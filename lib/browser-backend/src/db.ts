/**
 * Pedigree PRO — Browser Backend Database Engine
 *
 * sql.js WASM SQLite with IndexedDB persistence.
 * Database is encrypted at rest using AES-256-GCM via Web Crypto API.
 * Migrations reuse the same SQL files as the Rust backend.
 */

import initSqlJs from "sql.js";
import { get, set, createStore } from "idb-keyval";
import { getOrCreateDbKey, encryptDbBlob, decryptDbBlob } from "./crypto-store";

const DB_STORE = createStore("pedigree-pro-db", "database");
const DB_KEY = "sqlcipher-data";

// In-memory database instance (sql.js Database type)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any = null;
let dbKey: CryptoKey | null = null;
let autoSaveInterval: ReturnType<typeof setInterval> | null = null;
let dirty = false;
let saveChain: Promise<void> = Promise.resolve();
let initPromise: Promise<void> | null = null;

/**
 * Initializes the sql.js database.
 * 1. Loads sql.js WASM
 * 2. Attempts to restore from IndexedDB (decrypting if present)
 * 3. Runs migrations if new database
 * 4. Sets up auto-save to IndexedDB on window unload
 */
export async function initDb(): Promise<void> {
  if (db) return; // Already initialized
  if (initPromise) return initPromise; // Coalesce concurrent callers

  initPromise = (async () => {
    try {
      const SQL = await initSqlJs({
        locateFile: (file: string) => {
          return file.includes("sql-wasm") ? "/sql-wasm-browser.wasm" : `/${file}`;
        },
      });

      dbKey = await getOrCreateDbKey();

      // Try to load existing encrypted database from IndexedDB
      const stored = await get<{ ciphertext: Uint8Array; iv: Uint8Array } | null>(
        DB_KEY,
        DB_STORE
      );

      if (stored) {
        const decrypted = await decryptDbBlob(
          stored.ciphertext,
          stored.iv,
          dbKey
        );
        db = new SQL.Database(decrypted);
      } else {
        db = new SQL.Database();
      }

      // Enable foreign key enforcement (matches Rust backend)
      exec("PRAGMA foreign_keys = ON;");

      // Run migrations
      await runMigrations();

      // Auto-save on page unload (synchronous best-effort via navigator.sendBeacon)
      window.addEventListener("beforeunload", handleBeforeUnload);

      // Also use visibilitychange for mobile/tab switching
      document.addEventListener("visibilitychange", handleVisibilityChange);

      // Periodic auto-save every 3 seconds to minimize data loss on abrupt close
      autoSaveInterval = setInterval(saveIfDirty, 3_000);
    } finally {
      initPromise = null; // Allow retry on next call
    }
  })();

  return initPromise;
}

/**
 * Marks the database as having unsaved changes.
 * Called internally by exec() to track mutation operations.
 */
export function markDirty(): void {
  dirty = true;
}

/**
 * Best-effort save on beforeunload.
 * beforeunload cannot await async operations, so we fire saveDb()
 * and rely on the periodic auto-save (3s interval) as the primary
 * durability mechanism. Data loss is limited to at most 3 seconds.
 */
function handleBeforeUnload(): void {
  if (!db || !dbKey || !dirty) return;
  saveDb().catch(() => { /* best effort */ });
}

/**
 * Save on visibility change (mobile/tab switch) where async saves are more reliable.
 */
function handleVisibilityChange(): void {
  if (document.visibilityState === "hidden" && dirty && db && dbKey) {
    saveDb().catch(() => { /* best effort */ });
  }
}

/**
 * Saves the database only if there are unsaved changes.
 */
async function saveIfDirty(): Promise<void> {
  if (dirty) {
    await saveDb();
  }
}

/**
 * Stops the periodic auto-save timer and removes event listeners (cleanup).
 */
export function stopAutoSave(): void {
  if (autoSaveInterval !== null) {
    clearInterval(autoSaveInterval);
    autoSaveInterval = null;
  }
  window.removeEventListener("beforeunload", handleBeforeUnload);
  document.removeEventListener("visibilitychange", handleVisibilityChange);
}

/**
 * Exports the current database as a Uint8Array.
 */
export async function exportDb(): Promise<Uint8Array> {
  if (!db) throw new Error("Database not initialized");
  return new Uint8Array(db.export());
}

/**
 * Imports a database from a Uint8Array, replacing the current one.
 */
export async function importDb(data: Uint8Array): Promise<void> {
  if (!db) throw new Error("Database not initialized");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const DbCtor = (db as any).constructor;
  db.close();
  db = new DbCtor(data);
  dirty = true;
  await runMigrations();
  await saveDb();
}

/**
 * Saves the current database state to IndexedDB, encrypted.
 *
 * Uses a serialized promise chain so every call actually persists data.
 * Previous implementation skipped concurrent calls with `if (saveInProgress) return`,
 * which caused silent data loss: share_pedigree's INSERT + saveDb() could be
 * skipped if the 3-second auto-save was running, leaving the short code only
 * in the in-memory DB. A new tab loading from IndexedDB would get the stale
 * snapshot → 404.
 */
export async function saveDb(): Promise<void> {
  if (!db || !dbKey) return;
  // Append this save to the chain; each save waits for the previous to finish.
  // db.export() captures the LATEST in-memory state, so even queued saves
  // will persist the correct data (including any INSERTs that happened while
  // waiting for the previous save to complete).
  saveChain = saveChain.then(async () => {
    const data = db!.export();
    const { ciphertext, iv } = await encryptDbBlob(data, dbKey!);
    await set(DB_KEY, { ciphertext, iv }, DB_STORE);
    dirty = false;
  }).catch((e) => {
    console.error("[saveDb] Error persisting database:", e);
  });
  return saveChain;
}

/**
 * Executes a SQL statement that does not return rows (INSERT, UPDATE, DELETE).
 */
export function exec(sql: string, params?: unknown[]): void {
  if (!db) throw new Error("Database not initialized");
  if (params && params.length > 0) {
    const stmt = db.prepare(sql);
    stmt.run(params);
    stmt.free();
  } else {
    db.run(sql);
  }
  dirty = true;
}

/**
 * Executes a SQL query and returns rows as objects.
 */
export function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): T[] {
  if (!db) throw new Error("Database not initialized");
  const stmt = db.prepare(sql);
  if (params && params.length > 0) {
    stmt.bind(params);
  }
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

/**
 * Executes a SQL query and returns the first row, or null.
 */
export function queryOne<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): T | null {
  const rows = query<T>(sql, params);
  return rows.length > 0 ? rows[0]! : null;
}

/**
 * Gets the last inserted row ID.
 */
export function lastInsertRowId(): number {
  if (!db) throw new Error("Database not initialized");
  const result = query<{ lastId: number }>("SELECT last_insert_rowid() as lastId");
  return result[0]?.lastId ?? 0;
}

/**
 * Runs the migration SQL files.
 * Reuses the same migrations as the Rust backend.
 */
async function runMigrations(): Promise<void> {
  // Ensure the migrations tracking table exists
  exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = query<{ version: number }>("SELECT version FROM _migrations");
  const appliedSet = new Set(applied.map((r) => r.version));

  const migrations: [number, string, string][] = [
    [1, "001_initial", MIGRATION_001],
    [2, "002_clinical_annotations", MIGRATION_002],
    [3, "003_drop_deprecated_columns", MIGRATION_003],
    [4, "004_share_log", MIGRATION_004],
    [5, "005_share_links", MIGRATION_005],
  ];

  for (const [version, name, sql] of migrations) {
    if (appliedSet.has(version)) continue;
    exec(sql);
    exec("INSERT INTO _migrations (version, name) VALUES (?, ?)", [version, name]);
  }
}

// Inlined migration 001 (same as Rust backend, minus deprecated Phase 0-D columns)
const MIGRATION_001 = `
CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mrn TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth TEXT,
  sex TEXT DEFAULT 'unknown',
  ethnicity TEXT,
  referral_reason TEXT,
  clinician_key TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pedigrees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  patient_id INTEGER REFERENCES patients(id),
  canvas_data TEXT,
  canvas_hash TEXT,
  notes TEXT,
  creator_key TEXT,
  creator_signature TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pedigree_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedigree_id INTEGER NOT NULL REFERENCES pedigrees(id),
  version_number INTEGER NOT NULL DEFAULT 1,
  label TEXT,
  canvas_data TEXT NOT NULL,
  canvas_hash TEXT,
  thumbnail TEXT,
  saver_key TEXT,
  saver_signature TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  subject TEXT NOT NULL,
  actor_key TEXT,
  actor_signature TEXT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS app_preferences (
  device_id TEXT PRIMARY KEY,
  theme TEXT NOT NULL DEFAULT 'terminal',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS local_profiles (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  role_label TEXT NOT NULL DEFAULT '',
  public_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_patients_mrn ON patients(mrn);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_pedigrees_patient_id ON pedigrees(patient_id);
CREATE INDEX IF NOT EXISTS idx_pedigrees_creator_key ON pedigrees(creator_key);
CREATE INDEX IF NOT EXISTS idx_pedigrees_updated_at ON pedigrees(updated_at);
CREATE INDEX IF NOT EXISTS idx_pedigree_versions_pedigree_id ON pedigree_versions(pedigree_id, version_number);
CREATE INDEX IF NOT EXISTS idx_pedigree_versions_saver_key ON pedigree_versions(saver_key);
CREATE INDEX IF NOT EXISTS idx_activity_log_timestamp ON activity_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_actor_key ON activity_log(actor_key);
`;

// Inlined migration 002 (clinical annotations)
const MIGRATION_002 = `
CREATE TABLE IF NOT EXISTS pedigree_node_annotations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedigree_id INTEGER NOT NULL REFERENCES pedigrees(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  hpo_terms TEXT,
  omim_ids TEXT,
  variant_hgvs TEXT,
  test_results TEXT,
  clinical_notes TEXT,
  affected_status TEXT DEFAULT 'unknown',
  carrier_status TEXT DEFAULT 'unknown',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_node_annotations_pedigree ON pedigree_node_annotations(pedigree_id, node_id);

CREATE TABLE IF NOT EXISTS pedigree_phenotypes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedigree_id INTEGER NOT NULL REFERENCES pedigrees(id) ON DELETE CASCADE,
  condition_name TEXT NOT NULL,
  omim_id TEXT,
  hpo_terms TEXT,
  inheritance_mode TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pedigree_phenotypes_pedigree ON pedigree_phenotypes(pedigree_id);
`;

// Inlined migration 003: Drop deprecated Phase 0-D columns and tables.
// For databases created after this migration, these columns won't exist,
// so we skip DROP COLUMN (not supported in sql.js SQLite < 3.35).
const MIGRATION_003 = `
DROP INDEX IF EXISTS idx_pedigrees_share_token;
DROP TABLE IF EXISTS users;
`;

// Inlined migration 004: Share log for HIPAA audit trail
const MIGRATION_004 = `
CREATE TABLE IF NOT EXISTS share_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedigree_id INTEGER NOT NULL REFERENCES pedigrees(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  recipient_public_key TEXT,
  role TEXT NOT NULL DEFAULT 'viewer',
  encrypted_by_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_share_log_pedigree ON share_log(pedigree_id);
CREATE INDEX IF NOT EXISTS idx_share_log_action ON share_log(action);
CREATE INDEX IF NOT EXISTS idx_share_log_created_at ON share_log(created_at DESC);
`;

// Inlined migration 005: Shortlink mapping for share tokens
const MIGRATION_005 = `
CREATE TABLE IF NOT EXISTS share_links (
  short_code TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_share_links_created_at ON share_links(created_at DESC);
`;

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

const DB_STORE = createStore("haploclinical-db", "database");
const DB_KEY = "sqlcipher-data";

// In-memory database instance
let db: any = null;
let dbKey: CryptoKey | null = null;
let autoSaveInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Initializes the sql.js database.
 * 1. Loads sql.js WASM
 * 2. Attempts to restore from IndexedDB (decrypting if present)
 * 3. Runs migrations if new database
 * 4. Sets up auto-save to IndexedDB on window unload
 */
export async function initDb(): Promise<void> {
  if (db) return; // Already initialized

  const SQL = await initSqlJs({
    locateFile: (file: string) => `/${file}`,
  });

  dbKey = await getOrCreateDbKey();

  // Try to load existing encrypted database from IndexedDB
  const stored = await get<{ ciphertext: Uint8Array; iv: Uint8Array } | null>(
    DB_KEY,
    DB_STORE
  );

  if (stored) {
    try {
      const decrypted = await decryptDbBlob(
        stored.ciphertext,
        stored.iv,
        dbKey
      );
      db = new SQL.Database(decrypted);
    } catch (e) {
      console.error("Failed to decrypt database, starting fresh:", e);
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
  }

  // Run migrations
  await runMigrations();

  // Auto-save on page unload
  window.addEventListener("beforeunload", saveDb);

  // Periodic auto-save every 30 seconds
  autoSaveInterval = setInterval(saveDb, 30_000);
}

/**
 * Stops the periodic auto-save timer (cleanup).
 */
export function stopAutoSave(): void {
  if (autoSaveInterval !== null) {
    clearInterval(autoSaveInterval);
    autoSaveInterval = null;
  }
}

/**
 * Saves the current database state to IndexedDB, encrypted.
 */
export async function saveDb(): Promise<void> {
  if (!db || !dbKey) return;
  const data = db.export();
  const { ciphertext, iv } = await encryptDbBlob(data, dbKey);
  await set(DB_KEY, { ciphertext, iv }, DB_STORE);
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
  return rows.length > 0 ? rows[0] : null;
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
  // Migration 1: Initial schema
  const migration001 = await fetchMigration("001_initial.sql");
  exec(migration001);

  // Migration 2: Clinical annotations
  const migration002 = await fetchMigration("002_clinical_annotations.sql");
  exec(migration002);

  // Track migrations
  exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Record applied migrations
  exec(`INSERT OR IGNORE INTO _migrations (version, name) VALUES (1, '001_initial');`);
  exec(`INSERT OR IGNORE INTO _migrations (version, name) VALUES (2, '002_clinical_annotations');`);
}

/**
 * Fetches a migration SQL file from the shared lib/db/migrations directory.
 * In browser mode, we fetch via HTTP because we cannot use fs.
 */
async function fetchMigration(name: string): Promise<string> {
  // In a Vite build, these files are in the public directory or can be imported
  // For now, we inline the migrations to avoid build complexity
  // TODO: Consider bundling migrations as strings at build time
  const migrations: Record<string, string> = {
    "001_initial.sql": MIGRATION_001,
    "002_clinical_annotations.sql": MIGRATION_002,
  };
  return migrations[name] ?? "";
}

// Inlined migration 001 (same as Rust backend)
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
  clinician_id INTEGER,
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
  created_by_id INTEGER,
  creator_key TEXT,
  creator_signature TEXT,
  share_token TEXT,
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
  saved_by_id INTEGER,
  saver_key TEXT,
  saver_signature TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  subject TEXT NOT NULL,
  user_id INTEGER,
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
CREATE INDEX IF NOT EXISTS idx_pedigrees_patient ON pedigrees(patient_id);
CREATE INDEX IF NOT EXISTS idx_versions_pedigree ON pedigree_versions(pedigree_id);
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

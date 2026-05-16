import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';

const SQL = await initSqlJs();
const Database = SQL.Database;

const dbPath = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('sqlite:')
  ? process.env.DATABASE_URL.replace('sqlite:', '')
  : (process.env.SQLITE_FILE || './data/db.sqlite');

const dataDir = path.dirname(dbPath);
await fs.promises.mkdir(dataDir, { recursive: true });

let db;
if (await fs.promises.stat(dbPath).then(() => true).catch(() => false)) {
  const buf = await fs.promises.readFile(dbPath);
  db = new Database(new Uint8Array(buf));
} else {
  db = new Database();
}

// Create tables (post-migration-003 schema — no deprecated columns)
db.exec(`
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
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  subject TEXT NOT NULL,
  actor_key TEXT,
  actor_signature TEXT,
  timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_preferences (
  device_id TEXT PRIMARY KEY,
  theme TEXT NOT NULL DEFAULT 'terminal',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS local_profiles (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  role_label TEXT NOT NULL DEFAULT '',
  public_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT NOT NULL DEFAULT (datetime('now'))
);

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
`);

// Export DB to file
const data = db.export();
await fs.promises.writeFile(dbPath, Buffer.from(data));
console.log('Initialized SQLite database at', dbPath);
db.close();
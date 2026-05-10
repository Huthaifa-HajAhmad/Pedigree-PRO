const fs = require('fs');
const path = require('path');

// Select SQLite driver: prefer @vercel/sqlite (WASM) then fallback to better-sqlite3 (native)
let Database;
let driverName = 'none';
try {
  // Try WASM driver first
  Database = require('@vercel/sqlite').Database || require('@vercel/sqlite').default || require('@vercel/sqlite');
  driverName = '@vercel/sqlite';
} catch (e1) {
  try {
    // Fallback to native
    Database = require('better-sqlite3');
    driverName = 'better-sqlite3';
  } catch (e2) {
    console.error('No SQLite driver found. Install @vercel/sqlite or better-sqlite3.');
    console.error('Install commands:');
    console.error('  pnpm --filter @workspace/db add @vercel/sqlite');
    console.error('  or pnpm --filter @workspace/db add better-sqlite3');
    console.error('Errors:');
    console.error('@vercel/sqlite:', e1);
    console.error('better-sqlite3:', e2);
    process.exit(1);
  }
}

console.info('[init-sqlite] using sqlite driver:', driverName);

const dbPath = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('sqlite:')
  ? process.env.DATABASE_URL.replace('sqlite:', '')
  : (process.env.SQLITE_FILE || './data/db.sqlite');

const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('Created data directory:', dataDir);
}

const db = new Database(dbPath);

// Create tables (basic schema compatible with existing Postgres definitions)
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'counselor',
  department TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mrn TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth TEXT,
  sex TEXT,
  ethnicity TEXT,
  referral_reason TEXT,
  clinician_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pedigrees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  patient_id INTEGER,
  canvas_data TEXT,
  notes TEXT,
  share_token TEXT,
  created_by_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pedigree_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedigree_id INTEGER NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  label TEXT,
  canvas_data TEXT NOT NULL,
  thumbnail TEXT,
  saved_by_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  subject TEXT NOT NULL,
  user_id INTEGER,
  timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_preferences (
  device_id TEXT PRIMARY KEY,
  theme TEXT NOT NULL DEFAULT 'terminal',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

console.log('Initialized SQLite database at', dbPath);
db.close();

-- Pedigree PRO — Initial Schema (Phase 0-B)
-- SQLite-compatible (run by Rust migration runner at app startup)
--
-- All tables use Ed25519 *_key + *_signature columns for provenance
-- (ADR-002). Deprecated *ById columns and share_token were removed
-- in Phase 0-D and are no longer created.

-- ============================================================================
-- patients
-- ============================================================================
CREATE TABLE IF NOT EXISTS patients (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  date_of_birth    TEXT,
  sex              TEXT DEFAULT 'unknown',
  ethnicity        TEXT,
  referral_reason  TEXT,
  clinician_key    TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_patients_clinician_key ON patients(clinician_key);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(last_name, first_name);

-- ============================================================================
-- pedigrees
-- ============================================================================
CREATE TABLE IF NOT EXISTS pedigrees (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  title              TEXT NOT NULL,
  patient_id         INTEGER REFERENCES patients(id),
  canvas_data        TEXT,
  canvas_hash        TEXT,
  notes              TEXT,
  creator_key        TEXT,
  creator_signature  TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pedigrees_patient_id ON pedigrees(patient_id);
CREATE INDEX IF NOT EXISTS idx_pedigrees_creator_key ON pedigrees(creator_key);
CREATE INDEX IF NOT EXISTS idx_pedigrees_updated_at ON pedigrees(updated_at);

-- ============================================================================
-- pedigree_versions
-- ============================================================================
CREATE TABLE IF NOT EXISTS pedigree_versions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  pedigree_id      INTEGER NOT NULL REFERENCES pedigrees(id),
  version_number   INTEGER NOT NULL DEFAULT 1,
  label            TEXT,
  canvas_data      TEXT NOT NULL,
  canvas_hash      TEXT,
  thumbnail        TEXT,
  saver_key        TEXT,
  saver_signature  TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pedigree_versions_pedigree_id ON pedigree_versions(pedigree_id, version_number);
CREATE INDEX IF NOT EXISTS idx_pedigree_versions_saver_key ON pedigree_versions(saver_key);

-- ============================================================================
-- activity_log
-- ============================================================================
CREATE TABLE IF NOT EXISTS activity_log (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  action           TEXT NOT NULL,
  subject          TEXT NOT NULL,
  actor_key        TEXT,
  actor_signature  TEXT,
  timestamp        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_activity_log_timestamp ON activity_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_actor_key ON activity_log(actor_key);

-- ============================================================================
-- app_preferences
-- ============================================================================
CREATE TABLE IF NOT EXISTS app_preferences (
  device_id  TEXT PRIMARY KEY,
  theme      TEXT NOT NULL DEFAULT 'clinical',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================================
-- local_profiles (device-only, never synced)
-- ============================================================================
CREATE TABLE IF NOT EXISTS local_profiles (
  id            TEXT PRIMARY KEY,
  display_name  TEXT NOT NULL,
  role_label    TEXT NOT NULL DEFAULT '',
  public_key    TEXT NOT NULL UNIQUE,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Pedigree PRO — Share Log (HIPAA Audit Trail)
-- SQLite-compatible (run by Rust migration runner at app startup)
--
-- Tracks all share operations for HIPAA compliance and audit trail.
-- Each entry records who shared what, with whom, and when.

CREATE TABLE IF NOT EXISTS share_log (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  pedigree_id           INTEGER NOT NULL REFERENCES pedigrees(id) ON DELETE CASCADE,
  action                TEXT NOT NULL,
  recipient_public_key  TEXT,
  role                  TEXT NOT NULL DEFAULT 'viewer',
  encrypted_by_key      TEXT NOT NULL,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_share_log_pedigree ON share_log(pedigree_id);
CREATE INDEX IF NOT EXISTS idx_share_log_action ON share_log(action);
CREATE INDEX IF NOT EXISTS idx_share_log_created_at ON share_log(created_at DESC);

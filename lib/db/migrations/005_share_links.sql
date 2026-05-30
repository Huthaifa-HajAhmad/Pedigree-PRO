-- Pedigree PRO — Share Links (Short Code Mapping)
-- SQLite-compatible (run by Rust migration runner at app startup)
--
-- Maps short 8-character codes to full share tokens for user-friendly URLs.
-- Used by the self-contained sharing flow (no relay server required).

CREATE TABLE IF NOT EXISTS share_links (
  short_code  TEXT PRIMARY KEY,
  token       TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_share_links_created_at ON share_links(created_at DESC);

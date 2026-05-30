-- Pedigree PRO — Migration 003: Cleanup of deprecated Phase 0-D artifacts.
--
-- The deprecated *ById columns, share_token, and users table were part of
-- the original HaploPainter schema (Phase 0-B) and are no longer used.
-- New databases (created after this migration) never have these columns
-- because migration 001 omits them.
--
-- For EXISTING databases that still have these artifacts:
--   - DROP COLUMN requires SQLite >= 3.35.0 (not available in SQLCipher).
--     The deprecated columns are harmless — SQLite ignores unknown columns
--     in queries — so we leave them as inert residue.
--   - DROP INDEX and DROP TABLE are safe on all SQLite versions.

DROP INDEX IF EXISTS idx_pedigrees_share_token;
DROP TABLE IF EXISTS users;

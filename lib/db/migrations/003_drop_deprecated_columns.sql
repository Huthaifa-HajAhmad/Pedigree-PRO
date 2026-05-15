-- Migration 003: Drop deprecated Phase 0-D columns and tables.
-- The *ById columns and share_token have been replaced by *_key/*_signature
-- and zero-knowledge relay tokens respectively. The `users` table has been
-- replaced by `local_profiles`.

-- Drop deprecated columns from existing tables
ALTER TABLE patients DROP COLUMN IF EXISTS clinician_id;
ALTER TABLE pedigrees DROP COLUMN IF EXISTS created_by_id;
ALTER TABLE pedigrees DROP COLUMN IF EXISTS share_token;
ALTER TABLE pedigree_versions DROP COLUMN IF EXISTS saved_by_id;
ALTER TABLE activity_log DROP COLUMN IF EXISTS user_id;

-- Drop deprecated index
DROP INDEX IF EXISTS idx_pedigrees_share_token;

-- Drop deprecated users table
DROP TABLE IF EXISTS users;
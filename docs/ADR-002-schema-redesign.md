# ADR-002: Pedigree Schema Re-engineering for Zero-Account Model

**Status:** Draft  
**Date:** 2026-05-03  
**Depends on:** ADR-001 (Trust Model)  
**Supersedes:** Existing `lib/db/src/schema/` and `lib/db/src/schema_sqlite_*.ts` definitions

---

## 1. Context

ADR-001 established that identity moves from a centralized `users` table to local encrypted profiles with Ed25519 keypairs. This ADR defines the concrete schema changes to implement that transition while also upgrading the pedigree data model for clinical standards compliance and tamper-evident integrity.

### 1.1 Current Schema Critical Path

The data model centers on six core tables with these identity couplings:

```
users (id, name, email, role, department)
  └── patients.clinicianId ────────────→ users.id
  └── pedigrees.createdById ────────────→ users.id
  └── pedigree_versions.savedById ──────→ users.id
  └── activity_log.userId ──────────────→ users.id

app_preferences (deviceId) ← already device-centric ✅
```

### 1.2 Query Dependencies to Preserve

The API server has established query patterns that must remain functional during and after migration:

| Query | Current Join | New Join Target |
|---|---|---|
| Pedigree list (with creator name) | `LEFT JOIN users` for `name` | `local_profiles` lookup by public key (app-side) |
| Version history (with saver name) | `LEFT JOIN users` for `name` | `local_profiles` lookup by public key (app-side) |
| Activity log (with actor name) | `LEFT JOIN users` for `name` | `local_profiles` lookup by public key (app-side) |
| Dashboard stats | `SELECT COUNT(*) FROM users` | Removed or replaced with profile count |
| Patient list (clinician assignment) | `clinicianId` FK | `clinician_key` text field |

### 1.3 Design Goals

1. **Eliminate the `users` table** as a runtime dependency
2. **Preserve all query patterns** through a dual-write migration window
3. **Add content-addressable integrity** (SHA-256 hashing of canvas data)
4. **Define clinical annotation extension points** (phenotype, genotype, test results)
5. **Maintain dual Postgres/SQLite compatibility**
6. **Support the local-first architecture** where the database is a single SQLite file

---

## 2. Re-engineered Schema

### 2.1 Core Entities (Replacing User Coupling)

#### 2.1.1 local_profiles (NEW)

Device-only table — never synced, never leaves the device.

```sql
CREATE TABLE local_profiles (
  id            TEXT PRIMARY KEY,                    -- UUID v4
  display_name  TEXT NOT NULL,                       -- "Dr. Sarah Chen"
  role_label    TEXT NOT NULL DEFAULT '',             -- "Clinical Geneticist"
  public_key    TEXT NOT NULL UNIQUE,                 -- Ed25519 public key (base64url)
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Notes:**
- Private key NEVER stored in database — resides in OS keychain (via Tauri `tauri-plugin-keystore`)
- Display name is self-asserted (acceptable for niche colleague-to-colleague contexts per ADR-001)
- `role_label` is free-text, not an enum (avoids central authority defining roles)

#### 2.1.2 patients (MODIFIED)

```sql
CREATE TABLE patients (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  mrn              TEXT NOT NULL UNIQUE,              -- Medical Record Number
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  date_of_birth    TEXT,                              -- ISO 8601 date (YYYY-MM-DD)
  sex              TEXT DEFAULT 'unknown',             -- 'male' | 'female' | 'unknown'
  ethnicity        TEXT,                              -- Free-text ethnicity
  referral_reason  TEXT,                              -- Clinical referral reason
  clinician_key    TEXT,                              -- ← REPLACES clinicianId: Ed25519 public key of responsible clinician
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for clinician lookup
CREATE INDEX idx_patients_clinician_key ON patients(clinician_key);
CREATE INDEX idx_patients_mrn ON patients(mrn);
CREATE INDEX idx_patients_name ON patients(last_name, first_name);
```

**Changes from v0:**
- `clinician_id INTEGER` → `clinician_key TEXT` (Ed25519 public key, nullable)
- Removed: `clinician_id` FK constraint
- Indexes added for common lookup patterns

#### 2.1.3 pedigrees (MODIFIED)

```sql
CREATE TABLE pedigrees (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  title              TEXT NOT NULL,
  patient_id         INTEGER REFERENCES patients(id),
  canvas_data        TEXT,                            -- JSON blob of nodes + edges
  canvas_hash        TEXT,                            -- ← NEW: SHA-256 hex digest of canvas_data (tamper evidence)
  notes              TEXT,
  creator_key        TEXT,                            -- ← REPLACES createdById: Ed25519 public key
  creator_signature  TEXT,                            -- ← NEW: Ed25519 signature over (canvas_hash || created_at)
  share_token        TEXT,                            -- DEPRECATED: will be removed in Phase 0-D (moves to relay)
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_pedigrees_patient_id ON pedigrees(patient_id);
CREATE INDEX idx_pedigrees_creator_key ON pedigrees(creator_key);
CREATE INDEX idx_pedigrees_updated_at ON pedigrees(updated_at);
CREATE INDEX idx_pedigrees_share_token ON pedigrees(share_token);
```

**Changes from v0:**
- `created_by_id INTEGER` → `creator_key TEXT` + `creator_signature TEXT`
- `canvas_hash TEXT` added — SHA-256 of `canvas_data` for tamper-evident versioning
- `share_token` marked deprecated (moving to relay in Phase 0-D)
- Indexes added for common query patterns and the share token lookup

**Content Hashing Semantics:**
```
canvas_hash = SHA256(canvas_data || '')
```
Updated on every `canvas_data` write. Verification:
```
assert(sha256(stored.canvas_data) === stored.canvas_hash)
```
Ensures data hasn't been tampered with outside the application.

**Signature Semantics:**
```
creator_signature = Ed25519.sign(sk, canvas_hash || created_at)
```
Where `sk` is the creator's private key (retrieved from OS keychain at creation time).

#### 2.1.4 pedigree_versions (MODIFIED)

```sql
CREATE TABLE pedigree_versions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  pedigree_id      INTEGER NOT NULL REFERENCES pedigrees(id),
  version_number   INTEGER NOT NULL DEFAULT 1,
  label            TEXT,
  canvas_data      TEXT NOT NULL,
  canvas_hash      TEXT,                              -- ← NEW: SHA-256 of canvas_data
  thumbnail        TEXT,                              -- Base64-encoded PNG thumbnail
  saver_key        TEXT,                              -- ← REPLACES savedById: Ed25519 public key
  saver_signature  TEXT,                              -- ← NEW: Ed25519 signature over (canvas_hash || created_at)
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_pedigree_versions_pedigree_id ON pedigree_versions(pedigree_id, version_number);
CREATE INDEX idx_pedigree_versions_saver_key ON pedigree_versions(saver_key);
```

**Changes from v0:**
- `saved_by_id INTEGER` → `saver_key TEXT` + `saver_signature TEXT`
- `canvas_hash TEXT` added
- Index tuned for the common query pattern (list versions by pedigree, ordered by version_number DESC)

#### 2.1.5 activity_log (MODIFIED)

```sql
CREATE TABLE activity_log (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  action           TEXT NOT NULL,                     -- 'created' | 'updated' | 'deleted' | 'shared' | 'restored'
  subject          TEXT NOT NULL,                     -- Human-readable description (e.g., "Pedigree: Smith Family")
  actor_key        TEXT,                              -- ← REPLACES userId: Ed25519 public key
  actor_signature  TEXT,                              -- ← NEW: Ed25519 signature over (action || subject || timestamp)
  timestamp        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_activity_log_timestamp ON activity_log(timestamp DESC);
CREATE INDEX idx_activity_log_actor_key ON activity_log(actor_key);
```

**Changes from v0:**
- `user_id INTEGER` → `actor_key TEXT` + `actor_signature TEXT`
- Timestamp stored as ISO 8601 text (SQLite compatibility)

#### 2.1.6 app_preferences (UNCHANGED)

Already correctly keyed on `deviceId` — no changes needed. ✅

```sql
CREATE TABLE app_preferences (
  device_id  TEXT PRIMARY KEY,
  theme      TEXT NOT NULL DEFAULT 'terminal',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

### 2.2 Clinical Annotation Extension Points (NEW)

These tables extend the pedigree node model with structured clinical data. They are designed as optional extensions — not required for core pedigree visualization, but available for clinicians who need detailed phenotype/genotype tracking.

#### 2.2.1 pedigree_node_annotations

Links structured clinical data to individual nodes in the pedigree canvas.

```sql
CREATE TABLE pedigree_node_annotations (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  pedigree_id    INTEGER NOT NULL REFERENCES pedigrees(id) ON DELETE CASCADE,
  node_id        TEXT NOT NULL,                       -- References nodes[] in canvas_data JSON
  hpo_terms      TEXT,                                -- JSON array of HPO IDs: ["HP:0001250","HP:0001263"]
  omim_ids        TEXT,                                -- JSON array of OMIM phenotype IDs: ["OMIM:143100"]
  variant_hgvs    TEXT,                                -- HGVS notation: "NM_000059.3:c.68-2A>G"
  test_results    TEXT,                                -- JSON blob of structured test results (see schema below)
  clinical_notes  TEXT,                                -- Free-text clinical notes
  affected_status TEXT DEFAULT 'unknown',              -- 'affected' | 'unaffected' | 'unknown'
  carrier_status  TEXT DEFAULT 'unknown',              -- 'carrier' | 'non-carrier' | 'obligate-carrier' | 'unknown'
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_node_annotations_pedigree ON pedigree_node_annotations(pedigree_id, node_id);
```

**Test Results JSON Schema (normative):**
```json
{
  "results": [
    {
      "test_type": "genetic_test|biochemical|imaging",
      "test_name": "BRCA1/2 Panel",
      "date": "2025-03-15",
      "result": "positive|negative|vus|inconclusive",
      "variant_hgvs": "NM_007294.3:c.5266dupC",
      "pathogenicity": "pathogenic|likely_pathogenic|vus|likely_benign|benign",
      "lab": "Institution Name",
      "notes": "Free-text notes"
    }
  ]
}
```

#### 2.2.2 pedigree_phenotypes (aggregate pedigree-level data)

```sql
CREATE TABLE pedigree_phenotypes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  pedigree_id     INTEGER NOT NULL REFERENCES pedigrees(id) ON DELETE CASCADE,
  condition_name  TEXT NOT NULL,                      -- e.g., "Huntington Disease"
  omim_id         TEXT,                               -- OMIM phenotype ID
  hpo_terms       TEXT,                               -- JSON array of representative HPO terms
  inheritance_mode TEXT,                              -- 'AD' | 'AR' | 'XLR' | 'XLD' | 'mitochondrial' | 'unknown'
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_pedigree_phenotypes_pedigree ON pedigree_phenotypes(pedigree_id);
```

---

### 2.3 Drop/Deprecation Schedule

| Artifact | Status | Removal Phase |
|---|---|---|
| `users` table (both schemas) | **DEPRECATED** — keep for migration window, remove in Phase 0-D | Phase 0-D |
| `patients.clinicianId` | **DEPRECATED** — dual-write to `clinician_key`, remove FK in Phase 0-D | Phase 0-D |
| `pedigrees.createdById` | **DEPRECATED** — dual-write to `creator_key` + `creator_signature` | Phase 0-D |
| `pedigrees.shareToken` | **DEPRECATED** — moves to relay service in Phase 0-D | Phase 0-D |
| `pedigree_versions.savedById` | **DEPRECATED** — dual-write to `saver_key` + `saver_signature` | Phase 0-D |
| `activity_log.userId` | **DEPRECATED** — dual-write to `actor_key` + `actor_signature` | Phase 0-D |
| `users` routes (`/api/users/*`) | **DEPRECATED** — UI pages transition to local profile management | Phase 0-D |

---

## 3. Migration Strategy

### 3.1 Phase 0-B (Now): Schema Definition Only

- Define new schema files with both old and new columns coexisting
- No data migration yet — this is a design document

### 3.2 Phase 0-C (Next): Migration Path Implementation

1. Run `ALTER TABLE ... ADD COLUMN` for all new columns
2. Update API server to **dual-write**: on every mutation, write both the old `*ById` column and the new `*_key` + `*_signature` columns
3. Backfill historical rows with a system migration profile key
4. Update API server to **read from new columns**, falling back to old columns via `LEFT JOIN users` for name display
5. Update frontend to submit `creator_key` + `creator_signature` alongside requests

### 3.3 Phase 0-D (After): Cleanup

1. Remove old `*ById` columns
2. Remove `users` table
3. Remove `LEFT JOIN users` from all queries
4. Profile name display moves to app-side lookup (from local_profiles or from signature verification + profile-cache)

---

## 4. Query Pattern Impact Analysis

### 4.1 Pedigree List with Creator Name

**Before:**
```sql
SELECT p.*, u.name AS createdByName
FROM pedigrees p
LEFT JOIN users u ON u.id = p.createdById
```

**After (Phase 0-C dual-read):**
```sql
SELECT p.*,
  COALESCE(p.creator_key, CAST(p.createdById AS TEXT)) AS creator_key,
  u.name AS display_name  -- fallback to users table during migration
FROM pedigrees p
LEFT JOIN users u ON u.id = p.createdById
```

**After (Phase 0-D clean):**
```sql
-- Creator name resolved app-side via local_profiles lookup or profile cache
SELECT p.* FROM pedigrees p
```

### 4.2 Dashboard Stats

**Before:** `SELECT COUNT(*) FROM users` for total users

**After:** `SELECT COUNT(DISTINCT creator_key) FROM pedigrees` for active creators, plus `SELECT COUNT(*) FROM local_profiles` for local profiles

### 4.3 Activity Feed with Actor Name

**Before:** `LEFT JOIN users u ON u.id = a.userId`

**After:** `actor_key` resolved app-side or against a profile cache. The share page `/share/:token` returns anonymized activity (action + timestamp only, no actor identity).

---

## 5. Postgres Schema Changes (For Server Mode)

The Postgres schema (`lib/db/src/schema/*.ts`) mirrors the SQLite changes with PostgreSQL-native types:

| SQLite Type | Postgres Type |
|---|---|
| `TEXT PRIMARY KEY` | `text PRIMARY KEY` |
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `serial PRIMARY KEY` |
| `TEXT NOT NULL DEFAULT (datetime('now'))` | `timestamp with time zone NOT NULL DEFAULT NOW()` |
| `INTEGER REFERENCES` | `integer REFERENCES` |

The Drizzle ORM schema generator handles this automatically through its dialect-specific table builders (`sqliteTable` vs. `pgTable`).

---

## 6. Decision Summary

| Decision | Details |
|---|---|
| **Identity columns** | Replace all `*ById INTEGER FK → users.id` with `*_key TEXT` (Ed25519 public key) + `*_signature TEXT` (Ed25519 signature) |
| **Content integrity** | Add `canvas_hash TEXT` (SHA-256 of canvas_data) to pedigrees and pedigree_versions |
| **Share tokens** | Deprecate `share_token` in local DB; migrate to zero-knowledge relay in Phase 0-D |
| **Phenotype annotations** | New optional tables: `pedigree_node_annotations`, `pedigree_phenotypes` |
| **Profile model** | New `local_profiles` table (device-only, never synced) |
| **Migration approach** | Dual-write + dual-read with fallback, then cleanup in Phase 0-D |
| **Users table** | Kept temporarily for migration, removed in Phase 0-D |
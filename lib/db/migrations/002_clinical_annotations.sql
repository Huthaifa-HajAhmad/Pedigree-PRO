-- Pedigree PRO — Clinical Annotation Extension Tables (Phase 0-B)
-- SQLite-compatible. Optional tables for phenotype/genotype tracking.
-- Per ADR-002: Clinical annotation extension points.

-- ============================================================================
-- pedigree_node_annotations
-- ============================================================================
CREATE TABLE IF NOT EXISTS pedigree_node_annotations (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  pedigree_id    INTEGER NOT NULL REFERENCES pedigrees(id) ON DELETE CASCADE,
  node_id        TEXT NOT NULL,
  hpo_terms      TEXT,
  omim_ids        TEXT,
  variant_hgvs    TEXT,
  test_results    TEXT,
  clinical_notes  TEXT,
  affected_status TEXT DEFAULT 'unknown',
  carrier_status  TEXT DEFAULT 'unknown',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_node_annotations_pedigree ON pedigree_node_annotations(pedigree_id, node_id);

-- ============================================================================
-- pedigree_phenotypes
-- ============================================================================
CREATE TABLE IF NOT EXISTS pedigree_phenotypes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  pedigree_id     INTEGER NOT NULL REFERENCES pedigrees(id) ON DELETE CASCADE,
  condition_name  TEXT NOT NULL,
  omim_id         TEXT,
  hpo_terms       TEXT,
  inheritance_mode TEXT,
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pedigree_phenotypes_pedigree ON pedigree_phenotypes(pedigree_id);
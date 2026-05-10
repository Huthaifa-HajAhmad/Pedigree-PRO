import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Aggregate pedigree-level phenotype data.
 *
 * Each row corresponds to a clinical condition associated with a pedigree.
 * Designed for aggregate condition tracking across pedigrees.
 *
 * Per ADR-002: Clinical annotation extension points for pedigree-level data.
 */
export const pedigreePhenotypesTable = sqliteTable("pedigree_phenotypes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  pedigreeId: integer("pedigree_id").notNull().references(() => {
    // Lazy import to avoid circular dependency
    const { pedigreesTable } = require("./schema_sqlite_pedigrees");
    return pedigreesTable.id;
  }),
  conditionName: text("condition_name").notNull(),              // e.g., "Huntington Disease"
  omimId: text("omim_id"),                                     // OMIM phenotype ID
  hpoTerms: text("hpo_terms"),                                 // JSON array of representative HPO terms
  inheritanceMode: text("inheritance_mode"),                   // 'AD' | 'AR' | 'XLR' | 'XLD' | 'mitochondrial' | 'unknown'
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export type PedigreePhenotype = typeof pedigreePhenotypesTable.$inferSelect;
import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { pedigreesTable } from "./pedigrees";

/**
 * Aggregate pedigree-level phenotype data.
 * Per ADR-002: Clinical annotation extension points.
 */
export const pedigreePhenotypesTable = pgTable("pedigree_phenotypes", {
  id: serial("id").primaryKey(),
  pedigreeId: integer("pedigree_id").notNull().references(() => pedigreesTable.id),
  conditionName: text("condition_name").notNull(),              // e.g., "Huntington Disease"
  omimId: text("omim_id"),                                     // OMIM phenotype ID
  hpoTerms: text("hpo_terms"),                                 // JSON array of representative HPO terms
  inheritanceMode: text("inheritance_mode"),                   // 'AD' | 'AR' | 'XLR' | 'XLD' | 'mitochondrial' | 'unknown'
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PedigreePhenotype = typeof pedigreePhenotypesTable.$inferSelect;
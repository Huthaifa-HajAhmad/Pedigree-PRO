import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Links structured clinical data to individual nodes in the pedigree canvas.
 *
 * Each row corresponds to one node (individual) in one pedigree's canvasData.
 * Designed as optional extensions — not required for core pedigree visualization,
 * but available for clinicians who need detailed phenotype/genotype tracking.
 *
 * Per ADR-002: Clinical annotation extension points for the pedigree node model.
 */
export const pedigreeNodeAnnotationsTable = sqliteTable("pedigree_node_annotations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  pedigreeId: integer("pedigree_id").notNull().references(() => {
    // Lazy import to avoid circular dependency
    const { pedigreesTable } = require("./schema_sqlite_pedigrees");
    return pedigreesTable.id;
  }),
  nodeId: text("node_id").notNull(),                         // References nodes[] in canvasData JSON
  hpoTerms: text("hpo_terms"),                               // JSON array of HPO IDs: ["HP:0001250","HP:0001263"]
  omimIds: text("omim_ids"),                                 // JSON array of OMIM phenotype IDs: ["OMIM:143100"]
  variantHgvs: text("variant_hgvs"),                         // HGVS notation: "NM_000059.3:c.68-2A>G"
  testResults: text("test_results"),                         // JSON blob of structured test results
  clinicalNotes: text("clinical_notes"),                     // Free-text clinical notes
  affectedStatus: text("affected_status").default("unknown"), // 'affected' | 'unaffected' | 'unknown'
  carrierStatus: text("carrier_status").default("unknown"),   // 'carrier' | 'non-carrier' | 'obligate-carrier' | 'unknown'
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export type PedigreeNodeAnnotation = typeof pedigreeNodeAnnotationsTable.$inferSelect;
import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

/**
 * Links structured clinical data to individual nodes in the pedigree canvas.
 * Per ADR-002: Clinical annotation extension points.
 */
export const pedigreeNodeAnnotationsTable = pgTable("pedigree_node_annotations", {
  id: serial("id").primaryKey(),
  pedigreeId: integer("pedigree_id").notNull().references(() => {
    const { pedigreesTable } = require("./pedigrees");
    return pedigreesTable.id;
  }),
  nodeId: text("node_id").notNull(),                         // References nodes[] in canvasData JSON
  hpoTerms: text("hpo_terms"),                               // JSON array of HPO IDs
  omimIds: text("omim_ids"),                                 // JSON array of OMIM IDs
  variantHgvs: text("variant_hgvs"),                         // HGVS notation
  testResults: text("test_results"),                         // JSON blob of structured test results
  clinicalNotes: text("clinical_notes"),                     // Free-text clinical notes
  affectedStatus: text("affected_status").default("unknown"), // 'affected' | 'unaffected' | 'unknown'
  carrierStatus: text("carrier_status").default("unknown"),   // 'carrier' | 'non-carrier' | 'obligate-carrier' | 'unknown'
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type PedigreeNodeAnnotation = typeof pedigreeNodeAnnotationsTable.$inferSelect;
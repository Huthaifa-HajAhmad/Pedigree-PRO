import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const pedigreesTable = sqliteTable("pedigrees", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  patientId: integer("patient_id"),
  canvasData: text("canvas_data"),
  canvasHash: text("canvas_hash"),
  notes: text("notes"),
  creatorKey: text("creator_key"),
  creatorSignature: text("creator_signature"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type Pedigree = typeof pedigreesTable.$inferSelect;
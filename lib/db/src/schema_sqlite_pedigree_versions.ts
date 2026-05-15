import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const pedigreeVersionsTable = sqliteTable("pedigree_versions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  pedigreeId: integer("pedigree_id").notNull(),
  versionNumber: integer("version_number").notNull().default(1),
  label: text("label"),
  canvasData: text("canvas_data").notNull(),
  canvasHash: text("canvas_hash"),
  thumbnail: text("thumbnail"),
  saverKey: text("saver_key"),
  saverSignature: text("saver_signature"),
  createdAt: text("created_at").notNull(),
});

export type PedigreeVersion = typeof pedigreeVersionsTable.$inferSelect;
import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const pedigreeVersionsTable = pgTable("pedigree_versions", {
  id: serial("id").primaryKey(),
  pedigreeId: integer("pedigree_id").notNull(),
  versionNumber: integer("version_number").notNull().default(1),
  label: text("label"),
  canvasData: text("canvas_data").notNull(),
  canvasHash: text("canvas_hash"),           // SHA-256 of canvasData (tamper evidence)
  thumbnail: text("thumbnail"),
  savedById: integer("saved_by_id"),          // DEPRECATED — replaced by saver_key (Phase 0-D removal)
  saverKey: text("saver_key"),                // Ed25519 public key of saver
  saverSignature: text("saver_signature"),     // Ed25519 signature over (canvas_hash || created_at)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPedigreeVersionSchema = createInsertSchema(pedigreeVersionsTable).omit({ id: true, createdAt: true });
export type InsertPedigreeVersion = z.infer<typeof insertPedigreeVersionSchema>;
export type PedigreeVersion = typeof pedigreeVersionsTable.$inferSelect;

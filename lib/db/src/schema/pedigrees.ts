import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const pedigreesTable = pgTable("pedigrees", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  patientId: integer("patient_id"),
  canvasData: text("canvas_data"),
  canvasHash: text("canvas_hash"),           // SHA-256 of canvasData (tamper evidence)
  notes: text("notes"),
  createdById: integer("created_by_id"),      // DEPRECATED — replaced by creator_key (Phase 0-D removal)
  creatorKey: text("creator_key"),            // Ed25519 public key of creator
  creatorSignature: text("creator_signature"), // Ed25519 signature over (canvas_hash || created_at)
  shareToken: text("share_token"),            // DEPRECATED — will move to zero-knowledge relay (Phase 0-D)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPedigreeSchema = createInsertSchema(pedigreesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPedigree = z.infer<typeof insertPedigreeSchema>;
export type Pedigree = typeof pedigreesTable.$inferSelect;

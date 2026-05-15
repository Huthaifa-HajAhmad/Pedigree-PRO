import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const pedigreesTable = pgTable("pedigrees", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  patientId: integer("patient_id"),
  canvasData: text("canvas_data"),
  canvasHash: text("canvas_hash"),
  notes: text("notes"),
  creatorKey: text("creator_key"),
  creatorSignature: text("creator_signature"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPedigreeSchema = createInsertSchema(pedigreesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPedigree = z.infer<typeof insertPedigreeSchema>;
export type Pedigree = typeof pedigreesTable.$inferSelect;

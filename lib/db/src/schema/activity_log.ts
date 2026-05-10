import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const activityLogTable = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(),
  subject: text("subject").notNull(),
  userId: integer("user_id"),                 // DEPRECATED — replaced by actor_key (Phase 0-D removal)
  actorKey: text("actor_key"),                // Ed25519 public key of actor
  actorSignature: text("actor_signature"),     // Ed25519 signature over (action || subject || timestamp)
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogTable).omit({ id: true, timestamp: true });
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogTable.$inferSelect;

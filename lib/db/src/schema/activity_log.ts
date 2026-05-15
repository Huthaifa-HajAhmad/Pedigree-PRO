import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const activityLogTable = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(),
  subject: text("subject").notNull(),
  actorKey: text("actor_key"),
  actorSignature: text("actor_signature"),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogTable).omit({ id: true, timestamp: true });
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogTable.$inferSelect;

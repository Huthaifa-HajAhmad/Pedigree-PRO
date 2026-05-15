import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const activityLogTable = sqliteTable("activity_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  action: text("action").notNull(),
  subject: text("subject").notNull(),
  actorKey: text("actor_key"),
  actorSignature: text("actor_signature"),
  timestamp: text("timestamp").notNull().default(sql`(datetime('now'))`),
});

export type ActivityLog = typeof activityLogTable.$inferSelect;
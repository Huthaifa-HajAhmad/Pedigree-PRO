import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const appPreferencesTable = sqliteTable("app_preferences", {
  deviceId: text("device_id").primaryKey(),
  theme: text("theme").notNull().default("terminal"),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export type AppPreferences = typeof appPreferencesTable.$inferSelect;

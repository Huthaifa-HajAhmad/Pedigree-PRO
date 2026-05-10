import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const appPreferencesTable = pgTable("app_preferences", {
  deviceId: text("device_id").primaryKey(),
  theme: text("theme").notNull().default("terminal"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AppPreferences = typeof appPreferencesTable.$inferSelect;

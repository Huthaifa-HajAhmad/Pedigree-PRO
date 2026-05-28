import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const shareLinksTable = pgTable("share_links", {
  shortCode: text("short_code").primaryKey(),
  token: text("token").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ShareLink = typeof shareLinksTable.$inferSelect;

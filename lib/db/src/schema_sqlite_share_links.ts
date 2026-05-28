import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const shareLinksTable = sqliteTable("share_links", {
  shortCode: text("short_code").primaryKey(),
  token: text("token").notNull(),
  createdAt: text("created_at").notNull(),
});

export type ShareLink = typeof shareLinksTable.$inferSelect;

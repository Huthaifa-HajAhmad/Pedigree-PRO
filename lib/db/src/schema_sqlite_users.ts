import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * DEPRECATED — Phase 0-D removal.
 *
 * Replaced by `local_profiles` (device-only, Ed25519 keypair identity).
 * Kept temporarily for migration window: old `*ById` columns reference this table
 * via LEFT JOIN while dual-write populates new `*_key` + `*_signature` columns.
 */
export const usersTable = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("counselor"),
  department: text("department"),
  createdAt: text("created_at").notNull(),
});

export type User = typeof usersTable.$inferSelect;

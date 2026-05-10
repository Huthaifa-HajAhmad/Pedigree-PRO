import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Device-only table — never synced, never leaves the device.
 *
 * Stores clinician profile metadata. Private keys are stored in the OS keychain,
 * NOT in this table. Only the public key and display metadata are persisted here.
 *
 * Per ADR-001: Local encrypted profiles with Ed25519 keypairs.
 */
export const localProfilesTable = pgTable("local_profiles", {
  id: text("id").primaryKey(),                                // UUID v4
  displayName: text("display_name").notNull(),                // "Dr. Sarah Chen"
  roleLabel: text("role_label").notNull().default(""),        // "Clinical Geneticist" (free-text)
  publicKey: text("public_key").notNull().unique(),           // Ed25519 public key (base64url)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LocalProfile = typeof localProfilesTable.$inferSelect;
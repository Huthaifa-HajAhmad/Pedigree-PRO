import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Device-only table — never synced, never leaves the device.
 *
 * Stores clinician profile metadata. Private keys are stored in the OS keychain
 * (via Tauri tauri-plugin-keystore), NOT in this table. Only the public key and
 * display metadata are persisted here.
 *
 * Per ADR-001: Local encrypted profiles with Ed25519 keypairs replace the
 * centralized `users` table.
 */
export const localProfilesTable = sqliteTable("local_profiles", {
  id: text("id").primaryKey(),                                // UUID v4
  displayName: text("display_name").notNull(),                // "Dr. Sarah Chen"
  roleLabel: text("role_label").notNull().default(""),        // "Clinical Geneticist" (free-text, not enum)
  publicKey: text("public_key").notNull().unique(),           // Ed25519 public key (base64url)
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  lastUsedAt: text("last_used_at").notNull().default(sql`(datetime('now'))`),
});

export type LocalProfile = typeof localProfilesTable.$inferSelect;
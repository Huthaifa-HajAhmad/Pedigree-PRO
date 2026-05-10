import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const pedigreeVersionsTable = sqliteTable("pedigree_versions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  pedigreeId: integer("pedigree_id").notNull(),
  versionNumber: integer("version_number").notNull().default(1),
  label: text("label"),
  canvasData: text("canvas_data").notNull(),
  canvasHash: text("canvas_hash"),           // SHA-256 of canvasData (tamper evidence)
  thumbnail: text("thumbnail"),
  savedById: integer("saved_by_id"),          // DEPRECATED — replaced by saver_key (Phase 0-D removal)
  saverKey: text("saver_key"),                // Ed25519 public key of saver
  saverSignature: text("saver_signature"),     // Ed25519 signature over (canvas_hash || created_at)
  createdAt: text("created_at").notNull(),
});

export type PedigreeVersion = typeof pedigreeVersionsTable.$inferSelect;

/**
 * Phase 0-B Migration Notes:
 * - `savedById` (FK → users.id) is DEPRECATED.
 * - `saverKey` + `saverSignature` are the new identity/provenance columns.
 * - `canvasHash` stores SHA-256 of canvasData for tamper-evident integrity.
 * - Dual-write: populate both old and new columns during transition.
 * - Removal: drop `savedById` in Phase 0-D cleanup.
 */

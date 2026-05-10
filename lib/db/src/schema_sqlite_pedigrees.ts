import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const pedigreesTable = sqliteTable("pedigrees", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  patientId: integer("patient_id"),
  canvasData: text("canvas_data"),
  canvasHash: text("canvas_hash"),           // SHA-256 of canvasData (tamper evidence)
  notes: text("notes"),
  createdById: integer("created_by_id"),      // DEPRECATED — replaced by creator_key (Phase 0-D removal)
  creatorKey: text("creator_key"),            // Ed25519 public key of creator
  creatorSignature: text("creator_signature"), // Ed25519 signature over (canvas_hash || created_at)
  shareToken: text("share_token"),            // DEPRECATED — will move to zero-knowledge relay (Phase 0-D)
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type Pedigree = typeof pedigreesTable.$inferSelect;

/**
 * Phase 0-B Migration Notes:
 * - `createdById` (FK → users.id) is DEPRECATED.
 * - `creatorKey` + `creatorSignature` are the new identity/provenance columns.
 * - `canvasHash` stores SHA-256 of canvasData for tamper-evident integrity.
 * - `shareToken` is DEPRECATED — moving to zero-knowledge relay in Phase 0-D.
 * - Dual-write: populate both old and new columns during transition.
 * - Removal: drop `createdById` and `shareToken` in Phase 0-D cleanup.
 */

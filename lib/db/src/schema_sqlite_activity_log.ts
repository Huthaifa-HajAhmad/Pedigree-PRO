import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const activityLogTable = sqliteTable("activity_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  action: text("action").notNull(),
  subject: text("subject").notNull(),
  userId: integer("user_id"),                 // DEPRECATED — replaced by actor_key (Phase 0-D removal)
  actorKey: text("actor_key"),                // Ed25519 public key of actor
  actorSignature: text("actor_signature"),     // Ed25519 signature over (action || subject || timestamp)
  timestamp: text("timestamp").notNull().default(sql`(datetime('now'))`),
});

export type ActivityLog = typeof activityLogTable.$inferSelect;

/**
 * Phase 0-B Migration Notes:
 * - `userId` (FK → users.id) is DEPRECATED.
 * - `actorKey` + `actorSignature` are the new identity/provenance columns.
 * - Dual-write: populate both old and new columns during transition.
 * - Removal: drop `userId` in Phase 0-D cleanup.
 */

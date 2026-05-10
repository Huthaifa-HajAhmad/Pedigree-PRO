import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const patientsTable = sqliteTable("patients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  mrn: text("mrn").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dateOfBirth: text("date_of_birth"),
  sex: text("sex"),
  ethnicity: text("ethnicity"),
  referralReason: text("referral_reason"),
  clinicianId: integer("clinician_id"), // DEPRECATED — replaced by clinician_key (Phase 0-D removal)
  clinicianKey: text("clinician_key"),   // Ed25519 public key of responsible clinician
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type Patient = typeof patientsTable.$inferSelect;

/**
 * Phase 0-B Migration Notes:
 * - `clinicianId` (FK → users.id) is DEPRECATED.
 * - `clinicianKey` (Ed25519 public key) is the new identity column.
 * - Dual-write: populate both columns during transition.
 * - Removal: drop `clinicianId` in Phase 0-D cleanup.
 */

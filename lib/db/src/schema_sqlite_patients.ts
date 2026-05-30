import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const patientsTable = sqliteTable("patients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dateOfBirth: text("date_of_birth"),
  sex: text("sex").default("unknown"),
  ethnicity: text("ethnicity"),
  referralReason: text("referral_reason"),
  clinicianKey: text("clinician_key"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type Patient = typeof patientsTable.$inferSelect;
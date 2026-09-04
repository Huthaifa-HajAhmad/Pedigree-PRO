import { exec, query, queryOne, lastInsertRowId } from "../db";
import { withTransaction, type Patient, type CreatePatientInput } from "./types";

export function list_patients(args?: { search?: string }): Patient[] {
  const search = args?.search;
  if (search) {
    const pattern = `%${search}%`;
    return query<Patient>(
      "SELECT id, first_name, last_name, date_of_birth, sex, ethnicity, referral_reason, clinician_key, created_at, updated_at FROM patients WHERE first_name LIKE ? OR last_name LIKE ? ORDER BY last_name, first_name",
      [pattern, pattern]
    );
  }
  return query<Patient>(
    "SELECT id, first_name, last_name, date_of_birth, sex, ethnicity, referral_reason, clinician_key, created_at, updated_at FROM patients ORDER BY last_name, first_name"
  );
}

export function get_patient(args: { id: number }): Patient {
  const patient = queryOne<Patient>(
    "SELECT id, first_name, last_name, date_of_birth, sex, ethnicity, referral_reason, clinician_key, created_at, updated_at FROM patients WHERE id = ?",
    [args.id]
  );
  if (!patient) throw new Error("Patient not found");
  return patient;
}

export function create_patient(
  args: CreatePatientInput | { input: CreatePatientInput }
): Patient {
  const input = "input" in args ? args.input : args;
  exec(
    "INSERT INTO patients (first_name, last_name, date_of_birth, sex, ethnicity, referral_reason, clinician_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
    [
      input.first_name,
      input.last_name,
      input.date_of_birth ?? null,
      input.sex ?? null,
      input.ethnicity ?? null,
      input.referral_reason ?? null,
      input.clinician_key ?? null,
    ]
  );
  const id = lastInsertRowId();
  return get_patient({ id });
}

export function update_patient(args: {
  id: number;
  input: Partial<CreatePatientInput>;
}): Patient {
  const existing = get_patient({ id: args.id });
  const cleanInput = Object.fromEntries(
    Object.entries(args.input).filter(([_, v]) => v !== undefined)
  );
  const merged = { ...existing, ...cleanInput };
  exec(
    "UPDATE patients SET first_name = ?, last_name = ?, date_of_birth = ?, sex = ?, ethnicity = ?, referral_reason = ?, clinician_key = ?, updated_at = datetime('now') WHERE id = ?",
    [
      merged.first_name,
      merged.last_name,
      merged.date_of_birth ?? null,
      merged.sex ?? null,
      merged.ethnicity ?? null,
      merged.referral_reason ?? null,
      merged.clinician_key ?? null,
      args.id,
    ]
  );
  return get_patient({ id: args.id });
}

export function delete_patient(args: { id: number }): void {
  withTransaction(() => {
    const patient = queryOne<{ id: number }>(
      "SELECT id FROM patients WHERE id = ?",
      [args.id]
    );
    if (!patient) throw new Error("Patient not found");
    exec("UPDATE pedigrees SET patient_id = NULL WHERE patient_id = ?", [args.id]);
    exec("DELETE FROM patients WHERE id = ?", [args.id]);
  });
}

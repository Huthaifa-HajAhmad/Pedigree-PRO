import { exec } from "../db";

export function withTransaction<T>(fn: () => T): T {
  exec("BEGIN TRANSACTION");
  try {
    const res = fn();
    exec("COMMIT");
    return res;
  } catch (e) {
    exec("ROLLBACK");
    throw e;
  }
}

// Profile Types
export interface LocalProfile {
  id: string;
  display_name: string;
  role_label: string;
  public_key: string;
  created_at: string;
  last_used_at: string;
}

export interface CreateProfileInput {
  display_name: string;
  role_label: string;
  public_key?: string;
}

export interface UpdateProfileInput {
  id: string;
  display_name: string;
  role_label: string;
}

// Patient Types
export interface Patient {
  id: number;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  sex: string | null;
  ethnicity: string | null;
  referral_reason: string | null;
  clinician_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePatientInput {
  first_name: string;
  last_name: string;
  date_of_birth?: string | null;
  sex?: string | null;
  ethnicity?: string | null;
  referral_reason?: string | null;
  clinician_key?: string | null;
}

// Pedigree Types
export interface PedigreeSummary {
  id: number;
  title: string;
  patient_id: number | null;
  node_count: number;
  version_count: number;
  creator_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface Pedigree {
  id: number;
  title: string;
  patient_id: number | null;
  canvas_data: string | null;
  canvas_hash: string | null;
  notes: string | null;
  creator_key: string | null;
  creator_signature: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePedigreeInput {
  title: string;
  patient_id?: number | null;
  canvas_data?: string | null;
  notes?: string | null;
  creator_key: string;
  creator_signature?: string | null;
}

// Version Types
export interface PedigreeVersion {
  id: number;
  pedigree_id: number;
  version_number: number;
  label: string | null;
  canvas_data: string;
  canvas_hash: string | null;
  thumbnail: string | null;
  saver_key: string | null;
  saver_signature: string | null;
  nodes_count?: number | null;
  couple_count?: number | null;
  created_at: string;
}

export interface SaveVersionInput {
  label?: string | null;
  canvas_data: string;
  thumbnail?: string | null;
  saver_key: string;
  saver_signature?: string | null;
}

// Dashboard & Activity Types
export interface DashboardStats {
  total_patients: number;
  total_pedigrees: number;
  total_profiles: number;
  pedigrees_this_week: number;
  pedigrees_this_month: number;
}

export interface ActivityItem {
  id: number;
  action: string;
  subject: string;
  actor_key: string | null;
  timestamp: string;
}

export interface Preferences {
  device_id: string;
  theme: string;
  updated_at: string;
}

// Sharing Types
export interface ShareResult {
  share_token: string;
  share_url: string;
}

export interface SharedPedigreeView {
  title: string;
  canvas_data: string | null;
  notes: string | null;
  updated_at: string;
  encrypted: boolean;
  decryptError?: string;
}

// Legacy Import
export interface LegacyImportSummary {
  patients_imported: number;
  pedigrees_imported: number;
  versions_imported: number;
  activity_entries_imported: number;
  migration_profile_key: string;
}

// .ppro Import/Export Types
export interface PproVersionEntry {
  version_number: number;
  label: string | null;
  canvas_data: string;
  canvas_hash: string | null;
  saver_key: string | null;
  saver_signature: string | null;
  created_at: string;
}

export interface PproPedigreeData {
  title: string;
  canvas_data: unknown | null;
  canvas_hash: string | null;
  notes: string | null;
  node_annotations: Record<string, unknown>[];
  phenotypes: Record<string, unknown>[];
  version_history: PproVersionEntry[];
}

export interface PproProvenance {
  creator_key: string;
  creator_signature: string | null;
  exported_at: string;
  exported_by_key: string;
  export_signature: string | null;
}

export interface PproExport {
  format_version: string;
  export_type: string;
  pedigree: PproPedigreeData | null;
  provenance: PproProvenance;
}

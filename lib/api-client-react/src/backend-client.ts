/**
 * HaploClinical — Backend Client
 *
 * Type-safe wrappers around the unified API adapter.
 * Each function corresponds to a command handler in either:
 * - Rust backend (Tauri desktop mode)
 * - Browser backend (sql.js + IndexedDB mode)
 *
 * Per ADR-004 §3.1: The adapter routes to the appropriate backend automatically.
 */

import { apiCall, detectApiMode } from "./adapter";

// =============================================================================
// Profile Types & Operations
// =============================================================================

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
}

export function listProfiles(): Promise<LocalProfile[]> {
  return apiCall<LocalProfile[]>("list_profiles");
}

export async function createProfile(input: CreateProfileInput): Promise<LocalProfile> {
  const mode = detectApiMode();
  if (mode === "browser") {
    const { generateEd25519Keypair } = await import("@workspace/crypto");
    const { publicKey, privateKey } = await generateEd25519Keypair();
    const result = await apiCall<LocalProfile>("create_profile", {
      ...input,
      public_key: publicKey,
    } as unknown as Record<string, unknown>);
    // Store private key in IndexedDB for browser mode (no OS keychain)
    localStorage.setItem(`hc:profile_private_key:${result.id}`, privateKey);
    return result;
  }
  return apiCall<LocalProfile>("create_profile", input as unknown as Record<string, unknown>);
}

export function switchProfile(profileId: string): Promise<LocalProfile> {
  return apiCall<LocalProfile>("switch_profile", { profile_id: profileId });
}

export function deleteProfile(profileId: string): Promise<void> {
  return apiCall<void>("delete_profile", { profile_id: profileId });
}

// =============================================================================
// Patient Types & Operations
// =============================================================================

export interface Patient {
  id: number;
  mrn: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  sex: string | null;
  ethnicity: string | null;
  referral_reason: string | null;
  clinician_id: number | null;
  clinician_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePatientInput {
  mrn: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string | null;
  sex?: string | null;
  ethnicity?: string | null;
  referral_reason?: string | null;
  clinician_key?: string | null;
}

export function listPatients(search?: string): Promise<Patient[]> {
  return apiCall<Patient[]>("list_patients", search ? { search } : undefined);
}

export function getPatient(id: number): Promise<Patient> {
  return apiCall<Patient>("get_patient", { id });
}

export function createPatient(input: CreatePatientInput): Promise<Patient> {
  return apiCall<Patient>("create_patient", input as unknown as Record<string, unknown>);
}

export function updatePatient(id: number, input: Partial<CreatePatientInput>): Promise<Patient> {
  return apiCall<Patient>("update_patient", { id, ...input } as unknown as Record<string, unknown>);
}

export function deletePatient(id: number): Promise<void> {
  return apiCall<void>("delete_patient", { id });
}

// =============================================================================
// Pedigree Types & Operations
// =============================================================================

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
  share_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePedigreeInput {
  title: string;
  patient_id?: number | null;
  canvas_data?: string | null;
  notes?: string | null;
  creator_key: string;
}

export function listPedigrees(patientId?: number, search?: string): Promise<PedigreeSummary[]> {
  return apiCall<PedigreeSummary[]>("list_pedigrees", {
    patient_id: patientId,
    search,
  });
}

export function getPedigree(id: number): Promise<Pedigree> {
  return apiCall<Pedigree>("get_pedigree", { id });
}

export function createPedigree(input: CreatePedigreeInput): Promise<Pedigree> {
  return apiCall<Pedigree>("create_pedigree", input as unknown as Record<string, unknown>);
}

export function updatePedigree(id: number, input: Partial<CreatePedigreeInput>): Promise<Pedigree> {
  return apiCall<Pedigree>("update_pedigree", { id, ...input } as unknown as Record<string, unknown>);
}

export function deletePedigree(id: number): Promise<void> {
  return apiCall<void>("delete_pedigree", { id });
}

// =============================================================================
// Version Types & Operations
// =============================================================================

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
  created_at: string;
}

export interface SaveVersionInput {
  label?: string | null;
  canvas_data: string;
  thumbnail?: string | null;
  saver_key: string;
}

export function listVersions(pedigreeId: number): Promise<PedigreeVersion[]> {
  return apiCall<PedigreeVersion[]>("list_versions", { pedigree_id: pedigreeId });
}

export function saveVersion(pedigreeId: number, input: SaveVersionInput): Promise<PedigreeVersion> {
  return apiCall<PedigreeVersion>("save_version", { pedigree_id: pedigreeId, ...input } as unknown as Record<string, unknown>);
}

export function restoreVersion(pedigreeId: number, versionId: number): Promise<Pedigree> {
  return apiCall<Pedigree>("restore_version", { pedigree_id: pedigreeId, version_id: versionId });
}

// =============================================================================
// Dashboard Types & Operations
// =============================================================================

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

export function getDashboardStats(): Promise<DashboardStats> {
  return apiCall<DashboardStats>("get_dashboard_stats");
}

export function getRecentActivity(limit?: number): Promise<ActivityItem[]> {
  return apiCall<ActivityItem[]>("get_recent_activity", limit ? { limit } : undefined);
}

// =============================================================================
// Preferences Types & Operations
// =============================================================================

export interface Preferences {
  device_id: string;
  theme: string;
  updated_at: string;
}

export function getPreferences(): Promise<Preferences> {
  return apiCall<Preferences>("get_preferences");
}

export function savePreferences(theme: string): Promise<Preferences> {
  return apiCall<Preferences>("save_preferences", { theme });
}

// =============================================================================
// Sharing Types & Operations
// =============================================================================

export interface ShareResult {
  share_token: string;
  share_url: string;
}

export function sharePedigree(pedigreeId: number, recipientKey: string): Promise<ShareResult> {
  return apiCall<ShareResult>("share_pedigree", { pedigree_id: pedigreeId, recipient_key: recipientKey });
}

export function importShared(shareToken: string): Promise<Pedigree> {
  return apiCall<Pedigree>("import_shared", { share_token: shareToken });
}

// =============================================================================
// Import (Native .hpcl + Legacy HaploPainter)
// =============================================================================

/** Summary returned by legacy HaploPainter database import. */
export interface LegacyImportSummary {
  patients_imported: number;
  pedigrees_imported: number;
  versions_imported: number;
  activity_entries_imported: number;
  users_found: number;
  migration_profile_key: string;
}

/**
 * Imports a pedigree from a native .hpcl JSON file.
 * Path A: Current program files produced by HaploClinical export.
 *
 * @param path Filesystem path to the .hpcl file
 * @param importerKey The importer's Ed25519 public key
 */
export function importPedigreeNative(path: string, importerKey: string): Promise<Pedigree> {
  return apiCall<Pedigree>("import_pedigree_native", { path, importer_key: importerKey });
}

/**
 * Imports an entire legacy HaploPainter SQLite database.
 * Path B: Migration from the original HaploPainter tool.
 *
 * @param path Filesystem path to the legacy HaploPainter .db file
 * @returns Summary with counts of all imported records and the migration profile key
 */
export function importPedigreeLegacy(path: string): Promise<LegacyImportSummary> {
  return apiCall<LegacyImportSummary>("import_pedigree_legacy", { path });
}

// =============================================================================
// Database Management (Backup, Restore, Key Rotation)
// =============================================================================

/**
 * Creates a timestamped backup of the encrypted database file.
 * Returns the filesystem path to the backup file.
 */
export function backupDatabase(): Promise<string> {
  return apiCall<string>("backup_database");
}

/**
 * Restores the database from a backup file.
 * Creates a safety backup of the current database before overwriting.
 * @param backupPath Filesystem path to the backup .db file
 */
export function restoreDatabase(backupPath: string): Promise<void> {
  return apiCall<void>("restore_database", { backup_path: backupPath });
}

/**
 * Rotates the SQLCipher encryption key.
 * Generates a new master secret, re-encrypts the database, and stores the new key.
 */
export function rotateEncryptionKey(): Promise<void> {
  return apiCall<void>("rotate_key");
}

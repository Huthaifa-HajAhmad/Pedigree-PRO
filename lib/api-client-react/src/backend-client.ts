/**
 * Pedigree PRO — Backend Client
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
  private_key?: string;
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
    const { storeProfilePrivateKey } = await import("@workspace/browser-backend");
    const { publicKey, privateKey } = await generateEd25519Keypair();
    const result = await apiCall<LocalProfile>("create_profile", {
      ...input,
      public_key: publicKey,
    } as unknown as Record<string, unknown>);
    // Store private key in IndexedDB for browser mode (no OS keychain)
    await storeProfilePrivateKey(result.id, privateKey);
    return result;
  }
  // Tauri mode: backend returns profile + private_key; store private key in IndexedDB
  const result = await apiCall<{ profile: LocalProfile; private_key: string }>("create_profile", input as unknown as Record<string, unknown>);
  const { storeProfilePrivateKey } = await import("@workspace/browser-backend");
  await storeProfilePrivateKey(result.profile.id, result.private_key);
  return result.profile;
}

export function switchProfile(profileId: string): Promise<LocalProfile> {
  return apiCall<LocalProfile>("switch_profile", { profile_id: profileId });
}

export function deleteProfile(profileId: string): Promise<void> {
  return apiCall<void>("delete_profile", { profile_id: profileId });
}

export function updateProfile(input: { id: string; display_name: string; role_label: string }): Promise<LocalProfile> {
  return apiCall<LocalProfile>("update_profile", input as unknown as Record<string, unknown>);
}

// =============================================================================
// Patient Types & Operations
// =============================================================================

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
  return apiCall<Patient>("update_patient", { id, input } as unknown as Record<string, unknown>);
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
  created_at: string;
  updated_at: string;
}

export interface CreatePedigreeInput {
  title: string;
  patient_id?: number | null;
  canvas_data?: string | null;
  canvas_hash?: string | null;
  notes?: string | null;
  creator_key: string;
  creator_signature?: string | null;
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
  return apiCall<Pedigree>("update_pedigree", { id, input } as unknown as Record<string, unknown>);
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
  canvas_hash?: string | null;
  thumbnail?: string | null;
  saver_key: string;
  saver_signature?: string | null;
}

export function listVersions(pedigreeId: number): Promise<PedigreeVersion[]> {
  return apiCall<PedigreeVersion[]>("list_versions", { pedigree_id: pedigreeId });
}

export function saveVersion(pedigreeId: number, input: SaveVersionInput): Promise<PedigreeVersion> {
  return apiCall<PedigreeVersion>("save_version", { pedigree_id: pedigreeId, input } as unknown as Record<string, unknown>);
}

export function restoreVersion(pedigreeId: number, versionId: number): Promise<Pedigree> {
  return apiCall<Pedigree>("restore_version", { pedigree_id: pedigreeId, version_id: versionId });
}

export function deleteVersion(pedigreeId: number, versionId: number): Promise<{ deleted: boolean }> {
  return apiCall<{ deleted: boolean }>("delete_version", { pedigree_id: pedigreeId, version_id: versionId });
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

export function clearActivityLog(): Promise<void> {
  return apiCall<void>("clear_activity_log");
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

export function importShared(shareToken: string, importerKey?: string): Promise<RelayPayload> {
  return apiCall<RelayPayload>("import_shared", { share_token: shareToken, importer_key: importerKey });
}

export function importPedigreeFromJson(jsonContent: string, importerKey: string): Promise<Pedigree> {
  return apiCall<Pedigree>("import_pedigree_from_json", { json_content: jsonContent, importer_key: importerKey });
}

// =============================================================================
// Import (Native .ppro + Legacy)
// =============================================================================

/** Summary returned by legacy database import. */
export interface LegacyImportSummary {
  patients_imported: number;
  pedigrees_imported: number;
  versions_imported: number;
  activity_entries_imported: number;
  migration_profile_key: string;
}

/**
 * Exports a pedigree in .ppro format (JSON with provenance, version history, annotations).
 * Returns the JSON string suitable for saving to a .ppro file.
 */
export interface RelayPayload {
  ciphertext: string;
  encrypted_key: string;
}

export function relayShare(ciphertext: string, encryptedKey: string, ttlHours?: number): Promise<ShareResult> {
  return apiCall<ShareResult>("relay_share", { ciphertext, encrypted_key: encryptedKey, ttl_hours: ttlHours });
}

export function relayReceive(shareToken: string): Promise<RelayPayload> {
  return apiCall<RelayPayload>("relay_receive", { share_token: shareToken });
}

export function relayRevoke(shareToken: string): Promise<void> {
  return apiCall<void>("relay_revoke", { share_token: shareToken });
}

export function exportPedigreePpro(pedigreeId: number, exporterKey: string): Promise<string> {
  return apiCall<string>("export_pedigree_ppro", { pedigree_id: pedigreeId, exporter_key: exporterKey });
}

/**
 * Imports a pedigree from a native .ppro JSON file.
 * Path A: Current program files produced by Pedigree PRO export.
 *
 * @param path Filesystem path to the .ppro file
 * @param importerKey The importer's Ed25519 public key
 */
export function importPedigreeNative(path: string, importerKey: string): Promise<Pedigree> {
  return apiCall<Pedigree>("import_pedigree_native", { path, importer_key: importerKey });
}

/**
 * Imports an entire legacy SQLite database.
 * Path B: Migration from the original HaploPainter tool.
 *
 * @param path Filesystem path to the legacy .db file
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
 * Returns the filesystem path (Tauri) or base64-encoded backup (browser).
 */
export function backupDatabase(): Promise<string> {
  return apiCall<string>("backup_database");
}

/**
 * Restores the database from a backup.
 * @param backupPathOrData Filesystem path (Tauri) or base64-encoded backup data (browser)
 */
export function restoreDatabase(backupPathOrData: string): Promise<void> {
  const mode = detectApiMode();
  if (mode === "browser") {
    return apiCall<void>("restore_database", { backup_data: backupPathOrData });
  }
  return apiCall<void>("restore_database", { backup_path: backupPathOrData });
}

/**
 * Rotates the SQLCipher encryption key.
 * Generates a new master secret, re-encrypts the database, and stores the new key.
 */
export function rotateEncryptionKey(): Promise<void> {
  return apiCall<void>("rotate_key");
}

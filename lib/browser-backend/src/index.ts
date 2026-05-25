/**
 * Pedigree PRO — Browser Backend
 *
 * sql.js WASM SQLite + IndexedDB persistence + Web Crypto API.
 * Re-implements the Rust command surface in TypeScript for browser standalone mode.
 *
 * No server. No Tauri. Works entirely in the browser.
 */

export { initDb, saveDb, stopAutoSave } from "./db";
export {
  getOrCreateDbKey,
  storeProfilePrivateKey,
  getProfilePrivateKey,
  listProfilePrivateKeys,
  encryptDbBlob,
  decryptDbBlob,
} from "./crypto-store";

// Re-export all command functions so the adapter can route to them
export {
  list_profiles,
  create_profile,
  switch_profile,
  delete_profile,
  list_patients,
  get_patient,
  create_patient,
  update_patient,
  delete_patient,
  list_pedigrees,
  get_pedigree,
  create_pedigree,
  update_pedigree,
  delete_pedigree,
  list_versions,
  save_version,
  restore_version,
  delete_version,
  get_dashboard_stats,
  get_recent_activity,
  get_preferences,
  save_preferences,
  share_pedigree,
  import_shared,
  import_pedigree_native,
  import_pedigree_legacy,
  export_pedigree_ppro,
  backup_database,
  restore_database,
  rotate_key,
  relay_share,
  relay_receive,
} from "./commands";

export type {
  LocalProfile,
  CreateProfileInput,
  Patient,
  CreatePatientInput,
  PedigreeSummary,
  Pedigree,
  CreatePedigreeInput,
  PedigreeVersion,
  SaveVersionInput,
  DashboardStats,
  ActivityItem,
  Preferences,
  ShareResult,
  LegacyImportSummary,
} from "./commands";

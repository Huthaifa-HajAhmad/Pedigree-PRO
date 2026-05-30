/**
 * Pedigree PRO — Unified API Adapter
 *
 * Routes all data operations through the appropriate backend:
 * - Tauri desktop: invoke() Rust commands via IPC
 * - Browser standalone: sql.js WASM SQLite + IndexedDB + Web Crypto API
 *
 * Per ADR-004 §3.1: The Tauri command API is the canonical backend for desktop mode.
 * The browser backend re-implements the same command surface in TypeScript using
 * sql.js (SQLite WASM) and IndexedDB for persistence.
 *
 * No server required. No REST API. No internet needed.
 */

// =============================================================================
// Mode Detection
// =============================================================================

export type ApiMode = "tauri" | "browser";

export function detectApiMode(): ApiMode {
  if (
    typeof window !== "undefined" &&
    "__TAURI__" in window
  ) {
    return "tauri";
  }
  return "browser";
}

// =============================================================================
// Typed Command Names
// =============================================================================

/**
 * Command names that the browser backend implements.
 * Tauri-only commands (e.g. import_pedigree_from_json) will throw at
 * runtime if called in browser mode.
 */
type BrowserCommandName =
  | "list_profiles" | "create_profile" | "switch_profile" | "delete_profile"
  | "list_patients" | "get_patient" | "create_patient" | "update_patient" | "delete_patient"
  | "list_pedigrees" | "get_pedigree" | "create_pedigree" | "update_pedigree" | "delete_pedigree"
  | "list_versions" | "save_version" | "restore_version" | "delete_version"
  | "get_dashboard_stats" | "get_recent_activity" | "clear_activity_log"
  | "get_preferences" | "save_preferences"
  | "share_pedigree" | "import_shared"
  | "import_pedigree_native" | "import_pedigree_legacy"
  | "export_pedigree_ppro"
  | "backup_database" | "restore_database" | "rotate_key"
  | "relay_share" | "relay_receive";

/** All valid command names (browser + Tauri-only). */
type CommandName = BrowserCommandName | "import_pedigree_from_json";

// =============================================================================
// Typed Command Map (M4 fix)
// =============================================================================

/**
 * Typed command map for browser backend dispatch.
 * Maps each command name to its function signature, providing type safety
 * instead of using `Record<string, unknown>` casts.
 */
type CommandMap = {
  list_profiles: () => import("@workspace/browser-backend").LocalProfile[];
  create_profile: (args: { display_name: string; role_label: string; public_key?: string }) => import("@workspace/browser-backend").LocalProfile;
  switch_profile: (args: { profile_id: string }) => import("@workspace/browser-backend").LocalProfile;
  delete_profile: (args: { profile_id: string }) => void;
  list_patients: (args?: { search?: string }) => import("@workspace/browser-backend").Patient[];
  get_patient: (args: { id: number }) => import("@workspace/browser-backend").Patient;
  create_patient: (args: import("@workspace/browser-backend").CreatePatientInput) => import("@workspace/browser-backend").Patient;
  update_patient: (args: { id: number; input: Partial<import("@workspace/browser-backend").CreatePatientInput> }) => import("@workspace/browser-backend").Patient;
  delete_patient: (args: { id: number }) => void;
  list_pedigrees: (args?: { patient_id?: number; search?: string }) => import("@workspace/browser-backend").PedigreeSummary[];
  get_pedigree: (args: { id: number }) => import("@workspace/browser-backend").Pedigree;
  create_pedigree: (args: import("@workspace/browser-backend").CreatePedigreeInput) => import("@workspace/browser-backend").Pedigree;
  update_pedigree: (args: { id: number; input: Partial<import("@workspace/browser-backend").CreatePedigreeInput> }) => import("@workspace/browser-backend").Pedigree;
  delete_pedigree: (args: { id: number }) => void;
  list_versions: (args: { pedigree_id: number }) => import("@workspace/browser-backend").PedigreeVersion[];
  save_version: (args: { pedigree_id: number; input: import("@workspace/browser-backend").SaveVersionInput }) => import("@workspace/browser-backend").PedigreeVersion;
  restore_version: (args: { pedigree_id: number; version_id: number }) => import("@workspace/browser-backend").Pedigree;
  delete_version: (args: { pedigree_id: number; version_id: number }) => Promise<{ deleted: boolean }>;
  get_dashboard_stats: () => import("@workspace/browser-backend").DashboardStats;
  get_recent_activity: (args?: { limit?: number }) => import("@workspace/browser-backend").ActivityItem[];
  clear_activity_log: () => Promise<void>;
  get_preferences: () => import("@workspace/browser-backend").Preferences;
  save_preferences: (args: { theme: string }) => import("@workspace/browser-backend").Preferences;
  share_pedigree: (args: { pedigree_id: number; recipient_key: string }) => import("@workspace/browser-backend").ShareResult;
  import_shared: (args: { share_token: string; importer_key?: string }) => import("@workspace/browser-backend").Pedigree;
  import_pedigree_native: (args: { path: string; importer_key: string }) => import("@workspace/browser-backend").Pedigree;
  import_pedigree_legacy: (args: { path: string }) => import("@workspace/browser-backend").LegacyImportSummary;
  export_pedigree_ppro: (args: { pedigree_id: number; exporter_key: string }) => string;
  backup_database: () => Promise<string>;
  restore_database: (args: { backup_data: string }) => Promise<void>;
  rotate_key: () => Promise<void>;
  relay_share: (args: { ciphertext: string; encrypted_key: string; ttl_hours?: number }) => Promise<import("@workspace/browser-backend").ShareResult>;
  relay_receive: (args: { share_token: string }) => Promise<{ ciphertext: string; encrypted_key: string }>;
};

// =============================================================================
// Generic API Call
// =============================================================================

let browserBackend: typeof import("@workspace/browser-backend") | null = null;
let browserBackendInitError: Error | null = null;
let initPromise: Promise<typeof import("@workspace/browser-backend")> | null = null;

async function getBrowserBackend() {
  if (browserBackendInitError) {
    throw new Error(
      `Browser backend failed to initialize: ${browserBackendInitError.message}\n\n` +
      `This is likely due to sql.js WASM loading failure.\n` +
      `Check browser console for details.`
    );
  }

  if (!browserBackend) {
    if (!initPromise) {
      initPromise = (async () => {
        try {
          browserBackend = await import("@workspace/browser-backend");
          await browserBackend.initDb();
          return browserBackend;
        } catch (error) {
          browserBackendInitError = error instanceof Error ? error : new Error(String(error));
          throw browserBackendInitError;
        }
      })();
    }
    await initPromise;
  }
  return browserBackend;
}

export function getBackendInitError(): Error | null {
  return browserBackendInitError;
}

/**
 * Makes an API call, routing through Tauri invoke() or browser backend based on mode.
 * @param command The command name (must match a CommandMap key)
 * @param args Optional arguments object
 * @returns Typed response
 */
export async function apiCall<T>(
  command: CommandName,
  args?: Record<string, unknown>
): Promise<T> {
  const mode = detectApiMode();

  if (mode === "tauri") {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<T>(command, args);
  }

  // Browser mode: route to sql.js backend via typed command map
  const backend = await getBrowserBackend();
  if (!backend) throw new Error("Browser backend not initialized");

  // Use the typed command map for safe dispatch (M4 fix)
  const commandMap = backend as unknown as CommandMap;
  const fn = commandMap[command as keyof CommandMap];

  if (typeof fn !== "function") {
    throw new Error(`Browser backend does not implement command: ${command}`);
  }

  return fn(args as never) as unknown as Promise<T>;
}

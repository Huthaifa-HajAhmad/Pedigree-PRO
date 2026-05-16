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
  | "list_versions" | "save_version" | "restore_version"
  | "get_dashboard_stats" | "get_recent_activity"
  | "get_preferences" | "save_preferences"
  | "share_pedigree" | "import_shared"
  | "import_pedigree_native" | "import_pedigree_legacy"
  | "export_pedigree_ppro"
  | "backup_database" | "restore_database" | "rotate_key"
  | "relay_share" | "relay_receive";

/** All valid command names (browser + Tauri-only). */
type CommandName = BrowserCommandName | "import_pedigree_from_json";

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
  const fn = (backend as Record<string, unknown>)[command];

  if (typeof fn !== "function") {
    throw new Error(`Browser backend does not implement command: ${command}`);
  }

  return fn(args) as Promise<T>;
}

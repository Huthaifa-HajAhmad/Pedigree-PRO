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

/**
 * Detects whether we're running inside a Tauri desktop app or a browser.
 * Tauri injects window.__TAURI__ at runtime.
 */
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
// Generic API Call
// =============================================================================

let browserBackend: typeof import("@workspace/browser-backend") | null = null;

async function getBrowserBackend() {
  if (!browserBackend) {
    browserBackend = await import("@workspace/browser-backend");
    await browserBackend.initDb();
  }
  return browserBackend;
}

/**
 * Makes an API call, routing through Tauri invoke() or browser backend based on mode.
 * @param command The Tauri command name (e.g., "list_pedigrees")
 * @param args Optional arguments object
 * @returns Typed response
 */
export async function apiCall<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  const mode = detectApiMode();

  if (mode === "tauri") {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<T>(command, args);
  }

  // Browser mode: route to sql.js backend
  const backend = await getBrowserBackend();
  const fn = (backend as Record<string, unknown>)[command] as
    | ((args?: Record<string, unknown>) => Promise<T>)
    | undefined;

  if (!fn) {
    throw new Error(`Browser backend does not implement command: ${command}`);
  }

  return fn(args);
}

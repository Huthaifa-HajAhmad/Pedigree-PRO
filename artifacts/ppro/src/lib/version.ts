declare const __APP_VERSION__: string;

export function getAppVersion(): string {
  try {
    if (typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)) {
      return __APP_VERSION__;
    }
  } catch {}
  return __APP_VERSION__;
}
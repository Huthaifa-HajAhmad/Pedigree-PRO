const PREFIX = "[Pedigree PRO]";

function warn(message: string): void {
  if (import.meta.env.DEV) {
    console.warn(`${PREFIX} localStorage: ${message}`);
  }
}

export function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    warn(`Failed to read "${key}": ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    warn(`Failed to write "${key}": ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}

export function safeRemoveItem(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    warn(`Failed to remove "${key}": ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}

export function safeGetJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (e) {
    warn(`Failed to parse "${key}": ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

export function safeSetJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    warn(`Failed to write JSON "${key}": ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}

const MIGRATION_FLAG = "ppro_ls_migrated_v1";

const KEY_MIGRATIONS: Array<[string, string]> = [
  ["haplopainter_draft_", "ppro_draft_"],
  ["pedigree-pro_open_tabs", "ppro_open_tabs"],
  ["pedigree-pro-device-id", "ppro_device_id"],
  ["pedigree-pro-theme", "ppro_theme"],
];

export function migrateLegacyKeys(): void {
  try {
    if (localStorage.getItem(MIGRATION_FLAG)) return;
  } catch { return; }

  try {
    for (const [oldPrefix, newPrefix] of KEY_MIGRATIONS) {
      if (oldPrefix.endsWith("_") && newPrefix.endsWith("_")) {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(oldPrefix)) {
            const newKey = newPrefix + key.slice(oldPrefix.length);
            const value = localStorage.getItem(key);
            if (value !== null) {
              localStorage.setItem(newKey, value);
              localStorage.removeItem(key);
            }
            i--;
          }
        }
      } else {
        const value = localStorage.getItem(oldPrefix);
        if (value !== null) {
          localStorage.setItem(newPrefix, value);
          localStorage.removeItem(oldPrefix);
        }
      }
    }
    localStorage.setItem(MIGRATION_FLAG, "1");
  } catch (e) {
    warn(`Migration failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

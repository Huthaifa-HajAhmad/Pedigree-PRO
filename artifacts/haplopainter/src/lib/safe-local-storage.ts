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

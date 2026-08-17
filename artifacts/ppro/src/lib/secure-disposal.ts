/**
 * Pedigree PRO — Secure Disposal & Right-to-Erasure
 *
 * Permanently wipes all client-side data, databases, private keys,
 * cache stores, and session tokens from the local browser environment.
 */

export async function secureDispose(): Promise<void> {
  // Stop background database auto-save and close active connections
  try {
    const { stopAutoSave } = await import("@workspace/browser-backend");
    stopAutoSave();
  } catch {}

  // Clear all localStorage data
  try {
    localStorage.clear();
  } catch (err) {
    console.warn("Error clearing localStorage:", err);
  }

  // Clear sessionStorage
  try {
    sessionStorage.clear();
  } catch (err) {
    console.warn("Error clearing sessionStorage:", err);
  }

  // Race-free wipe of all IndexedDB databases
  try {
    if ("databases" in indexedDB) {
      const databases = await indexedDB.databases();
      for (const db of databases) {
        if (db.name) {
          await new Promise<void>((resolve) => {
            const req = indexedDB.deleteDatabase(db.name!);
            req.onsuccess = () => resolve();
            req.onerror = () => resolve();
            req.onblocked = () => resolve();
          });
        }
      }
    }
  } catch (err) {
    console.warn("Error wiping IndexedDB databases:", err);
  }

  // Clear CacheStorage
  try {
    if ("caches" in window) {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        await caches.delete(name);
      }
    }
  } catch (err) {
    console.warn("Error clearing cache stores:", err);
  }

  // Clear all cookies
  try {
    document.cookie.split(";").forEach((c) => {
      const name = c.split("=")[0]?.trim();
      if (name) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
      }
    });
  } catch (err) {
    console.warn("Error clearing cookies:", err);
  }
}

export async function secureDisposalWithConfirmation(): Promise<boolean> {
  const confirmed = window.confirm(
    "Permanently wipe ALL pedigree clinical data, patient records, encryption keys, and profiles from this device?\n\n" +
    "This action cannot be undone.\n\n" +
    "Click OK to proceed to final confirmation."
  );

  if (!confirmed) return false;

  const confirmation = window.prompt("Type DELETE to confirm complete device wipe:");
  if (confirmation !== "DELETE") return false;

  await secureDispose();
  window.location.reload();
  return true;
}
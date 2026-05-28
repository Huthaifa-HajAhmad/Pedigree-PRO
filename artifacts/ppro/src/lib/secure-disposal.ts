export async function secureDispose(): Promise<void> {
  // Clear localStorage (non-sensitive items)
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && !key.startsWith("ppro:profile_private_key")) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }

  // Clear sessionStorage
  sessionStorage.clear();

  // Wipe IndexedDB databases
  const databases = await indexedDB.databases();
  for (const db of databases) {
    if (db.name) {
      indexedDB.deleteDatabase(db.name);
    }
  }

  // Clear caches
  if ("caches" in window) {
    const cacheNames = await caches.keys();
    for (const name of cacheNames) {
      await caches.delete(name);
    }
  }

  // Clear all cookies for this domain
  document.cookie.split(";").forEach((c) => {
    const name = c.split("=")[0]?.trim();
    if (name) {
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
    }
  });
}

export async function secureDisposalWithConfirmation(): Promise<boolean> {
  const confirmed = window.confirm(
    "This will permanently delete ALL pedigree data, profiles, and encryption keys from this device.\n\n" +
    "This action cannot be undone.\n\n" +
    "Type 'DELETE' in the next prompt to confirm."
  );

  if (!confirmed) return false;

  const confirmation = window.prompt("Type DELETE to confirm permanent data disposal:");
  if (confirmation !== "DELETE") return false;

  await secureDispose();
  window.location.reload();
  return true;
}
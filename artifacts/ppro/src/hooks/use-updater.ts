import { useState, useCallback } from "react";

export interface UpdateInfo {
  version: string;
  body?: string;
  date?: string;
}

export function useUpdater() {
  const [checking, setChecking] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isTauri = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

  const checkForUpdates = useCallback(async () => {
    if (!isTauri) return;
    setChecking(true);
    setError(null);

    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();
      if (update?.available) {
        setUpdateAvailable(true);
        setUpdateInfo({
          version: update.version,
          body: update.body,
          date: update.date,
        });
      } else {
        setUpdateAvailable(false);
        setUpdateInfo(null);
      }
    } catch (err) {
      console.warn("Failed to check for updates:", err);
      setError("Unable to check for updates. Please try again later.");
    } finally {
      setChecking(false);
    }
  }, [isTauri]);

  const downloadAndInstall = useCallback(async () => {
    if (!isTauri) return;
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();
      if (update?.available) {
        await update.downloadAndInstall();
      }
    } catch (err) {
      console.error("Failed to download/install update:", err);
      setError("Update installation failed. Please download the latest release manually.");
    }
  }, [isTauri]);

  return {
    isTauri,
    checking,
    updateAvailable,
    updateInfo,
    error,
    checkForUpdates,
    downloadAndInstall,
  };
}

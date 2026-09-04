import { useState, useCallback } from "react";

export interface UpdateInfo {
  version: string;
  body?: string;
  date?: string;
}

export function useUpdater() {
  const [checking, setChecking] = useState(false);
  const [updateAvailable] = useState(false);
  const [updateInfo] = useState<UpdateInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isTauri = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

  const checkForUpdates = useCallback(async () => {
    if (!isTauri) return;
    setChecking(true);
    setError(null);
    try {
      // In-app updater is deferred until code signing infrastructure is configured.
      // Releases are downloaded directly from GitHub Releases.
    } finally {
      setChecking(false);
    }
  }, [isTauri]);

  const downloadAndInstall = useCallback(async () => {
    // In-app updater is deferred until code signing infrastructure is configured.
  }, []);

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

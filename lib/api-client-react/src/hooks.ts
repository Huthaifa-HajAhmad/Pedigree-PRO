/**
 * Pedigree PRO — React Query Hooks (Adapter-Based)
 *
 * These hooks wrap the unified API adapter (backend-client.ts) in React Query
 * useQuery/useMutation calls, replacing the auto-generated OpenAPI hooks
 * in lib/api-client-react/src/generated/api.ts.
 *
 * All hooks route through apiCall() which detects Tauri desktop vs browser mode
 * and calls the appropriate backend (Tauri invoke() or browser sql.js).
 *
 * Key difference from generated hooks:
 *   - Field names are snake_case (matching Rust structs), not camelCase
 *   - Dashboard stats + recent activity are separate queries
 *   - No useGetRecentPedigrees; use listPedigrees with ordering instead
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listProfiles,
  createProfile,
  switchProfile,
  deleteProfile,
  listPatients,
  getPatient,
  createPatient,
  updatePatient,
  deletePatient,
  listPedigrees,
  getPedigree,
  createPedigree,
  updatePedigree,
  deletePedigree,
  listVersions,
  saveVersion,
  restoreVersion,
  deleteVersion,
  getDashboardStats,
  getRecentActivity,
  getPreferences,
  savePreferences,
  sharePedigree,
  importShared,
  importPedigreeFromJson,
  relayShare,
  relayReceive,
  exportPedigreePpro,
  importPedigreeNative,
  importPedigreeLegacy,
  backupDatabase,
  restoreDatabase,
  rotateEncryptionKey,
} from "./backend-client";


import type {
  CreateProfileInput,
  CreatePatientInput,
  CreatePedigreeInput,
  SaveVersionInput,
} from "./backend-client";

// =============================================================================
// Query Key Helpers
// =============================================================================

export const queryKeys = {
  profiles: ["profiles"] as const,
  patients: ["patients"] as const,
  patient: (id: number) => ["patients", id] as const,
  pedigrees: ["pedigrees"] as const,
  pedigree: (id: number) => ["pedigrees", id] as const,
  versions: (pedigreeId: number) => ["versions", pedigreeId] as const,
  dashboardStats: ["dashboard", "stats"] as const,
  recentActivity: ["activity"] as const,
  preferences: ["preferences"] as const,
};

// =============================================================================
// Profile Hooks
// =============================================================================

export function useListProfiles() {
  return useQuery({
    queryKey: queryKeys.profiles,
    queryFn: () => listProfiles(),
  });
}

export function useCreateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProfileInput) => createProfile(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles });
      queryClient.invalidateQueries({ queryKey: queryKeys.recentActivity });
    },
    onError: (error) => {
      console.error("[useCreateProfile] Error:", error instanceof Error ? error.message : String(error));
    },
  });
}

export function useDeleteProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (profileId: string) => deleteProfile(profileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles });
      queryClient.invalidateQueries({ queryKey: queryKeys.recentActivity });
    },
  });
}

export function useSwitchProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (profileId: string) => switchProfile(profileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles });
      queryClient.invalidateQueries({ queryKey: queryKeys.recentActivity });
    },
  });
}

// =============================================================================
// Patient Hooks
// =============================================================================

export function useListPatients(search?: string) {
  return useQuery({
    queryKey: [...queryKeys.patients, search],
    queryFn: () => listPatients(search),
  });
}

export function useGetPatient(id: number) {
  return useQuery({
    queryKey: queryKeys.patient(id),
    queryFn: () => getPatient(id),
    enabled: !!id,
  });
}

export function useCreatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePatientInput) => createPatient(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.patients });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats });
      queryClient.invalidateQueries({ queryKey: queryKeys.recentActivity });
    },
    onError: (error) => {
      console.error("[useCreatePatient] Error:", error instanceof Error ? error.message : String(error));
    },
  });
}

export function useUpdatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<CreatePatientInput> }) =>
      updatePatient(id, input),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.patients });
      queryClient.invalidateQueries({ queryKey: queryKeys.patient(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.recentActivity });
    },
  });
}

export function useDeletePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deletePatient(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.patients });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats });
      queryClient.invalidateQueries({ queryKey: queryKeys.recentActivity });
    },
  });
}

// =============================================================================
// Pedigree Hooks
// =============================================================================

export function useListPedigrees(params?: { patientId?: number; search?: string }) {
  return useQuery({
    queryKey: [...queryKeys.pedigrees, params?.patientId, params?.search],
    queryFn: () => listPedigrees(params?.patientId, params?.search),
    refetchOnMount: "always",
  });
}

export function useGetPedigree(id: number) {
  return useQuery({
    queryKey: queryKeys.pedigree(id),
    queryFn: () => getPedigree(id),
    enabled: !!id,
  });
}

export function useCreatePedigree() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePedigreeInput) => createPedigree(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pedigrees });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats });
      queryClient.invalidateQueries({ queryKey: queryKeys.recentActivity });
    },
    onError: (error) => {
      console.error("[useCreatePedigree] Error:", error instanceof Error ? error.message : String(error));
    },
  });
}

export function useUpdatePedigree() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<CreatePedigreeInput> }) =>
      updatePedigree(id, input),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pedigrees });
      queryClient.invalidateQueries({ queryKey: queryKeys.pedigree(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.recentActivity });
    },
  });
}

export function useDeletePedigree() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deletePedigree(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pedigrees });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats });
      queryClient.invalidateQueries({ queryKey: queryKeys.recentActivity });
    },
  });
}

// =============================================================================
// Version Hooks
// =============================================================================

export function useListVersions(pedigreeId: number) {
  return useQuery({
    queryKey: queryKeys.versions(pedigreeId),
    queryFn: () => listVersions(pedigreeId),
    enabled: !!pedigreeId,
  });
}

export function useSaveVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      pedigreeId,
      input,
    }: {
      pedigreeId: number;
      input: SaveVersionInput;
    }) => saveVersion(pedigreeId, input),
    onSuccess: (_, { pedigreeId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.versions(pedigreeId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.pedigree(pedigreeId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.pedigrees });
      queryClient.invalidateQueries({ queryKey: queryKeys.recentActivity });
    },
  });
}

export function useRestoreVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      pedigreeId,
      versionId,
    }: {
      pedigreeId: number;
      versionId: number;
    }) => restoreVersion(pedigreeId, versionId),
    onSuccess: (_, { pedigreeId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pedigree(pedigreeId) });
    },
  });
}

export function useDeleteVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      pedigreeId,
      versionId,
    }: {
      pedigreeId: number;
      versionId: number;
    }) => deleteVersion(pedigreeId, versionId),
    onSuccess: (_, { pedigreeId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.versions(pedigreeId) });
    },
  });
}

// =============================================================================
// Dashboard Hooks
// =============================================================================

export function useGetDashboardStats() {
  return useQuery({
    queryKey: queryKeys.dashboardStats,
    queryFn: () => getDashboardStats(),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}

export function useGetRecentActivity(limit?: number) {
  return useQuery({
    queryKey: [...queryKeys.recentActivity, limit],
    queryFn: () => getRecentActivity(limit),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
}

// =============================================================================
// Preferences Hooks
// =============================================================================

export function useGetPreferences() {
  return useQuery({
    queryKey: queryKeys.preferences,
    queryFn: () => getPreferences(),
  });
}

export function useSavePreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (theme: string) => savePreferences(theme),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.preferences }),
  });
}

// =============================================================================
// Sharing Hooks
// =============================================================================

export function useSharePedigree() {
  return useMutation({
    mutationFn: ({
      pedigreeId,
      recipientKey,
    }: {
      pedigreeId: number;
      recipientKey: string;
    }) => sharePedigree(pedigreeId, recipientKey),
  });
}

export function useImportShared() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (shareToken: string) => {
      const { detectApiMode } = await import("./adapter");
      const mode = detectApiMode();

      if (mode === "browser") {
        const backend = await import("@workspace/browser-backend");
        await backend.initDb();

        // Read fallback full token from hash fragment (#token) for cross-browser support
        let fallbackToken: string | undefined;
        try {
          const hash = window.location.hash;
          if (hash && hash.length > 1) {
            fallbackToken = hash.slice(1) || undefined;
          }
        } catch { /* ignore */ }

        return backend.import_shared({ share_token: shareToken, fallback_token: fallbackToken });
      }

      // Tauri mode: fetch encrypted payload, decrypt client-side, then import
      const payload = await importShared(shareToken);
      const sealedEnvelope = atob(payload.ciphertext);
      const { sodiumOpenSealedBox } = await import("@workspace/crypto");
      const { listProfilePrivateKeys } = await import("@workspace/browser-backend");

      let lastError: Error | null = null;
      for (const { privateKey } of await listProfilePrivateKeys()) {
        try {
          const decrypted = await sodiumOpenSealedBox(sealedEnvelope, privateKey);
          return importPedigreeFromJson(decrypted, "imported");
        } catch (e) {
          lastError = e instanceof Error ? e : new Error(String(e));
        }
      }
      throw lastError ?? new Error("No matching private key found");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pedigrees });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats });
      queryClient.invalidateQueries({ queryKey: queryKeys.recentActivity });
    },
  });
}

export function useRelayShare() {
  return useMutation({
    mutationFn: ({ ciphertext, encryptedKey, ttlHours }: { ciphertext: string; encryptedKey: string; ttlHours?: number }) =>
      relayShare(ciphertext, encryptedKey, ttlHours),
  });
}

export function useRelayReceive() {
  return useMutation({
    mutationFn: (shareToken: string) => relayReceive(shareToken),
  });
}

// =============================================================================
// Export & Import Hooks
// =============================================================================

export function useExportPedigreePpro() {
  return useMutation({
    mutationFn: ({ pedigreeId, exporterKey }: { pedigreeId: number; exporterKey: string }) =>
      exportPedigreePpro(pedigreeId, exporterKey),
  });
}

export function useImportPedigreeNative() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ path, importerKey }: { path: string; importerKey: string }) =>
      importPedigreeNative(path, importerKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pedigrees });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats });
      queryClient.invalidateQueries({ queryKey: queryKeys.recentActivity });
    },
  });
}

export function useImportPedigreeLegacy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => importPedigreeLegacy(path),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pedigrees });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats });
      queryClient.invalidateQueries({ queryKey: queryKeys.recentActivity });
    },
  });
}

// =============================================================================
// Database Management Hooks
// =============================================================================

export function useBackupDatabase() {
  return useMutation({
    mutationFn: () => backupDatabase(),
  });
}

export function useRestoreDatabase() {
  return useMutation({
    mutationFn: (backupPath: string) => restoreDatabase(backupPath),
  });
}

export function useRotateKey() {
  return useMutation({
    mutationFn: () => rotateEncryptionKey(),
  });
}

// =============================================================================
// Share View Hook
// =============================================================================

export interface SharedPedigreeView {
  title: string;
  canvas_data: string | null;
  notes: string | null;
  updated_at: string;
  encrypted: boolean;
  decryptError?: string;
}

export function useGetSharedPedigree(token: string) {
  return useQuery<SharedPedigreeView>({
    queryKey: ["shared", token],
    queryFn: async () => {
      const { detectApiMode } = await import("./adapter");
      const mode = detectApiMode();

      if (mode === "browser") {
        const backend = await import("@workspace/browser-backend");
        await backend.initDb();

        // Read fallback full token from hash fragment (#token).
        // The short code in the URL path only resolves in the same browser
        // (same IndexedDB). The hash fragment carries the full token so
        // the share works cross-browser without a server.
        let fallbackToken: string | undefined;
        try {
          const hash = window.location.hash;
          if (hash && hash.length > 1) {
            fallbackToken = hash.slice(1) || undefined; // strip leading #
          }
        } catch { /* ignore */ }

        return backend.decode_shared_pedigree({
          share_token: token,
          fallback_token: fallbackToken,
        });
      }

      // Tauri mode: fetch encrypted payload, decrypt client-side, then return view
      const payload = await importShared(token);
      const sealedEnvelope = atob(payload.ciphertext);
      const { sodiumOpenSealedBox } = await import("@workspace/crypto");
      const { listProfilePrivateKeys } = await import("@workspace/browser-backend");

      let lastError: Error | null = null;
      for (const { privateKey } of await listProfilePrivateKeys()) {
        try {
          const decrypted = await sodiumOpenSealedBox(sealedEnvelope, privateKey);
          // Parse as .ppro JSON for view
          const data = JSON.parse(decrypted);
          if (data?.pedigree) {
            return {
              title: data.pedigree.title ?? "",
              canvas_data: data.pedigree.canvas_data ? JSON.stringify(data.pedigree.canvas_data) : null,
              notes: data.pedigree.notes ?? null,
              updated_at: data.provenance?.exported_at ?? new Date().toISOString(),
              encrypted: false,
            } satisfies SharedPedigreeView;
          }
        } catch (e) {
          lastError = e instanceof Error ? e : new Error(String(e));
        }
      }

      return {
        title: "",
        canvas_data: null,
        notes: null,
        updated_at: new Date().toISOString(),
        encrypted: true,
        decryptError: lastError?.message ?? "No matching private key found",
      } satisfies SharedPedigreeView;
    },
    enabled: !!token,
  });
}

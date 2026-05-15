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
  getDashboardStats,
  getRecentActivity,
  getPreferences,
  savePreferences,
  sharePedigree,
  importShared,
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.profiles }),
  });
}

export function useDeleteProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (profileId: string) => deleteProfile(profileId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.profiles }),
  });
}

export function useSwitchProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (profileId: string) => switchProfile(profileId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.profiles }),
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.patients }),
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
    },
  });
}

export function useDeletePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deletePatient(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.patients }),
  });
}

// =============================================================================
// Pedigree Hooks
// =============================================================================

export function useListPedigrees(params?: { patientId?: number; search?: string }) {
  return useQuery({
    queryKey: [...queryKeys.pedigrees, params?.patientId, params?.search],
    queryFn: () => listPedigrees(params?.patientId, params?.search),
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.pedigrees }),
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
    },
  });
}

export function useDeletePedigree() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deletePedigree(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.pedigrees }),
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
    mutationFn: (shareToken: string) => importShared(shareToken),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.pedigrees }),
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.pedigrees }),
  });
}

export function useImportPedigreeLegacy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => importPedigreeLegacy(path),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.pedigrees }),
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

export function useGetSharedPedigree(token: string) {
  return useQuery({
    queryKey: ["shared", token],
    queryFn: () => importShared(token),
    enabled: !!token,
  });
}

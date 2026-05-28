export type ShareRole = "viewer" | "annotator" | "editor" | "admin";

export interface ShareEnvelope {
  version: "1.0";
  format: "pedigree-pro-v1";

  title: string;
  nodeCount: number;
  generationCount: number;
  exporterPublicKey: string;

  role: ShareRole;

  previewSvg: string;
  previewHash: string;

  canvasData?: string;
  canvasHash?: string;

  wrappedKey?: string;

  passphraseSalt?: string;
  passphraseIterations?: number;
}

export interface ShareLinkRequest {
  pedigreeId: number;
  recipientPublicKey?: string;
  role: ShareRole;
  ttlHours: number;
  passphrase?: string;
}

export interface ShareLinkResponse {
  url: string;
  expiresAt: string;
  role: ShareRole;
  token: string;
}

export interface ShareLogEntry {
  id: number;
  pedigree_id: number;
  action: "share_created" | "share_accessed" | "share_revoked";
  recipient_public_key: string | null;
  role: ShareRole;
  encrypted_by_key: string;
  created_at: string;
}

export const ROLE_PERMISSIONS: Record<ShareRole, string[]> = {
  viewer: ["read"],
  annotator: ["read", "annotate"],
  editor: ["read", "annotate", "edit"],
  admin: ["read", "annotate", "edit", "manage_roles", "delete"],
};

export function canPerformAction(role: ShareRole, action: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(action) ?? false;
}
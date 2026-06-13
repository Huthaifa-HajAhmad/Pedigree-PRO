import { useState, useEffect } from "react";
import { useListProfiles, useCreateProfile, useUpdateProfile, useDeleteProfile } from "@workspace/api-client-react";
import { UserCircle, Copy, Check, Shield, KeyRound, Pencil, Save, X } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

function truncate(str: string, len: number) {
  return str.length > len ? str.slice(0, len) + "…" : str;
}

export default function Profiles() {
  const { data: profiles, isLoading } = useListProfiles();
  const createProfile = useCreateProfile();
  const updateProfile = useUpdateProfile();
  const deleteProfile = useDeleteProfile();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Inline editing state
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftRole, setDraftRole] = useState("");

  const profile = profiles?.[0];

  useEffect(() => {
    if (profile) {
      setDraftName(profile.display_name);
      setDraftRole(profile.role_label);
    }
  }, [profile?.display_name, profile?.role_label]);

  // Clipboard state
  const [copiedId, setCopiedId] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  const handleCopy = async (text: string, setter: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setter(true);
      setTimeout(() => setter(false), 2000);
    } catch {
      // Fallback not needed — clipboard API is widely supported in secure contexts
    }
  };

  const handleSave = () => {
    if (!profile) return;
    updateProfile.mutate({
      id: profile.id,
      display_name: draftName.trim() || profile.display_name,
      role_label: draftRole.trim() || profile.role_label,
    }, {
      onSuccess: () => setEditing(false),
    });
  };

  return (
    <section className="p-6">
      <PageHeader
        icon={UserCircle}
        title="My Profile"
        subtitle="Your profile details and sharing key"
      />

      {isLoading ? (
        <div className="border border-border rounded-lg bg-card p-6 space-y-6">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-4 w-64" />
        </div>
      ) : !profile ? (
        <div className="border border-border rounded-lg bg-card p-8 text-center">
          <Shield className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm mb-4">No identity found. Creating one automatically…</p>
          <Button
            onClick={() => createProfile.mutate({ display_name: "User", role_label: "Clinical Geneticist" })}
            disabled={createProfile.isPending}
          >
            {createProfile.isPending ? "Creating…" : "Create Identity"}
          </Button>
        </div>
      ) : (
        <div className="border border-border rounded-lg bg-card overflow-hidden max-w-2xl">
          {/* Header */}
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <UserCircle className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">{profile.display_name}</h2>
                <p className="text-xs text-muted-foreground">{profile.role_label}</p>
              </div>
            </div>
            {!editing ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={updateProfile.isPending}
                  className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors px-2 py-1 rounded hover:bg-primary/10"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setDraftName(profile.display_name);
                    setDraftRole(profile.role_label);
                  }}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Fields */}
          <div className="px-6 py-5 space-y-5">
            {/* Display Name */}
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Display Name
              </label>
              {editing ? (
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
                  placeholder="Dr. Sarah Chen"
                />
              ) : (
                <p className="text-sm text-foreground">{profile.display_name}</p>
              )}
            </div>

            {/* Role Label */}
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Role
              </label>
              {editing ? (
                <input
                  value={draftRole}
                  onChange={(e) => setDraftRole(e.target.value)}
                  className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
                  placeholder="Clinical Geneticist"
                />
              ) : (
                <p className="text-sm text-foreground">{profile.role_label}</p>
              )}
            </div>

            {/* Profile ID */}
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Profile ID
              </label>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
                  {truncate(profile.id, 32)}
                </code>
                <button
                  type="button"
                  onClick={() => handleCopy(profile.id, setCopiedId)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-muted"
                  title="Copy Profile ID"
                  aria-label="Copy Profile ID"
                >
                  {copiedId ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Public Key / Sharing Key */}
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                <KeyRound className="w-3 h-3" />
                Sharing Key
              </label>
              <div className="flex items-start gap-2">
                <code className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded break-all flex-1">
                  {truncate(profile.public_key, 48)}
                </code>
                <button
                  type="button"
                  onClick={() => handleCopy(profile.public_key, setCopiedKey)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded hover:bg-muted flex-shrink-0"
                  title="Copy Sharing Key"
                  aria-label="Copy Sharing Key"
                >
                  {copiedKey ? (
                    <span className="flex items-center gap-1 text-[10px] text-green-500 font-medium">
                      <Check className="w-3.5 h-3.5" />
                      Copied
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                      <Copy className="w-3.5 h-3.5" />
                      Copy
                    </span>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Share this key with other users so they can send you encrypted pedigrees.
              </p>
            </div>

            {/* Created date */}
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Created
              </label>
              <p className="text-xs text-muted-foreground">
                {new Date(profile.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="border-t border-border px-6 py-5 bg-destructive/5 dark:bg-destructive/10">
            <h3 className="text-xs font-bold text-destructive uppercase tracking-wider mb-1">
              Danger Zone
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Permanently delete this profile and its associated encryption keys. You will lose access to all pedigrees encrypted with this profile.
            </p>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={deleteProfile.isPending}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold"
            >
              Delete Profile
            </Button>
          </div>
        </div>
      )}

      {profile && (
        <ConfirmDialog
          open={deleteConfirmOpen}
          title="Delete Profile"
          message="Warning: Deleting your profile will permanently remove your digital signature keys and profile data. You will no longer be able to open pedigrees secured by this profile. This action is irreversible, and you will need to create a new profile to continue using the application. Are you sure you want to proceed?"
          confirmLabel="Yes, Delete Profile"
          cancelLabel="Cancel"
          variant="destructive"
          onConfirm={() => {
            deleteProfile.mutate(profile.id, {
              onSuccess: () => {
                setDeleteConfirmOpen(false);
                window.location.reload();
              },
              onError: () => {
                setDeleteConfirmOpen(false);
              }
            });
          }}
          onCancel={() => setDeleteConfirmOpen(false)}
        />
      )}
    </section>
  );
}

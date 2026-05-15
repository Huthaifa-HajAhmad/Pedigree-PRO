import { useState } from "react";
import { useListProfiles, useCreateProfile, useDeleteProfile, apiCall } from "@workspace/api-client-react";
import { Plus, Trash2, UserCircle, Shield, Clock, Download, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormLayout } from "@/components/shared/FormLayout";
import { TableSkeleton } from "@/components/shared/Skeleton";
import { toast } from "@/hooks/use-toast";

const schema = z.object({
  display_name: z.string().min(1, "Display name required"),
  role_label: z.string().min(1, "Role label required"),
});
type FormData = z.infer<typeof schema>;

export default function Profiles() {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmProps, setConfirmProps] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportPassphrase, setExportPassphrase] = useState("");
  const [exportOutput, setExportOutput] = useState<string | null>(null);
  const [exportBlobUrl, setExportBlobUrl] = useState<string | null>(null);
  const [exportError, setExportError] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [importPassphrase, setImportPassphrase] = useState("");
  const [importInput, setImportInput] = useState("");
  const [importError, setImportError] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const { data: profiles, isLoading } = useListProfiles();
  const createProfile = useCreateProfile();
  const deleteProfile = useDeleteProfile();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { display_name: "", role_label: "" },
  });

  const onSubmit = (data: FormData) => {
    createProfile.mutate(data, {
      onSuccess: () => {
        form.reset();
        setOpen(false);
      },
    });
  };

  const handleDelete = (id: string, name: string) => {
    setConfirmProps({
      title: "Delete Profile",
      message: `Delete profile "${name}"? The keypair cannot be recovered.`,
      onConfirm: () => {
        setConfirmOpen(false);
        deleteProfile.mutate(id);
      },
    });
    setConfirmOpen(true);
  };

  // ── Profile Export (client-side encryption) ───────────────────────────
  const handleExportProfile = async () => {
    setExportError("");
    setExportOutput("");
    setIsExporting(true);
    try {
      const { deriveKeyFromPassphrase, encryptAesGcm } = await import("@workspace/crypto");
      const { derivedKey } = await deriveKeyFromPassphrase(exportPassphrase);
      const key = Uint8Array.from(atob(derivedKey), (c) => c.charCodeAt(0));

      // Find the most recently used profile to export
      if (!profiles || profiles.length === 0) {
        setExportError("No profiles available to export.");
        return;
      }
      const profile = profiles[0]; // most recently used
      const payload = JSON.stringify({ profile, exported_at: new Date().toISOString() });
      const { ciphertext, nonce } = await encryptAesGcm(payload, key);
      const json = JSON.stringify({ ciphertext, nonce, version: 1 });
      const blob = new Blob([json], { type: "application/json" });
      if (exportBlobUrl) URL.revokeObjectURL(exportBlobUrl);
      const url = URL.createObjectURL(blob);
      setExportBlobUrl(url);
      setExportOutput(json);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  // ── Profile Import (client-side decryption) ───────────────────────────
  const handleImportProfile = async () => {
    setImportError("");
    setIsImporting(true);
    try {
      const { deriveKeyFromPassphrase, decryptAesGcm } = await import("@workspace/crypto");
      const envelope = JSON.parse(importInput);
      if (!envelope.ciphertext || !envelope.nonce) {
        setImportError("Invalid import file: missing ciphertext or nonce.");
        return;
      }
      const { derivedKey } = await deriveKeyFromPassphrase(importPassphrase);
      const key = Uint8Array.from(atob(derivedKey), (c) => c.charCodeAt(0));
      const decrypted = await decryptAesGcm(envelope.ciphertext, envelope.nonce, key);
      const { profile } = JSON.parse(decrypted);
      if (!profile?.display_name || !profile?.role_label) {
        setImportError("Imported profile data is incomplete.");
        return;
      }
      await apiCall("create_profile", {
        display_name: profile.display_name,
        role_label: profile.role_label,
        public_key: profile.public_key ?? "",
      });
      toast({
        title: "Profile Imported",
        description: `"${profile.display_name}" (${profile.role_label}) has been imported.`,
      });
      setImportOpen(false);
      setImportInput("");
      setImportPassphrase("");
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <section className="p-6">
      <PageHeader
        icon={UserCircle}
        title="Profiles"
        subtitle={`${profiles?.length ?? 0} local clinician profiles`}
        actions={
          <div className="flex items-center gap-2">
            {/* Export Profile */}
            <Dialog open={exportOpen} onOpenChange={setExportOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-export-profile" disabled={!profiles || profiles.length === 0}>
                  <Download className="w-4 h-4" /> Export
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-panel border-0 max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-sm uppercase tracking-wider text-primary">Export Profile</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Exports your most recently used profile encrypted with a passphrase.
                    The encrypted file can be imported on another device.
                  </p>
                  <input
                    type="password"
                    aria-label="Enter a passphrase to encrypt the export"
                    placeholder="Enter a passphrase to encrypt..."
                    value={exportPassphrase}
                    onChange={(e) => setExportPassphrase(e.target.value)}
                    className="w-full bg-muted border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
                    data-testid="input-export-passphrase"
                  />
                  {exportError && <p className="text-xs text-destructive">{exportError}</p>}
                  {isExporting && <div className="flex items-center justify-center py-4"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}
                  {exportOutput ? (
                    <div className="space-y-2">
                      <textarea
                        readOnly
                        value={exportOutput}
                        className="w-full bg-muted border border-border rounded px-3 py-2 text-xs font-mono outline-none h-32 resize-none"
                        data-testid="textarea-export-output"
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={() => {
                            navigator.clipboard.writeText(exportOutput);
                            toast({ title: "Copied to clipboard", description: "Encrypted profile data copied." });
                          }}
                          className="flex-1"
                        >
                          Copy
                        </Button>
                        {exportBlobUrl && (
                          <a
                            href={exportBlobUrl}
                            download="profile-export.json"
                            className="flex-1 py-2 rounded text-sm font-semibold text-center border border-primary text-primary hover:bg-primary/10 transition-colors"
                          >
                            Download
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (
                    <Button
                      onClick={handleExportProfile}
                      disabled={!exportPassphrase.trim() || isExporting}
                      className="w-full"
                    >
                      Encrypt & Export
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground italic">
                    Backend export command is being implemented. Currently exports the profile JSON
                    encrypted with your passphrase using AES-256-GCM.
                  </p>
                </div>
              </DialogContent>
            </Dialog>

            {/* Import Profile */}
            <Dialog open={importOpen} onOpenChange={setImportOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-import-profile">
                  <Upload className="w-4 h-4" /> Import
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-panel border-0 max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-sm uppercase tracking-wider text-primary">Import Profile</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Paste an encrypted profile export and enter the passphrase to decrypt it.
                  </p>
                  <textarea
                    aria-label="Paste encrypted profile data to import"
                    placeholder="Paste encrypted profile data..."
                    value={importInput}
                    onChange={(e) => setImportInput(e.target.value)}
                    className="w-full bg-muted border border-border rounded px-3 py-2 text-xs font-mono outline-none focus:border-primary transition-colors h-32 resize-none"
                    data-testid="textarea-import-input"
                  />
                  <input
                    type="password"
                    aria-label="Enter the passphrase to decrypt the import"
                    placeholder="Enter the passphrase to decrypt..."
                    value={importPassphrase}
                    onChange={(e) => setImportPassphrase(e.target.value)}
                    className="w-full bg-muted border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
                    data-testid="input-import-passphrase"
                  />
                  {importError && <p className="text-xs text-destructive">{importError}</p>}
                  {isImporting && <div className="flex items-center justify-center py-4"><div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}
                  <Button
                    onClick={handleImportProfile}
                    disabled={!importInput.trim() || !importPassphrase.trim() || isImporting}
                    className="w-full"
                  >
                    Decrypt & Import
                  </Button>
                  <p className="text-xs text-muted-foreground italic">
                    Backend import command is being implemented. Currently decrypts and displays
                    the profile — not yet persisted to the database.
                  </p>
                </div>
              </DialogContent>
            </Dialog>

            {/* New Profile */}
            <FormLayout
                open={open}
                onOpenChange={setOpen}
                title="Create Clinical Profile"
                submitLabel="Create Profile"
                form={form}
                onSubmit={onSubmit}
                isSubmitting={createProfile.isPending}
                trigger={
                  <Button data-testid="button-new-profile">
                    <Plus className="w-4 h-4" /> New Profile
                  </Button>
                }
              >
                <FormField
                  control={form.control}
                  name="display_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider">Display Name</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-profile-name" className="bg-muted border-border text-sm" placeholder="Dr. Sarah Chen" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role_label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider">Role Label</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-profile-role" className="bg-muted border-border text-sm" placeholder="Clinical Geneticist" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FormLayout>
          </div>
        }
      />

      <div className="border border-border rounded overflow-hidden bg-card">
        <div className="grid grid-cols-5 gap-4 px-4 py-3 border-b border-border text-xs text-muted-foreground uppercase tracking-widest">
          <div className="col-span-2">Profile</div>
          <div>Role</div>
          <div>Last Used</div>
          <div>Actions</div>
        </div>
        <div className="divide-y divide-border">
          {isLoading ? (
            <TableSkeleton rows={3} cols={5} />
          ) : profiles?.length === 0 ? (
            <div className="px-4 py-12 text-center text-muted-foreground text-sm">
              No profiles yet. Create your first clinician profile.
            </div>
          ) : (
            profiles?.map((p) => (
              <div key={p.id} data-testid={`row-profile-${p.id}`} className="grid grid-cols-5 gap-4 px-4 py-3 text-sm hover:bg-accent transition-colors items-center">
                <div className="col-span-2 flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <span className="font-medium truncate">{p.display_name}</span>
                </div>
                <div className="text-muted-foreground text-xs truncate">{p.role_label}</div>
                <div className="text-muted-foreground text-xs">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(p.last_used_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    data-testid={`button-delete-profile-${p.id}`}
                    onClick={() => handleDelete(p.id, p.display_name)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {confirmProps && (
        <ConfirmDialog
          open={confirmOpen}
          title={confirmProps.title}
          message={confirmProps.message}
          variant="destructive"
          confirmLabel="Delete"
          onConfirm={confirmProps.onConfirm}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </section>
  );
}
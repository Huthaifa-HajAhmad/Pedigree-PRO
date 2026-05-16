import { useState } from "react";
import { useListProfiles, useCreateProfile, useDeleteProfile, getBackendInitError } from "@workspace/api-client-react";
import { Plus, Trash2, UserCircle, Shield, Clock } from "lucide-react";
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
import { ErrorDialog } from "@/components/shared/ErrorDialog";

const schema = z.object({
  display_name: z.string().min(1, "Display name required"),
  role_label: z.string().min(1, "Role label required"),
});
type FormData = z.infer<typeof schema>;

export default function Profiles() {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmProps, setConfirmProps] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; title: string; message: string; error: Error | null; details: string }>({
    open: false,
    title: "",
    message: "",
    error: null,
    details: "",
  });

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
       onError: (error) => {
         const backendError = getBackendInitError();
         setErrorDialog({
           open: true,
           title: "Failed to Create Profile",
           message: "The profile could not be created. See details below.",
           error: backendError || error,
           details: backendError
             ? `Backend initialization failed.\n${backendError.message}`
             : `Error: ${error.message}\n\nStack:\n${error.stack || "N/A"}`,
         });
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

  return (
    <section className="p-6">
      <PageHeader
        icon={UserCircle}
        title="Profiles"
        subtitle={`${profiles?.length ?? 0} local clinician profiles`}
        actions={
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
        }
      />

      <div className="border border-border rounded overflow-hidden bg-card">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 px-4 py-3 border-b border-border text-xs text-muted-foreground uppercase tracking-widest">
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
              <div key={p.id} data-testid={`row-profile-${p.id}`} className="grid grid-cols-2 md:grid-cols-5 gap-4 px-4 py-3 text-sm hover:bg-accent transition-colors items-center">
                <div className="col-span-2 flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <span className="font-medium truncate">{p.display_name}</span>
                </div>
                <div className="text-muted-foreground text-xs truncate">{p.role_label}</div>
                <div className="text-muted-foreground text-xs flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(p.last_used_at).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    data-testid={`button-delete-profile-${p.id}`}
                    onClick={() => handleDelete(p.id, p.display_name)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded hover:bg-destructive/10"
                    title="Delete profile"
                    aria-label={`Delete profile ${p.display_name}`}
                  >
                    <Trash2 className="w-4 h-4" />
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

      <ErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog({ ...errorDialog, open })}
        title={errorDialog.title}
        message={errorDialog.message}
        error={errorDialog.error}
        details={errorDialog.details}
      />
    </section>
  );
}

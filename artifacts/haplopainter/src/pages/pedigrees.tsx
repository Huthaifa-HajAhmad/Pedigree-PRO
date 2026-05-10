import { useState } from "react";
import { useListPedigrees, useDeletePedigree, useCreatePedigree, useListPatients, queryKeys } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Plus, Trash2, ChevronRight, Dna, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ImportDialog } from "@/components/ImportDialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import { SearchBar } from "@/components/shared/SearchBar";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { TableSkeleton } from "@/components/shared/Skeleton";

const schema = z.object({
  title: z.string().min(1, "Title required"),
  patientId: z.string().optional(),
  notes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function Pedigrees() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmProps, setConfirmProps] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: pedigrees, isLoading } = useListPedigrees({ search: search || undefined });
  const { data: patients } = useListPatients();
  const deletePedigree = useDeletePedigree();
  const createPedigree = useCreatePedigree();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", patientId: "", notes: "" },
  });

  const onSubmit = (data: FormData) => {
    createPedigree.mutate(
      {
        title: data.title,
        patient_id: data.patientId ? parseInt(data.patientId, 10) : null,
        notes: data.notes ?? null,
        creator_key: "",
      },
      {
        onSuccess: (pedigree) => {
          queryClient.invalidateQueries({ queryKey: queryKeys.pedigrees });
          form.reset();
          setOpen(false);
          navigate(`/pedigrees/${pedigree.id}`);
        },
      }
    );
  };

  const handleDelete = (id: number, title: string) => {
    setConfirmProps({
      title: "Delete Pedigree",
      message: `Delete "${title}"? This cannot be undone.`,
      onConfirm: () => {
        setConfirmOpen(false);
        deletePedigree.mutate(id, { onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.pedigrees }) });
      },
    });
    setConfirmOpen(true);
  };

  return (
    <div className="p-6">
      <PageHeader
        icon={Dna}
        title="Pedigrees"
        subtitle={`${pedigrees?.length ?? 0} family trees`}
        actions={
          <div className="flex items-center gap-2">
            <ImportDialog>
              <button
                data-testid="button-import-pedigree"
                className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold border border-border hover:border-primary hover:text-primary transition-colors"
              >
                <Upload className="w-4 h-4" /> Import
              </button>
            </ImportDialog>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <button
                  data-testid="button-new-pedigree"
                  className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90"
                >
                  <Plus className="w-4 h-4" /> New Pedigree
                </button>
              </DialogTrigger>
              <DialogContent className="glass-panel border-0 max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-sm uppercase tracking-wider text-primary">Create Pedigree</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField control={form.control} name="title" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider">Title</FormLabel>
                        <FormControl><Input {...field} data-testid="input-title" className="bg-muted border-border" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="patientId" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider">Patient (optional)</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-patient" className="bg-muted border-border">
                              <SelectValue placeholder="Select patient" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-popover border-border">
                            <SelectItem value="none">No patient</SelectItem>
                            {patients?.map((p) => (
                              <SelectItem key={p.id} value={String(p.id)}>
                                {p.last_name}, {p.first_name} ({p.mrn})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="notes" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider">Notes</FormLabel>
                        <FormControl><Input {...field} data-testid="input-notes" className="bg-muted border-border" /></FormControl>
                      </FormItem>
                    )} />
                    <button
                      type="submit"
                      data-testid="button-submit"
                      className="w-full py-2 rounded text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90"
                      disabled={createPedigree.isPending}
                    >
                      {createPedigree.isPending ? "Creating..." : "Create & Open Editor"}
                    </button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <SearchBar
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search pedigrees..."
        testId="input-search"
      />

      <div className="border border-border rounded overflow-hidden bg-card">
        <div className="grid grid-cols-6 gap-4 px-4 py-3 border-b border-border text-xs text-muted-foreground uppercase tracking-widest">
          <div className="col-span-2">Title</div>
          <div>Patient</div>
          <div>Versions</div>
          <div>Updated</div>
          <div>Actions</div>
        </div>
        <div className="divide-y divide-border">
          {isLoading ? (
            <TableSkeleton rows={5} cols={6} />
          ) : pedigrees?.length === 0 ? (
            <div className="px-4 py-12 text-center text-muted-foreground text-sm">No pedigrees found. Create your first one.</div>
          ) : (
            pedigrees?.map((p) => (
              <div key={p.id} data-testid={`row-pedigree-${p.id}`} className="grid grid-cols-6 gap-4 px-4 py-3 text-sm hover:bg-accent transition-colors items-center">
                <div className="col-span-2 flex items-center gap-2">
                  <Dna className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <span className="font-medium truncate">{p.title}</span>
                </div>
                <div className="text-muted-foreground text-xs truncate">{p.patient_id ? `#${p.patient_id}` : "—"}</div>
                <div>
                  <span className="text-xs px-2 py-0.5 rounded border border-border text-muted-foreground">{p.version_count}</span>
                </div>
                <div className="text-muted-foreground text-xs">{new Date(p.updated_at).toLocaleDateString()}</div>
                <div className="flex items-center gap-3">
                  <Link href={`/pedigrees/${p.id}`}>
                    <button data-testid={`button-open-${p.id}`} className="text-xs flex items-center gap-1 hover:text-primary transition-colors text-muted-foreground">
                      Open <ChevronRight className="w-3 h-3" />
                    </button>
                  </Link>
                  <button
                    data-testid={`button-delete-${p.id}`}
                    onClick={() => handleDelete(p.id, p.title)}
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
    </div>
  );
}
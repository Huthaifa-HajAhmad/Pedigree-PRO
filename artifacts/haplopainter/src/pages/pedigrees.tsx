import { useState, useRef, useEffect } from "react";
import { useListPedigrees, useDeletePedigree, useCreatePedigree, useListPatients, queryKeys } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Plus, Trash2, ChevronRight, Dna, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImportDialog } from "@/components/ImportDialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/PageHeader";
import { SearchBar } from "@/components/shared/SearchBar";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormLayout } from "@/components/shared/FormLayout";
import { TableSkeleton } from "@/components/shared/Skeleton";
import { EmptyState } from "@/components/shared/EmptyState";

const schema = z.object({
  title: z.string().min(1, "Title required"),
  patientId: z.string().optional(),
  notes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function Pedigrees() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchTimerRef.current !== null) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => { if (searchTimerRef.current !== null) clearTimeout(searchTimerRef.current); };
  }, [search]);
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmProps, setConfirmProps] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: pedigrees, isLoading } = useListPedigrees({ search: debouncedSearch || undefined });
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
    <section className="p-6">
      <PageHeader
        icon={Dna}
        title="Pedigrees"
        subtitle={`${pedigrees?.length ?? 0} family trees`}
        actions={
          <div className="flex items-center gap-2">
            <ImportDialog>
              <Button variant="outline" data-testid="button-import-pedigree">
                <Upload className="w-4 h-4" /> Import
              </Button>
            </ImportDialog>
            <FormLayout
                open={open}
                onOpenChange={setOpen}
                title="Create Pedigree"
                submitLabel="Create & Open Editor"
                form={form}
                onSubmit={onSubmit}
                isSubmitting={createPedigree.isPending}
                trigger={
                  <Button data-testid="button-new-pedigree">
                    <Plus className="w-4 h-4" /> New Pedigree
                  </Button>
                }
              >
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider">Title</FormLabel>
                    <FormControl><Input {...field} data-testid="input-title" className="bg-muted border-border text-sm" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="patientId" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider">Patient (optional)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-patient" className="bg-muted border-border text-sm">
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
                    <FormControl><Input {...field} data-testid="input-notes" className="bg-muted border-border text-sm" /></FormControl>
                  </FormItem>
                )} />
              </FormLayout>
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
            <EmptyState icon={Dna} title="No pedigrees found" description="Create your first pedigree or import one." />
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
                    <Button variant="ghost" size="sm" data-testid={`button-open-${p.id}`} className="text-xs">
                      Open <ChevronRight className="w-3 h-3" />
                    </Button>
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
    </section>
  );
}
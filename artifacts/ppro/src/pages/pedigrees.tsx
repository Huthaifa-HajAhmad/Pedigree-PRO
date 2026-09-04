import { useState, useRef, useEffect } from "react";
import { useListPedigrees, useDeletePedigree, useCreatePedigree, useListPatients, useListProfiles, queryKeys, getBackendInitError, getProfilePrivateKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Plus, Trash2, Dna, Upload, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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
import { ErrorDialog } from "@/components/shared/ErrorDialog";
import { signData, computeHash } from "@workspace/crypto";
import { usePedigreeTabs } from "@/hooks/use-pedigree-tabs";

const schema = z.object({
  title: z.string().min(1, "Title required"),
  patientId: z.string().optional(),
  notes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

type SortField = "title" | "patient" | "versions" | "updated";
type SortDir = "asc" | "desc";

export default function Pedigrees() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("updated");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchTimerRef.current !== null) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => { if (searchTimerRef.current !== null) clearTimeout(searchTimerRef.current); };
  }, [search]);
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
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: pedigrees, isLoading } = useListPedigrees({ search: debouncedSearch || undefined });
  const { data: patients } = useListPatients();
  const { data: profiles } = useListProfiles();
  const deletePedigree = useDeletePedigree();
  const createPedigree = useCreatePedigree();
  const { openTab, closeTab, pruneStaleTabs } = usePedigreeTabs();

  useEffect(() => {
    if (pedigrees) {
      pruneStaleTabs(new Set(pedigrees.map((p) => p.id)));
    }
  }, [pedigrees, pruneStaleTabs]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", patientId: "", notes: "" },
  });

  const onSubmit = async (data: FormData) => {
    const canvasData = JSON.stringify({ nodes: [], edges: [] });
    const canvasHash = computeHash(canvasData);
    const activeProfile = profiles && profiles.length > 0 ? profiles[0] : null;
    const privateKey = activeProfile ? await getProfilePrivateKey(activeProfile.id) : null;
    const cryptoModule = await import("@workspace/crypto");
    const creatorKey = activeProfile?.public_key ?? (privateKey ? await cryptoModule.getPublicKeyFromPrivate(privateKey) : "");
    const creatorSignature = privateKey ? await signData(canvasHash, privateKey) : null;
    createPedigree.mutate(
      {
        title: data.title,
        patient_id: data.patientId ? parseInt(data.patientId, 10) : null,
        notes: data.notes ?? null,
        canvas_data: canvasData,
        canvas_hash: canvasHash,
        creator_key: creatorKey,
        creator_signature: creatorSignature,
      },
        {
          onSuccess: (pedigree) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.pedigrees });
            openTab(pedigree.id, pedigree.title);
            form.reset();
            setOpen(false);
            navigate(`/pedigrees/${pedigree.id}`);
          },
          onError: (error) => {
            const backendError = getBackendInitError();
            setErrorDialog({
              open: true,
              title: "Failed to Create Pedigree",
              message: "The pedigree could not be created. See details below.",
              error: backendError || error,
              details: backendError
                ? `Backend initialization error: ${backendError.message}`
                : `Error: ${error.message || "An unexpected error occurred"}`,
            });
          },
        }
      );
    };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "title" ? "asc" : "desc");
    }
  };

  const sortedPedigrees = pedigrees ? [...pedigrees].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortField) {
      case "title": return dir * a.title.localeCompare(b.title);
      case "patient": return dir * ((a.patient_id ?? Number.MAX_SAFE_INTEGER) - (b.patient_id ?? Number.MAX_SAFE_INTEGER));
      case "versions": return dir * (a.version_count - b.version_count);
      case "updated": return dir * (new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime());
      default: return 0;
    }
  }) : [];

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-muted-foreground/30" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />;
  };

  const handleDelete = (id: number, title: string) => {
    setConfirmProps({
      title: "Delete Pedigree",
      message: `Delete "${title}"? This cannot be undone.`,
      onConfirm: () => {
        setConfirmOpen(false);
        deletePedigree.mutate(id, {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.pedigrees });
            closeTab(id);
          },
        });
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
                            {p.last_name}, {p.first_name}
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 px-4 py-3 border-b border-border text-xs text-muted-foreground uppercase tracking-widest">
          <button type="button" onClick={() => toggleSort("title")} className="col-span-2 flex items-center gap-1 hover:text-foreground transition-colors">Title<SortIcon field="title" /></button>
          <button type="button" onClick={() => toggleSort("patient")} className="flex items-center gap-1 hover:text-foreground transition-colors">Patient<SortIcon field="patient" /></button>
          <button type="button" onClick={() => toggleSort("versions")} className="flex items-center gap-1 hover:text-foreground transition-colors">Versions<SortIcon field="versions" /></button>
          <div className="text-center">Actions</div>
        </div>
        <div className="divide-y divide-border">
          {isLoading ? (
            <TableSkeleton rows={5} cols={5} />
          ) : sortedPedigrees.length === 0 ? (
            <EmptyState icon={Dna} title="No pedigrees found" description="Create your first pedigree or import one." />
          ) : (
            sortedPedigrees.map((p) => (
              <div key={p.id} data-testid={`row-pedigree-${p.id}`} className="grid grid-cols-2 md:grid-cols-5 gap-4 px-4 py-3 text-sm hover:bg-accent transition-colors items-center">
                <Link href={`/pedigrees/${p.id}`} onClick={() => openTab(p.id, p.title)} className="col-span-2 md:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-4 items-center text-foreground hover:text-foreground hover:no-underline cursor-pointer">
                  <div className="col-span-2 flex items-center gap-2">
                    <Dna className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <span className="font-medium truncate">{p.title}</span>
                  </div>
                  <div className="text-muted-foreground text-xs truncate">{p.patient_id ? `#${p.patient_id}` : "—"}</div>
                  <div className="text-muted-foreground text-xs truncate">
                    <span className="font-mono">{p.version_count} ver{p.version_count !== 1 ? "s" : ""}</span>
                    <span className="mx-1.5 text-muted-foreground/40">·</span>
                    <span>{(() => { try { return new Date(p.updated_at).toLocaleDateString(); } catch { return "—"; } })()}</span>
                  </div>
                </Link>
                <div className="flex items-center justify-center gap-1">
                  <button
                    type="button"
                    data-testid={`button-delete-${p.id}`}
                    onClick={() => handleDelete(p.id, p.title)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded hover:bg-destructive/10"
                    title="Delete pedigree"
                    aria-label={`Delete pedigree ${p.title}`}
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
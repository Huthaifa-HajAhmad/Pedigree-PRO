import { useState, useRef, useEffect } from "react";
import { useListPatients, useCreatePatient, useUpdatePatient, useDeletePatient, queryKeys, getBackendInitError } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, Trash2, Eye, Activity, Pencil, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { SearchBar } from "@/components/shared/SearchBar";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormLayout } from "@/components/shared/FormLayout";
import { TableSkeleton } from "@/components/shared/Skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorDialog } from "@/components/shared/ErrorDialog";

const createPatientSchema = z.object({
  mrn: z.string().default(""),
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  dateOfBirth: z.string().optional(),
  sex: z.enum(["male", "female", "unknown"]).optional(),
  ethnicity: z.string().optional(),
});

type CreatePatientForm = z.infer<typeof createPatientSchema>;

type PatientSortField = "name" | "sex" | "updated";
type PatientSortDir = "asc" | "desc";

const editPatientSchema = z.object({
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  dateOfBirth: z.string().optional(),
  sex: z.enum(["male", "female", "unknown"]).optional(),
  ethnicity: z.string().optional(),
});
type EditPatientForm = z.infer<typeof editPatientSchema>;

export default function Patients() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortField, setSortField] = useState<PatientSortField>("updated");
  const [sortDir, setSortDir] = useState<PatientSortDir>("desc");
  const [editOpen, setEditOpen] = useState(false);
  const [editPatient, setEditPatient] = useState<{ id: number; firstName: string; lastName: string; dateOfBirth?: string; sex?: string; ethnicity?: string } | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchTimerRef.current !== null) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => { if (searchTimerRef.current !== null) clearTimeout(searchTimerRef.current); };
  }, [search]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmProps, setConfirmProps] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; title: string; message: string; error: Error | null; details: string }>({
    open: false,
    title: "",
    message: "",
    error: null,
    details: "",
  });
  const queryClient = useQueryClient();

  const { data: patients, isLoading } = useListPatients(debouncedSearch || undefined);
  const createPatient = useCreatePatient();
  const deletePatient = useDeletePatient();

  const form = useForm<CreatePatientForm>({
    resolver: zodResolver(createPatientSchema),
    defaultValues: { mrn: "", firstName: "", lastName: "", dateOfBirth: "", sex: undefined, ethnicity: "" },
  });

    const onSubmit = (data: CreatePatientForm) => {
      createPatient.mutate(
        {
          mrn: data.mrn,
          first_name: data.firstName,
          last_name: data.lastName,
          date_of_birth: data.dateOfBirth ?? undefined,
          sex: data.sex ?? undefined,
          ethnicity: data.ethnicity ?? undefined,
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.patients });
            form.reset();
            setDialogOpen(false);
          },
          onError: (error) => {
            const backendError = getBackendInitError();
            setErrorDialog({
              open: true,
              title: "Failed to Register Patient",
              message: "The patient could not be registered. See details below.",
              error: backendError || error,
              details: backendError
                ? `Backend initialization failed.\n${backendError.message}`
                : `Error: ${error.message}\n\nStack:\n${error.stack || "N/A"}`,
            });
          },
        }
      );
    };

  const handleDelete = (id: number, name: string) => {
    setConfirmProps({
      title: "Delete Patient",
      message: `Delete patient "${name}"? This cannot be undone.`,
      onConfirm: () => {
        setConfirmOpen(false);
        deletePatient.mutate(id, { onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.patients }) });
      },
    });
    setConfirmOpen(true);
  };

  const sexBadge = (sex: string | null, showDot = false) => {
    if (!sex) return showDot ? <><span className="inline-block w-2 h-2 rounded-full bg-gray-400 mr-1" />—</> : "—";
    const colorMap: Record<string, string> = { male: "bg-blue-400", female: "bg-pink-400", unknown: "bg-gray-400" };
    const classMap: Record<string, string> = { male: "text-blue-400", female: "text-pink-400", unknown: "text-gray-400" };
    return <span className={`capitalize ${classMap[sex] ?? "text-gray-400"}`}>
      {showDot && <span className={`inline-block w-2 h-2 rounded-full ${colorMap[sex] ?? "bg-gray-400"} mr-1`} />}{sex}
    </span>;
  };

  const toggleSort = (field: PatientSortField) => {
    if (sortField === field) { setSortDir(sortDir === "asc" ? "desc" : "asc"); }
    else { setSortField(field); setSortDir(field === "name" ? "asc" : "desc"); }
  };

  const sortedPatients = patients ? [...patients].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortField) {
      case "name": return dir * `${a.last_name}, ${a.first_name}`.localeCompare(`${b.last_name}, ${b.first_name}`);
      case "sex": return dir * (a.sex ?? "").localeCompare(b.sex ?? "");
      case "updated": return dir * (new Date(a.updated_at ?? a.created_at).getTime() - new Date(b.updated_at ?? b.created_at).getTime());
      default: return 0;
    }
  }) : [];

  const SortIcon = ({ field }: { field: PatientSortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-muted-foreground/30" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />;
  };

  const editForm = useForm<EditPatientForm>({ resolver: zodResolver(editPatientSchema) });
  const updatePatient = useUpdatePatient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openEdit = (p: any) => {
    setEditPatient({ id: p.id, firstName: p.first_name, lastName: p.last_name, dateOfBirth: p.date_of_birth ?? undefined, sex: p.sex ?? undefined, ethnicity: p.ethnicity ?? undefined });
    editForm.reset({ firstName: p.first_name, lastName: p.last_name, dateOfBirth: p.date_of_birth ?? "", sex: p.sex ?? undefined, ethnicity: p.ethnicity ?? "" });
    setEditOpen(true);
  };

  const onEditSubmit = (data: EditPatientForm) => {
    if (!editPatient) return;
    updatePatient.mutate({ id: editPatient.id, input: { first_name: data.firstName, last_name: data.lastName, date_of_birth: data.dateOfBirth ?? null, sex: data.sex ?? null, ethnicity: data.ethnicity ?? null } }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.patients }); setEditOpen(false); setEditPatient(null); },
    });
  };

  return (
    <section className="p-6">
      <PageHeader
        icon={Activity}
        title="Patients"
        subtitle={`Patient registry — ${patients?.length ?? 0} records`}
        actions={
          <FormLayout
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            title="Register Patient"
            submitLabel="Register Patient"
            form={form}
            onSubmit={onSubmit}
            isSubmitting={createPatient.isPending}
            trigger={
              <Button data-testid="button-create-patient">
                <Plus className="w-4 h-4" />
                New Patient
              </Button>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField control={form.control} name="firstName" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider">First Name</FormLabel>
                  <FormControl><Input {...field} data-testid="input-firstName" className="bg-muted border-border text-sm" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="lastName" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider">Last Name</FormLabel>
                  <FormControl><Input {...field} data-testid="input-lastName" className="bg-muted border-border text-sm" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField control={form.control} name="dateOfBirth" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider">Date of Birth</FormLabel>
                  <FormControl><Input {...field} type="date" data-testid="input-dob" className="bg-muted border-border text-sm" /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="sex" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider">Sex</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-sex" className="bg-muted border-border text-sm">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="unknown">Unknown</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="ethnicity" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider">Ethnicity</FormLabel>
                <FormControl><Input {...field} data-testid="input-ethnicity" className="bg-muted border-border text-sm" /></FormControl>
              </FormItem>
            )} />
          </FormLayout>
        }
      />

      <SearchBar
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or MRN..."
        testId="input-search-patients"
      />

      <div className="border border-border rounded overflow-hidden bg-card">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 px-4 py-3 border-b border-border text-xs text-muted-foreground uppercase tracking-widest">
          <button type="button" onClick={() => toggleSort("name")} className="col-span-2 flex items-center gap-1 hover:text-foreground transition-colors">Name<SortIcon field="name" /></button>
          <button type="button" onClick={() => toggleSort("sex")} className="flex items-center gap-1 hover:text-foreground transition-colors">Sex<SortIcon field="sex" /></button>
          <div>Details</div>
          <div>Actions</div>
        </div>
        <div className="divide-y divide-border">
          {isLoading ? (
            <TableSkeleton rows={5} cols={5} />
          ) : sortedPatients.length === 0 ? (
            <EmptyState icon={Activity} title="No patients found" description="Create your first patient record." />
          ) : (
              sortedPatients.map((p) => (
              <div key={p.id} data-testid={`row-patient-${p.id}`} className="grid grid-cols-2 md:grid-cols-5 gap-4 px-4 py-3 text-sm hover:bg-accent transition-colors items-center">
                <div className="col-span-2 font-medium">{p.last_name}, {p.first_name}</div>
                <div className="text-muted-foreground text-xs">{sexBadge(p.sex, true)}</div>
                <div className="text-muted-foreground text-xs">{p.date_of_birth ?? "—"}</div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    data-testid={`button-edit-patient-${p.id}`}
                    onClick={() => openEdit(p)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors"
                    title="Edit patient"
                    aria-label={`Edit patient ${p.first_name} ${p.last_name}`}
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                  <Link href={`/patients/${p.id}`}>
                    <button
                      type="button"
                      data-testid={`button-view-patient-${p.id}`}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors"
                      title="View patient details"
                      aria-label={`View patient ${p.first_name} ${p.last_name}`}
                    >
                       <Eye className="w-3 h-3" />
                       <span>View</span>
                    </button>
                  </Link>
                  <button
                    type="button"
                    data-testid={`button-delete-patient-${p.id}`}
                    onClick={() => handleDelete(p.id, `${p.first_name} ${p.last_name}`)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border text-muted-foreground hover:border-destructive/40 hover:text-destructive hover:bg-destructive/5 transition-colors"
                    title="Delete patient"
                    aria-label={`Delete patient ${p.first_name} ${p.last_name}`}
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Edit Patient Modal */}
      <FormLayout
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit Patient"
        submitLabel="Save Changes"
        form={editForm}
        onSubmit={onEditSubmit}
        isSubmitting={updatePatient.isPending}
        trigger={<></>}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField control={editForm.control} name="firstName" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider">First Name</FormLabel>
              <FormControl><Input {...field} className="bg-muted border-border text-sm" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={editForm.control} name="lastName" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider">Last Name</FormLabel>
              <FormControl><Input {...field} className="bg-muted border-border text-sm" /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField control={editForm.control} name="dateOfBirth" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider">Date of Birth</FormLabel>
              <FormControl><Input {...field} type="date" className="bg-muted border-border text-sm" /></FormControl>
            </FormItem>
          )} />
          <FormField control={editForm.control} name="sex" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider">Sex</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="bg-muted border-border text-sm">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )} />
        </div>
        <FormField control={editForm.control} name="ethnicity" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider">Ethnicity</FormLabel>
            <FormControl><Input {...field} className="bg-muted border-border text-sm" /></FormControl>
          </FormItem>
        )} />
      </FormLayout>

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
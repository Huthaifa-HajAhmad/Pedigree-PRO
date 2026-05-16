import { useState, useRef, useEffect } from "react";
import { useListPatients, useCreatePatient, useDeletePatient, queryKeys, getBackendInitError } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, Trash2, Eye, Activity } from "lucide-react";
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

export default function Patients() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
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

  const sexBadge = (sex: string | null) => {
    if (!sex) return "—";
    const classMap: Record<string, string> = { male: "text-blue-400", female: "text-pink-400", unknown: "text-gray-400" };
    return <span className={`capitalize ${classMap[sex] ?? "text-gray-400"}`}>{sex}</span>;
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
            <div className="grid grid-cols-2 gap-3">
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
            <div className="grid grid-cols-2 gap-3">
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
        <div className="grid grid-cols-5 gap-4 px-4 py-3 border-b border-border text-xs text-muted-foreground uppercase tracking-widest">
          <div className="col-span-2">Name</div>
          <div>MRN</div>
          <div>Details</div>
          <div>Actions</div>
        </div>
        <div className="divide-y divide-border">
          {isLoading ? (
            <TableSkeleton rows={5} cols={5} />
          ) : patients?.length === 0 ? (
            <EmptyState icon={Activity} title="No patients found" description="Create your first patient record." />
          ) : (
            patients?.map((p) => (
              <div key={p.id} data-testid={`row-patient-${p.id}`} className="grid grid-cols-5 gap-4 px-4 py-3 text-sm hover:bg-accent transition-colors items-center">
                <div className="col-span-2 font-medium">{p.last_name}, {p.first_name}</div>
                <div className="text-muted-foreground font-mono text-xs">{p.mrn}</div>
                <div className="text-muted-foreground text-xs">{p.date_of_birth ?? "—"} <span className="mx-1">·</span> {sexBadge(p.sex)}</div>
                <div className="flex items-center gap-1">
                  <Link href={`/patients/${p.id}`}>
                    <button
                      data-testid={`button-view-patient-${p.id}`}
                      className="text-muted-foreground hover:text-primary transition-colors p-1 rounded hover:bg-primary/10"
                      title="View patient details"
                    >
                       <Eye className="w-4 h-4" />
                    </button>
                  </Link>
                  <button
                    data-testid={`button-delete-patient-${p.id}`}
                    onClick={() => handleDelete(p.id, `${p.first_name} ${p.last_name}`)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded hover:bg-destructive/10"
                    title="Delete patient"
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
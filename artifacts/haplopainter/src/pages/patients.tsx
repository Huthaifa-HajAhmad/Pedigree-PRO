import { useState } from "react";
import { useListPatients, useCreatePatient, useDeletePatient, queryKeys } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, Trash2, ChevronRight, Activity } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { SearchBar } from "@/components/shared/SearchBar";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { TableSkeleton } from "@/components/shared/Skeleton";

const createPatientSchema = z.object({
  mrn: z.string().min(1, "MRN required"),
  firstName: z.string().min(1, "First name required"),
  lastName: z.string().min(1, "Last name required"),
  dateOfBirth: z.string().optional(),
  sex: z.enum(["male", "female", "unknown"]).optional(),
  ethnicity: z.string().optional(),
});

type CreatePatientForm = z.infer<typeof createPatientSchema>;

export default function Patients() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmProps, setConfirmProps] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const queryClient = useQueryClient();

  const { data: patients, isLoading } = useListPatients(search || undefined);
  const createPatient = useCreatePatient();
  const deletePatient = useDeletePatient();

  const form = useForm<CreatePatientForm>({
    resolver: zodResolver(createPatientSchema),
    defaultValues: { mrn: "", firstName: "", lastName: "", dateOfBirth: "", ethnicity: "" },
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
    <div className="p-6">
      <PageHeader
        icon={Activity}
        title="Patients"
        subtitle={`Patient registry — ${patients?.length ?? 0} records`}
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <button
                data-testid="button-create-patient"
                className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold tracking-wide transition-all bg-primary text-primary-foreground hover:opacity-90"
              >
                <Plus className="w-4 h-4" />
                New Patient
              </button>
            </DialogTrigger>
            <DialogContent className="glass-panel border-0 max-w-md">
              <DialogHeader>
                <DialogTitle className="tracking-wider uppercase text-sm text-primary">Register Patient</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                  <FormField control={form.control} name="mrn" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider">MRN</FormLabel>
                      <FormControl><Input {...field} data-testid="input-mrn" placeholder="MRN-2024-XXX" className="bg-muted border-border text-sm" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
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
                  <button
                    type="submit"
                    data-testid="button-submit-patient"
                    disabled={createPatient.isPending}
                    className="w-full py-2 rounded text-sm font-semibold tracking-wide transition-all bg-primary text-primary-foreground hover:opacity-90"
                  >
                    {createPatient.isPending ? "Saving..." : "Register Patient"}
                  </button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        }
      />

      <SearchBar
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or MRN..."
        testId="input-search-patients"
      />

      <div className="border border-border rounded overflow-hidden bg-card">
        <div className="grid grid-cols-7 gap-4 px-4 py-3 border-b border-border text-xs text-muted-foreground uppercase tracking-widest">
          <div className="col-span-2">Name</div>
          <div>MRN</div>
          <div>DOB</div>
          <div>Sex</div>
          <div>Pedigrees</div>
          <div>Actions</div>
        </div>
        <div className="divide-y divide-border">
          {isLoading ? (
            <TableSkeleton rows={5} cols={7} />
          ) : patients?.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">No patients found</div>
          ) : (
            patients?.map((p) => (
              <div key={p.id} data-testid={`row-patient-${p.id}`} className="grid grid-cols-7 gap-4 px-4 py-3 text-sm hover:bg-accent transition-colors items-center">
                <div className="col-span-2 font-medium">{p.last_name}, {p.first_name}</div>
                <div className="text-muted-foreground font-mono text-xs">{p.mrn}</div>
                <div className="text-muted-foreground text-xs">{p.date_of_birth ?? "—"}</div>
                <div className="text-xs">{sexBadge(p.sex)}</div>
                <div>
                  <span className="text-xs px-2 py-0.5 rounded border border-border text-muted-foreground">—</span>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/patients/${p.id}`}>
                    <button data-testid={`button-view-patient-${p.id}`} className="text-xs flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors">
                      View <ChevronRight className="w-3 h-3" />
                    </button>
                  </Link>
                  <button
                    data-testid={`button-delete-patient-${p.id}`}
                    onClick={() => handleDelete(p.id, `${p.first_name} ${p.last_name}`)}
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
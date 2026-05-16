import { useParams, Link } from "wouter";
import { useGetPatient, useListPedigrees, useCreatePedigree, queryKeys } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Dna, Plus, ChevronRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormLayout } from "@/components/shared/FormLayout";
import { EmptyState } from "@/components/shared/EmptyState";
import { TableSkeleton } from "@/components/shared/Skeleton";


const schema = z.object({ title: z.string().min(1, "Title required"), notes: z.string().optional() });
type FormData = z.infer<typeof schema>;

export default function PatientDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id, 10);
  const validId = Number.isFinite(id) && id > 0 ? id : 0;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: patient, isLoading } = useGetPatient(validId);
  const { data: pedigrees, isLoading: pedLoading } = useListPedigrees({ patientId: validId });
  const createPedigree = useCreatePedigree();

  const form = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { title: "", notes: "" } });

  const onSubmit = (data: FormData) => {
    createPedigree.mutate(
      {
        title: data.title,
        patient_id: id,
        notes: data.notes ?? undefined,
        creator_key: "",
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [...queryKeys.pedigrees, { patientId: validId }] });
          form.reset();
          setOpen(false);
        },
      }
    );
  };

  const Detail = ({ label, value }: { label: string; value: string | null | undefined }) => (
    <div className="py-2 border-b border-border last:border-0">
      <div className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5">{label}</div>
      <div className="text-sm">{value ?? "—"}</div>
    </div>
  );

  return (
    <section className="p-6">
      <Link href="/patients">
        <Button data-testid="button-back-patients" variant="ghost" className="mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Patients
        </Button>
      </Link>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-64" />
          <div className="h-4 bg-muted rounded w-40" />
        </div>
      ) : patient ? (
        <>
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight mb-1">
              {patient.last_name}, {patient.first_name}
            </h1>
            <div className="text-sm text-muted-foreground font-mono">{patient.mrn}</div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="border border-border rounded bg-card p-5">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">Demographics</h2>
              <Detail label="Date of Birth" value={patient.date_of_birth} />
              <Detail label="Sex" value={patient.sex} />
              <Detail label="Ethnicity" value={patient.ethnicity} />
              <Detail label="Registered" value={(() => { try { return new Date(patient.created_at).toLocaleDateString(); } catch { return "—"; } })()} />
            </div>

            <div className="lg:col-span-2 border border-border rounded bg-card">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Pedigrees ({pedigrees?.length ?? 0})</h2>
                <FormLayout
                  open={open}
                  onOpenChange={setOpen}
                  title="New Pedigree"
                  submitLabel="Create Pedigree"
                  form={form}
                  onSubmit={onSubmit}
                  isSubmitting={createPedigree.isPending}
                  trigger={
                    <Button data-testid="button-new-pedigree" size="sm">
                      <Plus className="w-3.5 h-3.5" /> New Pedigree
                    </Button>
                  }
                >
                  <FormField control={form.control} name="title" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider">Title</FormLabel>
                      <FormControl><Input {...field} data-testid="input-pedigree-title" className="bg-muted border-border text-sm" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground uppercase tracking-wider">Notes</FormLabel>
                      <FormControl><Input {...field} data-testid="input-pedigree-notes" className="bg-muted border-border text-sm" /></FormControl>
                    </FormItem>
                  )} />
                </FormLayout>
              </div>
              <div className="divide-y divide-border">
                {pedLoading ? (
                  <TableSkeleton rows={3} cols={1} />
                ) : pedigrees?.length === 0 ? (
                  <EmptyState icon={Dna} title="No pedigrees" description="No pedigrees linked to this patient yet." />
                ) : (
                  pedigrees?.map((p) => (
                    <Link key={p.id} href={`/pedigrees/${p.id}`}>
                      <div data-testid={`pedigree-${p.id}`} className="p-4 flex items-center gap-4 cursor-pointer hover:bg-accent transition-colors group">
                        <Dna className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{p.title}</div>
                          <div className="text-xs text-muted-foreground">{p.version_count} version{p.version_count !== 1 ? "s" : ""} · Updated {(() => { try { return new Date(p.updated_at).toLocaleDateString(); } catch { return "—"; } })()}</div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-16 text-muted-foreground">Patient not found</div>
      )}
    </section>
  );
}
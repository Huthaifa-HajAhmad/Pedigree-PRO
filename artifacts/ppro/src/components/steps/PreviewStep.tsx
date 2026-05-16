import { FileText, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ParseResult } from "@/lib/import-pedigree";

interface PreviewStepProps {
  importMode: "ped" | "ppro";
  filename: string;
  title: string;
  setTitle: (v: string) => void;
  patientId: string;
  setPatientId: (v: string) => void;
  result: ParseResult;
  error: string | null;
  onBack: () => void;
  onImport: () => void;
  patients?: Array<{ id: number; first_name: string; last_name: string; mrn: string }> | null;
}

export function PreviewStep({ importMode, filename, title, setTitle, patientId, setPatientId, result, error, onBack, onImport, patients }: PreviewStepProps) {
  const isPPro = importMode === "ppro";
  const subtitle = isPPro
    ? "Pedigree PRO native export — cryptographic provenance verified"
    : `${result.canvasData.nodes.length} individuals · ${result.canvasData.edges.length} relationships`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-3 border border-border rounded bg-muted/30">
        <FileText className="w-5 h-5 text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{filename}</div>
          <div className="text-xs text-muted-foreground">{subtitle}</div>
        </div>
        <button type="button" aria-label="Remove file" onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      {result.warnings.length > 0 && (
        <div className="border border-yellow-500/30 bg-yellow-500/10 rounded p-3 space-y-1">
          <div className="flex items-center gap-2 text-yellow-400 text-xs font-semibold uppercase tracking-wider">
            <AlertTriangle className="w-3.5 h-3.5" /> {result.warnings.length} warning{result.warnings.length !== 1 ? "s" : ""}
          </div>
          {result.warnings.map((w, i) => <div key={`${w.substring(0, 24)}-${i}`} className="text-xs text-yellow-300/80">{w}</div>)}
        </div>
      )}

      <div>
        <label htmlFor={`import-title-${importMode}`} className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Pedigree Title</label>
        <input id={`import-title-${importMode}`} data-testid="input-import-title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-muted border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary transition-colors" />
      </div>
      <div>
        <label htmlFor={`import-patient-${importMode}`} className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Link to Patient (optional)</label>
        <select id={`import-patient-${importMode}`} data-testid="select-import-patient" value={patientId} onChange={(e) => setPatientId(e.target.value)} className="w-full bg-muted border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary transition-colors text-foreground">
          <option value="">No patient</option>
          {patients?.map((p) => <option key={p.id} value={String(p.id)}>{p.last_name}, {p.first_name} ({p.mrn})</option>)}
        </select>
      </div>

      {error && <div className="flex items-start gap-2 text-destructive bg-destructive/10 border border-destructive/30 rounded p-3 text-xs"><AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{error}</span></div>}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">Back</Button>
        <Button data-testid="button-confirm-import" onClick={onImport} disabled={!title.trim()} className="flex-1">Import & Open Editor</Button>
      </div>
    </div>
  );
}

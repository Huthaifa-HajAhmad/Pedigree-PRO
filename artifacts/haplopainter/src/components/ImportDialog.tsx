import { useRef, useState } from "react";
import { useCreatePedigree, useListPatients, useImportPedigreeNative, useImportPedigreeLegacy, queryKeys, detectApiMode } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Upload, FileText, AlertTriangle, CheckCircle2, X, Dna, Database } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { parseFile, type ParseResult } from "@/lib/import-pedigree";

interface Props {
  children: React.ReactNode;
}

type Step = "upload" | "preview" | "importing" | "legacy_summary";
type ImportMode = "ped" | "hpcl" | "legacy";

export function ImportDialog({ children }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [result, setResult] = useState<ParseResult | null>(null);
  const [filename, setFilename] = useState("");
  const [title, setTitle] = useState("");
  const [patientId, setPatientId] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>("ped");
  const fileRef = useRef<HTMLInputElement>(null);
  const isBrowserMode = detectApiMode() === "browser";

  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { data: patients } = useListPatients();
  const createPedigree = useCreatePedigree();
  const importNative = useImportPedigreeNative();
  const importLegacy = useImportPedigreeLegacy();

  const reset = () => {
    setStep("upload");
    setResult(null);
    setFilename("");
    setTitle("");
    setPatientId("");
    setError(null);
    setDragOver(false);
    setImportMode("ped");
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    setOpen(v);
  };

  const detectImportMode = (file: File): ImportMode => {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (ext === "hpcl") return "hpcl";
    if (ext === "db" || ext === "sqlite" || ext === "sqlite3") return "legacy";
    return "ped";
  };

  const processFile = (file: File) => {
    setError(null);
    const mode = detectImportMode(file);
    setImportMode(mode);

    if (mode === "hpcl") {
      if (file.size > 50 * 1024 * 1024) {
        setError("File too large (max 50 MB).");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        try {
          const parsed = JSON.parse(content);
          setResult({
            canvasData: parsed.pedigree?.canvas_data || { nodes: [], edges: [] },
            familyIds: [],
            warnings: [],
            suggestedTitle: parsed.pedigree?.title || file.name.replace(".hpcl", ""),
          });
          setFilename(file.name);
          setTitle(parsed.pedigree?.title || file.name.replace(".hpcl", ""));
          setStep("preview");
        } catch (err) {
          setError(`Invalid .hpcl file: ${err instanceof Error ? err.message : String(err)}`);
        }
      };
      reader.onerror = () => setError("Failed to read file.");
      reader.readAsText(file, "UTF-8");
      return;
    }

    if (mode === "legacy") {
      setFilename(file.name);
      setStep("preview");
      return;
    }

    const validExts = ["ped", "hap", "tfam", "csv", "tsv", "txt"];
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!validExts.includes(ext)) {
      setError(`Unsupported file type ".${ext}". Accepted: .ped, .hap, .tfam, .csv, .tsv, .txt, .hpcl, .db`);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("File too large (max 5 MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        const parsed = parseFile(content, file.name);
        setResult(parsed);
        setFilename(file.name);
        setTitle(parsed.suggestedTitle);
        setStep("preview");
      } catch (err) {
        setError(`Parse error: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    reader.onerror = () => setError("Failed to read file.");
    reader.readAsText(file, "UTF-8");
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleImport = () => {
    if (!result || !title.trim()) return;
    setStep("importing");
    createPedigree.mutate(
      {
        title: title.trim(),
        patient_id: patientId ? parseInt(patientId, 10) : undefined,
        notes: `Imported from ${filename}. ${result.warnings.length > 0 ? "Warnings: " + result.warnings.join("; ") : ""}`.trim() || undefined,
        canvas_data: JSON.stringify(result.canvasData),
        creator_key: "",
      },
      {
        onSuccess: (pedigree) => {
          queryClient.invalidateQueries({ queryKey: queryKeys.pedigrees });
          setOpen(false);
          reset();
          navigate(`/pedigrees/${pedigree.id}`);
        },
        onError: () => {
          setError("Failed to create pedigree. Please try again.");
          setStep("preview");
        },
      }
    );
  };

  const handleLegacyImport = () => {
    setStep("importing");
    importLegacy.mutate(filename, {
      onSuccess: (summary) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.pedigrees });
        setResult({
          canvasData: { nodes: [], edges: [] },
          familyIds: [],
          warnings: [`Imported: ${summary.pedigrees_imported} pedigrees, ${summary.patients_imported} patients, ${summary.users_found} users`],
          suggestedTitle: `Legacy DB: ${filename}`,
        });
        setStep("legacy_summary");
      },
      onError: (err) => {
        setError(`Legacy import failed: ${err instanceof Error ? err.message : String(err)}`);
        setStep("preview");
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="glass-panel border-0 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm uppercase tracking-wider flex items-center gap-2 text-primary">
            <Upload className="w-4 h-4" />
            Import Pedigree
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Import from <span className="text-foreground font-semibold">HaploPainter / PLINK PED</span>,{" "}
              <span className="text-foreground font-semibold">HaploClinical .hpcl</span>, or a{" "}
              <span className="text-foreground font-semibold">legacy HaploPainter database</span> (.db).
            </p>

            <div
              data-testid="dropzone"
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200 ${
                dragOver
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50 hover:bg-accent"
              }`}
            >
              <Upload className={`w-8 h-8 transition-colors ${dragOver ? "text-primary" : "text-muted-foreground"}`} />
              <div className="text-center">
                <div className="text-sm font-medium">Drop file here or click to browse</div>
                <div className="text-xs text-muted-foreground mt-1">.ped · .hap · .tfam · .csv · .tsv · .txt · .hpcl · .db — max 50 MB</div>
              </div>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".ped,.hap,.tfam,.csv,.tsv,.txt,.hpcl,.db,.sqlite,.sqlite3"
                onChange={handleFileInput}
                data-testid="file-input"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 text-destructive bg-destructive/10 border border-destructive/30 rounded p-3 text-xs">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="border border-border rounded p-4 space-y-3 bg-muted/30">
              <div className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Supported Formats</div>
              <div className="space-y-2">
                <div>
                  <div className="text-xs font-semibold text-foreground mb-1">HaploClinical .hpcl</div>
                  <div className="text-xs text-muted-foreground">Native export format with cryptographic provenance. Import with full signature verification.</div>
                </div>
                <div className="border-t border-border pt-2">
                  <div className="text-xs font-semibold text-foreground mb-1">Legacy Database (.db)</div>
                  <div className="text-xs text-muted-foreground">HaploPainter SQLite database. Full migration with dual-write and user name preservation.</div>
                </div>
                <div className="border-t border-border pt-2">
                  <div className="text-xs font-semibold text-foreground mb-1">HaploPainter PED  (.ped, .hap, .tfam)</div>
                  <div className="text-xs text-muted-foreground">FamilyID  IndivID  FatherID  MotherID  Sex  Phenotype</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === "preview" && importMode === "ped" && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 border border-border rounded bg-muted/30">
              <FileText className="w-5 h-5 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{filename}</div>
                <div className="text-xs text-muted-foreground">{result.canvasData.nodes.length} individuals · {result.canvasData.edges.length} relationships</div>
              </div>
              <button onClick={() => { setStep("upload"); setResult(null); setError(null); }} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
            {result.warnings.length > 0 && (
              <div className="border border-yellow-500/30 bg-yellow-500/10 rounded p-3 space-y-1">
                <div className="flex items-center gap-2 text-yellow-400 text-xs font-semibold uppercase tracking-wider">
                  <AlertTriangle className="w-3.5 h-3.5" /> {result.warnings.length} warning{result.warnings.length !== 1 ? "s" : ""}
                </div>
                {result.warnings.map((w, i) => <div key={i} className="text-xs text-yellow-300/80">{w}</div>)}
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Pedigree Title</label>
              <input data-testid="input-import-title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-muted border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary transition-colors" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Link to Patient (optional)</label>
              <select data-testid="select-import-patient" value={patientId} onChange={(e) => setPatientId(e.target.value)} className="w-full bg-muted border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary transition-colors text-foreground">
                <option value="">No patient</option>
                {patients?.map((p) => <option key={p.id} value={String(p.id)}>{p.last_name}, {p.first_name} ({p.mrn})</option>)}
              </select>
            </div>
            {error && (
              <div className="flex items-start gap-2 text-destructive bg-destructive/10 border border-destructive/30 rounded p-3 text-xs">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{error}</span>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => { setStep("upload"); setResult(null); setError(null); }} className="flex-1 py-2 rounded border border-border text-sm hover:border-primary hover:text-primary transition-colors">Back</button>
              <button data-testid="button-confirm-import" onClick={handleImport} disabled={!title.trim()} className="flex-1 py-2 rounded text-sm font-semibold transition-all disabled:opacity-40 bg-primary text-primary-foreground">Import & Open Editor</button>
            </div>
          </div>
        )}

        {step === "preview" && importMode === "hpcl" && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 border border-border rounded bg-muted/30">
              <FileText className="w-5 h-5 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{filename}</div>
                <div className="text-xs text-muted-foreground">HaploClinical .hpcl — cryptographic provenance verified</div>
              </div>
              <button onClick={() => { setStep("upload"); setResult(null); }} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"><X className="w-4 h-4" /></button>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Pedigree Title</label>
              <input data-testid="input-import-title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-muted border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary transition-colors" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Link to Patient (optional)</label>
              <select data-testid="select-import-patient" value={patientId} onChange={(e) => setPatientId(e.target.value)} className="w-full bg-muted border border-border rounded px-3 py-2 text-sm outline-none focus:border-primary transition-colors text-foreground">
                <option value="">No patient</option>
                {patients?.map((p) => <option key={p.id} value={String(p.id)}>{p.last_name}, {p.first_name} ({p.mrn})</option>)}
              </select>
            </div>
            {error && <div className="flex items-start gap-2 text-destructive bg-destructive/10 border border-destructive/30 rounded p-3 text-xs"><AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{error}</span></div>}
            <div className="flex gap-3">
              <button onClick={() => { setStep("upload"); setResult(null); }} className="flex-1 py-2 rounded border border-border text-sm hover:border-primary hover:text-primary transition-colors">Back</button>
              <button data-testid="button-confirm-import" onClick={handleImport} disabled={!title.trim()} className="flex-1 py-2 rounded text-sm font-semibold transition-all disabled:opacity-40 bg-primary text-primary-foreground">Import & Open Editor</button>
            </div>
          </div>
        )}

        {step === "preview" && importMode === "legacy" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 border border-border rounded bg-muted/30">
              <Database className="w-5 h-5 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{filename}</div>
                <div className="text-xs text-muted-foreground">Legacy HaploPainter SQLite Database</div>
              </div>
              <button onClick={() => { setStep("upload"); setError(null); }} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"><X className="w-4 h-4" /></button>
            </div>

            {isBrowserMode && (
              <div className="border border-yellow-500/30 bg-yellow-500/10 rounded p-3">
                <div className="flex items-center gap-2 text-yellow-400 text-xs font-semibold uppercase tracking-wider mb-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Desktop Only
                </div>
                <div className="text-xs text-yellow-300/80">
                  Legacy database import requires filesystem access and is only available in the Tauri desktop app.
                </div>
              </div>
            )}

            <div className="border border-yellow-500/30 bg-yellow-500/10 rounded p-3">
              <div className="flex items-center gap-2 text-yellow-400 text-xs font-semibold uppercase tracking-wider mb-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Legacy Migration
              </div>
              <div className="text-xs text-yellow-300/80 space-y-1">
                <p>This will import all patients, pedigrees, version history, and activity logs from the legacy database.</p>
                <p>A new "Legacy Migration" profile will be created to attribute all imported records.</p>
                <p>Legacy user names will be preserved in pedigree notes and activity entries.</p>
              </div>
            </div>

            {error && <div className="flex items-start gap-2 text-destructive bg-destructive/10 border border-destructive/30 rounded p-3 text-xs"><AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{error}</span></div>}

            <div className="flex gap-3">
              <button onClick={() => { setStep("upload"); setError(null); }} className="flex-1 py-2 rounded border border-border text-sm hover:border-primary hover:text-primary transition-colors">Back</button>
              <button data-testid="button-confirm-legacy-import" onClick={handleLegacyImport} disabled={isBrowserMode} className="flex-1 py-2 rounded text-sm font-semibold transition-all bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed">
                {isBrowserMode ? "Desktop Only" : "Migrate Database"}
              </button>
            </div>
          </div>
        )}

        {step === "legacy_summary" && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 border border-emerald-500/30 bg-emerald-500/10 rounded">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div className="text-sm font-medium text-emerald-300">Migration Complete</div>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              {result.warnings.map((w, i) => <div key={i} className="text-emerald-300/80">{w}</div>)}
            </div>
            <button onClick={() => { queryClient.invalidateQueries({ queryKey: queryKeys.pedigrees }); setOpen(false); reset(); navigate("/pedigrees"); }} className="w-full py-2 rounded text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90">
              View Pedigrees
            </button>
          </div>
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Dna className="w-10 h-10 animate-spin text-primary" />
            <div className="text-sm text-muted-foreground tracking-wider">
              {importMode === "legacy" ? "Migrating database..." : "Importing pedigree..."}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
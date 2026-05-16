import { useRef, useState } from "react";
import { useCreatePedigree, useListPatients, useListProfiles, useImportPedigreeLegacy, queryKeys, detectApiMode } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Upload } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UploadStep } from "@/components/steps/UploadStep";
import { PreviewStep } from "@/components/steps/PreviewStep";
import { LegacyPreviewStep } from "@/components/steps/LegacyPreviewStep";
import { LegacySummaryStep } from "@/components/steps/LegacySummaryStep";
import { ImportingStep } from "@/components/steps/ImportingStep";
import { parseFile, type ParseResult } from "@/lib/import-pedigree";
import { signData, computeHash, getPublicKeyFromPrivate } from "@workspace/crypto";
import { listProfilePrivateKeys } from "@workspace/browser-backend";

interface Props {
  children: React.ReactNode;
}

type Step = "upload" | "preview" | "importing" | "legacy_summary";
type ImportMode = "ped" | "ppro" | "legacy";

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
  const { data: profiles } = useListProfiles();
  const createPedigree = useCreatePedigree();
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
    if (ext === "ppro") return "ppro";
    if (ext === "db" || ext === "sqlite" || ext === "sqlite3") return "legacy";
    return "ped";
  };

  const processFile = (file: File) => {
    setError(null);
    const mode = detectImportMode(file);
    setImportMode(mode);

    if (mode === "ppro") {
      if (file.size > 20 * 1024 * 1024) { setError("File too large (max 20 MB)."); return; }
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        try {
          const parsed = JSON.parse(content);
          setResult({
            canvasData: parsed.pedigree?.canvas_data || { nodes: [], edges: [] },
            familyIds: [], warnings: [],
            suggestedTitle: parsed.pedigree?.title || file.name.replace(".ppro", ""),
          });
          setFilename(file.name);
          setTitle(parsed.pedigree?.title || file.name.replace(".ppro", ""));
          setStep("preview");
        } catch (err) { setError(`Invalid .ppro file: ${err instanceof Error ? err.message : String(err)}`); }
      };
      reader.onerror = () => setError("Failed to read file.");
      reader.readAsText(file, "UTF-8");
      return;
    }

    if (mode === "legacy") { setFilename(file.name); setStep("preview"); return; }

    const validExts = ["ped", "hap", "tfam", "csv", "tsv", "txt"];
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!validExts.includes(ext)) { setError(`Unsupported file type ".${ext}". Accepted: .ped, .hap, .tfam, .csv, .tsv, .txt, .ppro, .db`); return; }
    if (file.size > 5 * 1024 * 1024) { setError("File too large (max 5 MB)."); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        const parsed = parseFile(content, file.name);
        setResult(parsed); setFilename(file.name); setTitle(parsed.suggestedTitle); setStep("preview");
      } catch (err) { setError(`Parse error: ${err instanceof Error ? err.message : String(err)}`); }
    };
    reader.onerror = () => setError("Failed to read file.");
    reader.readAsText(file, "UTF-8");
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); const file = e.dataTransfer.files[0]; if (file) processFile(file); };

  const handleImport = async () => {
    if (!result || !title.trim()) return;
    setStep("importing");
    const canvasData = JSON.stringify(result.canvasData);
    const canvasHash = computeHash(canvasData);
    const keys = await listProfilePrivateKeys();
    const activeKey = keys.length > 0 ? keys[0] : null;
    const creatorKey = profiles?.[0]?.public_key ?? (activeKey ? await getPublicKeyFromPrivate(activeKey.privateKey) : "");
    const creatorSignature = activeKey ? await signData(canvasHash, activeKey.privateKey) : null;
    createPedigree.mutate({
      title: title.trim(),
      patient_id: patientId ? parseInt(patientId, 10) : undefined,
      notes: `Imported from ${filename}. ${result.warnings.length > 0 ? "Warnings: " + result.warnings.join("; ") : ""}`.trim() || undefined,
      canvas_data: canvasData,
      canvas_hash: canvasHash,
      creator_key: creatorKey,
      creator_signature: creatorSignature,
    }, {
      onSuccess: (pedigree) => { queryClient.invalidateQueries({ queryKey: queryKeys.pedigrees }); setOpen(false); reset(); navigate(`/pedigrees/${pedigree.id}`); },
      onError: () => { setError("Failed to create pedigree."); setStep("preview"); },
    });
  };

  const handleLegacyImport = () => {
    setStep("importing");
    importLegacy.mutate(filename, {
      onSuccess: (summary) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.pedigrees });
        setResult({ canvasData: { nodes: [], edges: [] }, familyIds: [], warnings: [`Imported: ${summary.pedigrees_imported} pedigrees, ${summary.patients_imported} patients`], suggestedTitle: `Legacy DB: ${filename}` });
        setStep("legacy_summary");
      },
      onError: (err) => { setError(`Legacy import failed: ${err instanceof Error ? err.message : String(err)}`); setStep("preview"); },
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="glass-panel border-0 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm uppercase tracking-wider flex items-center gap-2 text-primary">
            <Upload className="w-4 h-4" /> Import Pedigree
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && <UploadStep dragOver={dragOver} setDragOver={setDragOver} fileRef={fileRef} handleFileInput={handleFileInput} handleDrop={handleDrop} error={error} />}

        {step === "preview" && importMode !== "legacy" && result && (
          <PreviewStep importMode={importMode} filename={filename} title={title} setTitle={setTitle}
            patientId={patientId} setPatientId={setPatientId} result={result}
            error={error} patients={patients}
            onBack={() => { setStep("upload"); setResult(null); setError(null); }}
            onImport={handleImport} />
        )}

        {step === "preview" && importMode === "legacy" && (
          <LegacyPreviewStep filename={filename} isBrowserMode={isBrowserMode}
            error={error} onBack={() => { setStep("upload"); setError(null); }}
            onImport={handleLegacyImport} />
        )}

        {step === "legacy_summary" && result && (
          <LegacySummaryStep result={result}
            onDone={() => { queryClient.invalidateQueries({ queryKey: queryKeys.pedigrees }); setOpen(false); reset(); navigate("/pedigrees"); }} />
        )}

        {step === "importing" && <ImportingStep importMode={importMode} />}
      </DialogContent>
    </Dialog>
  );
}

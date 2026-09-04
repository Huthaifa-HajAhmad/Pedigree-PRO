import { useRef, useState } from "react";
import { useCreatePedigree, useListPatients, useListProfiles, queryKeys, getProfilePrivateKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Upload } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UploadStep } from "@/components/steps/UploadStep";
import { PreviewStep } from "@/components/steps/PreviewStep";
import { ImportingStep } from "@/components/steps/ImportingStep";
import { parseFile, type ParseResult } from "@/lib/import-pedigree";
import { signData, computeHash, getPublicKeyFromPrivate } from "@workspace/crypto";
import { validatePproExport } from "@workspace/browser-backend";
import { usePedigreeTabs } from "@/hooks/use-pedigree-tabs";

interface Props {
  children: React.ReactNode;
}

type Step = "upload" | "preview" | "importing";
type ImportMode = "ped" | "ppro";

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

  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { data: patients } = useListPatients();
  const { data: profiles } = useListProfiles();
  const createPedigree = useCreatePedigree();
  const { openTab } = usePedigreeTabs();

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
          const validated = validatePproExport(parsed);
          setResult({
            canvasData: (validated.pedigree?.canvas_data as any) || { nodes: [], edges: [], annotations: [] },
            familyIds: [], warnings: [],
            suggestedTitle: validated.pedigree?.title || file.name.replace(".ppro", ""),
          });
          setFilename(file.name);
          setTitle(validated.pedigree?.title || file.name.replace(".ppro", ""));
          setStep("preview");
        } catch (err) { setError(`Invalid .ppro file: ${err instanceof Error ? err.message : String(err)}`); }
      };
      reader.onerror = () => setError("Failed to read file.");
      reader.readAsText(file, "UTF-8");
      return;
    }

    const validExts = ["ped", "hap", "tfam", "hp", "csv", "tsv", "txt", "utf8"];
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!validExts.includes(ext)) { setError(`Unsupported file type ".${ext}". Accepted: .ped, .hap, .tfam, .hp, .csv, .tsv, .txt, .utf8, .ppro`); return; }
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
    const activeProfile = profiles?.[0];
    const privateKey = activeProfile ? await getProfilePrivateKey(activeProfile.id) : null;
    const creatorKey = activeProfile?.public_key ?? (privateKey ? await getPublicKeyFromPrivate(privateKey) : "");
    const creatorSignature = privateKey ? await signData(canvasHash, privateKey) : null;
    createPedigree.mutate({
      title: title.trim(),
      patient_id: patientId ? parseInt(patientId, 10) : undefined,
      notes: `Imported from ${filename}. ${result.warnings.length > 0 ? "Warnings: " + result.warnings.join("; ") : ""}`.trim() || undefined,
      canvas_data: canvasData,
      canvas_hash: canvasHash,
      creator_key: creatorKey,
      creator_signature: creatorSignature,
    }, {
      onSuccess: (pedigree) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.pedigrees });
        openTab(pedigree.id, pedigree.title);
        setOpen(false);
        reset();
        navigate(`/pedigrees/${pedigree.id}`);
      },
      onError: () => { setError("Failed to create pedigree."); setStep("preview"); },
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="border border-slate-200 dark:border-slate-800 max-w-lg bg-background/95 backdrop-blur-lg shadow-2xl rounded-xl sm:rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-sm uppercase tracking-wider flex items-center gap-2 text-primary">
            <Upload className="w-4 h-4" /> Import Pedigree
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && <UploadStep dragOver={dragOver} setDragOver={setDragOver} fileRef={fileRef} handleFileInput={handleFileInput} handleDrop={handleDrop} error={error} />}

        {step === "preview" && result && (
          <PreviewStep importMode={importMode} filename={filename} title={title} setTitle={setTitle}
            patientId={patientId} setPatientId={setPatientId} result={result}
            error={error} patients={patients}
            onBack={() => { setStep("upload"); setResult(null); setError(null); }}
            onImport={handleImport} />
        )}

        {step === "importing" && <ImportingStep importMode={importMode} />}
      </DialogContent>
    </Dialog>
  );
}

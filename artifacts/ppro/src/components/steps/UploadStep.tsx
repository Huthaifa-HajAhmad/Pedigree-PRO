import type { Dispatch, RefObject, SetStateAction } from "react";
import { Upload, ChevronDown, ChevronUp, FileCheck, FileText, Paintbrush } from "lucide-react";
import { useState } from "react";

interface UploadStepProps {
  dragOver: boolean;
  setDragOver: Dispatch<SetStateAction<boolean>>;
  fileRef: RefObject<HTMLInputElement | null>;
  handleFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDrop: (e: React.DragEvent) => void;
  error: string | null;
}

export function UploadStep({ dragOver, setDragOver, fileRef, handleFileInput, handleDrop, error }: UploadStepProps) {
  const [formatsExpanded, setFormatsExpanded] = useState(false);

  return (
    <div className="space-y-4">
      <div
        data-testid="dropzone"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200 ${
          dragOver
            ? "border-primary bg-primary/10"
            : "border-border hover:border-primary/50 hover:bg-accent"
        }`}
      >
        <Upload className={`w-7 h-7 transition-colors ${dragOver ? "text-primary" : "text-muted-foreground"}`} />
        <div className="text-center">
          <div className="text-sm font-medium">Drop file here or click to browse</div>
          <div className="text-xs text-muted-foreground mt-1">.ppro · .ped · .hp · .utf8 — max 20 MB</div>
        </div>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept=".ped,.hap,.tfam,.hp,.csv,.tsv,.txt,.utf8,.ppro"
          onChange={handleFileInput}
          data-testid="file-input"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 text-destructive bg-destructive/10 border border-destructive/30 rounded p-3 text-xs">
          <Upload className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="button"
        onClick={() => setFormatsExpanded((v) => !v)}
        className="w-full flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {formatsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        <span className="font-medium">Supported formats</span>
        <span className="text-muted-foreground/60">3 formats</span>
      </button>

      {formatsExpanded && (
        <div className="space-y-2 text-xs">
          <div className="flex items-start gap-3 p-2.5 rounded-md border border-border/50 bg-muted/20">
            <FileCheck className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-foreground">Pedigree PRO <span className="text-muted-foreground font-normal">.ppro</span></div>
              <div className="text-muted-foreground mt-0.5">Native export with signature verification. Preserves layout, annotations, and cryptographic provenance.</div>
            </div>
          </div>
          <div className="flex items-start gap-3 p-2.5 rounded-md border border-border/50 bg-muted/20">
            <FileText className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-foreground">PLINK PED <span className="text-muted-foreground font-normal">.ped .hap .tfam .csv .tsv .txt</span></div>
              <div className="text-muted-foreground mt-0.5">Standard pedigree format. Columns: FamilyID, IndividualID, FatherID, MotherID, Sex, Phenotype. Auto-layout applied on import.</div>
            </div>
          </div>
          <div className="flex items-start gap-3 p-2.5 rounded-md border border-border/50 bg-muted/20">
            <Paintbrush className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-foreground">HaploPainter <span className="text-muted-foreground font-normal">.hp .txt .utf8</span></div>
              <div className="text-muted-foreground mt-0.5">HaploPainter pedigree export. Auto-detects explicit, header-delimited, or whitespace-delimited format variants.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import type { Dispatch, RefObject, SetStateAction } from "react";
import { Upload } from "lucide-react";

interface UploadStepProps {
  dragOver: boolean;
  setDragOver: Dispatch<SetStateAction<boolean>>;
  fileRef: RefObject<HTMLInputElement | null>;
  handleFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDrop: (e: React.DragEvent) => void;
  error: string | null;
}

export function UploadStep({ dragOver, setDragOver, fileRef, handleFileInput, handleDrop, error }: UploadStepProps) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground leading-relaxed">
        Import from <span className="text-foreground font-semibold">PLINK PED</span>,{" "}
        <span className="text-foreground font-semibold">Pedigree PRO .ppro</span>, or a{" "}
        <span className="text-foreground font-semibold">legacy database</span> (.db).
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
          <div className="text-xs text-muted-foreground mt-1">.ped · .hap · .tfam · .csv · .tsv · .txt · .ppro · .db — max 20 MB</div>
        </div>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept=".ped,.hap,.tfam,.csv,.tsv,.txt,.ppro,.db,.sqlite,.sqlite3"
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

      <div className="border border-border rounded p-4 space-y-3 bg-muted/30">
        <div className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Supported Formats</div>
        <div className="space-y-2">
          <div>
            <div className="text-xs font-semibold text-foreground mb-1">Pedigree PRO .ppro</div>
            <div className="text-xs text-muted-foreground">Native export format with cryptographic provenance. Import with full signature verification.</div>
          </div>
          <div className="border-t border-border pt-2">
            <div className="text-xs font-semibold text-foreground mb-1">Legacy Database (.db)</div>
            <div className="text-xs text-muted-foreground">Legacy SQLite database. Full migration with dual-write and user name preservation.</div>
          </div>
          <div className="border-t border-border pt-2">
            <div className="text-xs font-semibold text-foreground mb-1">PLINK PED  (.ped, .hap, .tfam)</div>
            <div className="text-xs text-muted-foreground">FamilyID  IndivID  FatherID  MotherID  Sex  Phenotype</div>
          </div>
        </div>
      </div>
    </div>
  );
}

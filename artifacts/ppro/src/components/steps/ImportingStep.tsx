import { Dna } from "lucide-react";

interface ImportingStepProps {
  importMode: string;
}

export function ImportingStep({ importMode }: ImportingStepProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <Dna className="w-10 h-10 animate-spin text-primary" />
      <div className="text-sm text-muted-foreground tracking-wider">
        {importMode === "legacy" ? "Migrating database..." : "Importing pedigree..."}
      </div>
    </div>
  );
}

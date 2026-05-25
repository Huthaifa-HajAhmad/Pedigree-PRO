import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ParseResult } from "@/lib/import-pedigree";

interface LegacySummaryStepProps {
  result: ParseResult;
  onDone: () => void;
}

export function LegacySummaryStep({ result, onDone }: LegacySummaryStepProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-3 border border-primary/30 bg-primary/10 rounded">
        <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
        <div className="text-sm font-medium text-primary">Migration Complete</div>
      </div>
      <div className="text-xs text-muted-foreground space-y-1">
        {result.warnings.map((w, i) => <div key={`${w.substring(0, 24)}-${i}`} className="text-primary/80">{w}</div>)}
      </div>
      <Button onClick={onDone} className="w-full">View Pedigrees</Button>
    </div>
  );
}

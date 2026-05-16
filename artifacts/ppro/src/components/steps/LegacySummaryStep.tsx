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
      <div className="flex items-center gap-3 p-3 border border-emerald-500/30 bg-emerald-500/10 rounded">
        <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
        <div className="text-sm font-medium text-emerald-300">Migration Complete</div>
      </div>
      <div className="text-xs text-muted-foreground space-y-1">
        {result.warnings.map((w, i) => <div key={`${w.substring(0, 24)}-${i}`} className="text-emerald-300/80">{w}</div>)}
      </div>
      <Button onClick={onDone} className="w-full">View Pedigrees</Button>
    </div>
  );
}

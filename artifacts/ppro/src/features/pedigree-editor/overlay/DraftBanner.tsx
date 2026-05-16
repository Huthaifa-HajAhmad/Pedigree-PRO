import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DraftBanner({
  onRestore, onDismiss,
}: {
  onRestore: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-amber-500/30 flex-shrink-0 bg-amber-500/10">
      <div className="flex items-center gap-2">
        <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
        <span className="text-xs text-amber-200">
          You have unsaved work from a previous session for this pedigree.
        </span>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0 ml-4">
        <Button size="sm" variant="outline" onClick={onRestore} className="border-amber-500/60 text-amber-300 hover:bg-amber-500/20">Restore</Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>Dismiss</Button>
      </div>
    </div>
  );
}
import { Clock } from "lucide-react";

export function DraftBanner({
  onRestore, onDismiss,
}: {
  onRestore: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-amber-500/30 flex-shrink-0" style={{ background: "rgba(120,70,0,0.25)" }}>
      <div className="flex items-center gap-2">
        <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
        <span className="text-xs text-amber-200">
          You have unsaved work from a previous session for this pedigree.
        </span>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0 ml-4">
        <button onClick={onRestore} className="text-xs px-3 py-1 rounded border border-amber-500/60 text-amber-300 hover:bg-amber-500/20 transition-colors font-medium">Restore</button>
        <button onClick={onDismiss} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Dismiss</button>
      </div>
    </div>
  );
}
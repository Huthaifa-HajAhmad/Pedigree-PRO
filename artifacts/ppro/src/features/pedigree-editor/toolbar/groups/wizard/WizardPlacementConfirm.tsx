import { AlertTriangle, RefreshCw, Plus } from "lucide-react";

export function WizardPlacementConfirm({
  onReplace,
  onAppend,
}: {
  onReplace: () => void;
  onAppend: () => void;
}) {
  return (
    <div className="flex-1 p-6 overflow-y-auto min-h-0 flex flex-col items-center justify-center text-center">
      <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-2">
        <AlertTriangle className="w-6 h-6 text-amber-500" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-bold text-foreground">Pedigree Placement Options</h3>
        <p className="text-xs text-muted-foreground max-w-sm">
          Your canvas already contains family members. How would you like to place the newly configured pedigree?
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md mt-4">
        <button
          type="button"
          onClick={onReplace}
          className="flex-1 p-5 rounded-xl border border-border bg-card hover:bg-destructive/5 hover:border-destructive/30 transition-all text-center flex flex-col items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-destructive/30"
        >
          <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive group-hover:scale-105 transition-transform shrink-0">
            <RefreshCw className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground">Clear & Replace</h4>
            <p className="text-[10px] text-muted-foreground mt-1 leading-normal">
              Wipe the current pedigree and start fresh with this family.
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={onAppend}
          className="flex-1 p-5 rounded-xl border border-border bg-card hover:bg-primary/5 hover:border-primary/30 transition-all text-center flex flex-col items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform shrink-0">
            <Plus className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground">Add alongside</h4>
            <p className="text-[10px] text-muted-foreground mt-1 leading-normal">
              Keep your current pedigree and place this family next to it.
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}

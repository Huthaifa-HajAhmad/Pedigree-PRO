import { Undo2, Redo2, Trash2 } from "lucide-react";

interface EditGroupProps {
  undo: () => void;
  redo: () => void;
  deleteSelected: () => void;
  historyLength: number;
  futureLength: number;
  selectedCount: number;
  anySelected: boolean;
  labelHidden?: boolean;
}

export function EditGroup({ undo, redo, deleteSelected, historyLength, futureLength, selectedCount, anySelected, labelHidden = false }: EditGroupProps) {
  return (
    <div className="flex flex-col justify-between h-full border-r border-border flex-shrink-0 px-2 pt-2 pb-2">
      <div className="flex-1 flex items-center gap-1">
        <button type="button" onClick={undo} disabled={historyLength === 0} title="Undo (Ctrl+Z)" aria-label="Undo"
          className="flex flex-col items-center gap-1.5 min-w-[44px] min-h-[44px] py-1 rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <Undo2 className="w-5 h-5" />
          <span className="text-[11px] leading-tight font-medium">Undo</span>
        </button>
        <button type="button" onClick={redo} disabled={futureLength === 0} title="Redo (Ctrl+Shift+Z)" aria-label="Redo"
          className="flex flex-col items-center gap-1.5 min-w-[44px] min-h-[44px] py-1 rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <Redo2 className="w-5 h-5" />
          <span className="text-[11px] leading-tight font-medium">Redo</span>
        </button>
        <div className="w-px self-stretch bg-border mx-0.5 my-1" />
        <button type="button" data-testid="button-delete-node" onClick={deleteSelected} disabled={!anySelected} title="Delete selected (Del)" aria-label="Delete selected"
          className="flex flex-col items-center gap-1.5 min-w-[44px] min-h-[44px] py-1 rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive active:bg-destructive/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <Trash2 className="w-5 h-5" />
          <span className="text-[11px] leading-tight font-medium">{selectedCount > 1 ? `Del (${selectedCount})` : "Delete"}</span>
        </button>
      </div>
      {!labelHidden && <div className="text-[10px] text-muted-foreground uppercase tracking-wider text-center border-t border-border/40 pt-1">Edit</div>}
    </div>
  );
}

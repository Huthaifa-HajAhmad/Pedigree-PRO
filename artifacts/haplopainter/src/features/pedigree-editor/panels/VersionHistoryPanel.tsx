import { Save, RotateCcw, Trash2 } from "lucide-react";

export function VersionHistoryPanel({
  versions, versionsLoading, onSave, onRestore, onDelete,
}: {
  versions: Array<{
    id: number;
    label?: string | null;
    version_number: number;
    thumbnail?: string | null;
    created_at: string;
  }> | undefined;
  versionsLoading: boolean;
  onSave: () => void;
  onRestore: (versionId: number) => void;
  onDelete: (versionId: number) => void;
}) {
  return (
    <div className="w-64 border-l border-border glass-panel flex-shrink-0 overflow-y-auto">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-foreground">Saved Sessions</div>
          <div className="text-[9px] text-muted-foreground mt-0.5">Restore any snapshot below</div>
        </div>
        <button onClick={onSave} title="Save current session"
          className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-primary">
          <Save className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="divide-y divide-border">
        {versionsLoading ? (
          [...Array(3)].map((_, i) => <div key={i} className="p-3 animate-pulse h-14 bg-muted/20 rounded m-2" />)
        ) : versions?.length === 0 ? (
          <div className="p-6 text-center">
            <Save className="w-6 h-6 mx-auto mb-2 text-muted-foreground/40" />
            <div className="text-xs text-muted-foreground">No sessions saved yet.</div>
            <div className="text-[10px] text-muted-foreground/60 mt-1">Click Save in the toolbar to snapshot the current state.</div>
          </div>
        ) : (
          versions?.map((v) => (
            <div key={v.id} data-testid={`version-${v.id}`} className="p-2.5 hover:bg-accent/50 transition-colors group">
              <div className="flex items-start gap-2.5">
                {v.thumbnail ? (
                  <div className="flex-shrink-0 w-[72px] h-[45px] rounded border border-border overflow-hidden bg-black">
                    <img src={v.thumbnail} alt={`Session v${v.version_number} preview`}
                      className="w-full h-full object-contain" draggable={false} />
                  </div>
                ) : (
                  <div className="flex-shrink-0 w-[72px] h-[45px] rounded border border-border bg-muted/10 flex items-center justify-center">
                    <span className="text-[8px] text-muted-foreground/40">no preview</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <div className="text-xs font-medium text-foreground truncate leading-tight">
                      {v.label ?? `Session v${v.version_number}`}
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                      <button data-testid={`button-restore-${v.id}`} onClick={() => onRestore(v.id)}
                        className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10" title="Restore this session">
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      <button data-testid={`button-delete-version-${v.id}`} onClick={() => onDelete(v.id)}
                        className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="Delete this session">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                    <span>v{v.version_number}</span>
                    <span className="opacity-30">·</span>
                    <span>{new Date(v.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
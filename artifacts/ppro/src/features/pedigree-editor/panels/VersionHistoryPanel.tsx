import { Save, RotateCcw, Trash2, Clock, Calendar } from "lucide-react";
import { PanelShell } from "@/components/shared/panels/PanelShell";
import { usePedigreeEditor } from "@/features/pedigree-editor/context";
import { Button } from "@/components/ui/button";
import { computeCanvasDiff, diffSummary } from "@/features/collaboration/VisualDiffEngine";
import { parseCanvas } from "@/features/pedigree-editor/utils/helpers";

export function VersionHistoryPanel({ onClose }: { onClose: () => void }) {
  const { state, dispatch, ops, versions, versionsLoading } = usePedigreeEditor();

  const getDiffText = (versionCanvasData: string) => {
    try {
      const parsedHistorical = JSON.parse(versionCanvasData);
      const liveCanvas = state.liveCanvasCache || state.canvas;
      const diff = computeCanvasDiff(parsedHistorical, liveCanvas);
      const summary = diffSummary(diff);
      return summary === "No changes" ? null : summary;
    } catch {
      return null;
    }
  };

  return (
    <PanelShell
      title="Version History"
      icon={<Clock className="w-3.5 h-3.5" />}
      onClose={onClose}
      width="w-80"
      actions={
        <button
          type="button"
          aria-label="Save current session"
          onClick={ops.handleSaveVersion}
          title="Save current session"
          className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-primary"
        >
          <Save className="w-3.5 h-3.5" />
        </button>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">Select any snapshot below to preview changes</p>
        <div className="space-y-2">
          {versionsLoading ? (
            Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="p-3 animate-pulse h-16 bg-muted/20 rounded-lg border border-border/50" />
            ))
          ) : versions?.length === 0 ? (
            <div className="p-6 text-center">
              <Clock className="w-6 h-6 mx-auto mb-2 text-muted-foreground/40" />
              <div className="text-xs text-muted-foreground">No sessions saved yet.</div>
              <div className="text-xs text-muted-foreground/60 mt-1">
                Click the Save icon in the toolbar or sidebar header to snapshot the current state.
              </div>
            </div>
          ) : (
            versions?.map((v) => {
              const isSelected = state.isPreviewMode && state.previewVersionId === v.id;
              const diffText = getDiffText(v.canvas_data);
              const dateText = (() => {
                try {
                  return new Date(v.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "2-digit",
                  });
                } catch {
                  return "—";
                }
              })();
              const timeText = (() => {
                try {
                  return new Date(v.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                } catch {
                  return "—";
                }
              })();

              return (
                <div
                  key={v.id}
                  data-testid={`version-${v.id}`}
                  onClick={() => {
                    if (isSelected) {
                      dispatch({ type: "EXIT_PREVIEW" });
                    } else {
                      dispatch({ type: "ENTER_PREVIEW", canvas: parseCanvas(v.canvas_data), versionId: v.id });
                    }
                  }}
                  className={`p-2.5 rounded-lg border transition-all cursor-pointer group flex gap-2.5 items-start ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border/60 bg-card/50 hover:border-muted-foreground/30 hover:bg-accent/30"
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="flex-shrink-0 w-16 h-10 rounded border border-border overflow-hidden bg-muted/20 relative flex items-center justify-center">
                    {v.thumbnail ? (
                      <img
                        src={v.thumbnail}
                        alt={`Session v${v.version_number} preview`}
                        className="w-full h-full object-contain"
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                      />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-muted-foreground/40" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <div className="text-xs font-semibold text-foreground truncate leading-tight">
                        {v.label ?? `Session v${v.version_number}`}
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                        <button
                          type="button"
                          aria-label="Restore this session"
                          data-testid={`button-restore-${v.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            ops.handleRestoreVersion(v.id);
                          }}
                          className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10"
                          title="Restore this session"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Delete this session"
                          data-testid={`button-delete-version-${v.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            ops.handleDeleteVersion(v.id);
                          }}
                          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Delete this session"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      <span className="font-medium">v{v.version_number}</span>
                      <span className="opacity-30">·</span>
                      <span className="flex items-center gap-0.5 font-mono">
                        <Calendar className="w-2.5 h-2.5 opacity-60" />
                        {dateText} {timeText}
                      </span>
                    </div>

                    {v.saver_key && (
                      <div className="text-[9px] text-primary/75 truncate font-mono mt-0.5">
                        by {v.saver_key.slice(0, 8)}
                      </div>
                    )}

                    {diffText && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold border border-emerald-500/20">
                          {diffText}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {state.isPreviewMode && (
        <div className="sticky bottom-0 bg-background/95 backdrop-blur-md border-t border-border -mx-3 -mb-3 p-3.5 z-10 space-y-3 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={state.showVisualDiff}
              onChange={(e) => dispatch({ type: "TOGGLE_VISUAL_DIFF", enabled: e.target.checked })}
              className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary/30"
            />
            <span className="text-xs text-muted-foreground font-semibold">Highlight Changes</span>
          </label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => ops.handleRestoreVersion(state.previewVersionId || 0)}
              className="flex-1"
            >
              Restore
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => dispatch({ type: "EXIT_PREVIEW" })}
            >
              Exit
            </Button>
          </div>
        </div>
      )}
    </PanelShell>
  );
}
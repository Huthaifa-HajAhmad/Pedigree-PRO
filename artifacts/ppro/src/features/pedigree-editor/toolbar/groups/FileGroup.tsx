import { useState, useCallback, useRef, useEffect } from "react";
import { Save, Clock, Trash2 } from "lucide-react";

interface FileGroupProps {
  handleSaveVersion: () => void;
  showSaveModal: boolean;
  setShowSaveModal: (v: boolean) => void;
  sessionLabel: string;
  setSessionLabel: (v: string) => void;
  commitSaveVersion: () => void;
  saveVersion: { isPending: boolean };
  showVersions: boolean;
  setShowVersions: (v: boolean) => void;
  canvasNodesLength: number;
  canvasEdgesLength: number;
  pedigreeTitle: string;
  onDeletePedigree: () => void;
  labelHidden?: boolean;
}

function useDropdownPosition(ref: React.RefObject<HTMLButtonElement | null>) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left });
  }, [ref]);
  return { pos, measure };
}

export function FileGroup({
  handleSaveVersion, showSaveModal, setShowSaveModal,
  sessionLabel, setSessionLabel, commitSaveVersion, saveVersion,
  showVersions, setShowVersions, canvasNodesLength, canvasEdgesLength, pedigreeTitle, onDeletePedigree, labelHidden = false,
}: FileGroupProps) {
  const saveRef = useRef<HTMLButtonElement>(null);
  const { pos: savePos, measure: measureSave } = useDropdownPosition(saveRef);

  useEffect(() => {
    if (!showSaveModal) return;
    measureSave();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowSaveModal(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showSaveModal, measureSave, setShowSaveModal]);

  return (
    <div className="flex flex-col justify-between h-full flex-shrink-0 px-2 pt-2 pb-2">
      <div className="flex-1 flex items-center gap-1">
        <button ref={saveRef} type="button" data-testid="button-save-version" onClick={handleSaveVersion} title="Save session snapshot to database" aria-label="Save session snapshot"
          aria-pressed={showSaveModal}
          className={`flex flex-col items-center gap-1.5 min-w-[44px] min-h-[44px] py-1 rounded text-[11px] leading-tight font-medium transition-colors ${showSaveModal ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
          <Save className="w-5 h-5" />
          <span>Save</span>
        </button>
        <button type="button" data-testid="button-history" onClick={() => setShowVersions(!showVersions)} title="Browse saved sessions" aria-label="Browse saved sessions"
          aria-pressed={showVersions}
          className={`flex flex-col items-center gap-1.5 min-w-[44px] min-h-[44px] py-1 rounded text-[11px] leading-tight font-medium transition-colors ${showVersions ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
          <Clock className="w-5 h-5" />
          <span>Sessions</span>
        </button>
        <button type="button" data-testid="button-delete-pedigree" onClick={onDeletePedigree} title="Delete this pedigree" aria-label="Delete pedigree"
          className="flex flex-col items-center gap-1.5 min-w-[44px] min-h-[44px] py-1 rounded text-[11px] leading-tight font-medium transition-colors text-muted-foreground hover:bg-red-500/10 hover:text-red-400">
          <Trash2 className="w-5 h-5" />
          <span>Delete</span>
        </button>
        {showSaveModal && savePos && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowSaveModal(false)} />
            <div className="fixed z-50 w-72 border border-border rounded-lg shadow-xl overflow-hidden bg-popover"
              style={{ top: savePos.top, left: savePos.left }}>
              <div className="px-3 py-2 border-b border-border text-xs text-muted-foreground uppercase tracking-widest">Save Session</div>
              <div className="p-3 space-y-2">
                <label htmlFor="session-label-input" className="text-xs text-muted-foreground">Label for this snapshot:</label>
                <input
                  id="session-label-input"
                  autoFocus
                  value={sessionLabel}
                  onChange={(e) => setSessionLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") commitSaveVersion(); if (e.key === "Escape") setShowSaveModal(false); }}
                  className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded focus:outline-none focus:border-primary"
                  placeholder="Session name…"
                />
                <div className="text-xs text-muted-foreground">{canvasNodesLength} nodes · {canvasEdgesLength} connections</div>
                <div className="flex gap-2">
                  <button type="button" onClick={commitSaveVersion} disabled={saveVersion.isPending}
                    className="flex-1 py-1.5 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
                    {saveVersion.isPending ? "Saving…" : "Save Session"}
                  </button>
                  <button type="button" onClick={() => setShowSaveModal(false)} className="px-3 py-1.5 text-xs rounded border border-border hover:bg-accent transition-colors">Cancel</button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      {!labelHidden && <div className="text-[10px] text-muted-foreground uppercase tracking-wider text-center border-t border-border/40 pt-1">File</div>}
    </div>
  );
}

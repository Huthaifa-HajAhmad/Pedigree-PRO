import { Save, Clock } from "lucide-react";

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
  labelHidden?: boolean;
}

export function FileGroup({
  handleSaveVersion, showSaveModal, setShowSaveModal,
  sessionLabel, setSessionLabel, commitSaveVersion, saveVersion,
  showVersions, setShowVersions, canvasNodesLength, canvasEdgesLength, labelHidden = false,
}: FileGroupProps) {
  return (
    <div className="flex flex-col justify-between border-l border-border flex-shrink-0 px-2 pt-2 pb-2">
      <div className="flex items-center gap-0.5">
        <div className="relative">
          <button type="button" data-testid="button-save-version" onClick={handleSaveVersion} title="Save session snapshot to database" aria-label="Save session snapshot"
            className={`flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded text-xs leading-none transition-colors ${showSaveModal ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
            <Save className="w-4 h-4" />
            <span>Save</span>
          </button>
          <button type="button" data-testid="button-history" onClick={() => setShowVersions(!showVersions)} title="Browse saved sessions" aria-label="Browse saved sessions"
            className={`flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded text-xs leading-none transition-colors ${showVersions ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
            <Clock className="w-4 h-4" />
            <span>Sessions</span>
          </button>
          {showSaveModal && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowSaveModal(false)} />
              <div className="absolute left-0 top-full mt-1 z-50 w-72 border border-border rounded-lg shadow-xl overflow-hidden bg-popover">
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
      </div>
      {!labelHidden && <div className="text-xs text-muted-foreground uppercase tracking-widest text-center border-t border-border/40 pt-0.5">File</div>}
    </div>
  );
}

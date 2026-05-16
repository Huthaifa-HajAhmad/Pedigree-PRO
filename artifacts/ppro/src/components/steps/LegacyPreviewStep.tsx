import { Database, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LegacyPreviewStepProps {
  filename: string;
  isBrowserMode: boolean;
  error: string | null;
  onBack: () => void;
  onImport: () => void;
}

export function LegacyPreviewStep({ filename, isBrowserMode, error, onBack, onImport }: LegacyPreviewStepProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-3 border border-border rounded bg-muted/30">
        <Database className="w-5 h-5 text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{filename}</div>
          <div className="text-xs text-muted-foreground">Legacy Pedigree PRO SQLite Database</div>
        </div>
        <button type="button" aria-label="Remove file" onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"><X className="w-4 h-4" /></button>
      </div>

      {isBrowserMode && (
        <div className="border border-yellow-500/30 bg-yellow-500/10 rounded p-3">
          <div className="flex items-center gap-2 text-yellow-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Desktop Only
          </div>
          <div className="text-xs text-yellow-300/80">
            Legacy database import requires filesystem access and is only available in the Tauri desktop app.
          </div>
        </div>
      )}

      <div className="border border-yellow-500/30 bg-yellow-500/10 rounded p-3">
        <div className="flex items-center gap-2 text-yellow-400 text-xs font-semibold uppercase tracking-wider mb-1">
          <AlertTriangle className="w-3.5 h-3.5" /> Legacy Migration
        </div>
        <div className="text-xs text-yellow-300/80 space-y-1">
          <p>This will import all patients, pedigrees, version history, and activity logs from the legacy database.</p>
          <p>A new "Legacy Migration" profile will be created to attribute all imported records.</p>
          <p>Legacy user names will be preserved in pedigree notes and activity entries.</p>
        </div>
      </div>

      {error && <div className="flex items-start gap-2 text-destructive bg-destructive/10 border border-destructive/30 rounded p-3 text-xs"><AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{error}</span></div>}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">Back</Button>
        <Button data-testid="button-confirm-legacy-import" onClick={onImport} disabled={isBrowserMode} className="flex-1">
          {isBrowserMode ? "Desktop Only" : "Migrate Database"}
        </Button>
      </div>
    </div>
  );
}

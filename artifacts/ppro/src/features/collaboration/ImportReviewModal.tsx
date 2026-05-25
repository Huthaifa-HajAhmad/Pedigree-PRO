import { useState, useMemo } from "react";
import { X, GitMerge, GitBranch, Trash2, ShieldCheck, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CanvasData } from "@/features/pedigree-editor/canvas/types";
import { computeCanvasDiff, diffColor } from "./VisualDiffEngine";

interface ImportReviewModalProps {
  incomingTitle: string;
  incomingCanvas: CanvasData;
  currentCanvas: CanvasData | null;
  incomingProvenance: {
    creator_key: string;
    creator_signature?: string;
    timestamp: string;
  };
  onMerge: (mergedCanvas: CanvasData) => void;
  onBranch: (canvas: CanvasData, title: string) => void;
  onReject: () => void;
}

/**
 * ImportReviewModal — Side-by-side diff review for incoming shared pedigrees.
 *
 * Presents three decisions:
 * - Merge: Apply incoming changes into current version
 * - Branch: Create a new independent pedigree copy
 * - Reject: Discard the import
 */
export function ImportReviewModal({
  incomingTitle,
  incomingCanvas,
  currentCanvas,
  incomingProvenance,
  onMerge,
  onBranch,
  onReject,
}: ImportReviewModalProps) {
  const [decision, setDecision] = useState<"merge" | "branch" | "reject" | null>(null);
  const [newTitle, setNewTitle] = useState(`${incomingTitle} (copy)`);

  const diff = useMemo(() => {
    if (!currentCanvas) return null;
    return computeCanvasDiff(currentCanvas, incomingCanvas);
  }, [currentCanvas, incomingCanvas]);

  const isVerified = !!incomingProvenance.creator_signature;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onReject} />
      <div className="relative z-10 w-full max-w-2xl max-h-[85vh] overflow-y-auto border border-border rounded-lg shadow-2xl p-6 bg-card">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className={`w-4 h-4 ${isVerified ? "text-primary" : "text-yellow-400"}`} />
            <span className="font-semibold text-sm">Review Import</span>
          </div>
          <button type="button" aria-label="Close import review" onClick={onReject} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Provenance */}
        <div className="mb-4 px-3 py-2 rounded border border-border bg-muted/30">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Provenance</div>
          <div className="text-xs font-mono text-foreground/80">
            Creator: {incomingProvenance.creator_key.slice(0, 16)}...
          </div>
          <div className="text-xs text-muted-foreground">
            {new Date(incomingProvenance.timestamp).toLocaleString()}
            {isVerified ? " · Signature verified" : " · No signature"}
          </div>
        </div>

        {/* Diff summary */}
        {diff && (
          <div className="mb-4 px-3 py-2 rounded border border-border bg-muted/30">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Changes</div>
            <div className="text-xs">
              <span className="text-primary font-medium">+{diff.addedNodes.length} nodes</span>
              {diff.removedNodes.length > 0 && (
                <span className="text-red-400 font-medium ml-2">-{diff.removedNodes.length} nodes</span>
              )}
              {diff.changedNodes.length > 0 && (
                <span className="text-yellow-400 font-medium ml-2">~{diff.changedNodes.length} modified</span>
              )}
              {diff.addedEdges.length > 0 && (
                <span className="text-primary font-medium ml-2">+{diff.addedEdges.length} edges</span>
              )}
              {diff.removedEdges.length > 0 && (
                <span className="text-red-400 font-medium ml-2">-{diff.removedEdges.length} edges</span>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {diff.nodeDiffs.filter((d) => d.status !== "unchanged").map((nodeDiff) => (
                <span
                  key={nodeDiff.id}
                  className="text-xs px-1.5 py-0.5 rounded border"
                  style={{
                    borderColor: diffColor(nodeDiff.status),
                    color: diffColor(nodeDiff.status),
                    backgroundColor: `${diffColor(nodeDiff.status)}15`,
                  }}
                >
                  {nodeDiff.id.slice(0, 6)} {nodeDiff.status}
                </span>
              ))}
            </div>
          </div>
        )}

        {!currentCanvas && (
          <div className="mb-4 px-3 py-2 rounded border border-yellow-500/30 bg-yellow-500/5 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 mt-0.5" />
            <span className="text-xs text-yellow-400/80">
              No current pedigree to compare against. Import will create a new pedigree.
            </span>
          </div>
        )}

        {/* Decision buttons */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <Button
            variant={decision === "merge" ? "default" : "outline"}
            onClick={() => setDecision("merge")}
            className="flex-col h-auto py-3 gap-1.5"
          >
            <GitMerge className="w-4 h-4" />
            <span className="text-xs font-medium">Merge</span>
            <span className="text-xs text-muted-foreground">Apply changes to current</span>
          </Button>

          <Button
            variant={decision === "branch" ? "default" : "outline"}
            onClick={() => setDecision("branch")}
            className="flex-col h-auto py-3 gap-1.5"
          >
            <GitBranch className="w-4 h-4" />
            <span className="text-xs font-medium">Branch</span>
            <span className="text-xs text-muted-foreground">Create new pedigree</span>
          </Button>

          <Button
            variant={decision === "reject" ? "destructive" : "outline"}
            onClick={() => setDecision("reject")}
            className="flex-col h-auto py-3 gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-xs font-medium">Reject</span>
            <span className="text-xs text-muted-foreground">Discard import</span>
          </Button>
        </div>

        {/* Branch name input */}
        {decision === "branch" && (
          <div className="mb-4">
            <label htmlFor="branch-title" className="text-xs text-muted-foreground block mb-1">New pedigree title</label>
            <input
              id="branch-title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded focus:outline-none focus:border-primary"
            />
          </div>
        )}

        {/* Confirm */}
        {decision && (
          <div className="flex gap-2">
            {decision === "merge" && (
              <Button
                size="sm"
                onClick={() => onMerge(incomingCanvas)}
                className="flex-1"
              >
                Confirm Merge
              </Button>
            )}
            {decision === "branch" && (
              <Button
                size="sm"
                onClick={() => onBranch(incomingCanvas, newTitle)}
                className="flex-1"
              >
                Create Branch
              </Button>
            )}
            {decision === "reject" && (
              <Button
                variant="destructive"
                size="sm"
                onClick={onReject}
                className="flex-1"
              >
                Confirm Reject
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDecision(null)}
            >
              Back
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

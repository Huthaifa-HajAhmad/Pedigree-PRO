import { AlertTriangle, ShieldCheck } from "lucide-react";
import { ValidationIssueRow } from "@/features/pedigree-editor/panels/ValidationPanel";
import type { PedigreeNode } from "@/features/pedigree-editor/canvas/types";
import type { ValidationResult } from "@/lib/validate-pedigree";

export interface ValidationPanelWrapperProps {
  validation: ValidationResult;
  expandedIssueId: string | null;
  onToggleIssue: (id: string) => void;
  onFocusIssue: (nodeIds: string[]) => void;
  nodes: PedigreeNode[];
}

export function ValidationPanelWrapper({
  validation,
  expandedIssueId,
  onToggleIssue,
  onFocusIssue,
  nodes,
}: ValidationPanelWrapperProps) {
  return (
    <div className="w-72 border-l border-border glass-panel flex-shrink-0 overflow-y-auto">
      {/* Panel header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Validation</div>
          <div
            className={`text-xs mt-0.5 ${
              validation.errorCount > 0
                ? "text-red-400"
                : validation.warningCount > 0
                ? "text-yellow-400"
                : "text-primary"
            }`}
          >
            {validation.errorCount > 0
              ? `${validation.errorCount} error${validation.errorCount !== 1 ? "s" : ""}, ${validation.warningCount} warning${validation.warningCount !== 1 ? "s" : ""}`
              : validation.warningCount > 0
              ? `${validation.warningCount} warning${validation.warningCount !== 1 ? "s" : ""}`
              : "No issues found ✓"}
          </div>
        </div>
        {validation.issues.length === 0 ? (
          <ShieldCheck className="w-5 h-5 text-primary" />
        ) : (
          <AlertTriangle
            className={`w-5 h-5 ${validation.errorCount > 0 ? "text-red-400" : "text-yellow-400"}`}
          />
        )}
      </div>

      {/* Issue list */}
      {validation.issues.length === 0 ? (
        <div className="p-6 text-center">
          <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-primary" />
          <div className="text-xs text-muted-foreground">This pedigree passes all structural checks.</div>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {validation.issues.map((issue) => (
            <ValidationIssueRow
              key={issue.id}
              issue={issue as any}
              expanded={expandedIssueId === issue.id}
              onToggle={() => onToggleIssue(issue.id)}
              onFocus={() => onFocusIssue(issue.nodeIds)}
              nodes={nodes}
            />
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="p-4 border-t border-border space-y-1.5 mt-auto">
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Legend</div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" /> Error — structural impossibility
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" /> Warning — review recommended
        </div>
      </div>
    </div>
  );
}
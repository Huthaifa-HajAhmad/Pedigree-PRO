import { AlertTriangle, ShieldCheck } from "lucide-react";
import { ValidationIssueRow } from "@/features/pedigree-editor/panels/ValidationPanel";
import { PanelShell } from "@/components/shared/panels/PanelShell";
import type { PedigreeNode } from "@/features/pedigree-editor/canvas/types";
import type { ValidationResult } from "@/lib/validate-pedigree";

export interface ValidationPanelWrapperProps {
  validation: ValidationResult;
  expandedIssueId: string | null;
  onToggleIssue: (id: string) => void;
  onFocusIssue: (nodeIds: string[]) => void;
  nodes: PedigreeNode[];
  onClose?: () => void;
}

export function ValidationPanelWrapper({
  validation,
  expandedIssueId,
  onToggleIssue,
  onFocusIssue,
  nodes,
  onClose,
}: ValidationPanelWrapperProps) {
  const hasIssues = validation.issues.length > 0;
  const hasErrors = validation.errorCount > 0;

  return (
    <PanelShell
      title="Validation"
      icon={
        hasIssues
          ? <AlertTriangle className={`w-3.5 h-3.5 ${hasErrors ? "text-red-400" : "text-yellow-400"}`} />
          : <ShieldCheck className="w-3.5 h-3.5 text-primary" />
      }
      width="w-80"
      onClose={onClose}
      actions={
        hasIssues ? (
          <span
            className={`text-xs ${
              hasErrors
                ? "text-red-400"
                : validation.warningCount > 0
                ? "text-yellow-400"
                : "text-primary"
            }`}
          >
            {hasErrors
              ? `${validation.errorCount} error${validation.errorCount !== 1 ? "s" : ""}, ${validation.warningCount} warning${validation.warningCount !== 1 ? "s" : ""}`
              : validation.warningCount > 0
              ? `${validation.warningCount} warning${validation.warningCount !== 1 ? "s" : ""}`
              : null}
          </span>
        ) : undefined
      }
    >
      <div className="flex flex-col min-h-full gap-4">
        {!hasIssues ? (
          <div className="p-6 text-center">
            <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-primary" />
            <div className="text-xs text-muted-foreground">This pedigree passes all structural checks.</div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {validation.issues.map((issue) => (
              <ValidationIssueRow
                key={issue.id}
                issue={issue}
                expanded={expandedIssueId === issue.id}
                onToggle={() => onToggleIssue(issue.id)}
                onFocus={() => onFocusIssue(issue.nodeIds)}
                nodes={nodes}
              />
            ))}
          </div>
        )}

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
    </PanelShell>
  );
}

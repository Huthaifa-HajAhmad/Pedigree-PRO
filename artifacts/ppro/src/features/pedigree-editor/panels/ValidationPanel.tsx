import type { PedigreeNode } from "@/features/pedigree-editor/canvas/types";
import { ValidationIssue, ISSUE_TYPE_LABELS } from "@/lib/validate-pedigree";
import { ChevronDown, ChevronRight } from "lucide-react";

export function ValidationIssueRow({
  issue, expanded, onToggle, onFocus, nodes,
}: {
  issue: ValidationIssue;
  expanded: boolean;
  onToggle: () => void;
  onFocus: () => void;
  nodes: PedigreeNode[];
}) {
  const isError = issue.severity === "error";
  const severityColor = isError ? "hsl(var(--destructive))" : "hsl(var(--warning))";
  const affectedNames = issue.nodeIds
    .map((id) => nodes.find((n) => n.id === id)?.label || id.slice(0, 6))
    .filter(Boolean);

  return (
    <div className={`border-l-2 ${isError ? "border-red-500" : "border-yellow-500"}`}>
      <button
        type="button"
        className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-accent transition-colors"
        onClick={onToggle}
      >
        <span
          className="mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full"
          style={{ background: severityColor }}
        />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium" style={{ color: severityColor }}>
            {ISSUE_TYPE_LABELS[issue.type]}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">{issue.message}</div>
        </div>
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-0.5" />
        ) : (
          <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-0.5" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          {issue.detail && (
            <p className="text-xs text-muted-foreground leading-relaxed">{issue.detail}</p>
          )}
          {affectedNames.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Affected: </span>
              <span className="text-xs" style={{ color: severityColor }}>
                {affectedNames.join(", ")}
              </span>
            </div>
          )}
          {issue.nodeIds.length > 0 && (
            <button
              onClick={onFocus}
              className="text-xs px-2.5 py-1.5 border rounded-lg transition-all duration-200 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-medium"
              style={{ borderColor: severityColor, color: severityColor }}
            >
              Select affected nodes
            </button>
          )}
        </div>
      )}
    </div>
  );
}
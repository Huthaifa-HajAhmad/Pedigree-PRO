import type { PedigreeNode } from "@/features/pedigree-editor/canvas/types";
import { ValidationIssue, ISSUE_TYPE_LABELS } from "@/lib/validate-pedigree";
import { ChevronDown, ChevronRight, Wrench } from "lucide-react";
import { usePedigreeEditor } from "@/features/pedigree-editor/context";

export function ValidationIssueRow({
  issue, expanded, onToggle, onFocus, nodes,
}: {
  issue: ValidationIssue;
  expanded: boolean;
  onToggle: () => void;
  onFocus: () => void;
  nodes: PedigreeNode[];
}) {
  const { ops } = usePedigreeEditor();
  const isError = issue.severity === "error";
  const severityColor = isError ? "hsl(var(--destructive))" : "hsl(var(--warning))";
  const affectedNames = issue.nodeIds
    .map((id) => nodes.find((n) => n.id === id)?.label || id.slice(0, 6))
    .filter(Boolean);

  const fixLabels: Partial<Record<typeof issue.type, string>> = {
    self_loop: "Remove loops",
    orphaned_edge: "Clean edge",
    invalid_partner_type: "Remove partner link",
    sibling_marriage: "Remove couple link",
    incest_union: "Remove couple link",
    duplicate_edge: "Deduplicate",
    couple_parent_conflict: "Remove conflict",
    isolated_node: "Delete individual",
    cycle: "Break cycle",
    too_many_parents: "Reset parents",
    same_sex_parents: "Toggle parent sex",
    same_sex_couple: "Toggle partner sex",
    invalid_parent_type: "Set sex to male",
  };
  const fixLabel = fixLabels[issue.type];

  const handleApplyFix = () => {
    switch (issue.type) {
      case "self_loop":
      case "orphaned_edge":
      case "invalid_partner_type":
      case "sibling_marriage":
      case "incest_union":
        ops.updateCanvas((prev) => ({
          ...prev,
          edges: prev.edges.filter((e) => !issue.edgeIds.includes(e.id)),
        }));
        break;
      case "duplicate_edge":
        ops.updateCanvas((prev) => ({
          ...prev,
          edges: prev.edges.filter((e) => e.id !== issue.edgeIds[0]),
        }));
        break;
      case "couple_parent_conflict":
        ops.updateCanvas((prev) => ({
          ...prev,
          edges: prev.edges.filter((e) => !issue.edgeIds.includes(e.id)),
        }));
        break;
      case "isolated_node":
        ops.updateCanvas((prev) => ({
          nodes: prev.nodes.filter((n) => !issue.nodeIds.includes(n.id)),
          edges: prev.edges.filter((e) => !issue.nodeIds.includes(e.sourceId) && !issue.nodeIds.includes(e.targetId)),
          annotations: prev.annotations.filter((a) => !issue.nodeIds.includes(a.nodeId)),
        }));
        break;
      case "cycle":
        ops.updateCanvas((prev) => ({
          ...prev,
          edges: prev.edges.filter((e) => !(e.type === "parent-child" && issue.nodeIds.includes(e.sourceId) && issue.nodeIds.includes(e.targetId))),
        }));
        break;
      case "too_many_parents":
        ops.updateCanvas((prev) => ({
          ...prev,
          edges: prev.edges.filter((e) => !(e.type === "parent-child" && e.targetId === issue.nodeIds[0])),
        }));
        break;
      case "same_sex_parents":
        const pId2 = issue.nodeIds[2];
        ops.updateCanvas((prev) => ({
          ...prev,
          nodes: prev.nodes.map((n) => n.id === pId2 ? { ...n, type: n.type === "male" ? "female" : "male" } : n),
        }));
        break;
      case "same_sex_couple":
        const partnerId = issue.nodeIds[1];
        ops.updateCanvas((prev) => ({
          ...prev,
          nodes: prev.nodes.map((n) => n.id === partnerId ? { ...n, type: n.type === "male" ? "female" : "male" } : n),
        }));
        break;
      case "invalid_parent_type":
        const pId = issue.nodeIds[0];
        ops.updateCanvas((prev) => ({
          ...prev,
          nodes: prev.nodes.map((n) => n.id === pId ? { ...n, type: "male" } : n),
        }));
        break;
      default:
        break;
    }
  };

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
        <div className="px-4 pb-3 space-y-2.5">
          {issue.detail && (
            <p className="text-xs text-muted-foreground leading-relaxed">{issue.detail}</p>
          )}
          {affectedNames.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wider text-[10px] font-semibold">Affected: </span>
              <span className="text-xs font-medium" style={{ color: severityColor }}>
                {affectedNames.join(", ")}
              </span>
            </div>
          )}
          <div className="flex gap-2">
            {issue.nodeIds.length > 0 && (
              <button
                onClick={onFocus}
                className="text-[11px] px-2.5 py-1 border rounded-lg transition-all duration-200 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-semibold flex-1 text-center"
                style={{ borderColor: severityColor, color: severityColor }}
              >
                Select nodes
              </button>
            )}
            {fixLabel && (
              <button
                onClick={handleApplyFix}
                className="text-[11px] px-2.5 py-1 bg-primary text-primary-foreground rounded-lg transition-all duration-200 hover:bg-primary/95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-semibold flex items-center justify-center gap-1 flex-1 text-center"
              >
                <Wrench className="w-3 h-3" />
                <span>{fixLabel}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
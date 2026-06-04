import type { PedigreeNode, PedigreeEdge } from "@/features/pedigree-editor/canvas/types";

export interface CanvasData {
  nodes: PedigreeNode[];
  edges: PedigreeEdge[];
}

export type IssueSeverity = "error" | "warning";

export type IssueType =
  | "self_loop"
  | "cycle"
  | "duplicate_edge"
  | "couple_parent_conflict"
  | "orphaned_edge"
  | "isolated_node"
  | "multi_couple"
  | "single_parent";

export interface ValidationIssue {
  id: string;
  type: IssueType;
  severity: IssueSeverity;
  message: string;
  detail?: string;
  nodeIds: string[];
  edgeIds: string[];
}

export interface ValidationResult {
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
  invalidNodeIds: Set<string>;
  invalidEdgeIds: Set<string>;
}

export function validatePedigree(canvas: CanvasData): ValidationResult {
  const issues: ValidationIssue[] = [];
  const { nodes, edges } = canvas;
  const nodeSet = new Set(nodes.map((n) => n.id));

  // ── 1. Orphaned edges ──────────────────────────────────────────────────────
  for (const edge of edges) {
    const srcMissing = !nodeSet.has(edge.sourceId);
    const tgtMissing = !nodeSet.has(edge.targetId);
    if (srcMissing || tgtMissing) {
      issues.push({
        id: `orphan-${edge.id}`,
        type: "orphaned_edge",
        severity: "error",
        message: "Edge references a missing node",
        detail: `Edge "${edge.id}" points to a node that no longer exists.`,
        nodeIds: [],
        edgeIds: [edge.id],
      });
    }
  }

  // ── 2. Self-loops ─────────────────────────────────────────────────────────
  for (const edge of edges) {
    if (edge.sourceId === edge.targetId) {
      const node = nodes.find((n) => n.id === edge.sourceId);
      issues.push({
        id: `self-${edge.id}`,
        type: "self_loop",
        severity: "error",
        message: "Individual connected to themselves",
        detail: `"${node?.label || edge.sourceId}" has a ${edge.type} link to itself.`,
        nodeIds: [edge.sourceId],
        edgeIds: [edge.id],
      });
    }
  }

  // ── 3. Duplicate edges ────────────────────────────────────────────────────
  const seenEdgeKeys = new Map<string, string>(); // key → first edge id
  for (const edge of edges) {
    const a = edge.sourceId < edge.targetId ? edge.sourceId : edge.targetId;
    const b = edge.sourceId < edge.targetId ? edge.targetId : edge.sourceId;
    const key = `${edge.type}:${a}:${b}`;
    if (seenEdgeKeys.has(key)) {
      const n1 = nodes.find((n) => n.id === edge.sourceId);
      const n2 = nodes.find((n) => n.id === edge.targetId);
      issues.push({
        id: `dup-${edge.id}`,
        type: "duplicate_edge",
        severity: "warning",
        message: `Duplicate ${edge.type} connection`,
        detail: `"${n1?.label || edge.sourceId}" and "${n2?.label || edge.targetId}" are connected twice as ${edge.type}.`,
        nodeIds: [edge.sourceId, edge.targetId],
        edgeIds: [edge.id, seenEdgeKeys.get(key)!],
      });
    } else {
      seenEdgeKeys.set(key, edge.id);
    }
  }

  // ── 4. Couple + parent-child conflict (same pair) ─────────────────────────
  const coupleKeys = new Set<string>();
  for (const edge of edges) {
    if (edge.type === "couple" || edge.type === "consanguinity" || edge.type === "divorced" || edge.type === "separated") {
      const a = edge.sourceId < edge.targetId ? edge.sourceId : edge.targetId;
      const b = edge.sourceId < edge.targetId ? edge.targetId : edge.sourceId;
      coupleKeys.add(`${a}:${b}`);
    }
  }
  for (const edge of edges) {
    if (edge.type === "parent-child") {
      const a = edge.sourceId < edge.targetId ? edge.sourceId : edge.targetId;
      const b = edge.sourceId < edge.targetId ? edge.targetId : edge.sourceId;
      const key = `${a}:${b}`;
      if (coupleKeys.has(key)) {
        const n1 = nodes.find((n) => n.id === edge.sourceId);
        const n2 = nodes.find((n) => n.id === edge.targetId);
        issues.push({
          id: `conflict-${edge.id}`,
          type: "couple_parent_conflict",
          severity: "error",
          message: "Individual is both partner and parent/child",
          detail: `"${n1?.label || edge.sourceId}" and "${n2?.label || edge.targetId}" are marked as both a couple and a parent-child pair.`,
          nodeIds: [edge.sourceId, edge.targetId],
          edgeIds: [edge.id],
        });
      }
    }
  }

  // ── 5. Cycle in parent-child graph ────────────────────────────────────────
  const childrenOf = new Map<string, string[]>();
  for (const n of nodes) childrenOf.set(n.id, []);
  for (const edge of edges) {
    if (edge.type === "parent-child" && nodeSet.has(edge.sourceId) && nodeSet.has(edge.targetId)) {
      childrenOf.get(edge.sourceId)?.push(edge.targetId);
    }
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();
  const cycleNodeIds = new Set<string>();

  function dfs(nodeId: string): boolean {
    if (inStack.has(nodeId)) {
      cycleNodeIds.add(nodeId);
      return true;
    }
    if (visited.has(nodeId)) return false;
    visited.add(nodeId);
    inStack.add(nodeId);
    for (const child of childrenOf.get(nodeId) ?? []) {
      if (dfs(child)) cycleNodeIds.add(nodeId);
    }
    inStack.delete(nodeId);
    return false;
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) dfs(node.id);
  }

  if (cycleNodeIds.size > 0) {
    const names = [...cycleNodeIds]
      .map((id) => nodes.find((n) => n.id === id)?.label || id)
      .join(", ");
    issues.push({
      id: "cycle-1",
      type: "cycle",
      severity: "error",
      message: "Circular ancestry detected",
      detail: `A node is an ancestor of itself, creating an impossible family loop. Involved: ${names}.`,
      nodeIds: [...cycleNodeIds],
      edgeIds: [],
    });
  }

  // ── 6. Node connected to more than 2 different partners (warning) ──────────
  const partnerCount = new Map<string, Set<string>>();
  for (const n of nodes) partnerCount.set(n.id, new Set());
  for (const edge of edges) {
    if ((edge.type === "couple" || edge.type === "consanguinity" || edge.type === "divorced" || edge.type === "separated") && nodeSet.has(edge.sourceId) && nodeSet.has(edge.targetId)) {
      partnerCount.get(edge.sourceId)?.add(edge.targetId);
      partnerCount.get(edge.targetId)?.add(edge.sourceId);
    }
  }
  for (const [nodeId, partners] of partnerCount) {
    if (partners.size > 2) {
      const node = nodes.find((n) => n.id === nodeId);
      issues.push({
        id: `multi-couple-${nodeId}`,
        type: "multi_couple",
        severity: "warning",
        message: "Individual has more than 2 partner connections",
        detail: `"${node?.label || nodeId}" is connected as a couple to ${partners.size} individuals. Please verify this is intentional.`,
        nodeIds: [nodeId, ...partners],
        edgeIds: [],
      });
    }
  }

  // ── 7. Isolated nodes (no connections at all) — info-level warning ─────────
  const connectedNodeIds = new Set<string>();
  for (const edge of edges) {
    if (nodeSet.has(edge.sourceId)) connectedNodeIds.add(edge.sourceId);
    if (nodeSet.has(edge.targetId)) connectedNodeIds.add(edge.targetId);
  }
  for (const node of nodes) {
    if (!connectedNodeIds.has(node.id) && nodes.length > 1) {
      issues.push({
        id: `isolated-${node.id}`,
        type: "isolated_node",
        severity: "warning",
        message: "Individual has no connections",
        detail: `"${node.label || node.id}" is not connected to any other individual in the pedigree.`,
        nodeIds: [node.id],
        edgeIds: [],
      });
    }
  }

  // ── 8. Single-parent children ──
  const childParentIds = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.type === "parent-child" && nodeSet.has(edge.sourceId) && nodeSet.has(edge.targetId)) {
      if (!childParentIds.has(edge.targetId)) childParentIds.set(edge.targetId, []);
      childParentIds.get(edge.targetId)!.push(edge.sourceId);
    }
  }
  for (const [childId, parentIds] of childParentIds) {
    if (parentIds.length === 1) {
      const singleParentId = parentIds[0]!;
      const hasPartner = edges.some((e) => (e.type === "couple" || e.type === "consanguinity" || e.type === "divorced" || e.type === "separated") && (e.sourceId === singleParentId || e.targetId === singleParentId));
      const child = nodes.find((n) => n.id === childId);
      const parent = nodes.find((n) => n.id === singleParentId);
      issues.push({
        id: `single-parent-${childId}`,
        type: "single_parent",
        severity: "warning",
        message: hasPartner ? "Child connected to only one parent in a couple" : "Child has only one parent",
        detail: hasPartner
          ? `${child?.label || childId} has a parent-child link from only one parent (${parent?.label || singleParentId}) even though that parent has a partner. Add a second parent-child edge to complete the family.`
          : `${child?.label || childId} is connected to only one parent (${parent?.label || singleParentId}). Consider adding the other parent for a complete pedigree.`,
        nodeIds: [childId, singleParentId],
        edgeIds: [],
      });
    }
  }

  // ── Aggregate results ──────────────────────────────────────────────────────
  const invalidNodeIds = new Set<string>(issues.flatMap((i) => i.nodeIds));
  const invalidEdgeIds = new Set<string>(issues.flatMap((i) => i.edgeIds));
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  return { issues, errorCount, warningCount, invalidNodeIds, invalidEdgeIds };
}

export const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  self_loop: "Self-Loop",
  cycle: "Circular Ancestry",
  duplicate_edge: "Duplicate Edge",
  couple_parent_conflict: "Role Conflict",
  orphaned_edge: "Orphaned Edge",
  isolated_node: "Isolated Node",
  multi_couple: "Multiple Partners",
  single_parent: "Single Parent",
};

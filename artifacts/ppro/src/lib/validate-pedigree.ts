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
  | "single_parent"
  | "invalid_parent_type"
  | "invalid_partner_type"
  | "too_many_parents"
  | "same_sex_parents"
  | "same_sex_couple"
  | "sibling_marriage";

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

  // ── 9. Invalid parent and partner types ──
  for (const edge of edges) {
    if (nodeSet.has(edge.sourceId) && nodeSet.has(edge.targetId)) {
      const srcNode = nodes.find((n) => n.id === edge.sourceId);
      const tgtNode = nodes.find((n) => n.id === edge.targetId);
      if (edge.type === "parent-child") {
        if (srcNode && (srcNode.type === "pregnancy" || srcNode.type === "sab" || srcNode.type === "unknown")) {
          issues.push({
            id: `invalid-parent-${edge.id}`,
            type: "invalid_parent_type",
            severity: "error",
            message: "Invalid parent type",
            detail: `"${srcNode.label || srcNode.id}" is a ${srcNode.type} but is marked as a parent of "${tgtNode?.label || edge.targetId}". Pregnancies, stillbirths (SABs), and individuals of unknown sex cannot be biological parents.`,
            nodeIds: [edge.sourceId],
            edgeIds: [edge.id],
          });
        }
      } else if (edge.type === "couple" || edge.type === "consanguinity" || edge.type === "divorced" || edge.type === "separated") {
        if (srcNode && (srcNode.type === "pregnancy" || srcNode.type === "sab")) {
          issues.push({
            id: `invalid-partner-${edge.id}-${srcNode.id}`,
            type: "invalid_partner_type",
            severity: "error",
            message: "Invalid partner type",
            detail: `"${srcNode.label || srcNode.id}" is a ${srcNode.type} and cannot have partner or marriage connections.`,
            nodeIds: [srcNode.id],
            edgeIds: [edge.id],
          });
        }
        if (tgtNode && (tgtNode.type === "pregnancy" || tgtNode.type === "sab")) {
          issues.push({
            id: `invalid-partner-${edge.id}-${tgtNode.id}`,
            type: "invalid_partner_type",
            severity: "error",
            message: "Invalid partner type",
            detail: `"${tgtNode.label || tgtNode.id}" is a ${tgtNode.type} and cannot have partner or marriage connections.`,
            nodeIds: [tgtNode.id],
            edgeIds: [edge.id],
          });
        }
      }
    }
  }

  // ── 10. Parent counts & same-sex biological parents ──
  for (const [childId, parentIds] of childParentIds) {
    const child = nodes.find((n) => n.id === childId);
    if (parentIds.length > 2) {
      issues.push({
        id: `too-many-parents-${childId}`,
        type: "too_many_parents",
        severity: "error",
        message: "Too many parents",
        detail: `"${child?.label || childId}" is connected to ${parentIds.length} biological parents. A child can have at most two biological parents.`,
        nodeIds: [childId, ...parentIds],
        edgeIds: [],
      });
    } else if (parentIds.length === 2) {
      const p1 = nodes.find((n) => n.id === parentIds[0]);
      const p2 = nodes.find((n) => n.id === parentIds[1]);
      if (p1 && p2 && p1.type !== "unknown" && p2.type !== "unknown" && p1.type === p2.type) {
        issues.push({
          id: `same-sex-parents-${childId}`,
          type: "same_sex_parents",
          severity: "warning",
          message: "Same-sex biological parents",
          detail: `"${child?.label || childId}" has biological parents of the same sex: two ${p1.type}s ("${p1.label || p1.id}" and "${p2.label || p2.id}"). Biological pedigree charts require male and female roles for genetic inheritance.`,
          nodeIds: [childId, p1.id, p2.id],
          edgeIds: [],
        });
      }
    }
  }

  // ── 11. Same-sex couples & Sibling marriages ──
  const reportedSameSexCouples = new Set<string>();
  const reportedSiblingMarriages = new Set<string>();

  for (const edge of edges) {
    if ((edge.type === "couple" || edge.type === "consanguinity" || edge.type === "divorced" || edge.type === "separated") && nodeSet.has(edge.sourceId) && nodeSet.has(edge.targetId)) {
      const p1 = nodes.find((n) => n.id === edge.sourceId);
      const p2 = nodes.find((n) => n.id === edge.targetId);
      if (p1 && p2) {
        // Same-sex couples
        if (p1.type !== "unknown" && p2.type !== "unknown" && p1.type === p2.type) {
          const coupleKey = [p1.id, p2.id].sort().join(":");
          if (!reportedSameSexCouples.has(coupleKey)) {
            reportedSameSexCouples.add(coupleKey);
            issues.push({
              id: `same-sex-couple-${edge.id}`,
              type: "same_sex_couple",
              severity: "warning",
              message: "Same-sex couple",
              detail: `The couple link connects two individuals of the same sex: two ${p1.type}s ("${p1.label || p1.id}" and "${p2.label || p2.id}").`,
              nodeIds: [p1.id, p2.id],
              edgeIds: [edge.id],
            });
          }
        }

        // Sibling marriages (sharing one or more biological parents)
        const parents1 = childParentIds.get(p1.id) || [];
        const parents2 = childParentIds.get(p2.id) || [];
        if (parents1.length > 0 && parents2.length > 0) {
          const sharedParents = parents1.filter((pId) => parents2.includes(pId));
          if (sharedParents.length > 0) {
            const coupleKey = [p1.id, p2.id].sort().join(":");
            if (!reportedSiblingMarriages.has(coupleKey)) {
              reportedSiblingMarriages.add(coupleKey);
              issues.push({
                id: `sibling-marriage-${edge.id}`,
                type: "sibling_marriage",
                severity: "error",
                message: "Incompatible biological relationship",
                detail: `"${p1.label || p1.id}" and "${p2.label || p2.id}" share biological parent(s) (${sharedParents.map(id => nodes.find(n => n.id === id)?.label || id).join(", ")}). Sibling and parent-child pairings are restricted in biological pedigrees.`,
                nodeIds: [p1.id, p2.id],
                edgeIds: [edge.id],
              });
            }
          }
        }
      }
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
  invalid_parent_type: "Invalid Parent Type",
  invalid_partner_type: "Invalid Partner Type",
  too_many_parents: "Too Many Parents",
  same_sex_parents: "Same-Sex Biological Parents",
  same_sex_couple: "Same-Sex Couple",
  sibling_marriage: "Incompatible Sibling Relationship",
};

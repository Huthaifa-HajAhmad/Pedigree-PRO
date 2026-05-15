/**
 * Pedigree PRO — Visual Diff Engine
 *
 * Computes structural differences between two pedigree canvas states.
 * Used by the version timeline and import review to highlight changes.
 */

import type { CanvasData, PedigreeNode, PedigreeEdge } from "@/features/pedigree-editor/canvas/types";

export interface NodeDiff {
  id: string;
  status: "added" | "removed" | "changed" | "unchanged";
  before?: PedigreeNode;
  after?: PedigreeNode;
  propertyChanges?: Array<{ property: string; from: unknown; to: unknown }>;
}

export interface EdgeDiff {
  id: string;
  status: "added" | "removed" | "changed" | "unchanged";
  before?: PedigreeEdge;
  after?: PedigreeEdge;
}

export interface CanvasDiff {
  nodeDiffs: NodeDiff[];
  edgeDiffs: EdgeDiff[];
  addedNodes: PedigreeNode[];
  removedNodes: PedigreeNode[];
  changedNodes: NodeDiff[];
  addedEdges: PedigreeEdge[];
  removedEdges: PedigreeEdge[];
  changedEdges: PedigreeEdge[];
}

/**
 * Computes the diff between two canvas states.
 */
export function computeCanvasDiff(before: CanvasData, after: CanvasData): CanvasDiff {
  const nodeDiffs: NodeDiff[] = [];
  const edgeDiffs: EdgeDiff[] = [];
  const addedNodes: PedigreeNode[] = [];
  const removedNodes: PedigreeNode[] = [];
  const changedNodes: NodeDiff[] = [];
  const addedEdges: PedigreeEdge[] = [];
  const removedEdges: PedigreeEdge[] = [];
  const changedEdges: PedigreeEdge[] = [];

  // Index nodes by ID
  const beforeNodes = new Map(before.nodes.map((n) => [n.id, n]));
  const afterNodes = new Map(after.nodes.map((n) => [n.id, n]));

  // Find added and changed nodes
  for (const afterNode of after.nodes) {
    const beforeNode = beforeNodes.get(afterNode.id);
    if (!beforeNode) {
      nodeDiffs.push({ id: afterNode.id, status: "added", after: afterNode });
      addedNodes.push(afterNode);
    } else {
      const propertyChanges = compareNodeProperties(beforeNode, afterNode);
      if (propertyChanges.length > 0) {
        const diff: NodeDiff = {
          id: afterNode.id,
          status: "changed",
          before: beforeNode,
          after: afterNode,
          propertyChanges,
        };
        nodeDiffs.push(diff);
        changedNodes.push(diff);
      } else {
        nodeDiffs.push({ id: afterNode.id, status: "unchanged", before: beforeNode, after: afterNode });
      }
    }
  }

  // Find removed nodes
  for (const beforeNode of before.nodes) {
    if (!afterNodes.has(beforeNode.id)) {
      nodeDiffs.push({ id: beforeNode.id, status: "removed", before: beforeNode });
      removedNodes.push(beforeNode);
    }
  }

  // Index edges by ID
  const beforeEdges = new Map(before.edges.map((e) => [e.id, e]));
  const afterEdges = new Map(after.edges.map((e) => [e.id, e]));

  // Find added and changed edges
  for (const afterEdge of after.edges) {
    const beforeEdge = beforeEdges.get(afterEdge.id);
    if (!beforeEdge) {
      edgeDiffs.push({ id: afterEdge.id, status: "added", after: afterEdge });
      addedEdges.push(afterEdge);
    } else {
      const changed = beforeEdge.type !== afterEdge.type;
      edgeDiffs.push({ id: afterEdge.id, status: changed ? "changed" : "unchanged", before: beforeEdge, after: afterEdge });
      if (changed) changedEdges.push(afterEdge);
    }
  }

  // Find removed edges
  for (const beforeEdge of before.edges) {
    if (!afterEdges.has(beforeEdge.id)) {
      edgeDiffs.push({ id: beforeEdge.id, status: "removed", before: beforeEdge });
      removedEdges.push(beforeEdge);
    }
  }

  return {
    nodeDiffs,
    edgeDiffs,
    addedNodes,
    removedNodes,
    changedNodes,
    addedEdges,
    removedEdges,
    changedEdges,
  };
}

const COMPARABLE_PROPS: Array<keyof PedigreeNode> = [
  "type", "x", "y", "affected", "carrier", "deceased", "proband",
  "label", "age", "dob", "pinned", "condition",
];

function compareNodeProperties(
  before: PedigreeNode,
  after: PedigreeNode
): Array<{ property: string; from: unknown; to: unknown }> {
  const changes: Array<{ property: string; from: unknown; to: unknown }> = [];
  for (const key of COMPARABLE_PROPS) {
    if (before[key] !== after[key]) {
      changes.push({ property: key, from: before[key], to: after[key] });
    }
  }
  return changes;
}

/**
 * Gets a color for diff visualization based on status.
 */
export function diffColor(status: "added" | "removed" | "changed" | "unchanged"): string {
  switch (status) {
    case "added": return "#22c55e";    // green
    case "removed": return "#ef4444";  // red
    case "changed": return "#eab308"; // yellow
    case "unchanged": return "transparent";
  }
}

/**
 * Renders a human-readable summary of a diff.
 */
export function diffSummary(diff: CanvasDiff): string {
  const parts: string[] = [];
  if (diff.addedNodes.length) parts.push(`+${diff.addedNodes.length} nodes`);
  if (diff.removedNodes.length) parts.push(`-${diff.removedNodes.length} nodes`);
  if (diff.changedNodes.length) parts.push(`~${diff.changedNodes.length} nodes`);
  if (diff.addedEdges.length) parts.push(`+${diff.addedEdges.length} edges`);
  if (diff.removedEdges.length) parts.push(`-${diff.removedEdges.length} edges`);
  if (diff.changedEdges.length) parts.push(`~${diff.changedEdges.length} edges`);
  if (parts.length === 0) return "No changes";
  return parts.join(", ");
}

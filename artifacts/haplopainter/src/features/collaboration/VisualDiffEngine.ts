/**
 * HaploClinical — Visual Diff Engine
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
  status: "added" | "removed" | "unchanged";
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

  // Find added edges
  for (const afterEdge of after.edges) {
    const beforeEdge = beforeEdges.get(afterEdge.id);
    if (!beforeEdge) {
      edgeDiffs.push({ id: afterEdge.id, status: "added", after: afterEdge });
      addedEdges.push(afterEdge);
    } else {
      edgeDiffs.push({ id: afterEdge.id, status: "unchanged", before: beforeEdge, after: afterEdge });
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
  };
}

function compareNodeProperties(
  before: PedigreeNode,
  after: PedigreeNode
): Array<{ property: string; from: unknown; to: unknown }> {
  const changes: Array<{ property: string; from: unknown; to: unknown }> = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    const beforeVal = (before as Record<string, unknown>)[key];
    const afterVal = (after as Record<string, unknown>)[key];
    if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      changes.push({ property: key, from: beforeVal, to: afterVal });
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
  if (parts.length === 0) return "No changes";
  return parts.join(", ");
}

import type { CanvasData, PedigreeNode, PedigreeEdge } from "@/features/pedigree-editor/canvas/types";
import { computeCanvasDiff } from "@/features/collaboration/VisualDiffEngine";

export type MergeDecision = "ours" | "theirs";

export interface MergeConflict {
  nodeId: string;
  property: string;
  ourValue: unknown;
  theirValue: unknown;
  baseValue: unknown;
}

export interface MergeResult {
  merged: CanvasData;
  conflicts: MergeConflict[];
  autoMerged: number;
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function threeWayMerge(
  base: CanvasData,
  ours: CanvasData,
  _oursLabel: string,
  theirs: CanvasData,
  _theirsLabel: string,
  decisions?: Map<string, MergeDecision>
): MergeResult {
  const diffOurs = computeCanvasDiff(base, ours);
  const diffTheirs = computeCanvasDiff(base, theirs);
  const conflicts: MergeConflict[] = [];
  let autoMerged = 0;

  const resultNodes = new Map<string, PedigreeNode>();
  const resultEdges = new Map<string, PedigreeEdge>();

  for (const node of base.nodes) {
    resultNodes.set(node.id, deepClone(node));
  }
  for (const edge of base.edges) {
    resultEdges.set(edge.id, deepClone(edge));
  }

  // Apply ours additions
  for (const node of diffOurs.addedNodes) {
    if (!resultNodes.has(node.id)) {
      resultNodes.set(node.id, deepClone(node));
      autoMerged++;
    }
  }
  for (const node of diffOurs.removedNodes) {
    if (resultNodes.has(node.id) && !diffTheirs.addedNodes.some(n => n.id === node.id)) {
      resultNodes.delete(node.id);
      autoMerged++;
    }
  }
  for (const diff of diffOurs.changedNodes) {
    const theirChange = diffTheirs.changedNodes.find(d => d.id === diff.id);
    if (!theirChange) {
      if (resultNodes.has(diff.id)) {
        resultNodes.set(diff.id, deepClone(diff.after!));
        autoMerged++;
      }
    } else {
      // Both changed same node — handle property-level conflicts
      for (const change of diff.propertyChanges ?? []) {
        const theirPropChange = theirChange.propertyChanges?.find(c => c.property === change.property);
        if (theirPropChange) {
          const decision = decisions?.get(`${diff.id}:${change.property}`);
          if (decision === "theirs") {
            const existing = resultNodes.get(diff.id);
            if (existing) {
              (existing as unknown as Record<string, unknown>)[change.property] = theirPropChange.to;
            }
          } else {
            const existing = resultNodes.get(diff.id);
            if (existing) {
              (existing as unknown as Record<string, unknown>)[change.property] = change.to;
            }
          }
          conflicts.push({
            nodeId: diff.id,
            property: change.property,
            ourValue: change.to,
            theirValue: theirPropChange.to,
            baseValue: change.from,
          });
        } else {
          const existing = resultNodes.get(diff.id);
          if (existing) {
            (existing as unknown as Record<string, unknown>)[change.property] = change.to;
          }
        }
      }
    }
  }

  // Apply theirs additions (if not conflicting)
  for (const node of diffTheirs.addedNodes) {
    if (!resultNodes.has(node.id) && !diffOurs.removedNodes.some(n => n.id === node.id)) {
      resultNodes.set(node.id, deepClone(node));
      autoMerged++;
    }
  }
  for (const node of diffTheirs.removedNodes) {
    if (!diffOurs.addedNodes.some(n => n.id === node.id)) {
      resultNodes.delete(node.id);
      autoMerged++;
    }
  }
  for (const diff of diffTheirs.changedNodes) {
    if (diffOurs.changedNodes.some(d => d.id === diff.id)) continue;
    if (resultNodes.has(diff.id)) {
      resultNodes.set(diff.id, deepClone(diff.after!));
      autoMerged++;
    }
  }

  // Edges: apply ours then theirs
  for (const edge of diffOurs.addedEdges) {
    if (!resultEdges.has(edge.id)) {
      resultEdges.set(edge.id, deepClone(edge));
      autoMerged++;
    }
  }
  for (const edge of diffOurs.removedEdges) {
    resultEdges.delete(edge.id);
    autoMerged++;
  }
  for (const edge of diffTheirs.addedEdges) {
    if (!resultEdges.has(edge.id)) {
      resultEdges.set(edge.id, deepClone(edge));
      autoMerged++;
    }
  }
  for (const edge of diffTheirs.removedEdges) {
    resultEdges.delete(edge.id);
    autoMerged++;
  }

  return {
    merged: {
      nodes: Array.from(resultNodes.values()),
      edges: Array.from(resultEdges.values()),
      annotations: [],
    },
    conflicts,
    autoMerged,
  };
}
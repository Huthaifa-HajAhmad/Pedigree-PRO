// ─── Unified Layout Engine ─────────────────────────────────────────────────
//
// Pure-function module for collision detection and resolution in the
// pedigree canvas. Replaces the fragmented insertAndShiftRight /
// getFamilyGroup / shiftFamilyGroup helpers with a single, consistent
// algorithm that operates on family-unit bounding boxes.
//
// Design principles:
//   1. Family-aware: shifts move entire nuclear families, not individual nodes.
//   2. Bounding-box collisions: a family's footprint includes all members.
//   3. Bidirectional cost optimisation: for every collision, both shift
//      directions are evaluated and the cheaper one is chosen.
//   4. Recursive subtree awareness: shifting a node shifts its entire
//      descendant tree.
//   5. Single-pass resolution: one call to resolveAllCollisions() replaces
//      the 3-5 separate phases in the old code.
// ──────────────────────────────────────────────────────────────────────────

import { NODE_SIZE, NODE_GAP, GEN_GRID } from "@/features/pedigree-editor/canvas/types";
import type { PedigreeNode, PedigreeEdge, CanvasData } from "@/features/pedigree-editor/canvas/types";
import { buildAdjacency, buildGenerations, buildNodeMap, evaluateCostAwareInversion } from "./layout-shared";
import type { AdjacencyMaps, LayoutNode, EdgeSubset } from "./layout-shared";
import { minimizeCrossings } from "./crossing-minimization";
export { buildGenerations };

// ── Types ──────────────────────────────────────────────────────────────────

/** Axis-aligned bounding box */
export interface BBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export class PinnedBlockConflictError extends Error {
  constructor(message?: string) {
    super(message ?? "Could not place nodes without moving pinned nodes.");
    this.name = "PinnedBlockConflictError";
    Object.setPrototypeOf(this, PinnedBlockConflictError.prototype);
  }
}




// ── Constants ──────────────────────────────────────────────────────────────

/** Nodes within this vertical distance are on the "same row" */
const ROW_TOLERANCE = GEN_GRID / 2; // 60px — correct for 120px generation grid

// ── Bounding box computation ───────────────────────────────────────────────

/** Compute the bounding box of a single node */
function nodeBBox(node: LayoutNode): BBox {
  const halfS = NODE_SIZE / 2;
  return {
    left: node.x - halfS,
    right: node.x + halfS,
    top: node.y - halfS,
    bottom: node.y + halfS,
  };
}

/** Merge multiple bounding boxes into one enclosing bbox */
function mergeBBoxes(boxes: BBox[]): BBox {
  if (boxes.length === 0) {
    return { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
  }
  return {
    left: boxes.reduce((min, b) => Math.min(min, b.left), Infinity),
    right: boxes.reduce((max, b) => Math.max(max, b.right), -Infinity),
    top: boxes.reduce((min, b) => Math.min(min, b.top), Infinity),
    bottom: boxes.reduce((max, b) => Math.max(max, b.bottom), -Infinity),
  };
}

/**
 * Recursively compute the bounding box of a node and all its descendants.
 * Includes the node itself, its couple partners, and all children (recursive).
 */
export function computeSubtreeBBox(
  nodeId: string,
  nodeMap: Map<string, LayoutNode>,
  adj: AdjacencyMaps,
  visited?: Set<string>,
): BBox {
  const v = visited ?? new Set<string>();
  const subtreeIds = collectSubtree(nodeId, adj, v, { anchorMarriedIn: true });
  const boxes: BBox[] = [];
  for (const id of subtreeIds) {
    const node = nodeMap.get(id);
    if (node) {
      boxes.push(nodeBBox(node));
    }
  }
  return mergeBBoxes(boxes);
}


/**
 * Helper to compute Y tolerance dynamically based on generation Ys.
 */
export function getRowTolerance(nodes: LayoutNode[], genGrid = GEN_GRID): number {
  const uniqueYs = Array.from(new Set(nodes.map(n => n.y))).sort((a, b) => a - b);
  if (uniqueYs.length === 0) return genGrid / 2;
  const allMultiples = uniqueYs.every(y => Math.round(y) % genGrid === 0);
  if (allMultiples) return genGrid / 2;
  
  let minDelta = Infinity;
  for (let i = 1; i < uniqueYs.length; i++) {
    const delta = uniqueYs[i]! - uniqueYs[i - 1]!;
    if (delta >= 20 && delta < minDelta) {
      minDelta = delta;
    }
  }
  return minDelta !== Infinity ? minDelta / 2 : genGrid / 2;
}

// ── Row-based collision detection ──────────────────────────────────────────

export interface Collision<T extends LayoutNode = LayoutNode> {
  leftNode: T;
  rightNode: T;
  overlap: number; // positive = overlapping by this many px
}

/**
 * Detect horizontal collisions between nodes on the same generation row.
 * Uses a sweep-line approach: sort nodes by X, then check adjacent pairs for overlap.
 */
export function detectRowCollisions<T extends LayoutNode>(
  nodes: T[],
  rowY: number,
  minGap: number = NODE_GAP,
  tolerance?: number,
  genIndexOf?: Map<string, number>,
  adj?: AdjacencyMaps,
  twinGapMono: number = NODE_SIZE * 0.55,
  twinGapDizygotic: number = NODE_SIZE * 0.8,
): Collision<T>[] {
  const tol = tolerance ?? getRowTolerance(nodes);
  const rowNodes = genIndexOf
    ? nodes.filter(n => genIndexOf.get(n.id) === rowY)
    : nodes.filter(n => Math.abs(n.y - rowY) < tol);

  if (rowNodes.length < 2) return [];

  rowNodes.sort((a, b) => a.x - b.x);

  const collisions: Collision<T>[] = [];
  for (let i = 1; i < rowNodes.length; i++) {
    const left = rowNodes[i - 1]!;
    const right = rowNodes[i]!;
    const gap = right.x - left.x;

    let currentMinGap = minGap;
    if (adj) {
      const twins = adj.twinsOf.get(left.id);
      if (twins && twins.includes(right.id)) {
        const type = adj.twinTypeOf.get(left.id);
        currentMinGap = type === "m" ? twinGapMono : twinGapDizygotic;
      }
    }

    if (gap < currentMinGap - 0.15) { // Allow up to 0.15px topological tolerance
      collisions.push({
        leftNode: left,
        rightNode: right,
        overlap: currentMinGap - gap,
      });
    }
  }

  return collisions;
}

// ── Subtree collection ─────────────────────────────────────────────────────

/**
 * Collect all descendant node IDs of a given node (children, grandchildren, etc.)
 * AND their couple partners. This is the full "subtree" that must move together.
 */
export function collectDescendants(
  startNodeId: string,
  adj: AdjacencyMaps,
  visited = new Set<string>()
): Set<string> {
  const stack = [startNodeId];
  while (stack.length > 0) {
    const nodeId = stack.pop()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const children = adj.childrenOf.get(nodeId) ?? [];
    for (let i = children.length - 1; i >= 0; i--) {
      const childId = children[i]!;
      if (!visited.has(childId)) {
        stack.push(childId);
      }
    }
  }
  return visited;
}

export function collectSubtree(
  nodeId: string,
  adj: AdjacencyMaps,
  visited?: Set<string>,
  options?: { anchorMarriedIn?: boolean },
): Set<string> {
  const descendants = collectDescendants(nodeId, adj);
  const v = visited ?? new Set<string>();

  const stack = [nodeId];
  while (stack.length > 0) {
    const curr = stack.pop()!;
    if (v.has(curr)) continue;
    v.add(curr);

    // Couple partners
    for (const partnerId of adj.couplesOf.get(curr) ?? []) {
      if (!v.has(partnerId)) {
        if (options?.anchorMarriedIn) {
          const partnerParents = adj.parentsOf.get(partnerId) ?? [];
          const hasExternalParents = partnerParents.some(pId => !descendants.has(pId));
          if (hasExternalParents) {
            continue;
          }
        }
        v.add(partnerId);
        const partnerChildren = adj.childrenOf.get(partnerId) ?? [];
        for (let i = partnerChildren.length - 1; i >= 0; i--) {
          const childId = partnerChildren[i]!;
          if (!v.has(childId)) {
            stack.push(childId);
          }
        }
      }
    }

    // Children
    const children = adj.childrenOf.get(curr) ?? [];
    for (let i = children.length - 1; i >= 0; i--) {
      const childId = children[i]!;
      if (!v.has(childId)) {
        stack.push(childId);
      }
    }

    // Twins
    const twins = adj.twinsOf.get(curr) ?? [];
    for (let i = twins.length - 1; i >= 0; i--) {
      const twinId = twins[i]!;
      if (!v.has(twinId)) {
        stack.push(twinId);
      }
    }
  }
  return v;
}



// ── Unified collision resolution ───────────────────────────────────────────

/**
 * Top-level collision resolver. Detects all collisions across all generation
 * rows and resolves them using family-aware, bidirectional shifting.
 *
 * @param nodes      Current node array
 * @param edges      Current edge array
 * @param excludeIds Node IDs that should not be shifted (e.g. the newly placed node)
 * @returns          New node array with resolved positions
 */
export function resolveAllCollisions<T extends LayoutNode>(
  nodes: T[],
  edges: EdgeSubset[],
  excludeIds?: Set<string>,
  nodeGap = NODE_GAP,
  genGrid = GEN_GRID,
  genIndexOf?: Map<string, number>,
  canvasWidth?: number,
  twinGapMono = NODE_SIZE * 0.55,
  twinGapDizygotic = NODE_SIZE * 0.8,
  initialOrderMap?: Map<number, string[]>
): T[] {
  let currentNodes = [...nodes.map(n => ({ ...n }))]; // deep clone positions
  const adj = buildAdjacency(currentNodes, edges);
  const nodeMap = buildNodeMap(currentNodes);
  const pinnedIds = new Set(excludeIds ?? []);
  const tolerance = getRowTolerance(currentNodes, genGrid);

  // Group nodes by generation/row Y
  const rowMap = new Map<number, T[]>();
  for (const node of currentNodes) {
    const rowKey = genIndexOf ? (genIndexOf.get(node.id) ?? 0) : Math.round(node.y / genGrid) * genGrid;
    if (!rowMap.has(rowKey)) rowMap.set(rowKey, []);
    rowMap.get(rowKey)!.push(node);
  }
  const sortedRows = [...rowMap.keys()].sort((a, b) => a - b);

  function getBlockDesiredX(b: { nodes: T[]; offsets: number[] }): number {
    let sum = 0;
    for (let i = 0; i < b.nodes.length; i++) {
      sum += b.nodes[i]!.x - b.offsets[i]!;
    }
    return sum / b.nodes.length;
  }

  // 1D VPSC Solver over 2 sweep passes (top-to-bottom) to handle constraints & propagation
  for (let sweep = 0; sweep < 2; sweep++) {
    for (const rowY of sortedRows) {
      const rowNodes = rowMap.get(rowY) ?? [];
      if (rowNodes.length <= 1) continue;

      const order = initialOrderMap?.get(rowY);
      const orderMap = order ? new Map(order.map((id, idx) => [id, idx])) : null;

      // Group and sort rowNodes to ensure couple partners and twins are contiguous
      const visitedForSort = new Set<string>();
      const coupleGroups: T[][] = [];

      for (const n of rowNodes) {
        if (visitedForSort.has(n.id)) continue;

        const group: T[] = [];
        const queue = [n];
        const groupSet = new Set<string>([n.id]);
        let head = 0;
        while (head < queue.length) {
          const curr = queue[head]!;
          head++;
          group.push(curr);
          visitedForSort.add(curr.id);

          const couples = adj.couplesOf.get(curr.id) ?? [];
          const twins = adj.twinsOf.get(curr.id) ?? [];
          const neighbors = [...couples, ...twins];

          for (const neighId of neighbors) {
            if (!groupSet.has(neighId)) {
              const neighNode = nodeMap.get(neighId);
              if (neighNode) {
                const sameRow = genIndexOf
                  ? (genIndexOf.get(neighId) === genIndexOf.get(n.id))
                  : (Math.abs(neighNode.y - n.y) < tolerance);
                if (sameRow) {
                  groupSet.add(neighId);
                  queue.push(neighNode as T);
                }
              }
            }
          }
        }

        if (orderMap) {
          group.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
        } else {
          group.sort((a, b) => a.x - b.x);
        }
        coupleGroups.push(group);
      }

      if (orderMap) {
        coupleGroups.sort((a, b) => {
          const minA = Math.min(...a.map(node => orderMap.get(node.id) ?? 0));
          const minB = Math.min(...b.map(node => orderMap.get(node.id) ?? 0));
          return minA - minB;
        });
      } else {
        coupleGroups.sort((a, b) => {
          const avgA = a.reduce((sum, node) => sum + node.x, 0) / a.length;
          const avgB = b.reduce((sum, node) => sum + node.x, 0) / b.length;
          return avgA - avgB;
        });
      }

      const sortedRowNodes = coupleGroups.flat();

      interface Block {
        nodes: T[];
        offsets: number[];
        pinnedX: number | null;
      }

      // Build initial blocks where adjacent couples and twins are merged rigidly
      const blocks: Block[] = [];
      let currentBlock: Block = {
        nodes: [sortedRowNodes[0]!],
        offsets: [0],
        pinnedX: pinnedIds.has(sortedRowNodes[0]!.id) || sortedRowNodes[0]!.pinned ? sortedRowNodes[0]!.x : null
      };

      for (let i = 1; i < sortedRowNodes.length; i++) {
        const prev = sortedRowNodes[i - 1]!;
        const curr = sortedRowNodes[i]!;

        const isCouple = (adj.couplesOf.get(prev.id) ?? []).includes(curr.id);
        const twinsList = adj.twinsOf.get(prev.id);
        const areTwins = twinsList && twinsList.includes(curr.id);

        if (isCouple || areTwins) {
          currentBlock.nodes.push(curr);
          
          let gap = nodeGap;
          if (isCouple) {
            gap = Math.max(nodeGap, Math.abs(curr.x - prev.x));
          } else if (areTwins) {
            gap = adj.twinTypeOf.get(prev.id) === "m" ? twinGapMono : twinGapDizygotic;
          }
          
          const newOffset = currentBlock.offsets[currentBlock.offsets.length - 1]! + gap;
          currentBlock.offsets.push(newOffset);
          
          if (pinnedIds.has(curr.id) || curr.pinned) {
            if (currentBlock.pinnedX === null) {
              currentBlock.pinnedX = curr.x - newOffset;
            }
          }
        } else {
          blocks.push(currentBlock);
          currentBlock = {
            nodes: [curr],
            offsets: [0],
            pinnedX: pinnedIds.has(curr.id) || curr.pinned ? curr.x : null
          };
        }
      }
      blocks.push(currentBlock);

      let merged = true;
      while (merged) {
        merged = false;
        for (let i = 0; i < blocks.length - 1; i++) {
          const b1 = blocks[i]!;
          const b2 = blocks[i + 1]!;

          const n1 = b1.nodes[b1.nodes.length - 1]!;
          const x1 = (b1.pinnedX !== null ? b1.pinnedX : getBlockDesiredX(b1)) + b1.offsets[b1.offsets.length - 1]!;

          const n2 = b2.nodes[0]!;
          const x2 = (b2.pinnedX !== null ? b2.pinnedX : getBlockDesiredX(b2)) + b2.offsets[0]!;

          const twins = adj.twinsOf.get(n1.id);
          const areTwins = twins && twins.includes(n2.id);
          const minAllowedGap = areTwins
            ? (adj.twinTypeOf.get(n1.id) === "m" ? twinGapMono : twinGapDizygotic)
            : nodeGap;

          if (x2 < x1 + minAllowedGap - 0.05) {
            const b1BaseOffset = b1.offsets[b1.offsets.length - 1]! + minAllowedGap;
            const newNodes = [...b1.nodes, ...b2.nodes];
            const newOffsets = [
              ...b1.offsets,
              ...b2.offsets.map(o => b1BaseOffset + o - b2.offsets[0]!)
            ];

            if (b1.pinnedX !== null && b2.pinnedX !== null) {
              throw new PinnedBlockConflictError("Could not place nodes without moving pinned nodes.");
            }

            let newPinnedX = b1.pinnedX;
            if (b2.pinnedX !== null) {
              if (newPinnedX === null) {
                newPinnedX = b2.pinnedX - newOffsets[b1.nodes.length]!;
              }
            }

            blocks[i] = {
              nodes: newNodes,
              offsets: newOffsets,
              pinnedX: newPinnedX
            };
            blocks.splice(i + 1, 1);
            merged = true;
            break;
          }
        }
      }

      // Compute shifts
      const shifts = new Map<string, number>();
      for (const b of blocks) {
        const blockX = b.pinnedX !== null ? b.pinnedX : getBlockDesiredX(b);
        for (let i = 0; i < b.nodes.length; i++) {
          const node = b.nodes[i]!;
          const targetX = blockX + b.offsets[i]!;
          const shift = targetX - node.x;
          if (Math.abs(shift) > 0.01) {
            shifts.set(node.id, shift);
          }
        }
      }

      // Apply shifts and propagate to subtrees using average of all ancestral shifts
      const nodeShiftsMap = new Map<string, number[]>();
      for (const [nodeId, shift] of shifts) {
        const subtree = collectSubtree(nodeId, adj, undefined, { anchorMarriedIn: true });
        
        // Find all pinned nodes in the subtree
        const doNotShift = new Set<string>();
        for (const id of subtree) {
          const n = nodeMap.get(id);
          if (pinnedIds.has(id) || (n && n.pinned)) {
            doNotShift.add(id);
          }
        }
        
        // Propagate doNotShift state to spouses recursively
        let added = true;
        while (added) {
          added = false;
          for (const id of subtree) {
            if (doNotShift.has(id)) {
              const spouses = adj.couplesOf.get(id) ?? [];
              for (const sId of spouses) {
                if (subtree.has(sId) && !doNotShift.has(sId)) {
                  doNotShift.add(sId);
                  added = true;
                }
              }
            }
          }
        }

        for (const id of subtree) {
          if (doNotShift.has(id)) continue;
          if (!nodeShiftsMap.has(id)) {
            nodeShiftsMap.set(id, []);
          }
          nodeShiftsMap.get(id)!.push(shift);
        }
      }

      for (const [id, shiftList] of nodeShiftsMap.entries()) {
        const avgShift = shiftList.reduce((sum, s) => sum + s, 0) / shiftList.length;
        if (Math.abs(avgShift) > 0.01) {
          const n = nodeMap.get(id);
          if (n) {
            n.x += avgShift;
          }
        }
      }
    }
  }

  // Shift all unpinned nodes right if minX < genGrid
  const unpinnedNodes = currentNodes.filter(n => !pinnedIds.has(n.id) && !n.pinned);
  const minX = unpinnedNodes.reduce((min, n) => Math.min(min, n.x), Infinity);
  let adjust = 0;
  if (minX < genGrid) {
    adjust = genGrid - minX;
    for (const n of currentNodes) {
      if (!pinnedIds.has(n.id) && !n.pinned) {
        n.x += adjust;
      }
    }
  }

  // Final snap to remove topological deltas (0.01) and clamp within bounds
  return currentNodes.map(n => {
    if (pinnedIds.has(n.id) || n.pinned) return n;
    const snappedX = Math.max(genGrid, Math.round(n.x * 10) / 10);
    const maxW = canvasWidth !== undefined ? canvasWidth : 50 * genGrid;
    const clampedX = Math.min(snappedX, maxW - genGrid);
    const snappedY = genIndexOf ? n.y : Math.round(n.y / genGrid) * genGrid;
    return {
      ...n,
      x: clampedX,
      y: snappedY,
    };
  });
}



// ── Parent recentering ─────────────────────────────────────────────────────

/**
 * Try to center parents above the midpoint of their children.
 * Returns the shifted nodes if safe, or the original nodes if shifting
 * would cause new collisions.
 */
export function recenterParents<T extends LayoutNode>(
  nodes: T[],
  edges: EdgeSubset[],
  parentIds: string[],
  childIds: string[],
  excludeIds?: Set<string>,
  nodeGap = NODE_GAP,
  genGrid = GEN_GRID,
  genIndexOf?: Map<string, number>,
  canvasWidth?: number,
  coupleEdgeMap?: Map<string, EdgeSubset>,
): T[] {
  const nodeMap = buildNodeMap(nodes);
  const parents = parentIds.map(id => nodeMap.get(id)).filter((n): n is T => !!n);
  const children = childIds.map(id => nodeMap.get(id)).filter((n): n is T => !!n);

  if (parents.length === 0 || children.length === 0) return nodes;

  // N1: Validate parents share the same generation index / Y row
  const firstParentGen = genIndexOf?.get(parents[0]!.id);
  const firstParentY = parents[0]!.y;
  const tolerance = getRowTolerance(nodes, genGrid);

  for (let i = 1; i < parents.length; i++) {
    const p = parents[i]!;
    if (genIndexOf) {
      if (genIndexOf.get(p.id) !== firstParentGen) return nodes;
    } else {
      if (Math.abs(p.y - firstParentY) > tolerance) return nodes;
    }
  }

  const hasAncestorPinnedOrExcluded = parents.some(
    p => edges.some(e => e.type === "parent-child" && e.targetId === p.id && (excludeIds?.has(e.sourceId) || nodeMap.get(e.sourceId)?.pinned))
  );
  const bothHaveParentsInExclude = parents.length === 2 && parents.every(
    p => edges.some(e => e.type === "parent-child" && e.targetId === p.id && (excludeIds?.has(e.sourceId) || nodeMap.get(e.sourceId)?.pinned))
  );
  const hasPinnedOrExcluded = parents.some(p => p.pinned || excludeIds?.has(p.id)) || hasAncestorPinnedOrExcluded || bothHaveParentsInExclude;

  const childCenter = children.reduce((sum, c) => sum + c.x, 0) / children.length;
  const parentCenter = parents.reduce((sum, p) => sum + p.x, 0) / parents.length;

  const shift = childCenter - parentCenter;

  // Compute ideal target positions for each parent
  const parentTargets = new Map<string, number>();

  if (parents.length === 2) {
    const p1 = parents[0]!;
    const p2 = parents[1]!;
    let coupleEdge: EdgeSubset | undefined;
    if (coupleEdgeMap) {
      const key = p1.id < p2.id ? `${p1.id}|${p2.id}` : `${p2.id}|${p1.id}`;
      coupleEdge = coupleEdgeMap.get(key);
    } else {
      coupleEdge = edges.find(
        (e) =>
          (e.type === "couple" || e.type === "consanguinity" || e.type === "divorced" || e.type === "separated") &&
          ((e.sourceId === p1.id && e.targetId === p2.id) || (e.sourceId === p2.id && e.targetId === p1.id))
      );
    }
    let isInverted = coupleEdge?.inverted;
    if (isInverted === undefined) {
      const adj = buildAdjacency(nodes, edges);
      isInverted = evaluateCostAwareInversion(p1.id, p2.id, nodeMap, adj.parentsOf, adj.childrenOf);
    }

    const sortedParents = [...parents].sort((a, b) => {
      if (isInverted) {
        if (a.type === "female" && b.type === "male") return -1;
        if (a.type === "male" && b.type === "female") return 1;
      } else {
        if (a.type === "male" && b.type === "female") return -1;
        if (a.type === "female" && b.type === "male") return 1;
      }
      return a.x - b.x;
    });

    const p0HasParents = edges.some(e => e.type === "parent-child" && e.targetId === sortedParents[0]!.id);
    const p1HasParents = edges.some(e => e.type === "parent-child" && e.targetId === sortedParents[1]!.id);

    const p0Anchored = sortedParents[0]!.pinned || excludeIds?.has(sortedParents[0]!.id) || p0HasParents;
    const p1Anchored = sortedParents[1]!.pinned || excludeIds?.has(sortedParents[1]!.id) || p1HasParents;

    if (p0Anchored && p1Anchored) {
      // Both parents are anchored (e.g., both have parents of their own or are pinned).
      // We keep their current positions as-is, naturally preserving any existing horizontal inversion.
      parentTargets.set(sortedParents[0]!.id, sortedParents[0]!.x);
      parentTargets.set(sortedParents[1]!.id, sortedParents[1]!.x);
    } else if (p0Anchored && !p1Anchored) {
      parentTargets.set(sortedParents[0]!.id, sortedParents[0]!.x);
      parentTargets.set(sortedParents[1]!.id, sortedParents[0]!.x + nodeGap);
    } else if (!p0Anchored && p1Anchored) {
      parentTargets.set(sortedParents[1]!.id, sortedParents[1]!.x);
      parentTargets.set(sortedParents[0]!.id, sortedParents[1]!.x - nodeGap);
    } else {
      const leftTarget = childCenter - nodeGap / 2;
      const rightTarget = childCenter + nodeGap / 2;
      parentTargets.set(sortedParents[0]!.id, leftTarget);
      parentTargets.set(sortedParents[1]!.id, rightTarget);
    }
  } else if (parents.length === 1) {
    parentTargets.set(parents[0]!.id, childCenter);
  } else {
    const bulkShift = childCenter - parentCenter;
    for (const p of parents) {
      parentTargets.set(p.id, p.x + bulkShift);
    }
  }

  if (Math.abs(shift) < 1) return nodes; // Already centered

  const parentY = parents[0]!.y;
  const parentGen = genIndexOf?.get(parents[0]!.id);
  const tol = getRowTolerance(nodes, genGrid);
  const rowNodes = parentGen !== undefined && genIndexOf
    ? nodes.filter(n => genIndexOf.get(n.id) === parentGen)
    : nodes.filter(n => Math.abs(n.y - parentY) < tol);
  rowNodes.sort((a, b) => a.x - b.x);

  const parentIndices = parents.map(p => rowNodes.findIndex(rn => rn.id === p.id)).sort((a, b) => a - b);
  const minParentIdx = parentIndices[0]!;
  const maxParentIdx = parentIndices[parentIndices.length - 1]!;

  const parentIdSet = new Set(parentIds);
  const adj = buildAdjacency(nodes, edges);
  let currentNodes = nodes.map(n => ({ ...n }));
  let currentNodesMap = buildNodeMap(currentNodes);
  
  const allExclude = new Set(excludeIds ?? []);
  for (const childId of childIds) {
    const childSubtree = collectSubtree(childId, adj, undefined, { anchorMarriedIn: true });
    for (const id of childSubtree) {
      allExclude.add(id);
    }
  }

  // First, apply target positions directly to parents and shift their subtrees.
  for (const p of parents) {
    const tx = parentTargets.get(p.id)!;
    const nodeInCurrent = currentNodesMap.get(p.id);
    if (!nodeInCurrent) continue;
    const s = tx - nodeInCurrent.x;
    if (Math.abs(s) < 0.01) continue;

    const subtree = collectSubtree(p.id, adj, undefined, { anchorMarriedIn: true });
    for (const n of currentNodes) {
      if (allExclude.has(n.id)) continue;
      if (parentIdSet.has(n.id) && n.id !== p.id) continue;
      if (subtree.has(n.id)) {
        n.x += s;
      }
    }
  }

  // Second, perform a rightward sweep-line push pass for nodes to the right of the parents.
  for (let i = maxParentIdx; i < rowNodes.length - 1; i++) {
    const currId = rowNodes[i]!.id;
    const nextId = rowNodes[i + 1]!.id;
    const currNode = currentNodesMap.get(currId)!;
    const nextNode = currentNodesMap.get(nextId)!;
    
    if (nextNode.x < currNode.x + nodeGap - 0.05) {
      const push = (currNode.x + nodeGap) - nextNode.x;
      const subtree = collectSubtree(nextId, adj, undefined, { anchorMarriedIn: true });
      for (const n of currentNodes) {
        if (allExclude.has(n.id)) continue;
        if (parentIdSet.has(n.id) && n.id !== nextId) continue;
        if (subtree.has(n.id)) {
          n.x += push;
        }
      }
    }
  }

  // Third, perform a leftward sweep-line push pass for nodes to the left of the parents.
  for (let i = minParentIdx; i > 0; i--) {
    const currId = rowNodes[i]!.id;
    const prevId = rowNodes[i - 1]!.id;
    const currNode = currentNodesMap.get(currId)!;
    const prevNode = currentNodesMap.get(prevId)!;

    if (prevNode.x > currNode.x - nodeGap + 0.05) {
      const push = (currNode.x - nodeGap) - prevNode.x;
      const subtree = collectSubtree(prevId, adj, undefined, { anchorMarriedIn: true });
      for (const n of currentNodes) {
        if (allExclude.has(n.id)) continue;
        if (parentIdSet.has(n.id) && n.id !== prevId) continue;
        if (subtree.has(n.id)) {
          n.x += push;
        }
      }
    }
  }

  // Enforce boundary constraints
  const rowNodesForMinX = currentNodes.filter(n => parentGen !== undefined && genIndexOf ? genIndexOf.get(n.id) === parentGen : Math.abs(n.y - parentY) < tol);
  const minX = rowNodesForMinX.reduce((min, n) => Math.min(min, n.x), Infinity);
  if (minX < genGrid) {
    const adjust = genGrid - minX;
    for (const n of currentNodes) {
      if (!n.pinned && !allExclude.has(n.id)) {
        n.x += adjust;
      }
    }
  }

  const maxW = canvasWidth !== undefined ? canvasWidth : 50 * genGrid;
  for (const n of currentNodes) {
    if (n.pinned || allExclude.has(n.id)) continue;
    const isParentRow = parentGen !== undefined && genIndexOf
      ? genIndexOf.get(n.id) === parentGen
      : Math.abs(n.y - parentY) < tol;
    if (isParentRow) {
      n.x = Math.min(n.x, maxW - genGrid);
    }
  }

  // T3.0d: finalize couples to canonical nodeGap in a post-pass when anchorMarriedIn stretched them
  if (parents.length === 2 && !hasPinnedOrExcluded) {
    const p1 = parents[0]!;
    const p2 = parents[1]!;
    const node1 = currentNodesMap.get(p1.id);
    const node2 = currentNodesMap.get(p2.id);
    if (node1 && node2) {
      const dist = Math.abs(node1.x - node2.x);
      if (Math.abs(dist - nodeGap) > 0.1) {
        const p1Excluded = allExclude.has(p1.id) || p1.pinned;
        const p2Excluded = allExclude.has(p2.id) || p2.pinned;
        const mid = (node1.x + node2.x) / 2;
        if (p1Excluded && !p2Excluded) {
          const dir = node2.x > node1.x ? 1 : -1;
          node2.x = node1.x + dir * nodeGap;
        } else if (p2Excluded && !p1Excluded) {
          const dir = node1.x > node2.x ? 1 : -1;
          node1.x = node2.x + dir * nodeGap;
        } else if (!p1Excluded && !p2Excluded) {
          const dir = node2.x > node1.x ? 1 : -1;
          node1.x = mid - (dir * nodeGap) / 2;
          node2.x = mid + (dir * nodeGap) / 2;
        }
      }
    }
  }

  const anyShifted = currentNodes.some((cn, idx) => Math.abs(cn.x - nodes[idx]!.x) > 0.01);
  return anyShifted ? currentNodes : nodes;
}

/**
 * Global bottom-up pass: recenters all parents over their children.
 * Ripples from the lowest generation up to the highest.
 */
export function recenterAllChildren<T extends LayoutNode>(
  nodes: T[],
  edges: EdgeSubset[],
  excludeIds?: Set<string>,
  nodeGap = NODE_GAP,
  genGrid = GEN_GRID,
  genIndexOf?: Map<string, number>,
  canvasWidth?: number,
): T[] {
  // Guard: if any node has NaN/Infinite coordinates (e.g. corrupted IndexedDB state),
  // bail out immediately so we don't propagate invalid values further.
  if (nodes.some(n => !isFinite(n.x) || !isFinite(n.y))) return nodes;

  let currentNodes = [...nodes.map(n => ({ ...n }))];
  const adj = buildAdjacency(currentNodes, edges);
  let nodeMap = buildNodeMap(currentNodes);
  
  // Record initial sorted order of nodes on each row to preserve layout ordering after shifts
  const initialOrderMap = new Map<number, string[]>();
  const initialRowMap = new Map<number, T[]>();
  for (const node of currentNodes) {
    const rowKey = genIndexOf ? (genIndexOf.get(node.id) ?? 0) : Math.round(node.y / genGrid) * genGrid;
    if (!initialRowMap.has(rowKey)) initialRowMap.set(rowKey, []);
    initialRowMap.get(rowKey)!.push(node);
  }
  for (const [rowKey, rowNodes] of initialRowMap) {
    rowNodes.sort((a, b) => a.x - b.x);
    initialOrderMap.set(rowKey, rowNodes.map(n => n.id));
  }
  
  // Group families
  const families = new Map<string, { parentIds: string[]; childIds: string[] }>();
  for (const [childId, pIds] of adj.parentsOf.entries()) {
    if (pIds.length === 0) continue;
    const key = [...pIds].sort().join("_");
    if (!families.has(key)) families.set(key, { parentIds: pIds, childIds: [] });
    families.get(key)!.childIds.push(childId);
  }
  const familyList = Array.from(families.values());
  if (familyList.length === 0) return currentNodes;

  // Get all child rows
  const childRows = new Set<number>();
  for (const f of familyList) {
    const childId = f.childIds[0];
    if (childId) {
      const child = nodeMap.get(childId);
      if (child) {
        const rowKey = genIndexOf ? (genIndexOf.get(child.id) ?? 0) : Math.round(child.y / genGrid) * genGrid;
        childRows.add(rowKey);
      }
    }
  }
  // Sort child rows top-down (ascending Y or generation)
  const sortedRows = Array.from(childRows).sort((a, b) => a - b);

  // T2.5: hoist getRowTolerance to top of function
  const tol = getRowTolerance(currentNodes, genGrid);
  let anyShifted = false;

  for (const rowY of sortedRows) {
    const rowFamilies = familyList.filter(f => {
      const childId = f.childIds[0];
      if (!childId) return false;
      const child = nodeMap.get(childId);
      if (!child) return false;
      if (genIndexOf) {
        return genIndexOf.get(child.id) === rowY;
      } else {
        return Math.abs(child.y - rowY) < tol;
      }
    });

    for (const f of rowFamilies) {
      const parents = f.parentIds.map(id => nodeMap.get(id)).filter((n): n is T => !!n);
      const children = f.childIds.map(id => nodeMap.get(id)).filter((n): n is T => !!n);
      if (parents.length === 0 || children.length === 0) continue;

      // Calculate parent midpoint using mean of all effective parents
      const parentMidpoint = parents.reduce((sum, p) => sum + p.x, 0) / parents.length;

      // Calculate current children center using mean of all children
      const childrenCenter = children.reduce((sum, c) => sum + c.x, 0) / children.length;

      const shift = parentMidpoint - childrenCenter;
      if (Math.abs(shift) < 0.1) continue;

      // We shift the children and their subtrees.
      // Raw subtrees are collected first, then filtered so that a descendant is only
      // included if ALL of its parents are already in the effective shift set.
      // This prevents IV:* from being dragged when only one of their two parents
      // (e.g. III:1 but not III:2) is being re-centred in this pass — which would
      // pull the grandchildren off-centre before the grandparent-level pass can fix them.
      const rawShiftNodes = new Set<string>();
      for (const child of children) {
        const subtree = collectSubtree(child.id, adj, undefined, { anchorMarriedIn: true });
        for (const id of subtree) {
          if (!excludeIds?.has(id)) {
            rawShiftNodes.add(id);
          }
        }
      }

      // Parent-completeness filter: iterative fixpoint propagation.
      // A node is included only if ALL its parents are in shiftNodes or are the
      // current family's own parents (so the direct children always qualify).
      const familyParentSet = new Set(f.parentIds);
      const shiftNodes = new Set<string>();
      let changed = true;
      while (changed) {
        changed = false;
        for (const id of rawShiftNodes) {
          if (shiftNodes.has(id)) continue;
          const nodeParents = adj.parentsOf.get(id) ?? [];
          const allParentsOk = nodeParents.every(
            pid => familyParentSet.has(pid) || shiftNodes.has(pid)
          );
          if (allParentsOk) {
            shiftNodes.add(id);
            changed = true;
          }
        }
      }

      if (shiftNodes.size > 0) {
        for (const n of currentNodes) {
          if (shiftNodes.has(n.id)) {
            n.x += shift;
          }
        }
        anyShifted = true;
      }
    }
  }



  // T2.3: Defer resolveAllCollisions to a single trailing call after all rows shift
  if (anyShifted) {
    currentNodes = resolveAllCollisions(
      currentNodes,
      edges,
      excludeIds,
      nodeGap,
      genGrid,
      genIndexOf,
      canvasWidth,
      undefined,
      undefined,
      initialOrderMap
    );
  }

  return currentNodes;
}

export function evenOutSiblingSpacing<T extends LayoutNode>(
  nodes: T[],
  edges: EdgeSubset[],
  excludeIds?: Set<string>,
  nodeGap = NODE_GAP,
  genGrid = GEN_GRID,
  genIndexOf?: Map<string, number>,
  twinGapMono = NODE_SIZE * 0.55,
  twinGapDizygotic = NODE_SIZE * 0.8,
): T[] {
  let currentNodes = [...nodes.map(n => ({ ...n }))];
  const adj = buildAdjacency(currentNodes, edges);
  const nodeMap = buildNodeMap(currentNodes);

  // Group by parents
  const families = new Map<string, { parentIds: string[]; childIds: string[] }>();
  for (const [childId, pIds] of adj.parentsOf.entries()) {
    if (pIds.length === 0) continue;
    const key = [...pIds].sort().join("_");
    if (!families.has(key)) families.set(key, { parentIds: pIds, childIds: [] });
    families.get(key)!.childIds.push(childId);
  }

  for (const [, f] of families) {
    const siblings = f.childIds.map(id => nodeMap.get(id)).filter((n): n is T => !!n);
    if (siblings.length < 3) continue;

    const hasTwins = siblings.some(sib => {
      const twins = adj.twinsOf.get(sib.id);
      return twins && twins.length > 0;
    });
    if (hasTwins) continue;

    siblings.sort((a, b) => a.x - b.x);

    const firstX = siblings[0]!.x;
    const lastX = siblings[siblings.length - 1]!.x;
    const totalSpan = lastX - firstX;
    const step = totalSpan / (siblings.length - 1);

    // Filter out sibling nodes (and their partner subtrees) from collision checks
    // to prevent self-collisions during the shift.
    const allSiblingsSubtreeIds = new Set<string>();
    for (const sib of siblings) {
      const subtree = collectSubtree(sib.id, adj, undefined, { anchorMarriedIn: true });
      for (const id of subtree) {
        allSiblingsSubtreeIds.add(id);
      }
    }

    const siblingIdToTargetX = new Map<string, number>();
    let siblingShiftsSucceeded = true;

    // Temporary cloned node list for testing dry-run shifts
    const testNodes = currentNodes.map(n => ({ ...n }));
    const testNodesMap = buildNodeMap(testNodes);

    // Pre-group testNodes by generation row/Y-coordinate for O(1) row lookups (N7 optimization)
    const testNodesByRow = new Map<number, typeof testNodes>();
    for (const n of testNodes) {
      const nGen = genIndexOf?.get(n.id) ?? (Math.round(n.y / genGrid) * genGrid);
      if (!testNodesByRow.has(nGen)) {
        testNodesByRow.set(nGen, []);
      }
      testNodesByRow.get(nGen)!.push(n);
    }

    for (let i = 1; i < siblings.length - 1; i++) {
      const sib = siblings[i]!;
      const targetX = firstX + i * step;
      const shiftAmount = targetX - sib.x;
      if (Math.abs(shiftAmount) < 0.1) continue;

      if (excludeIds?.has(sib.id)) {
        siblingShiftsSucceeded = false;
        break;
      }

      // Collect the rigid subtree of this inner sibling
      const subtree = collectSubtree(sib.id, adj, undefined, { anchorMarriedIn: true });
      
      // If the subtree contains any pinned/excluded nodes, we cannot shift it
      const hasPinnedOrExcluded = Array.from(subtree).some(
        id => {
          const node = nodeMap.get(id);
          return node?.pinned || excludeIds?.has(id);
        }
      );
      if (hasPinnedOrExcluded) {
        siblingShiftsSucceeded = false;
        break;
      }

      // Test shift the subtree
      for (const id of subtree) {
        const n = testNodesMap.get(id);
        if (n) {
          n.x += shiftAmount;
        }
      }

      // Verify that this shift does not cause any collisions with other nodes on their respective generation rows
      let wouldCollide = false;
      for (const id of subtree) {
        const shiftedNode = testNodesMap.get(id)!;
        const nodeGen = genIndexOf?.get(id) ?? (Math.round(shiftedNode.y / genGrid) * genGrid);
        
        // Find other nodes on the same generation row (O(1) row lookup + subtree filter)
        const sameRowNodes = (testNodesByRow.get(nodeGen) ?? []).filter(
          n => !subtree.has(n.id)
        );

        for (const other of sameRowNodes) {
          const gap = Math.abs(shiftedNode.x - other.x);
          
          let minAllowedGap = nodeGap;
          const twins = adj.twinsOf.get(shiftedNode.id);
          if (twins && twins.includes(other.id)) {
            const twinType = adj.twinTypeOf.get(shiftedNode.id);
            minAllowedGap = twinType === "m" ? twinGapMono : twinGapDizygotic;
          }

          if (gap < minAllowedGap - 0.05) {
            wouldCollide = true;
            break;
          }
        }
        if (wouldCollide) break;
      }

      if (wouldCollide) {
        siblingShiftsSucceeded = false;
        break;
      }

      // Record target X positions for sibling subtree nodes
      for (const id of subtree) {
        const currentVal = testNodesMap.get(id)!;
        siblingIdToTargetX.set(id, currentVal.x);
      }
    }

    if (siblingShiftsSucceeded && siblingIdToTargetX.size > 0) {
      for (const n of currentNodes) {
        const targetX = siblingIdToTargetX.get(n.id);
        if (targetX !== undefined) {
          n.x = targetX;
        }
      }
      // Re-initialize nodeMap for subsequent families
      nodeMap.clear();
      for (const n of currentNodes) {
        nodeMap.set(n.id, n);
      }
    }
  }

  return currentNodes;
}



export function recenterAllFamilies<T extends LayoutNode>(
  nodes: T[],
  edges: EdgeSubset[],
  excludeIds?: Set<string>,
  nodeGap = NODE_GAP,
  genGrid = GEN_GRID,
  genIndexOf?: Map<string, number>,
  canvasWidth?: number,
  twinGapMono = NODE_SIZE * 0.55,
  twinGapDizygotic = NODE_SIZE * 0.8,
): T[] {
  let currentNodes = nodes.map(n => ({ ...n }));
  const adj = buildAdjacency(currentNodes, edges);
  
  const coupleEdgeMap = new Map<string, EdgeSubset>();
  for (const e of edges) {
    if (e.type === "couple" || e.type === "consanguinity" || e.type === "divorced" || e.type === "separated") {
      const key = e.sourceId < e.targetId ? `${e.sourceId}|${e.targetId}` : `${e.targetId}|${e.sourceId}`;
      coupleEdgeMap.set(key, e);
    }
  }

  const initialNodeMap = buildNodeMap(currentNodes);

  // Record initial sorted order of nodes on each row to preserve layout ordering after shifts
  const initialOrderMap = new Map<number, string[]>();
  const initialRowMap = new Map<number, T[]>();
  for (const node of currentNodes) {
    const rowKey = genIndexOf ? (genIndexOf.get(node.id) ?? 0) : Math.round(node.y / genGrid) * genGrid;
    if (!initialRowMap.has(rowKey)) initialRowMap.set(rowKey, []);
    initialRowMap.get(rowKey)!.push(node);
  }
  for (const [rowKey, rowNodes] of initialRowMap) {
    rowNodes.sort((a, b) => a.x - b.x);
    initialOrderMap.set(rowKey, rowNodes.map(n => n.id));
  }

  const families = new Map<string, { parentIds: string[]; childIds: string[] }>();
  for (const [childId, pIds] of adj.parentsOf.entries()) {
    if (pIds.length === 0) continue;
    const key = [...pIds].sort().join("_");
    if (!families.has(key)) families.set(key, { parentIds: pIds, childIds: [] });
    families.get(key)!.childIds.push(childId);
  }
  const familyList = Array.from(families.values());

  if (familyList.length === 0) return currentNodes;

  const childRows = new Set<number>();
  for (const f of familyList) {
    const childId = f.childIds[0];
    if (childId) {
      const child = initialNodeMap.get(childId);
      if (child) {
        const rowKey = genIndexOf ? (genIndexOf.get(child.id) ?? 0) : Math.round(child.y / genGrid) * genGrid;
        childRows.add(rowKey);
      }
    }
  }

  const sortedRows = Array.from(childRows).sort((a, b) => b - a);

  // T2.5: hoist getRowTolerance to top of function
  const tol = getRowTolerance(currentNodes, genGrid);

  const history = new Set<string>();
  let changed = true;
  let safety = 0;
  const safetyLimit = Math.max(15, Math.ceil(Math.sqrt(nodes.length) * 3));
  while (changed && safety++ < safetyLimit) {
    changed = false;
    const prevXs = currentNodes.map(n => n.x);

    // T2.4: Oscillation / limit cycle check using string-based state hash
    const stateHash = currentNodes
      .map(n => `${n.id}:${n.x.toFixed(2)}`)
      .sort()
      .join("|");
    if (history.has(stateHash)) {
      break;
    }
    history.add(stateHash);

    let anyParentRowResolved = false;
    const nodeMap = buildNodeMap(currentNodes);

    for (const rowY of sortedRows) {
      const rowFamilies = familyList.filter(f => {
        const childId = f.childIds[0];
        if (!childId) return false;
        const child = nodeMap.get(childId);
        if (!child) return false;
        if (genIndexOf) {
          return genIndexOf.get(child.id) === rowY;
        } else {
          return Math.abs(child.y - rowY) < tol;
        }
      });

      // Exclude all nodes at or below the child row from being shifted
      const rowExcludeIds = new Set([
        ...(excludeIds ?? []),
        ...currentNodes.filter(n => {
          if (genIndexOf) {
            const nodeGen = genIndexOf.get(n.id) ?? 0;
            return nodeGen >= rowY;
          } else {
            return n.y >= rowY;
          }
        }).map(n => n.id)
      ]);

      for (const f of rowFamilies) {
        const nextNodes = recenterParents(currentNodes, edges, f.parentIds, f.childIds, rowExcludeIds, nodeGap, genGrid, genIndexOf, canvasWidth, coupleEdgeMap);
        if (nextNodes !== currentNodes) {
          currentNodes = nextNodes;
          anyParentRowResolved = true;
        }
      }
    }

    if (anyParentRowResolved) {
      currentNodes = resolveAllCollisions(
        currentNodes,
        edges,
        excludeIds,
        nodeGap,
        genGrid,
        genIndexOf,
        canvasWidth,
        twinGapMono,
        twinGapDizygotic,
        initialOrderMap
      );
    }

    const maxDelta = currentNodes.reduce((max, n, i) => Math.max(max, Math.abs(n.x - prevXs[i]!)), 0);
    if (maxDelta > 0.1) {
      changed = true;
    }
  }

  // Always resolve collisions one final time to guarantee no horizontal overlaps
  currentNodes = resolveAllCollisions(
    currentNodes,
    edges,
    excludeIds,
    nodeGap,
    genGrid,
    genIndexOf,
    canvasWidth,
    twinGapMono,
    twinGapDizygotic,
    initialOrderMap
  );

  // Even out sibling spacing for inner siblings BEFORE centering children,
  // so that any parent shifts from spacing (e.g. II:5 moving right) are
  // already in place when recenterAllChildren calculates the parent midpoint.
  currentNodes = evenOutSiblingSpacing(currentNodes, edges, excludeIds, nodeGap, genGrid, genIndexOf, twinGapMono, twinGapDizygotic);

  // Always run the bottom-up child centering pass so that children stay centred under
  // their parents even when those parents were never moved by the top-down loop
  // (e.g. Gen-III parents that are anchored via p0HasParents/p1HasParents and therefore
  // left unchanged by recenterParents, causing Gen-IV siblings to remain off-centre).
  // recenterAllChildren guards against NaN-infected inputs at its own entry point.
  currentNodes = recenterAllChildren(currentNodes, edges, excludeIds, nodeGap, genGrid, genIndexOf, canvasWidth);



  // Final snap to remove topological deltas (0.01) and clamp within bounds
  return currentNodes.map(n => {
    if (n.pinned) return n;
    const snappedX = Math.max(genGrid, Math.round(n.x * 10) / 10);
    const maxW = canvasWidth !== undefined ? canvasWidth : 50 * genGrid;
    const clampedX = Math.min(snappedX, maxW - genGrid);
    const snappedY = genIndexOf ? n.y : Math.round(n.y / genGrid) * genGrid;
    return {
      ...n,
      x: clampedX,
      y: snappedY,
    };
  });
}

/**
 * Find the nearest free X coordinate for insertion on a specific Y row.
 * It strictly respects the requested direction to maintain topological sorting.
 * Optimized to O(N log N) via sorted-list binary search and colliders scan.
 */
export function findInsertPosition(
  nodes: LayoutNode[],
  edges: EdgeSubset[],
  targetX: number,
  targetY: number,
  excludeIds?: Set<string>,
): number {
  const tol = getRowTolerance(nodes);
  const rowNodes = nodes.filter(n => Math.abs(n.y - targetY) < tol && !excludeIds?.has(n.id));
  
  if (rowNodes.length === 0) return targetX;

  rowNodes.sort((a, b) => a.x - b.x);

  let testX = targetX;
  let collision = true;
  let guard = 0;
  const maxIterations = rowNodes.length * 2;

  while (collision && guard++ < maxIterations) {
    collision = false;
    
    let low = 0;
    let high = rowNodes.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (rowNodes[mid]!.x < testX) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    if (low < rowNodes.length) {
      const n = rowNodes[low]!;
      if (n.x - testX < NODE_GAP - 0.05) {
        collision = true;
        testX = n.x - NODE_GAP;
        continue;
      }
    }

    if (low > 0) {
      const n = rowNodes[low - 1]!;
      if (testX - n.x < NODE_GAP - 0.05) {
        collision = true;
        testX = n.x + NODE_GAP;
        continue;
      }
    }
  }

  return testX;
}

// ── Convenience: resolve and recenter in one call ──────────────────────────

export function swapCouplePartners<T extends LayoutNode>(nodes: T[], edges: EdgeSubset[], nodeGap = NODE_GAP): T[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const result = nodes.map(n => ({ ...n }));
  const adj = buildAdjacency(nodes, edges);

  const coupleCount = new Map<string, number>();
  for (const e of edges) {
    if (e.type === "couple" || e.type === "consanguinity" || e.type === "divorced" || e.type === "separated") {
      coupleCount.set(e.sourceId, (coupleCount.get(e.sourceId) ?? 0) + 1);
      coupleCount.set(e.targetId, (coupleCount.get(e.targetId) ?? 0) + 1);
    }
  }

  for (const e of edges) {
    if (e.type === "couple" || e.type === "consanguinity" || e.type === "divorced" || e.type === "separated") {
      const n1 = nodeMap.get(e.sourceId);
      const n2 = nodeMap.get(e.targetId);
      if (!n1 || !n2) continue;

      // Skip swapping if either partner is involved in multiple couple relationships
      if ((coupleCount.get(n1.id) ?? 0) > 1 || (coupleCount.get(n2.id) ?? 0) > 1) {
        continue;
      }

      let leftNode = n1;
      let rightNode = n2;

      // Identify male and female
      const male = n1.type === "male" ? n1 : n2.type === "male" ? n2 : null;
      const female = n1.type === "female" ? n1 : n2.type === "female" ? n2 : null;

      if (male && female && male.id !== female.id) {
        leftNode = male;
        rightNode = female;
      }

      const leftIdx = result.findIndex(rn => rn.id === leftNode.id);
      const rightIdx = result.findIndex(rn => rn.id === rightNode.id);
      if (leftIdx !== -1 && rightIdx !== -1) {
        const leftNodeObj = result[leftIdx]!;
        const rightNodeObj = result[rightIdx]!;
        
        let isInverted = e.inverted;
        if (isInverted === undefined) {
          isInverted = evaluateCostAwareInversion(leftNode.id, rightNode.id, nodeMap, adj.parentsOf, adj.childrenOf);
        }

        const expectedLeft = isInverted ? rightNodeObj : leftNodeObj;
        const expectedRight = isInverted ? leftNodeObj : rightNodeObj;

        // If expectedLeft is to the right of expectedRight, swap and clamp to nodeGap
        if (expectedLeft.x > expectedRight.x) {
          const mid = (expectedLeft.x + expectedRight.x) / 2;
          expectedLeft.x = mid - nodeGap / 2;
          expectedRight.x = mid + nodeGap / 2;
        }
      }
    }
  }

  // Remarriages crossing-free middle sorting
  const processedRemarriages = new Set<string>();
  for (const node of nodes) {
    if (processedRemarriages.has(node.id)) continue;
    if ((coupleCount.get(node.id) ?? 0) === 2) {
      const spouses: string[] = [];
      for (const e of edges) {
        if (e.type === "couple" || e.type === "consanguinity" || e.type === "divorced" || e.type === "separated") {
          if (e.sourceId === node.id) spouses.push(e.targetId);
          else if (e.targetId === node.id) spouses.push(e.sourceId);
        }
      }
      
      if (spouses.length === 2) {
        const s1Id = spouses[0]!;
        const s2Id = spouses[1]!;
        const nIdx = result.findIndex(rn => rn.id === node.id);
        const s1Idx = result.findIndex(rn => rn.id === s1Id);
        const s2Idx = result.findIndex(rn => rn.id === s2Id);
        
        if (nIdx !== -1 && s1Idx !== -1 && s2Idx !== -1) {
          processedRemarriages.add(node.id);
          const nObj = result[nIdx]!;
          const s1Obj = result[s1Idx]!;
          const s2Obj = result[s2Idx]!;
          
          const minSpouseX = Math.min(s1Obj.x, s2Obj.x);
          const maxSpouseX = Math.max(s1Obj.x, s2Obj.x);
          
          if (nObj.x < minSpouseX || nObj.x > maxSpouseX) {
            const coords = [
              { id: node.id, x: nObj.x, idx: nIdx },
              { id: s1Id, x: s1Obj.x, idx: s1Idx },
              { id: s2Id, x: s2Obj.x, idx: s2Idx }
            ].sort((a, b) => a.x - b.x);
            
            if (coords[1]!.id !== node.id) {
              const currentMid = coords[1]!;
              const midNodeObj = result.find(rn => rn.id === currentMid.id)!;
              const tempX = nObj.x;
              nObj.x = midNodeObj.x;
              midNodeObj.x = tempX;
            }
          }
        }
      }
    }
  }

  return result;
}

function getIncrementalExcludeIds(
  nodes: LayoutNode[],
  edges: EdgeSubset[],
  affectedNodeIds: Set<string>
): Set<string> {
  const adj = buildAdjacency(nodes, edges);
  const affected = new Set<string>(affectedNodeIds);
  let queue = Array.from(affectedNodeIds);

  for (let step = 0; step < 2; step++) {
    const nextQueue: string[] = [];
    for (const id of queue) {
      const parents = adj.parentsOf.get(id) ?? [];
      const children = adj.childrenOf.get(id) ?? [];
      const spouses = adj.couplesOf.get(id) ?? [];

      const neighbors = [...parents, ...children, ...spouses];
      for (const n of neighbors) {
        if (!affected.has(n)) {
          affected.add(n);
          nextQueue.push(n);
        }
      }
    }
    queue = nextQueue;
  }

  const exclude = new Set<string>();
  for (const n of nodes) {
    if (!affected.has(n.id)) {
      exclude.add(n.id);
    }
  }
  return exclude;
}

/**
 * Full pipeline: resolve all collisions, then globally recenter parents.
 * This is the main entry point for the layout engine.
 */
export function resolveAndRecenter<T extends LayoutNode>(
  nodes: T[],
  edges: EdgeSubset[],
  excludeIds?: Set<string>,
  genIndexOf?: Map<string, number>,
  canvasWidth?: number,
  affectedNodeIds?: Set<string>,
  nodeGap = NODE_GAP,
  genGrid = GEN_GRID,
  twinGapMono = NODE_SIZE * 0.55,
  twinGapDizygotic = NODE_SIZE * 0.8,
  crossingMinimizationSweeps = 15
): T[] {
  // Sanitize any NaN/Infinite coordinates that may have been persisted to IndexedDB
  // from previous layout bugs.  Replace bad values with rough fallbacks so the layout
  // engine can recenter them — the subsequent passes will find their correct positions.
  nodes = nodes.map((n, i) => {
    const x = isFinite(n.x) ? n.x : (i + 1) * nodeGap;
    const y = isFinite(n.y) ? n.y : genGrid;
    return (x !== n.x || y !== n.y) ? { ...n, x, y } as T : n;
  });

  let finalExcludeIds = excludeIds;
  if (affectedNodeIds && affectedNodeIds.size > 0) {
    const incrementalExclude = getIncrementalExcludeIds(nodes, edges, affectedNodeIds);
    finalExcludeIds = new Set([...(excludeIds ?? []), ...incrementalExclude]);
  }
  const resolved = resolveAllCollisions(nodes, edges, finalExcludeIds, nodeGap, genGrid, genIndexOf, canvasWidth, twinGapMono, twinGapDizygotic);
  const minimized = minimizeCrossings(resolved, edges, genIndexOf, finalExcludeIds, crossingMinimizationSweeps);
  const resolved2 = resolveAllCollisions(minimized, edges, finalExcludeIds, nodeGap, genGrid, genIndexOf, canvasWidth, twinGapMono, twinGapDizygotic);
  const swapped = swapCouplePartners(resolved2, edges, nodeGap);
  return recenterAllFamilies(swapped, edges, finalExcludeIds, nodeGap, genGrid, genIndexOf, canvasWidth, twinGapMono, twinGapDizygotic);
}

// ── Smart-push insertion (bidirectional) ───────────────────────────────────

/**
 * Insert a node at (targetX, targetY) and resolve collisions using the
 * unified engine. Returns the canvas with the new node placed and all
 * collisions resolved, followed by a global bottom-up parent recentering pass.
 */
export function insertNodeWithCollisionResolution(
  canvas: CanvasData,
  newNode: PedigreeNode,
  newEdges: PedigreeEdge[],
  excludeIds?: Set<string>,
  canvasWidth?: number,
): CanvasData {
  const allNodes = [...canvas.nodes, newNode];
  const allEdges = [...canvas.edges, ...newEdges];
  const exclude = new Set([...(excludeIds ?? []), newNode.id]);
  const genIndexOf = buildGenerations(allNodes, allEdges);

  let resolved = resolveAllCollisions(allNodes, allEdges, exclude, NODE_GAP, GEN_GRID, genIndexOf, canvasWidth);
  resolved = recenterAllFamilies(resolved, allEdges, exclude, NODE_GAP, GEN_GRID, genIndexOf, canvasWidth);

  return {
    ...canvas,
    nodes: resolved,
    edges: allEdges,
  };
}




// ── Re-export adjacency builder for consumers ──────────────────────────────


// ── Surgical Space Clearing ────────────────────────────────────────────────

/**
 * Ensures there is enough empty space between `emptyStartX` and `emptyEndX`.
 * Unlike `makeSpaceAtX` which always shifts by a full NODE_GAP, this function
 * first checks whether the space is already clear. If so, it does nothing.
 * If blocked, it shifts only the exact amount needed to clear the gap.
 * This prevents unnecessary inflation of inter-family spacing.
 */
export function ensureSpaceAtX<T extends LayoutNode>(
  nodes: T[],
  emptyStartX: number,
  emptyEndX: number,
): T[] {
  // Find nodes that are inside the zone we want empty
  const blockingNodes = nodes.filter(n => n.x > emptyStartX && n.x < emptyEndX);
  if (blockingNodes.length === 0) {
    // Also check: is the first node to the right of emptyStartX already past emptyEndX?
    const rightNodes = nodes.filter(n => n.x > emptyStartX);
    if (rightNodes.length === 0) return nodes; // Nothing to the right at all
    const minRightX = rightNodes.reduce((min, n) => Math.min(min, n.x), Infinity);
    if (minRightX >= emptyEndX - 0.05) return nodes; // Already enough space
  }

  // Find the closest node to the right of emptyStartX
  const rightNodes = nodes.filter(n => n.x > emptyStartX);
  if (rightNodes.length === 0) return nodes;
  const minRightX = rightNodes.reduce((min, n) => Math.min(min, n.x), Infinity);

  const requiredShift = emptyEndX - minRightX;
  if (requiredShift <= 0) return nodes;

  // Shift everything at or right of minRightX by exactly the required amount
  return nodes.map(n => {
    if (n.x >= minRightX - 0.05) {
      return { ...n, x: n.x + requiredShift };
    }
    return n;
  });
}

// ── Topological Space Maker ────────────────────────────────────────────────

/**
 * Creates topological space at a specific X coordinate by shifting all nodes
 * to the right of this coordinate by the requested amount. This guarantees
 * the insertion point is completely empty across the entire canvas, preserving
 * the global topological order without relying on physics-based collision pushing.
 */
export function makeSpaceAtX<T extends LayoutNode>(
  nodes: T[],
  xThreshold: number,
  space: number = NODE_GAP,
): T[] {
  return nodes.map(n => {
    if (n.x >= xThreshold - 0.05) { // allow small float tolerance
      return { ...n, x: n.x + space };
    }
    return n;
  });
}
export { buildAdjacency, buildNodeMap, ROW_TOLERANCE };
export type { AdjacencyMaps };

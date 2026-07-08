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
import { buildAdjacency, buildGenerations, buildNodeMap } from "./layout-shared";
import type { AdjacencyMaps } from "./layout-shared";
export { buildGenerations };

// ── Types ──────────────────────────────────────────────────────────────────

/** Axis-aligned bounding box */
export interface BBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}


/** Shift instruction: which nodes to move and by how much */
export interface ShiftPlan {
  shifts: Map<string, number>;  // nodeId → new absolute X
  cost: number;                 // total displacement (lower = better)
}

// ── Constants ──────────────────────────────────────────────────────────────

/** Nodes within this vertical distance are on the "same row" */
const ROW_TOLERANCE = GEN_GRID / 2; // 60px — correct for 120px generation grid

// ── Bounding box computation ───────────────────────────────────────────────

/** Compute the bounding box of a single node */
function nodeBBox(node: PedigreeNode): BBox {
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
  nodeMap: Map<string, PedigreeNode>,
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
export function getRowTolerance(nodes: PedigreeNode[], genGrid = GEN_GRID): number {
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

interface Collision {
  leftNode: PedigreeNode;
  rightNode: PedigreeNode;
  overlap: number; // positive = overlapping by this many px
}

/**
 * Detect horizontal collisions between nodes on the same generation row.
 * Uses a sweep-line approach: sort nodes by X, then check adjacent pairs for overlap.
 */
export function detectRowCollisions(
  nodes: PedigreeNode[],
  rowY: number,
  minGap: number = NODE_GAP,
  tolerance?: number,
  genIndexOf?: Map<string, number>,
  adj?: AdjacencyMaps,
): Collision[] {
  const tol = tolerance ?? getRowTolerance(nodes);
  const rowNodes = genIndexOf
    ? nodes.filter(n => genIndexOf.get(n.id) === rowY)
    : nodes.filter(n => Math.abs(n.y - rowY) < tol);

  if (rowNodes.length < 2) return [];

  rowNodes.sort((a, b) => a.x - b.x);

  const collisions: Collision[] = [];
  for (let i = 1; i < rowNodes.length; i++) {
    const left = rowNodes[i - 1]!;
    const right = rowNodes[i]!;
    const gap = right.x - left.x;

    let currentMinGap = minGap;
    if (adj) {
      const twins = adj.twinsOf.get(left.id);
      if (twins && twins.includes(right.id)) {
        const type = adj.twinTypeOf.get(left.id);
        currentMinGap = type === "m" ? (NODE_SIZE * 0.55) : (NODE_SIZE * 0.8);
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
export function collectSubtree(
  nodeId: string,
  adj: AdjacencyMaps,
  visited?: Set<string>,
  options?: { anchorMarriedIn?: boolean },
): Set<string> {
  const v = visited ?? new Set<string>();
  if (v.has(nodeId)) return v;
  v.add(nodeId);

  // Include couple partners
  for (const partnerId of adj.couplesOf.get(nodeId) ?? []) {
    if (!v.has(partnerId)) {
      if (options?.anchorMarriedIn) {
        // If the partner has parents, and those parents are not in the visited set,
        // we do not include the partner in the rigid subtree to avoid breaking parent-child connections.
        const partnerParents = adj.parentsOf.get(partnerId) ?? [];
        const hasUnvisitedParents = Array.from(partnerParents).some(pId => !v.has(pId));
        if (hasUnvisitedParents) {
          continue;
        }
      }

      v.add(partnerId);
      // Partner's own children
      for (const childId of adj.childrenOf.get(partnerId) ?? []) {
        collectSubtree(childId, adj, v, options);
      }
    }
  }

  // Include children recursively
  for (const childId of adj.childrenOf.get(nodeId) ?? []) {
    collectSubtree(childId, adj, v, options);
  }

  // Include twins recursively (twins must move rigidly together)
  for (const twinId of adj.twinsOf.get(nodeId) ?? []) {
    collectSubtree(twinId, adj, v, options);
  }

  return v;
}


// ── Shift plan computation ─────────────────────────────────────────────────

/**
 * Compute the shift plan for resolving a collision between two families.
 * Tries both directions and returns the cheaper option.
 *
 * @param direction If specified, only compute the shift in that direction.
 *                  Otherwise, compute both and pick the cheaper one.
 */
export function computeShiftPlan(
  nodes: PedigreeNode[],
  edges: PedigreeEdge[],
  nodeToShift: PedigreeNode,
  overlap: number,
  direction?: 1 | -1,
  excludeIds?: Set<string>,
  prebuiltAdj?: AdjacencyMaps,
  prebuiltNodeMap?: Map<string, PedigreeNode>,
  prebuiltRowMap?: Map<number, PedigreeNode[]>,
  genGrid = GEN_GRID,
  genIndexOf?: Map<string, number>,
): ShiftPlan {
  const adj = prebuiltAdj ?? buildAdjacency(nodes, edges);
  const nodeMap = prebuiltNodeMap ?? buildNodeMap(nodes);

  const computeForDirection = (dir: 1 | -1): ShiftPlan => {
    const shifts = new Map<string, number>();
    let cost = 0;
    const shiftAmount = overlap;

    // Collect all nodes that must move with this family
    const movingNodes = new Set<string>();
    if (!excludeIds?.has(nodeToShift.id)) {
      const subtree = collectSubtree(nodeToShift.id, adj);
      for (const id of subtree) {
        if (!excludeIds?.has(id)) movingNodes.add(id);
      }
    }

    for (const id of movingNodes) {
      const node = nodeMap.get(id);
      if (!node) continue;
      const newX = node.x + dir * shiftAmount;
      shifts.set(id, newX);
      cost += Math.abs(dir * shiftAmount);
    }

    // Penalize shifts that change the relative horizontal order of nodes on any row
    let orderViolationPenalty = 0;
    let activeRowMap = prebuiltRowMap;
    if (!activeRowMap) {
      activeRowMap = new Map<number, PedigreeNode[]>();
      for (const n of nodes) {
        const rY = genIndexOf ? (genIndexOf.get(n.id) ?? 0) : Math.round(n.y / genGrid) * genGrid;
        if (!activeRowMap.has(rY)) activeRowMap.set(rY, []);
        activeRowMap.get(rY)!.push(n);
      }
      for (const [, rowNodes] of activeRowMap) {
        rowNodes.sort((a, b) => a.x - b.x);
      }
    }

    for (const [, rowNodes] of activeRowMap) {
      if (rowNodes.length <= 1) continue;

      for (let i = 0; i < rowNodes.length - 1; i++) {
        const nodeA = rowNodes[i]!;
        const nodeB = rowNodes[i + 1]!;
        if (nodeA.x < nodeB.x - 0.1) {
          const xA = shifts.get(nodeA.id) ?? nodeA.x;
          const xB = shifts.get(nodeB.id) ?? nodeB.x;
          if (xA > xB - 0.05) {
            orderViolationPenalty += 100000;
          }
        }
      }
    }

    return { shifts, cost: cost + orderViolationPenalty };
  };

  if (direction !== undefined) {
    return computeForDirection(direction);
  }

  // Try both directions, pick cheaper
  const planRight = computeForDirection(1);
  const planLeft = computeForDirection(-1);

  // Penalise leftward shifts that would push nodes below minimum X
  let leftPenalty = 0;
  for (const [, x] of planLeft.shifts) {
    if (x < genGrid) leftPenalty += (genGrid - x) * 10;
  }

  return (planLeft.cost + leftPenalty <= planRight.cost) ? planLeft : planRight;
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
export function resolveAllCollisions(
  nodes: PedigreeNode[],
  edges: PedigreeEdge[],
  excludeIds?: Set<string>,
  targetNodes?: Set<string>,
  nodeGap = NODE_GAP,
  genGrid = GEN_GRID,
  genIndexOf?: Map<string, number>,
  canvasWidth?: number,
): PedigreeNode[] {
  let currentNodes = [...nodes.map(n => ({ ...n }))]; // deep clone positions
  const adj = buildAdjacency(currentNodes, edges);
  
  // T13: dynamic tolerance
  const tolerance = getRowTolerance(currentNodes, genGrid);

  const seenHashes = new Set<string>();
  const maxCascade = Math.max(15, nodes.length);

  for (let cascade = 0; cascade < maxCascade; cascade++) {
    // Check for limit cycles/oscillations
    const stateHash = currentNodes
      .map(n => `${n.id}:${n.x.toFixed(2)}`)
      .sort()
      .join("|");
    if (seenHashes.has(stateHash)) {
      break; // Terminate gracefully
    }
    seenHashes.add(stateHash);

    let nodeMap = buildNodeMap(currentNodes);
    
    // T10: prebuild rowMap and sort once per cascade
    const rowMap = new Map<number, PedigreeNode[]>();
    for (const node of currentNodes) {
      const rY = genIndexOf ? (genIndexOf.get(node.id) ?? 0) : Math.round(node.y / genGrid) * genGrid;
      if (!rowMap.has(rY)) rowMap.set(rY, []);
      rowMap.get(rY)!.push(node);
    }
    for (const [, rowNodes] of rowMap) {
      rowNodes.sort((a, b) => a.x - b.x);
    }

    // Identify all unique generation rows
    const rows = new Set<number>(rowMap.keys());
    let anyCollision = false;

    for (const rowY of rows) {
      // T13: Pass calculated tolerance into detectRowCollisions
      const collisions = detectRowCollisions(currentNodes, rowY, nodeGap, tolerance, genIndexOf, adj);

      for (const collision of collisions) {
        anyCollision = true;

        // Determine which node to shift — prefer shifting the one not in excludeIds
        const leftExcluded = excludeIds?.has(collision.leftNode.id);
        const rightExcluded = excludeIds?.has(collision.rightNode.id);

        let nodeToShift: PedigreeNode;
        let shiftDirection: 1 | -1;

        if (leftExcluded && !rightExcluded) {
          nodeToShift = collision.rightNode;
          shiftDirection = 1; // push right node rightward
        } else if (rightExcluded && !leftExcluded) {
          nodeToShift = collision.leftNode;
          shiftDirection = -1; // push left node leftward
        } else {
          // Neither or both excluded — use bidirectional cost comparison
          // T10: pass rowMap cache
          const planRight = computeShiftPlan(currentNodes, edges, collision.rightNode, collision.overlap, 1, excludeIds, adj, nodeMap, rowMap, genGrid, genIndexOf);
          const planLeft = computeShiftPlan(currentNodes, edges, collision.leftNode, collision.overlap, -1, excludeIds, adj, nodeMap, rowMap, genGrid, genIndexOf);

          // Check if leftward shift would push below minimum X
          let leftViable = true;
          for (const [, x] of planLeft.shifts) {
            if (x < genGrid) { leftViable = false; break; }
          }

          if (!leftViable || planRight.cost <= planLeft.cost) {
            nodeToShift = collision.rightNode;
            shiftDirection = 1;
          } else {
            nodeToShift = collision.leftNode;
            shiftDirection = -1;
          }
        }

        // T10: pass rowMap cache
        const plan = computeShiftPlan(currentNodes, edges, nodeToShift, collision.overlap, shiftDirection, excludeIds, adj, nodeMap, rowMap, genGrid, genIndexOf);

        // Apply shifts in-place
        for (const n of currentNodes) {
          const newX = plan.shifts.get(n.id);
          if (newX !== undefined) {
            n.x = newX;
          }
        }

        // Re-sort the shifted rows in-place (avoiding full rebuild)
        for (const [, rowNodes] of rowMap) {
          rowNodes.sort((a, b) => a.x - b.x);
        }
      }
    }

    if (!anyCollision) break; // All clear — no more cascades needed
  }

  // T7: Final safety pass convergence loop (scales with tree size)
  const safetySeenHashes = new Set<string>();
  const safetyLimit = Math.max(15, nodes.length);
  for (let safetyLoop = 0; safetyLoop < safetyLimit; safetyLoop++) {
    // Check for safety loop oscillations
    const stateHash = currentNodes
      .map(n => `${n.id}:${n.x.toFixed(2)}`)
      .sort()
      .join("|");
    if (safetySeenHashes.has(stateHash)) {
      break;
    }
    safetySeenHashes.add(stateHash);
    // Check if any collisions remain using detectRowCollisions
    const rows = new Set<number>();
    for (const node of currentNodes) {
      const rowKey = genIndexOf ? (genIndexOf.get(node.id) ?? 0) : Math.round(node.y / genGrid) * genGrid;
      rows.add(rowKey);
    }
    
    let hasAnyRemainingCollision = false;
    for (const rowY of rows) {
      if (detectRowCollisions(currentNodes, rowY, nodeGap, tolerance, genIndexOf, adj).length > 0) {
        hasAnyRemainingCollision = true;
        break;
      }
    }
    
    if (!hasAnyRemainingCollision) {
      break; // No collisions remain!
    }

    // Safety pass: rebuild rowMap since we're shifting
    const rowMap = new Map<number, PedigreeNode[]>();
    for (const n of currentNodes) {
      const rowKey = genIndexOf ? (genIndexOf.get(n.id) ?? 0) : Math.round(n.y / genGrid) * genGrid;
      if (!rowMap.has(rowKey)) rowMap.set(rowKey, []);
      rowMap.get(rowKey)!.push(n);
    }

    for (const [, rowNodes] of rowMap) {
      rowNodes.sort((a, b) => a.x - b.x);
      for (let i = 1; i < rowNodes.length; i++) {
        const prev = rowNodes[i - 1]!;
        const curr = rowNodes[i]!;
        if (excludeIds?.has(curr.id)) continue;

        const twins = adj.twinsOf.get(prev.id);
        const areTwins = twins && twins.includes(curr.id);
        const currentMinGap = areTwins ? (adj.twinTypeOf.get(prev.id) === "m" ? (NODE_SIZE * 0.55) : (NODE_SIZE * 0.8)) : nodeGap;

        const gap = curr.x - prev.x;
        if (gap < currentMinGap - 0.05) {
          let maxPush = currentMinGap - gap;
          // Push curr, everything to its right, and their subtrees
          const movingNodes = new Set<string>();
          for (let j = i; j < rowNodes.length; j++) {
            const n = rowNodes[j]!;
            if (excludeIds?.has(n.id)) continue;
            
            const pNode = rowNodes[j - 1]!;
            const innerTwins = adj.twinsOf.get(pNode.id);
            const areInnerTwins = innerTwins && innerTwins.includes(n.id);
            const innerMinGap = areInnerTwins ? (adj.twinTypeOf.get(pNode.id) === "m" ? (NODE_SIZE * 0.55) : (NODE_SIZE * 0.8)) : nodeGap;

            const g = n.x - pNode.x;
            if (g < innerMinGap - 0.05) {
              maxPush = Math.max(maxPush, innerMinGap - g);
            }
            
            const subtree = collectSubtree(n.id, adj);
            for (const id of subtree) {
              if (!excludeIds?.has(id)) {
                movingNodes.add(id);
              }
            }
          }

          if (movingNodes.size > 0) {
            currentNodes = currentNodes.map(cn => {
              if (movingNodes.has(cn.id)) {
                return { ...cn, x: cn.x + maxPush };
              }
              return cn;
            });

            // Update rowNodes for continued iteration using a Map for O(1) lookups
            const currentNodesMap = new Map(currentNodes.map(cn => [cn.id, cn]));
            for (let j = i; j < rowNodes.length; j++) {
              const n = rowNodes[j]!;
              const updated = currentNodesMap.get(n.id);
              if (updated) rowNodes[j] = updated;
            }
          }
        }
      }
    }
  }

  // Shift all unpinned nodes right if minX < genGrid
  const unpinnedNodes = currentNodes.filter(n => !n.pinned);
  const minX = unpinnedNodes.reduce((min, n) => Math.min(min, n.x), Infinity);
  if (minX < genGrid) {
    const adjust = genGrid - minX;
    currentNodes = currentNodes.map(n => {
      if (n.pinned) return n;
      return { ...n, x: n.x + adjust };
    });
  }

  // Final snap to remove topological deltas (0.01) and clamp within bounds
  return currentNodes.map(n => {
    if (n.pinned) return n;
    const snappedX = Math.max(genGrid, Math.round(n.x * 10) / 10);
    const clampedX = canvasWidth !== undefined ? Math.min(snappedX, canvasWidth - genGrid) : snappedX;
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
export function recenterParents(
  nodes: PedigreeNode[],
  edges: PedigreeEdge[],
  parentIds: string[],
  childIds: string[],
  excludeIds?: Set<string>,
  nodeGap = NODE_GAP,
  genGrid = GEN_GRID,
  genIndexOf?: Map<string, number>,
  canvasWidth?: number,
): PedigreeNode[] {
  const nodeMap = buildNodeMap(nodes);
  const parents = parentIds.map(id => nodeMap.get(id)).filter((n): n is PedigreeNode => !!n);
  const children = childIds.map(id => nodeMap.get(id)).filter((n): n is PedigreeNode => !!n);

  if (parents.length === 0 || children.length === 0) return nodes;

  const hasPinnedOrExcluded = parents.some(
    p => p.pinned || excludeIds?.has(p.id) || edges.some(e => e.type === "parent-child" && e.targetId === p.id)
  );

  const childCenter = children.reduce((sum, c) => sum + c.x, 0) / children.length;
  const parentCenter = parents.reduce((sum, p) => sum + p.x, 0) / parents.length;

  const shift = childCenter - parentCenter;

  // Compute ideal target positions for each parent
  const parentTargets = new Map<string, number>();

  if (parents.length === 2) {
    const p1 = parents[0]!;
    const p2 = parents[1]!;
    const coupleEdge = edges.find(
      (e) =>
        (e.type === "couple" || e.type === "consanguinity" || e.type === "divorced" || e.type === "separated") &&
        ((e.sourceId === p1.id && e.targetId === p2.id) || (e.sourceId === p2.id && e.targetId === p1.id))
    );
    const isInverted = coupleEdge?.inverted ?? false;

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

    const targetDist = hasPinnedOrExcluded
      ? Math.max(nodeGap, Math.abs(parents[0]!.x - parents[1]!.x))
      : nodeGap;
    const leftTarget = childCenter - targetDist / 2;
    const rightTarget = childCenter + targetDist / 2;
    parentTargets.set(sortedParents[0]!.id, leftTarget);
    parentTargets.set(sortedParents[1]!.id, rightTarget);
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
    currentNodes = currentNodes.map(n => {
      if (allExclude.has(n.id)) return n;
      if (parentIdSet.has(n.id) && n.id !== p.id) return n;
      if (subtree.has(n.id)) {
        return { ...n, x: n.x + s };
      }
      return n;
    });
    currentNodesMap = buildNodeMap(currentNodes);
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
      currentNodes = currentNodes.map(n => {
        if (allExclude.has(n.id)) return n;
        if (parentIdSet.has(n.id) && n.id !== nextId) return n;
        if (subtree.has(n.id)) {
          return { ...n, x: n.x + push };
        }
        return n;
      });
      currentNodesMap = buildNodeMap(currentNodes);
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
      currentNodes = currentNodes.map(n => {
        if (allExclude.has(n.id)) return n;
        if (parentIdSet.has(n.id) && n.id !== prevId) return n;
        if (subtree.has(n.id)) {
          return { ...n, x: n.x + push };
        }
        return n;
      });
      currentNodesMap = buildNodeMap(currentNodes);
    }
  }

  // Enforce boundary constraints
  const rowNodesForMinX = currentNodes.filter(n => parentGen !== undefined && genIndexOf ? genIndexOf.get(n.id) === parentGen : Math.abs(n.y - parentY) < tol);
  const minX = rowNodesForMinX.reduce((min, n) => Math.min(min, n.x), Infinity);
  if (minX < genGrid) {
    const adjust = genGrid - minX;
    currentNodes = currentNodes.map(n => {
      if (n.pinned || allExclude.has(n.id)) return n;
      return { ...n, x: n.x + adjust };
    });
  }

  if (canvasWidth !== undefined) {
    currentNodes = currentNodes.map(n => {
      if (n.pinned || allExclude.has(n.id)) return n;
      const isParentRow = parentGen !== undefined && genIndexOf
        ? genIndexOf.get(n.id) === parentGen
        : Math.abs(n.y - parentY) < tol;
      if (isParentRow) {
        return { ...n, x: Math.min(n.x, canvasWidth - genGrid) };
      }
      return n;
    });
  }

  // T3.0d: finalize couples to canonical nodeGap in a post-pass when anchorMarriedIn stretched them
  if (parents.length === 2 && !hasPinnedOrExcluded) {
    const p1 = parents[0]!;
    const p2 = parents[1]!;
    const node1 = currentNodes.find(n => n.id === p1.id);
    const node2 = currentNodes.find(n => n.id === p2.id);
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
        currentNodes = currentNodes.map(n => {
          if (n.id === p1.id) return { ...n, x: node1.x };
          if (n.id === p2.id) return { ...n, x: node2.x };
          return n;
        });
      }
    }
  }

  return currentNodes;
}

/**
 * Global bottom-up pass: recenters all parents over their children.
 * Ripples from the lowest generation up to the highest.
 */
export function recenterAllChildren(
  nodes: PedigreeNode[],
  edges: PedigreeEdge[],
  excludeIds?: Set<string>,
  nodeGap = NODE_GAP,
  genGrid = GEN_GRID,
  genIndexOf?: Map<string, number>,
  canvasWidth?: number,
): PedigreeNode[] {
  let currentNodes = [...nodes.map(n => ({ ...n }))];
  const adj = buildAdjacency(currentNodes, edges);
  let nodeMap = buildNodeMap(currentNodes);
  
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
      const parents = f.parentIds.map(id => nodeMap.get(id)).filter((n): n is PedigreeNode => !!n);
      const children = f.childIds.map(id => nodeMap.get(id)).filter((n): n is PedigreeNode => !!n);
      if (parents.length === 0 || children.length === 0) continue;

      // Calculate parent midpoint using mean of all effective parents
      const parentMidpoint = parents.reduce((sum, p) => sum + p.x, 0) / parents.length;

      // Calculate current children center using mean of all children
      const childrenCenter = children.reduce((sum, c) => sum + c.x, 0) / children.length;

      const shift = parentMidpoint - childrenCenter;
      if (Math.abs(shift) < 0.1) continue;

      // We shift the children and their subtrees
      const shiftNodes = new Set<string>();
      for (const child of children) {
        const subtree = collectSubtree(child.id, adj, undefined, { anchorMarriedIn: true });
        for (const id of subtree) {
          if (!excludeIds?.has(id)) {
            shiftNodes.add(id);
          }
        }
      }

      if (shiftNodes.size > 0) {
        currentNodes = currentNodes.map(n => {
          if (shiftNodes.has(n.id)) {
            return { ...n, x: n.x + shift };
          }
          return n;
        });
        nodeMap = buildNodeMap(currentNodes);
        anyShifted = true;
      }
    }
  }

  // T2.3: Defer resolveAllCollisions to a single trailing call after all rows shift
  if (anyShifted) {
    currentNodes = resolveAllCollisions(currentNodes, edges, excludeIds, undefined, nodeGap, genGrid, genIndexOf, canvasWidth);
  }

  return currentNodes;
}

export function evenOutSiblingSpacing(
  nodes: PedigreeNode[],
  edges: PedigreeEdge[],
  excludeIds?: Set<string>,
  nodeGap = NODE_GAP,
  genGrid = GEN_GRID,
  genIndexOf?: Map<string, number>,
): PedigreeNode[] {
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
    const siblings = f.childIds.map(id => nodeMap.get(id)).filter((n): n is PedigreeNode => !!n);
    if (siblings.length < 3) continue;

    siblings.sort((a, b) => a.x - b.x);

    // Check if all inner siblings are free to shift
    let allInnerFree = true;
    for (let i = 1; i < siblings.length - 1; i++) {
      const sib = siblings[i]!;
      const hasCouples = (adj.couplesOf.get(sib.id) ?? []).length > 0;
      const hasChildren = (adj.childrenOf.get(sib.id) ?? []).length > 0;
      const isExcluded = excludeIds?.has(sib.id);
      const isTwin = (adj.twinsOf.get(sib.id) ?? []).length > 0;
      if (hasCouples || hasChildren || isExcluded || isTwin) {
        allInnerFree = false;
        break;
      }
    }

    if (allInnerFree) {
      const firstX = siblings[0]!.x;
      const lastX = siblings[siblings.length - 1]!.x;
      const totalSpan = lastX - firstX;
      const step = totalSpan / (siblings.length - 1);

      const parentY = siblings[0]!.y;
      const siblingIds = new Set(siblings.map(s => s.id));
      const sibGen = genIndexOf?.get(siblings[0]!.id);
      const tol = getRowTolerance(currentNodes, genGrid);
      const rowNodes = currentNodes.filter(
        n => {
          if (siblingIds.has(n.id)) return false;
          if (sibGen !== undefined && genIndexOf) {
            return genIndexOf.get(n.id) === sibGen;
          } else {
            return Math.abs(n.y - parentY) < tol;
          }
        }
      );

      let safeToEvenOut = true;
      for (let i = 1; i < siblings.length - 1; i++) {
        const targetX = firstX + i * step;
        const wouldCollide = rowNodes.some(
          rn => Math.abs(rn.x - targetX) < nodeGap - 0.05
        );
        if (wouldCollide) {
          safeToEvenOut = false;
          break;
        }
      }

      if (safeToEvenOut) {
        const siblingIdToTargetX = new Map<string, number>();
        for (let i = 1; i < siblings.length - 1; i++) {
          const sib = siblings[i]!;
          const targetX = firstX + i * step;
          siblingIdToTargetX.set(sib.id, targetX);
        }

        currentNodes = currentNodes.map(n => {
          const targetX = siblingIdToTargetX.get(n.id);
          return targetX !== undefined ? { ...n, x: targetX } : n;
        });
      }
    }
  }

  return currentNodes;
}

function hashState(nodes: PedigreeNode[]): number {
  let hash = 0x811c9dc5;
  for (const n of nodes) {
    const val = Math.round(n.x * 10);
    hash ^= (val & 0xFF);
    hash = Math.imul(hash, 0x01000193);
    hash ^= ((val >> 8) & 0xFF);
    hash = Math.imul(hash, 0x01000193);
    hash ^= ((val >> 16) & 0xFF);
    hash = Math.imul(hash, 0x01000193);
    hash ^= ((val >> 24) & 0xFF);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function recenterAllFamilies(
  nodes: PedigreeNode[],
  edges: PedigreeEdge[],
  excludeIds?: Set<string>,
  nodeGap = NODE_GAP,
  genGrid = GEN_GRID,
  genIndexOf?: Map<string, number>,
  canvasWidth?: number,
): PedigreeNode[] {
  let currentNodes = [...nodes.map(n => ({ ...n }))];
  const adj = buildAdjacency(currentNodes, edges);
  
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
      const child = currentNodes.find(n => n.id === childId);
      if (child) {
        const rowKey = genIndexOf ? (genIndexOf.get(child.id) ?? 0) : Math.round(child.y / genGrid) * genGrid;
        childRows.add(rowKey);
      }
    }
  }

  const sortedRows = Array.from(childRows).sort((a, b) => b - a);

  // T2.5: hoist getRowTolerance to top of function
  const tol = getRowTolerance(currentNodes, genGrid);

  const history = new Set<number>();
  let changed = true;
  let safety = 0;
  while (changed && safety++ < 15) {
    changed = false;
    const prevXs = currentNodes.map(n => n.x);

    // T2.4: Oscillation / limit cycle check using numeric FNV-1a hash
    const stateHash = hashState(currentNodes);
    if (history.has(stateHash)) {
      break;
    }
    history.add(stateHash);

    for (const rowY of sortedRows) {
      const rowFamilies = familyList.filter(f => {
        const childId = f.childIds[0];
        if (!childId) return false;
        const child = currentNodes.find(n => n.id === childId);
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

      let parentRowResolved = false;

      for (const f of rowFamilies) {
        const nextNodes = recenterParents(currentNodes, edges, f.parentIds, f.childIds, rowExcludeIds, nodeGap, genGrid, genIndexOf, canvasWidth);
        if (nextNodes !== currentNodes) {
          currentNodes = nextNodes;
          parentRowResolved = true;
        }
      }

      if (parentRowResolved) {
        currentNodes = resolveAllCollisions(currentNodes, edges, excludeIds, undefined, nodeGap, genGrid, genIndexOf, canvasWidth);
      }
    }

    const maxDelta = currentNodes.reduce((max, n, i) => Math.max(max, Math.abs(n.x - prevXs[i]!)), 0);
    if (maxDelta > 0.1) {
      changed = true;
    }
  }

  // Always resolve collisions one final time to guarantee no horizontal overlaps
  currentNodes = resolveAllCollisions(currentNodes, edges, excludeIds, undefined, nodeGap, genGrid, genIndexOf, canvasWidth);

  // Run top-down child recentering pass to align children under parent midpoints
  currentNodes = recenterAllChildren(currentNodes, edges, excludeIds, nodeGap, genGrid, genIndexOf, canvasWidth);

  // Even out sibling spacing for inner siblings
  currentNodes = evenOutSiblingSpacing(currentNodes, edges, excludeIds, nodeGap, genGrid, genIndexOf);

  // Final snap to remove topological deltas (0.01) and clamp within bounds
  return currentNodes.map(n => {
    if (n.pinned) return n;
    const snappedX = Math.max(genGrid, Math.round(n.x * 10) / 10);
    const clampedX = canvasWidth !== undefined ? Math.min(snappedX, canvasWidth - genGrid) : snappedX;
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
  nodes: PedigreeNode[],
  edges: PedigreeEdge[],
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

export function swapCouplePartners(nodes: PedigreeNode[], edges: PedigreeEdge[], nodeGap = NODE_GAP): PedigreeNode[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const result = [...nodes.map(n => ({ ...n }))];

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
        
        const expectedLeft = e.inverted ? rightNodeObj : leftNodeObj;
        const expectedRight = e.inverted ? leftNodeObj : rightNodeObj;

        // If expectedLeft is to the right of expectedRight, swap and clamp to nodeGap
        if (expectedLeft.x > expectedRight.x) {
          const mid = (expectedLeft.x + expectedRight.x) / 2;
          expectedLeft.x = mid - nodeGap / 2;
          expectedRight.x = mid + nodeGap / 2;
        }
      }
    }
  }
  return result;
}

/**
 * Full pipeline: resolve all collisions, then globally recenter parents.
 * This is the main entry point for the layout engine.
 */
export function resolveAndRecenter(
  nodes: PedigreeNode[],
  edges: PedigreeEdge[],
  excludeIds?: Set<string>,
  genIndexOf?: Map<string, number>,
  canvasWidth?: number,
): PedigreeNode[] {
  const resolved = resolveAllCollisions(nodes, edges, excludeIds, undefined, NODE_GAP, GEN_GRID, genIndexOf, canvasWidth);
  const swapped = swapCouplePartners(resolved, edges);
  return recenterAllFamilies(swapped, edges, excludeIds, NODE_GAP, GEN_GRID, genIndexOf, canvasWidth);
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

  let resolved = resolveAllCollisions(allNodes, allEdges, exclude, undefined, NODE_GAP, GEN_GRID, genIndexOf, canvasWidth);
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
export function ensureSpaceAtX(
  nodes: PedigreeNode[],
  emptyStartX: number,
  emptyEndX: number,
): PedigreeNode[] {
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
export function makeSpaceAtX(
  nodes: PedigreeNode[],
  xThreshold: number,
  space: number = NODE_GAP,
): PedigreeNode[] {
  return nodes.map(n => {
    if (n.x >= xThreshold - 0.05) { // allow small float tolerance
      return { ...n, x: n.x + space };
    }
    return n;
  });
}
export { buildAdjacency, buildNodeMap, ROW_TOLERANCE };
export type { AdjacencyMaps };

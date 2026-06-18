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

/** Maximum cascade depth for collision resolution */
const MAX_CASCADE = 5;

// ── Adjacency helpers ──────────────────────────────────────────────────────

interface AdjacencyMaps {
  childrenOf: Map<string, string[]>;
  parentsOf: Map<string, string[]>;
  couplesOf: Map<string, string[]>;
}

function buildAdjacency(nodes: PedigreeNode[], edges: PedigreeEdge[]): AdjacencyMaps {
  const nodeIds = new Set(nodes.map(n => n.id));
  const childrenOf = new Map<string, string[]>();
  const parentsOf = new Map<string, string[]>();
  const couplesOf = new Map<string, string[]>();

  for (const n of nodes) {
    childrenOf.set(n.id, []);
    parentsOf.set(n.id, []);
    couplesOf.set(n.id, []);
  }

  for (const e of edges) {
    if (!nodeIds.has(e.sourceId) || !nodeIds.has(e.targetId)) continue;
    if (e.type === "parent-child") {
      childrenOf.get(e.sourceId)!.push(e.targetId);
      parentsOf.get(e.targetId)!.push(e.sourceId);
    }
    if (e.type === "couple" || e.type === "consanguinity" || e.type === "divorced" || e.type === "separated") {
      couplesOf.get(e.sourceId)!.push(e.targetId);
      couplesOf.get(e.targetId)!.push(e.sourceId);
    }
  }

  return { childrenOf, parentsOf, couplesOf };
}

// ── Node lookup helper ─────────────────────────────────────────────────────

function buildNodeMap(nodes: PedigreeNode[]): Map<string, PedigreeNode> {
  return new Map(nodes.map(n => [n.id, n]));
}

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
    return { left: 0, right: 0, top: 0, bottom: 0 };
  }
  return {
    left: Math.min(...boxes.map(b => b.left)),
    right: Math.max(...boxes.map(b => b.right)),
    top: Math.min(...boxes.map(b => b.top)),
    bottom: Math.max(...boxes.map(b => b.bottom)),
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
  if (v.has(nodeId)) return { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
  v.add(nodeId);

  const node = nodeMap.get(nodeId);
  if (!node) return { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };

  const boxes: BBox[] = [nodeBBox(node)];

  // Include couple partners (same generation)
  for (const partnerId of adj.couplesOf.get(nodeId) ?? []) {
    if (v.has(partnerId)) continue;
    v.add(partnerId);
    const partner = nodeMap.get(partnerId);
    if (partner) boxes.push(nodeBBox(partner));
  }

  // Include children recursively
  for (const childId of adj.childrenOf.get(nodeId) ?? []) {
    boxes.push(computeSubtreeBBox(childId, nodeMap, adj, v));
  }

  return mergeBBoxes(boxes);
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
): Collision[] {
  const rowNodes = nodes.filter(n => Math.abs(n.y - rowY) < ROW_TOLERANCE);

  if (rowNodes.length < 2) return [];

  rowNodes.sort((a, b) => a.x - b.x);

  const collisions: Collision[] = [];
  for (let i = 1; i < rowNodes.length; i++) {
    const left = rowNodes[i - 1]!;
    const right = rowNodes[i]!;
    const gap = right.x - left.x;
    if (gap < minGap - 0.05) { // Allow up to 0.05px topological tolerance
      collisions.push({
        leftNode: left,
        rightNode: right,
        overlap: minGap - gap,
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
): Set<string> {
  const v = visited ?? new Set<string>();
  if (v.has(nodeId)) return v;
  v.add(nodeId);

  // Include couple partners
  for (const partnerId of adj.couplesOf.get(nodeId) ?? []) {
    if (!v.has(partnerId)) {
      v.add(partnerId);
      // Partner's own children
      for (const childId of adj.childrenOf.get(partnerId) ?? []) {
        collectSubtree(childId, adj, v);
      }
    }
  }

  // Include children recursively
  for (const childId of adj.childrenOf.get(nodeId) ?? []) {
    collectSubtree(childId, adj, v);
  }

  return v;
}

/**
 * Get the full connected family group for a node — includes partners, parents,
 * siblings (via shared parents), and all their direct connections.
 * This is the set of nodes that should move together when resolving collisions.
 */
export function getFamilyUnit(
  nodeId: string,
  adj: AdjacencyMaps,
  includeSubtrees: boolean = true,
): Set<string> {
  const group = new Set<string>();

  // Start with the node itself
  group.add(nodeId);

  // Add couple partners
  for (const partnerId of adj.couplesOf.get(nodeId) ?? []) {
    group.add(partnerId);
  }

  // Add children
  for (const childId of adj.childrenOf.get(nodeId) ?? []) {
    group.add(childId);
  }

  // Add parents
  for (const parentId of adj.parentsOf.get(nodeId) ?? []) {
    group.add(parentId);
  }

  // Add siblings (children of same parents)
  for (const parentId of adj.parentsOf.get(nodeId) ?? []) {
    for (const siblingId of adj.childrenOf.get(parentId) ?? []) {
      group.add(siblingId);
    }
  }

  // If includeSubtrees, expand each member's subtree (descendants + partners)
  if (includeSubtrees) {
    const expanded = new Set<string>(group);
    for (const memberId of group) {
      collectSubtree(memberId, adj, expanded);
    }
    return expanded;
  }

  return group;
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
): ShiftPlan {
  const adj = buildAdjacency(nodes, edges);
  const nodeMap = buildNodeMap(nodes);

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
    const rowMap = new Map<number, PedigreeNode[]>();
    for (const n of nodes) {
      const rY = Math.round(n.y / GEN_GRID) * GEN_GRID;
      if (!rowMap.has(rY)) rowMap.set(rY, []);
      rowMap.get(rY)!.push(n);
    }

    for (const [, rowNodes] of rowMap) {
      if (rowNodes.length <= 1) continue;
      rowNodes.sort((a, b) => a.x - b.x);

      for (let i = 0; i < rowNodes.length; i++) {
        const nodeA = rowNodes[i]!;
        const xA = shifts.get(nodeA.id) ?? nodeA.x;
        for (let j = i + 1; j < rowNodes.length; j++) {
          const nodeB = rowNodes[j]!;
          const xB = shifts.get(nodeB.id) ?? nodeB.x;

          // Since i < j, nodeA was originally to the left of nodeB (nodeA.x <= nodeB.x)
          // If nodeA ends up at or to the right of nodeB (xA > xB - 0.05), they have crossed/overlapped
          if (nodeA.x < nodeB.x - 0.1 && xA > xB - 0.05) {
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
    if (x < GEN_GRID) leftPenalty += (GEN_GRID - x) * 10;
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
): PedigreeNode[] {
  let currentNodes = [...nodes.map(n => ({ ...n }))]; // deep clone positions

  for (let cascade = 0; cascade < MAX_CASCADE; cascade++) {
    // Identify all unique generation rows
    const rows = new Set<number>();
    for (const node of currentNodes) {
      rows.add(Math.round(node.y / GEN_GRID) * GEN_GRID);
    }

    let anyCollision = false;

    for (const rowY of rows) {
      const collisions = detectRowCollisions(currentNodes, rowY, NODE_GAP);

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
          const planRight = computeShiftPlan(currentNodes, edges, collision.rightNode, collision.overlap, 1, excludeIds);
          const planLeft = computeShiftPlan(currentNodes, edges, collision.leftNode, collision.overlap, -1, excludeIds);

          // Check if leftward shift would push below minimum X
          let leftViable = true;
          for (const [, x] of planLeft.shifts) {
            if (x < GEN_GRID) { leftViable = false; break; }
          }

          if (!leftViable || planRight.cost <= planLeft.cost) {
            nodeToShift = collision.rightNode;
            shiftDirection = 1;
          } else {
            nodeToShift = collision.leftNode;
            shiftDirection = -1;
          }
        }

        const plan = computeShiftPlan(currentNodes, edges, nodeToShift, collision.overlap, shiftDirection, excludeIds);

        // Apply shifts
        currentNodes = currentNodes.map(n => {
          const newX = plan.shifts.get(n.id);
          return newX !== undefined ? { ...n, x: newX } : n;
        });
      }
    }

    if (!anyCollision) break; // All clear — no more cascades needed
  }

  // Final safety pass: pairwise check on each row for any remaining overlaps
  const rowMap = new Map<number, PedigreeNode[]>();
  for (const n of currentNodes) {
    const rowKey = Math.round(n.y / GEN_GRID) * GEN_GRID;
    if (!rowMap.has(rowKey)) rowMap.set(rowKey, []);
    rowMap.get(rowKey)!.push(n);
  }

  for (const [, rowNodes] of rowMap) {
    rowNodes.sort((a, b) => a.x - b.x);
    for (let i = 1; i < rowNodes.length; i++) {
      const prev = rowNodes[i - 1]!;
      const curr = rowNodes[i]!;
      if (excludeIds?.has(curr.id)) continue;
      const gap = curr.x - prev.x;
      if (gap < NODE_GAP - 0.05) {
        const push = NODE_GAP - gap;
        // Push curr and everything to its right
        for (let j = i; j < rowNodes.length; j++) {
          const n = rowNodes[j]!;
          if (excludeIds?.has(n.id)) continue;
          const idx = currentNodes.findIndex(cn => cn.id === n.id);
          if (idx !== -1) {
            currentNodes[idx] = { ...currentNodes[idx]!, x: currentNodes[idx]!.x + push };
          }
        }
        // Update rowNodes for continued iteration
        for (let j = i; j < rowNodes.length; j++) {
          const n = rowNodes[j]!;
          const updated = currentNodes.find(cn => cn.id === n.id);
          if (updated) rowNodes[j] = updated;
        }
      }
    }
  }

  // Final snap to remove topological deltas (0.01)
  return currentNodes.map(n => ({
    ...n,
    x: Math.max(GEN_GRID, Math.round(n.x * 10) / 10),
  }));
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
): PedigreeNode[] {
  const nodeMap = buildNodeMap(nodes);
  const parents = parentIds.map(id => nodeMap.get(id)).filter((n): n is PedigreeNode => !!n);
  const children = childIds.map(id => nodeMap.get(id)).filter((n): n is PedigreeNode => !!n);

  if (parents.length === 0 || children.length === 0) return nodes;

  const childXs = children.map(c => c.x).sort((a, b) => a - b);
  const childCenter = childXs.length >= 2
    ? (childXs[0]! + childXs[childXs.length - 1]!) / 2
    : childXs[0]!;

  const parentCenter = parents.length >= 2
    ? (parents[0]!.x + parents[1]!.x) / 2
    : parents[0]!.x;

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
    const currentDist = Math.max(NODE_GAP, Math.abs(parents[0]!.x - parents[1]!.x));
    const leftTarget = childCenter - currentDist / 2;
    const rightTarget = childCenter + currentDist / 2;
    parentTargets.set(sortedParents[0]!.id, leftTarget);
    parentTargets.set(sortedParents[1]!.id, rightTarget);
  } else if (parents.length === 1) {
    parentTargets.set(parents[0]!.id, childCenter);
  } else {
    const shift = childCenter - parentCenter;
    for (const p of parents) {
      parentTargets.set(p.id, p.x + shift);
    }
  }

  const shift = childCenter - parentCenter;
  if (Math.abs(shift) < 1) return nodes; // Already centered

  const parentY = parents[0]!.y;
  const rowNodes = nodes.filter(n => Math.abs(n.y - parentY) < ROW_TOLERANCE);
  rowNodes.sort((a, b) => a.x - b.x);

  const parentIndices = parents.map(p => rowNodes.findIndex(rn => rn.id === p.id)).sort((a, b) => a - b);
  const minParentIdx = parentIndices[0]!;
  const maxParentIdx = parentIndices[parentIndices.length - 1]!;

  const parentIdSet = new Set(parentIds);
  const adj = buildAdjacency(nodes, edges);
  let currentNodes = nodes.map(n => ({ ...n }));
  const allExclude = new Set([...(excludeIds ?? []), ...childIds]);

  // First, apply target positions directly to parents and shift their subtrees.
  for (const p of parents) {
    const tx = parentTargets.get(p.id)!;
    const nodeInCurrent = currentNodes.find(n => n.id === p.id);
    if (!nodeInCurrent) continue;
    const s = tx - nodeInCurrent.x;
    if (Math.abs(s) < 0.01) continue;

    const subtree = collectSubtree(p.id, adj);
    currentNodes = currentNodes.map(n => {
      if (allExclude.has(n.id)) return n;
      if (parentIdSet.has(n.id) && n.id !== p.id) return n;
      if (subtree.has(n.id)) {
        return { ...n, x: n.x + s };
      }
      return n;
    });
  }

  // Second, perform a rightward sweep-line push pass for nodes to the right of the parents.
  for (let i = maxParentIdx; i < rowNodes.length - 1; i++) {
    const currId = rowNodes[i]!.id;
    const nextId = rowNodes[i + 1]!.id;
    const currNode = currentNodes.find(n => n.id === currId)!;
    const nextNode = currentNodes.find(n => n.id === nextId)!;
    
    if (nextNode.x < currNode.x + NODE_GAP - 0.05) {
      const push = (currNode.x + NODE_GAP) - nextNode.x;
      const subtree = collectSubtree(nextId, adj);
      currentNodes = currentNodes.map(n => {
        if (allExclude.has(n.id)) return n;
        if (parentIdSet.has(n.id) && n.id !== nextId) return n;
        if (subtree.has(n.id)) {
          return { ...n, x: n.x + push };
        }
        return n;
      });
    }
  }

  // Third, perform a leftward sweep-line push pass for nodes to the left of the parents.
  for (let i = minParentIdx; i > 0; i--) {
    const currId = rowNodes[i]!.id;
    const prevId = rowNodes[i - 1]!.id;
    const currNode = currentNodes.find(n => n.id === currId)!;
    const prevNode = currentNodes.find(n => n.id === prevId)!;

    if (prevNode.x > currNode.x - NODE_GAP + 0.05) {
      const push = (currNode.x - NODE_GAP) - prevNode.x;
      const subtree = collectSubtree(prevId, adj);
      currentNodes = currentNodes.map(n => {
        if (allExclude.has(n.id)) return n;
        if (parentIdSet.has(n.id) && n.id !== prevId) return n;
        if (subtree.has(n.id)) {
          return { ...n, x: n.x + push };
        }
        return n;
      });
    }
  }

  // Enforce GEN_GRID boundary: if any shifted node went below GEN_GRID, shift the whole row.
  const minX = Math.min(...currentNodes.filter(n => Math.abs(n.y - parentY) < ROW_TOLERANCE).map(n => n.x));
  if (minX < GEN_GRID) {
    const adjust = GEN_GRID - minX;
    currentNodes = currentNodes.map(n => {
      if (allExclude.has(n.id)) return n;
      return { ...n, x: n.x + adjust };
    });
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
): PedigreeNode[] {
  let currentNodes = [...nodes.map(n => ({ ...n }))];
  const adj = buildAdjacency(currentNodes, edges);
  
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
      const child = currentNodes.find(n => n.id === childId);
      if (child) childRows.add(Math.round(child.y / GEN_GRID) * GEN_GRID);
    }
  }
  // Sort child rows top-down (ascending Y)
  const sortedRows = Array.from(childRows).sort((a, b) => a - b);

  for (const rowY of sortedRows) {
    const rowFamilies = familyList.filter(f => {
      const childId = f.childIds[0];
      if (!childId) return false;
      const child = currentNodes.find(n => n.id === childId);
      return child && Math.abs(child.y - rowY) < ROW_TOLERANCE;
    });

    let rowShifted = false;

    for (const f of rowFamilies) {
      const nodeMap = buildNodeMap(currentNodes);
      const parents = f.parentIds.map(id => nodeMap.get(id)).filter((n): n is PedigreeNode => !!n);
      const children = f.childIds.map(id => nodeMap.get(id)).filter((n): n is PedigreeNode => !!n);
      if (parents.length === 0 || children.length === 0) continue;

      // Calculate parent midpoint
      let parentMidpoint = 0;
      if (parents.length >= 2) {
        parentMidpoint = (parents[0]!.x + parents[1]!.x) / 2;
      } else {
        parentMidpoint = parents[0]!.x;
      }

      // Calculate current children center
      const childXs = children.map(c => c.x).sort((a, b) => a - b);
      const childrenCenter = (childXs[0]! + childXs[childXs.length - 1]!) / 2;

      const shift = parentMidpoint - childrenCenter;
      if (Math.abs(shift) < 0.1) continue;

      // We shift the children and their subtrees
      const shiftNodes = new Set<string>();
      for (const child of children) {
        const subtree = collectSubtree(child.id, adj);
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
        rowShifted = true;
      }
    }

    if (rowShifted) {
      // Resolve any collisions caused by these shifts on the row and below
      currentNodes = resolveAllCollisions(currentNodes, edges, excludeIds);
    }
  }

  return currentNodes;
}

export function evenOutSiblingSpacing(
  nodes: PedigreeNode[],
  edges: PedigreeEdge[],
  excludeIds?: Set<string>,
): PedigreeNode[] {
  const currentNodes = [...nodes.map(n => ({ ...n }))];
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
      if (hasCouples || hasChildren || isExcluded) {
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
      const rowNodes = currentNodes.filter(
        n => Math.abs(n.y - parentY) < ROW_TOLERANCE && !siblingIds.has(n.id)
      );

      let safeToEvenOut = true;
      for (let i = 1; i < siblings.length - 1; i++) {
        const targetX = firstX + i * step;
        const wouldCollide = rowNodes.some(
          rn => Math.abs(rn.x - targetX) < NODE_GAP - 0.05
        );
        if (wouldCollide) {
          safeToEvenOut = false;
          break;
        }
      }

      if (safeToEvenOut) {
        for (let i = 1; i < siblings.length - 1; i++) {
          const sib = siblings[i]!;
          const targetX = firstX + i * step;
          const node = currentNodes.find(n => n.id === sib.id);
          if (node) {
            node.x = targetX;
          }
        }
      }
    }
  }

  return currentNodes;
}

export function recenterAllFamilies(
  nodes: PedigreeNode[],
  edges: PedigreeEdge[],
  excludeIds?: Set<string>,
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
      if (child) childRows.add(Math.round(child.y / GEN_GRID) * GEN_GRID);
    }
  }

  const sortedRows = Array.from(childRows).sort((a, b) => b - a);

  let changed = true;
  let safety = 0;
  while (changed && safety++ < 5) {
    changed = false;
    const oldPositions = currentNodes.map(n => `${n.id}:${n.x}`).join(",");

    for (const rowY of sortedRows) {
      const rowFamilies = familyList.filter(f => {
        const childId = f.childIds[0];
        if (!childId) return false;
        const child = currentNodes.find(n => n.id === childId);
        return child && Math.abs(child.y - rowY) < ROW_TOLERANCE;
      });

      // Exclude all nodes at or below the child row from being shifted
      const rowExcludeIds = new Set([
        ...(excludeIds ?? []),
        ...currentNodes.filter(n => n.y >= rowY).map(n => n.id)
      ]);

      let parentRowResolved = false;

      for (const f of rowFamilies) {
        const nextNodes = recenterParents(currentNodes, edges, f.parentIds, f.childIds, rowExcludeIds);
        if (nextNodes !== currentNodes) {
          currentNodes = nextNodes;
          parentRowResolved = true;
        }
      }

      if (parentRowResolved) {
        currentNodes = resolveAllCollisions(currentNodes, edges, excludeIds);
      }
    }

    const newPositions = currentNodes.map(n => `${n.id}:${n.x}`).join(",");
    if (newPositions !== oldPositions) {
      changed = true;
    }
  }

  // Run top-down child recentering pass to align children under parent midpoints
  currentNodes = recenterAllChildren(currentNodes, edges, excludeIds);

  // Even out sibling spacing for inner siblings
  currentNodes = evenOutSiblingSpacing(currentNodes, edges, excludeIds);

  // Final snap to remove topological deltas (0.01)
  return currentNodes.map(n => ({
    ...n,
    x: Math.max(GEN_GRID, Math.round(n.x * 10) / 10),
  }));
}

/**
 * Find the nearest free X coordinate for insertion on a specific Y row.
 * It strictly respects the requested direction to maintain topological sorting.
 */
export function findInsertPosition(
  nodes: PedigreeNode[],
  edges: PedigreeEdge[],
  targetX: number,
  targetY: number,
  excludeIds?: Set<string>,
): number {
  const rowNodes = nodes.filter(n => Math.abs(n.y - targetY) < ROW_TOLERANCE && !excludeIds?.has(n.id));
  
  if (rowNodes.length === 0) return targetX;

  let testX = targetX;
  let collision = true;

  while (collision) {
    collision = false;
    for (const n of rowNodes) {
      if (Math.abs(n.x - testX) < NODE_GAP - 0.05) {
        collision = true;
        if (testX >= n.x) {
          testX = n.x + NODE_GAP;
        } else {
          testX = n.x - NODE_GAP;
        }
        break;
      }
    }
  }

  return testX;
}

// ── Convenience: resolve and recenter in one call ──────────────────────────

export function swapCouplePartners(nodes: PedigreeNode[], edges: PedigreeEdge[]): PedigreeNode[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const result = [...nodes.map(n => ({ ...n }))];

  for (const e of edges) {
    if (e.type === "couple" || e.type === "consanguinity" || e.type === "divorced" || e.type === "separated") {
      const n1 = nodeMap.get(e.sourceId);
      const n2 = nodeMap.get(e.targetId);
      if (!n1 || !n2) continue;

      // Identify male and female
      const male = n1.type === "male" ? n1 : n2.type === "male" ? n2 : null;
      const female = n1.type === "female" ? n1 : n2.type === "female" ? n2 : null;

      if (male && female && male.id !== female.id) {
        const maleIdx = result.findIndex(rn => rn.id === male.id);
        const femaleIdx = result.findIndex(rn => rn.id === female.id);
        if (maleIdx !== -1 && femaleIdx !== -1) {
          const maleNode = result[maleIdx]!;
          const femaleNode = result[femaleIdx]!;
          
          const expectedLeft = e.inverted ? femaleNode : maleNode;
          const expectedRight = e.inverted ? maleNode : femaleNode;

          // If expectedLeft is to the right of expectedRight, swap their X coordinates
          if (expectedLeft.x > expectedRight.x) {
            const tempX = expectedLeft.x;
            expectedLeft.x = expectedRight.x;
            expectedRight.x = tempX;
          }
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
): PedigreeNode[] {
  const resolved = resolveAllCollisions(nodes, edges, excludeIds);
  const swapped = swapCouplePartners(resolved, edges);
  return recenterAllFamilies(swapped, edges, excludeIds);
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
): CanvasData {
  const allNodes = [...canvas.nodes, newNode];
  const allEdges = [...canvas.edges, ...newEdges];
  const exclude = new Set([...(excludeIds ?? []), newNode.id]);

  let resolved = resolveAllCollisions(allNodes, allEdges, exclude);
  resolved = recenterAllFamilies(resolved, allEdges, exclude);

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
    const minRightX = Math.min(...rightNodes.map(n => n.x));
    if (minRightX >= emptyEndX - 0.05) return nodes; // Already enough space
  }

  // Find the closest node to the right of emptyStartX
  const rightNodes = nodes.filter(n => n.x > emptyStartX);
  if (rightNodes.length === 0) return nodes;
  const minRightX = Math.min(...rightNodes.map(n => n.x));

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

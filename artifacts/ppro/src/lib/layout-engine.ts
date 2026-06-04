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

/** A nuclear family unit: couple + their direct children */
export interface NuclearFamily {
  id: string;            // deterministic key from sorted parent IDs or singleton node ID
  parentIds: string[];
  childIds: string[];
  memberIds: Set<string>;
  bbox: BBox;
}

/** Shift instruction: which nodes to move and by how much */
export interface ShiftPlan {
  shifts: Map<string, number>;  // nodeId → new absolute X
  cost: number;                 // total displacement (lower = better)
}

// ── Constants ──────────────────────────────────────────────────────────────

/** Nodes within this vertical distance are on the "same row" */
const ROW_TOLERANCE = GEN_GRID / 2; // 60px — correct for 120px generation grid

/** Minimum horizontal gap between family bounding boxes */
const MIN_FAMILY_GAP = NODE_GAP * 0.15; // small buffer beyond NODE_GAP

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

// ── Family index ───────────────────────────────────────────────────────────

/**
 * Group nodes into nuclear families. Each family consists of:
 * - A couple (or single parent) and their direct children.
 * - Uncoupled, childless nodes form singleton "families."
 *
 * Returns families keyed by a deterministic ID (sorted parent IDs or node ID).
 */
export function buildFamilyIndex(
  nodes: PedigreeNode[],
  edges: PedigreeEdge[],
  adj?: AdjacencyMaps,
): NuclearFamily[] {
  const a = adj ?? buildAdjacency(nodes, edges);
  const nodeMap = buildNodeMap(nodes);
  const assigned = new Set<string>();
  const families: NuclearFamily[] = [];

  // Phase 1: Build families around couples with children
  for (const node of nodes) {
    if (assigned.has(node.id)) continue;

    const partners = a.couplesOf.get(node.id) ?? [];
    const children = a.childrenOf.get(node.id) ?? [];

    if (partners.length === 0 && children.length === 0) continue; // handle later as singleton

    // For each couple pair, group children that belong to BOTH parents
    for (const partnerId of partners) {
      if (assigned.has(node.id) && assigned.has(partnerId)) continue;

      const partnerChildren = a.childrenOf.get(partnerId) ?? [];
      // Children of this couple: children shared between both parents
      const sharedChildren = children.filter(c => partnerChildren.includes(c));
      // Also include children of only one parent (single-parent link to this couple)
      const allCoupleChildren = new Set([
        ...children.filter(c => {
          const ps = a.parentsOf.get(c) ?? [];
          return ps.includes(node.id) && (ps.includes(partnerId) || ps.length === 1);
        }),
        ...partnerChildren.filter(c => {
          const ps = a.parentsOf.get(c) ?? [];
          return ps.includes(partnerId) && (ps.includes(node.id) || ps.length === 1);
        }),
      ]);

      if (sharedChildren.length === 0 && allCoupleChildren.size === 0) {
        // Couple without children — still a family unit
        const parentIds = [node.id, partnerId].sort();
        const memberIds = new Set(parentIds);
        const memberNodes = parentIds.map(id => nodeMap.get(id)).filter((n): n is PedigreeNode => !!n);
        if (memberNodes.length > 0 && !assigned.has(node.id) && !assigned.has(partnerId)) {
          families.push({
            id: `f_${parentIds.join("_")}`,
            parentIds,
            childIds: [],
            memberIds,
            bbox: mergeBBoxes(memberNodes.map(nodeBBox)),
          });
          parentIds.forEach(id => assigned.add(id));
        }
        continue;
      }

      const coupleChildIds = [...allCoupleChildren];
      const parentIds = [node.id, partnerId].sort();
      const memberIds = new Set([...parentIds, ...coupleChildIds]);
      const memberNodes = [...memberIds].map(id => nodeMap.get(id)).filter((n): n is PedigreeNode => !!n);

      if (memberNodes.length > 0) {
        families.push({
          id: `f_${parentIds.join("_")}`,
          parentIds,
          childIds: coupleChildIds,
          memberIds,
          bbox: mergeBBoxes(memberNodes.map(nodeBBox)),
        });
        memberIds.forEach(id => assigned.add(id));
      }
    }

    // Single parent with children but no couple edge
    if (!assigned.has(node.id) && children.length > 0) {
      const parentIds = [node.id];
      const memberIds = new Set([node.id, ...children]);
      const memberNodes = [...memberIds].map(id => nodeMap.get(id)).filter((n): n is PedigreeNode => !!n);
      families.push({
        id: `f_${node.id}`,
        parentIds,
        childIds: children,
        memberIds,
        bbox: mergeBBoxes(memberNodes.map(nodeBBox)),
      });
      memberIds.forEach(id => assigned.add(id));
    }
  }

  // Phase 2: Assign remaining nodes as singletons
  for (const node of nodes) {
    if (assigned.has(node.id)) continue;
    families.push({
      id: `s_${node.id}`,
      parentIds: [],
      childIds: [],
      memberIds: new Set([node.id]),
      bbox: nodeBBox(node),
    });
    assigned.add(node.id);
  }

  return families;
}

// ── Row-based collision detection ──────────────────────────────────────────

interface Collision {
  leftFamily: NuclearFamily;
  rightFamily: NuclearFamily;
  overlap: number; // positive = overlapping by this many px
}

/**
 * Detect horizontal collisions between families on the same generation row.
 * Uses a sweep-line approach: sort families by left edge of bbox, then check
 * adjacent pairs for overlap.
 */
export function detectRowCollisions(
  families: NuclearFamily[],
  rowY: number,
  minGap: number = NODE_GAP,
): Collision[] {
  // Filter families that have members on this row
  const rowFamilies = families.filter(f => {
    const centerY = (f.bbox.top + f.bbox.bottom) / 2;
    return Math.abs(centerY - rowY) < ROW_TOLERANCE;
  });

  if (rowFamilies.length < 2) return [];

  // Sort by left edge of bounding box
  rowFamilies.sort((a, b) => a.bbox.left - b.bbox.left);

  const collisions: Collision[] = [];
  for (let i = 1; i < rowFamilies.length; i++) {
    const left = rowFamilies[i - 1]!;
    const right = rowFamilies[i]!;
    const gap = right.bbox.left - left.bbox.right;
    if (gap < minGap) {
      collisions.push({
        leftFamily: left,
        rightFamily: right,
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
  familyToShift: NuclearFamily,
  overlap: number,
  direction?: 1 | -1,
  excludeIds?: Set<string>,
): ShiftPlan {
  const adj = buildAdjacency(nodes, edges);
  const nodeMap = buildNodeMap(nodes);

  const computeForDirection = (dir: 1 | -1): ShiftPlan => {
    const shifts = new Map<string, number>();
    let cost = 0;
    const shiftAmount = Math.ceil(overlap + MIN_FAMILY_GAP);

    // Collect all nodes that must move with this family
    const movingNodes = new Set<string>();
    for (const memberId of familyToShift.memberIds) {
      if (excludeIds?.has(memberId)) continue;
      // Collect entire subtree of each member
      const subtree = collectSubtree(memberId, adj);
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

    return { shifts, cost };
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
    const adj = buildAdjacency(currentNodes, edges);
    const families = buildFamilyIndex(currentNodes, edges, adj);

    // Identify all unique generation rows
    const rows = new Set<number>();
    for (const node of currentNodes) {
      rows.add(Math.round(node.y / GEN_GRID) * GEN_GRID);
    }

    let anyCollision = false;

    for (const rowY of rows) {
      // Get families with members on this row
      const rowFamilies = families.filter(f => {
        for (const memberId of f.memberIds) {
          const node = currentNodes.find(n => n.id === memberId);
          if (node && Math.abs(node.y - rowY) < ROW_TOLERANCE) return true;
        }
        return false;
      });

      if (rowFamilies.length < 2) continue;

      // Recompute bboxes based on row-only members for accurate horizontal detection
      const rowFamiliesWithRowBBox = rowFamilies.map(f => {
        const rowMembers = [...f.memberIds]
          .map(id => currentNodes.find(n => n.id === id))
          .filter((n): n is PedigreeNode => !!n && Math.abs(n.y - rowY) < ROW_TOLERANCE);
        return {
          ...f,
          bbox: rowMembers.length > 0 ? mergeBBoxes(rowMembers.map(nodeBBox)) : f.bbox,
        };
      });

      const collisions = detectRowCollisions(rowFamiliesWithRowBBox, rowY, NODE_GAP);

      for (const collision of collisions) {
        anyCollision = true;

        // Determine which family to shift — prefer shifting the one not in excludeIds
        const leftExcluded = [...collision.leftFamily.memberIds].some(id => excludeIds?.has(id));
        const rightExcluded = [...collision.rightFamily.memberIds].some(id => excludeIds?.has(id));

        let familyToShift: NuclearFamily;
        let shiftDirection: 1 | -1;

        if (leftExcluded && !rightExcluded) {
          familyToShift = collision.rightFamily;
          shiftDirection = 1; // push right family rightward
        } else if (rightExcluded && !leftExcluded) {
          familyToShift = collision.leftFamily;
          shiftDirection = -1; // push left family leftward
        } else {
          // Neither or both excluded — use bidirectional cost comparison
          const planRight = computeShiftPlan(currentNodes, edges, collision.rightFamily, collision.overlap, 1, excludeIds);
          const planLeft = computeShiftPlan(currentNodes, edges, collision.leftFamily, collision.overlap, -1, excludeIds);

          // Check if leftward shift would push below minimum X
          let leftViable = true;
          for (const [, x] of planLeft.shifts) {
            if (x < NODE_SIZE) { leftViable = false; break; }
          }

          if (!leftViable || planRight.cost <= planLeft.cost) {
            familyToShift = collision.rightFamily;
            shiftDirection = 1;
          } else {
            familyToShift = collision.leftFamily;
            shiftDirection = -1;
          }
        }

        const plan = computeShiftPlan(currentNodes, edges, familyToShift, collision.overlap, shiftDirection, excludeIds);

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
      if (gap < NODE_GAP) {
        const push = Math.ceil(NODE_GAP - gap);
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

  // Ensure minimum X boundary
  return currentNodes.map(n => ({
    ...n,
    x: Math.max(GEN_GRID, n.x),
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

  const shift = childCenter - parentCenter;
  if (Math.abs(shift) < 1) return nodes; // Already centered

  // Check if shifting parents is safe (no collisions with non-family nodes)
  const parentIdSet = new Set(parentIds);
  const allExclude = new Set([...(excludeIds ?? []), ...parentIds, ...childIds]);

  const isSafe = parents.every(par => {
    const shiftedX = par.x + shift;
    if (shiftedX < GEN_GRID) return false;
    return !nodes.some(n =>
      !allExclude.has(n.id) &&
      Math.abs(n.x - shiftedX) < NODE_GAP &&
      Math.abs(n.y - par.y) < ROW_TOLERANCE,
    );
  });

  if (!isSafe) {
    // Try pushing blocking nodes out of the way (up to 3 blockers)
    const blockers = nodes.filter(n => {
      if (allExclude.has(n.id)) return false;
      return parents.some(par =>
        Math.abs(n.x - (par.x + shift)) < NODE_GAP &&
        Math.abs(n.y - par.y) < ROW_TOLERANCE,
      );
    });

    if (blockers.length === 0 || blockers.length > 3) return nodes;

    // Push blockers in the direction of the parent shift
    const adj = buildAdjacency(nodes, edges);
    let result = nodes.map(n => ({ ...n }));
    const pushDir = shift > 0 ? 1 : -1;
    const pushAmount = Math.ceil(Math.abs(shift) / NODE_GAP) * NODE_GAP;

    for (const blocker of blockers) {
      const subtree = collectSubtree(blocker.id, adj);
      result = result.map(n => {
        if (subtree.has(n.id) && !allExclude.has(n.id)) {
          return { ...n, x: n.x + pushDir * pushAmount };
        }
        return n;
      });
    }

    // Now apply parent shift
    result = result.map(n => {
      if (parentIdSet.has(n.id)) return { ...n, x: n.x + shift };
      return n;
    });

    return result.map(n => ({ ...n, x: Math.max(GEN_GRID, n.x) }));
  }

  // Safe — apply shift to parents only
  return nodes.map(n => {
    if (parentIdSet.has(n.id)) return { ...n, x: Math.max(GEN_GRID, n.x + shift) };
    return n;
  });
}

// ── Convenience: resolve and recenter in one call ──────────────────────────

/**
 * Full pipeline: resolve all collisions, then recenter parents over children.
 * This is the main entry point for the layout engine.
 */
export function resolveAndRecenter(
  nodes: PedigreeNode[],
  edges: PedigreeEdge[],
  parentIds: string[],
  childIds: string[],
  excludeIds?: Set<string>,
): PedigreeNode[] {
  const resolved = resolveAllCollisions(nodes, edges, excludeIds);
  return recenterParents(resolved, edges, parentIds, childIds, excludeIds);
}

// ── Smart-push insertion (bidirectional) ───────────────────────────────────

/**
 * Insert a node at (targetX, targetY) and resolve collisions using the
 * unified engine. Returns the canvas with the new node placed and all
 * collisions resolved.
 *
 * This replaces the old `insertAndShiftRight` + manual collision phases.
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

  const resolved = resolveAllCollisions(allNodes, allEdges, exclude);

  return {
    ...canvas,
    nodes: resolved,
    edges: allEdges,
  };
}

// ── Re-export adjacency builder for consumers ──────────────────────────────
export { buildAdjacency, buildNodeMap, ROW_TOLERANCE };
export type { AdjacencyMaps };

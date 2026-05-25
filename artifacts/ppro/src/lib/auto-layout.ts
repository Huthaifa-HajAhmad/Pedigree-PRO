// ─── Auto-layout algorithm for pedigree canvases ──────────────────────────
//
// Strategy:
//  1. Build parent-child and couple adjacency from edges.
//  2. BFS from roots to assign each node a generation number.
//     - Couple partners are forced into the same generation.
//  3. Determine the Y coordinate of each generation:
//     - If `respectPinned` and the generation contains pinned nodes, anchor Y
//       to the average Y of those pinned nodes.
//     - Otherwise use the default grid (GEN_Y_START + gen * GEN_SPACING).
//  4. For each generation, lay out unpinned nodes:
//     - Group couple pairs together.
//     - Sort groups left-to-right by average parent X position.
//     - Children are centered under BOTH parents in a couple (not just the one
//       with the parent-child edge) by expanding the effective parent set to
//       include couple partners.
//     - Spread nodes evenly, centering the row under the average parent X.
//  5. Pinned nodes are never moved (their positions act as anchors for
//     adjacent generations and for centering their children).
// ──────────────────────────────────────────────────────────────────────────

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  pinned?: boolean;
}

export interface LayoutEdge {
  id: string;
  type: "couple" | "parent-child" | "consanguinity";
  sourceId: string;
  targetId: string;
}

const GEN_Y_START = 130;
import { GEN_GRID } from "@/features/pedigree-editor/canvas/types";
const GEN_SPACING = GEN_GRID;
const H_SPACING = 110;
const COUPLE_SPACING = 90;
const CANVAS_CENTER_X = 700;

export function computeAutoLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  respectPinned: boolean
): LayoutNode[] {
  if (nodes.length === 0) return nodes;

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // ── Adjacency maps ──────────────────────────────────────────────────────
  const childrenOf = new Map<string, string[]>();
  const parentsOf = new Map<string, string[]>();
  const couplesOf = new Map<string, string[]>();

  for (const n of nodes) {
    childrenOf.set(n.id, []);
    parentsOf.set(n.id, []);
    couplesOf.set(n.id, []);
  }

  for (const e of edges) {
    if (!nodeMap.has(e.sourceId) || !nodeMap.has(e.targetId)) continue;
    if (e.type === "parent-child") {
      childrenOf.get(e.sourceId)!.push(e.targetId);
      parentsOf.get(e.targetId)!.push(e.sourceId);
    }
    if (e.type === "couple" || e.type === "consanguinity") {
      couplesOf.get(e.sourceId)!.push(e.targetId);
      couplesOf.get(e.targetId)!.push(e.sourceId);
    }
  }

  // ── BFS generation assignment ───────────────────────────────────────────
  // Couple partners are forced to the same generation (max of theirs).
  const genOf = new Map<string, number>();
  const roots = nodes.filter((n) => (parentsOf.get(n.id) ?? []).length === 0);
  const queue: Array<{ id: string; gen: number }> = roots.map((n) => ({
    id: n.id,
    gen: 0,
  }));

  let head = 0;
  while (head < queue.length) {
    const entry = queue[head];
    if (!entry) break;
    head++;
    const existing = genOf.get(entry.id);
    if (existing !== undefined && existing >= entry.gen) continue;
    genOf.set(entry.id, entry.gen);

    // Propagate same generation to couple partners
    for (const partnerId of couplesOf.get(entry.id) ?? []) {
      const partnerGen = genOf.get(partnerId);
      if (partnerGen === undefined || partnerGen < entry.gen) {
        queue.push({ id: partnerId, gen: entry.gen });
      }
    }
    // Propagate to children
    for (const childId of childrenOf.get(entry.id) ?? []) {
      queue.push({ id: childId, gen: entry.gen + 1 });
    }
  }
  // Disconnected nodes → generation 0
  for (const n of nodes) {
    if (!genOf.has(n.id)) genOf.set(n.id, 0);
  }

  // ── Group by generation ─────────────────────────────────────────────────
  const genGroups = new Map<number, string[]>();
  for (const [id, gen] of genOf) {
    if (!genGroups.has(gen)) genGroups.set(gen, []);
    genGroups.get(gen)!.push(id);
  }
  const sortedGens = [...genGroups.keys()].sort((a, b) => a - b);

  // ── Determine Y for each generation ────────────────────────────────────
  const genYOf = new Map<number, number>();
  for (const gen of sortedGens) {
    const nodeIds = genGroups.get(gen)!;
    if (respectPinned) {
      const pinnedYs = nodeIds
        .map((id) => nodeMap.get(id))
        .filter((n): n is LayoutNode => !!n?.pinned)
        .map((n) => n.y);
      if (pinnedYs.length > 0) {
        genYOf.set(
          gen,
          pinnedYs.reduce((a, b) => a + b, 0) / pinnedYs.length
        );
        continue;
      }
    }
    genYOf.set(gen, GEN_Y_START + gen * GEN_SPACING);
  }

  // ── Lay out each generation ─────────────────────────────────────────────
  const knownPos = new Map<string, { x: number; y: number }>();

  // Seed with pinned positions
  for (const n of nodes) {
    if (respectPinned && n.pinned) {
      knownPos.set(n.id, { x: n.x, y: n.y });
    }
  }

  for (const gen of sortedGens) {
    const nodeIds = genGroups.get(gen)!;
    const y = genYOf.get(gen)!;

    const unpinnedIds = nodeIds.filter((id) => !knownPos.has(id));
    if (unpinnedIds.length === 0) continue;

    // Compute the center X using effective parents (direct parents + their
    // couple partners) so children center under the full couple, not just
    // the node with the parent-child edge.
    const parentXs: number[] = [];
    for (const id of unpinnedIds) {
      parentXs.push(
        ...getEffectiveParentXs(id, parentsOf, couplesOf, knownPos, nodeMap)
      );
    }
    const centerX =
      parentXs.length > 0
        ? parentXs.reduce((a, b) => a + b, 0) / parentXs.length
        : CANVAS_CENTER_X;

    // Order unpinned nodes: couple pairs together, sorted by parent X
    const ordered = orderNodesForGen(
      unpinnedIds,
      couplesOf,
      parentsOf,
      knownPos,
      nodeMap
    );

    // Measure total width
    let totalWidth = 0;
    for (let i = 1; i < ordered.length; i++) {
      const curr = ordered[i];
      const prev = ordered[i - 1];
      if (!curr || !prev) continue;
      const isCouple = (couplesOf.get(curr) ?? []).includes(prev);
      totalWidth += isCouple ? COUPLE_SPACING : H_SPACING;
    }

    let x = centerX - totalWidth / 2;
    for (let i = 0; i < ordered.length; i++) {
      const curr = ordered[i];
      if (!curr) continue;
      if (i > 0) {
        const prev = ordered[i - 1];
        if (prev) {
          const isCouple = (couplesOf.get(curr) ?? []).includes(prev);
          x += isCouple ? COUPLE_SPACING : H_SPACING;
        }
      }
      knownPos.set(curr, { x, y });
    }
  }

  // ── Apply positions ─────────────────────────────────────────────────────
  return nodes.map((n) => {
    if (respectPinned && n.pinned) return n;
    const pos = knownPos.get(n.id);
    if (!pos) return n;
    return { ...n, x: pos.x, y: pos.y };
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns the X positions of all effective parents of a node.
 * "Effective parents" = direct parents from parent-child edges + their
 * couple partners. This ensures children center under the whole couple
 * even if only one parent has a parent-child edge.
 */
function getEffectiveParentXs(
  childId: string,
  parentsOf: Map<string, string[]>,
  couplesOf: Map<string, string[]>,
  knownPos: Map<string, { x: number; y: number }>,
  nodeMap: Map<string, LayoutNode>
): number[] {
  const effectiveIds = new Set<string>(parentsOf.get(childId) ?? []);
  for (const pid of [...effectiveIds]) {
    for (const partnerId of couplesOf.get(pid) ?? []) {
      effectiveIds.add(partnerId);
    }
  }
  const xs: number[] = [];
  for (const pid of effectiveIds) {
    const pos = knownPos.get(pid) ?? nodeMap.get(pid);
    if (pos) xs.push(pos.x);
  }
  return xs;
}

function orderNodesForGen(
  nodeIds: string[],
  couplesOf: Map<string, string[]>,
  parentsOf: Map<string, string[]>,
  knownPos: Map<string, { x: number; y: number }>,
  nodeMap: Map<string, LayoutNode>
): string[] {
  const seen = new Set<string>();
  const groups: string[][] = [];

  for (const id of nodeIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const partners = (couplesOf.get(id) ?? []).filter(
      (p) => nodeIds.includes(p) && !seen.has(p)
    );
    if (partners.length > 0 && partners[0]) {
      seen.add(partners[0]);
      groups.push([id, partners[0]]);
    } else {
      groups.push([id]);
    }
  }

  groups.sort((a, b) => {
    const aX = avgParentX(a, parentsOf, couplesOf, knownPos, nodeMap);
    const bX = avgParentX(b, parentsOf, couplesOf, knownPos, nodeMap);
    return aX - bX;
  });

  return groups.flat();
}

function avgParentX(
  ids: string[],
  parentsOf: Map<string, string[]>,
  couplesOf: Map<string, string[]>,
  knownPos: Map<string, { x: number; y: number }>,
  nodeMap: Map<string, LayoutNode>
): number {
  const xs: number[] = [];
  for (const id of ids) {
    xs.push(...getEffectiveParentXs(id, parentsOf, couplesOf, knownPos, nodeMap));
  }
  return xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : CANVAS_CENTER_X;
}

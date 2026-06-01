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

import { GEN_GRID } from "@/features/pedigree-editor/canvas/types";
const GEN_Y_START = GEN_GRID;
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

  // ── Spouse alignment pass: ensure both partners share the max generation ──
  // Married-in founders may have been assigned gen 0 by the BFS but their
  // partner has a higher gen from parental lineage. Re-align them.
  let spouseChanged = true;
  let spouseSafety = 0;
  while (spouseChanged && spouseSafety++ < 50) {
    spouseChanged = false;
    for (const n of nodes) {
      const myGen = genOf.get(n.id) ?? 0;
      for (const partnerId of couplesOf.get(n.id) ?? []) {
        const partnerGen = genOf.get(partnerId) ?? 0;
        const maxGen = Math.max(myGen, partnerGen);
        if (myGen < maxGen) {
          genOf.set(n.id, maxGen);
          spouseChanged = true;
        }
        if (partnerGen < maxGen) {
          genOf.set(partnerId, maxGen);
          spouseChanged = true;
        }
      }
    }
  }

  // ── Re-propagate children after spouse alignment ──────────────────────
  // Spouse alignment may have promoted some nodes, so their children need
  // to be at parentGen + 1 at minimum. Iterate until stable because
  // promoting a child may cascade to grandchildren.
  let repropChanged = true;
  let repropSafety = 0;
  while (repropChanged && repropSafety++ < 50) {
    repropChanged = false;
    const byGen = [...genOf.entries()].sort((a, b) => a[1] - b[1]);
    for (const [id] of byGen) {
      const myGen = genOf.get(id) ?? 0;
      for (const childId of childrenOf.get(id) ?? []) {
        const childGen = genOf.get(childId) ?? 0;
        if (childGen <= myGen) {
          genOf.set(childId, myGen + 1);
          repropChanged = true;
        }
      }
    }
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

    // Group unpinned nodes by their effective parent set (sibship groups)
    const sibGroups: { ids: string[]; centerX: number }[] = [];
    const assigned = new Set<string>();

    for (const id of unpinnedIds) {
      if (assigned.has(id)) continue;
      // Collect all siblings sharing the same effective parent set
      const myParents = new Set(parentsOf.get(id) ?? []);
      // Expand to include couple partners of parents
      const effectiveParents = new Set(myParents);
      for (const pid of myParents) {
        for (const partnerId of couplesOf.get(pid) ?? []) {
          effectiveParents.add(partnerId);
        }
      }
      const parentKey = [...effectiveParents].sort().join("_");
      const groupIds: string[] = [];
      for (const otherId of unpinnedIds) {
        if (assigned.has(otherId)) continue;
        const otherParents = new Set(parentsOf.get(otherId) ?? []);
        const otherEffective = new Set(otherParents);
        for (const pid of otherParents) {
          for (const partnerId of couplesOf.get(pid) ?? []) {
            otherEffective.add(partnerId);
          }
        }
        const otherKey = [...otherEffective].sort().join("_");
        if (otherKey === parentKey) {
          groupIds.push(otherId);
          assigned.add(otherId);
        }
      }
      const pxs = getEffectiveParentXs(id, parentsOf, couplesOf, knownPos, nodeMap);
      const cx = pxs.length > 0 ? pxs.reduce((a, b) => a + b, 0) / pxs.length : CANVAS_CENTER_X;
      sibGroups.push({ ids: groupIds, centerX: cx });
    }

    // Sort groups by centerX for left-to-right placement
    sibGroups.sort((a, b) => a.centerX - b.centerX);

    // For each group, order nodes (couples together), compute width, and place
    // centered around the group's centerX
    let nextAvailableX = -Infinity;
    for (const group of sibGroups) {
      const ordered = orderNodesForGen(
        group.ids,
        couplesOf,
        parentsOf,
        knownPos,
        nodeMap
      );

      let totalWidth = 0;
      for (let i = 1; i < ordered.length; i++) {
        const curr = ordered[i];
        const prev = ordered[i - 1];
        if (!curr || !prev) continue;
        const isCouple = (couplesOf.get(curr) ?? []).includes(prev);
        totalWidth += isCouple ? COUPLE_SPACING : H_SPACING;
      }

      const idealStartX = group.centerX - totalWidth / 2;
      const startX = Math.max(idealStartX, nextAvailableX);

      let x = startX;
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
      nextAvailableX = x + H_SPACING;
    }
  }

  // ── Overlap resolution: push overlapping sibship groups down ──────────
  for (const gen of sortedGens) {
    const nodeIds = genGroups.get(gen) ?? [];
    if (nodeIds.length <= 1) continue;

    // Re-group by effective parents
    const overlapAssigned = new Set<string>();
    const overlapGroups: { ids: string[]; xMin: number; xMax: number; y: number }[] = [];

    for (const id of nodeIds) {
      if (overlapAssigned.has(id)) continue;
      const myParents = new Set(parentsOf.get(id) ?? []);
      const effectiveParents = new Set(myParents);
      for (const pid of myParents) {
        for (const partnerId of couplesOf.get(pid) ?? []) {
          effectiveParents.add(partnerId);
        }
      }
      const parentKey = [...effectiveParents].sort().join("_");
      const groupIds: string[] = [];
      for (const otherId of nodeIds) {
        if (overlapAssigned.has(otherId)) continue;
        const otherParents = new Set(parentsOf.get(otherId) ?? []);
        const otherEffective = new Set(otherParents);
        for (const pid of otherParents) {
          for (const partnerId of couplesOf.get(pid) ?? []) {
            otherEffective.add(partnerId);
          }
        }
        const otherKey = [...otherEffective].sort().join("_");
        if (otherKey === parentKey) {
          groupIds.push(otherId);
          overlapAssigned.add(otherId);
        }
      }
      const xs = groupIds.map(gid => knownPos.get(gid)?.x).filter((x): x is number => x !== undefined);
      if (xs.length > 0) {
        const nodeRadius = 30; // approximate half-node size for overlap detection
        overlapGroups.push({
          ids: groupIds,
          xMin: Math.min(...xs) - nodeRadius,
          xMax: Math.max(...xs) + nodeRadius,
          y: knownPos.get(groupIds[0]!)?.y ?? genYOf.get(gen) ?? 0,
        });
      }
    }

    if (overlapGroups.length <= 1) continue;
    overlapGroups.sort((a, b) => a.xMin - b.xMin);

    for (let i = 1; i < overlapGroups.length; i++) {
      const prev = overlapGroups[i - 1]!;
      const curr = overlapGroups[i]!;
      if (curr.xMin < prev.xMax) {
        // Push down by a fraction of grid spacing to avoid overlapping next generation
        const yOffset = GEN_SPACING * 0.25;
        for (const id of curr.ids) {
          const pos = knownPos.get(id);
          if (pos) knownPos.set(id, { x: pos.x, y: pos.y + yOffset });
        }
        curr.y += yOffset;
      }
    }
  }

  // ── Apply positions, clamping minimum X to NODE_GAP ──
  return nodes.map((n) => {
    if (respectPinned && n.pinned) return n;
    const pos = knownPos.get(n.id);
    if (!pos) return n;
    return { ...n, x: Math.max(GEN_GRID, pos.x), y: pos.y };
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

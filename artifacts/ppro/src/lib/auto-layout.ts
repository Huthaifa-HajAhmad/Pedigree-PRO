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
  type?: "male" | "female" | "unknown" | "pregnancy" | "sab";
  pinned?: boolean;
}

export interface LayoutEdge {
  id: string;
  type: "couple" | "parent-child" | "consanguinity" | "divorced" | "separated";
  sourceId: string;
  targetId: string;
}

import { GEN_GRID, NODE_GAP } from "@/features/pedigree-editor/canvas/types";
import { resolveAllCollisions, recenterAllFamilies } from "./layout-engine";
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
    if (e.type === "couple" || e.type === "consanguinity" || e.type === "divorced" || e.type === "separated") {
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

    // Group unpinned nodes by their parentage/spouses
    const groupsMap = new Map<string, string[]>(); // groupKey -> nodeIds
    const groupCenterX = new Map<string, number>(); // groupKey -> centerX
    const nodeToGroupKey = new Map<string, string>();

    const nonFounders = unpinnedIds.filter((id) => (parentsOf.get(id) ?? []).length > 0);
    const founders = unpinnedIds.filter((id) => (parentsOf.get(id) ?? []).length === 0);

    // 1. Group non-founders by their parentKey
    for (const id of nonFounders) {
      const myParents = new Set(parentsOf.get(id) ?? []);
      const effectiveParents = new Set(myParents);
      for (const pid of myParents) {
        for (const partnerId of couplesOf.get(pid) ?? []) {
          effectiveParents.add(partnerId);
        }
      }
      const parentKey = [...effectiveParents].sort().join("_");
      
      if (!groupsMap.has(parentKey)) {
        groupsMap.set(parentKey, []);
        const pxs = getEffectiveParentXs(id, parentsOf, couplesOf, knownPos, nodeMap);
        const cx = pxs.length > 0 ? pxs.reduce((a, b) => a + b, 0) / pxs.length : CANVAS_CENTER_X;
        groupCenterX.set(parentKey, cx);
      }
      groupsMap.get(parentKey)!.push(id);
      nodeToGroupKey.set(id, parentKey);
    }

    // 2. Attach married-in founders to their spouse's group
    const remainingFounders: string[] = [];
    for (const id of founders) {
      const partners = (couplesOf.get(id) ?? []).filter((p) => unpinnedIds.includes(p));
      const nonFounderPartner = partners.find((p) => nodeToGroupKey.has(p));
      if (nonFounderPartner) {
        const parentKey = nodeToGroupKey.get(nonFounderPartner)!;
        groupsMap.get(parentKey)!.push(id);
        nodeToGroupKey.set(id, parentKey);
      } else {
        remainingFounders.push(id);
      }
    }

    // 3. Group remaining founders (founder couples and single founders)
    const assignedFounders = new Set<string>();
    let founderGroupIndex = 0;
    for (const id of remainingFounders) {
      if (assignedFounders.has(id)) continue;
      const key = `founder_gp_${founderGroupIndex++}`;
      groupsMap.set(key, [id]);
      groupCenterX.set(key, CANVAS_CENTER_X);
      assignedFounders.add(id);
      nodeToGroupKey.set(id, key);

      const partners = (couplesOf.get(id) ?? []).filter((p) => remainingFounders.includes(p) && !assignedFounders.has(p));
      if (partners.length > 0 && partners[0]) {
        groupsMap.get(key)!.push(partners[0]);
        assignedFounders.add(partners[0]);
        nodeToGroupKey.set(partners[0], key);
      }
    }

    // Convert to the array shape sibGroups expects
    const sibGroups: { ids: string[]; centerX: number }[] = [];
    for (const [key, ids] of groupsMap) {
      sibGroups.push({ ids, centerX: groupCenterX.get(key) ?? CANVAS_CENTER_X });
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
      nextAvailableX = x + Math.round(NODE_GAP * 2.0);
    }
  }

  // ── Apply initial positions ──
  const initialNodes = nodes.map((n) => {
    if (respectPinned && n.pinned) return n;
    const pos = knownPos.get(n.id);
    if (!pos) return n;
    return { ...n, x: Math.max(GEN_GRID, pos.x), y: pos.y };
  });

  // ── Overlap resolution: use shared collision resolver for horizontal overlaps ──
  const pinnedIds = new Set(
    nodes.filter((n) => respectPinned && n.pinned).map((n) => n.id)
  );
  
  const resolvedNodes = resolveAllCollisions(
    initialNodes as any,
    edges as any,
    pinnedIds
  );

  const swappedNodes = swapCouplePartners(resolvedNodes, edges);

  return recenterAllFamilies(swappedNodes as any, edges as any, pinnedIds) as any;
}

function swapCouplePartners(nodes: LayoutNode[], edges: LayoutEdge[]): LayoutNode[] {
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
          // If male is to the right of female, swap their X coordinates
          if (maleNode.x > femaleNode.x) {
            const tempX = maleNode.x;
            maleNode.x = femaleNode.x;
            femaleNode.x = tempX;
          }
        }
      }
    }
  }

  return result;
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
      // Enforce male on the left, female on the right
      const p1 = nodeMap.get(id);
      const p2 = nodeMap.get(partners[0]);
      if (p1 && p2) {
        if (p1.type === "female" || p2.type === "male") {
          groups.push([partners[0], id]);
        } else {
          groups.push([id, partners[0]]);
        }
      } else {
        groups.push([id, partners[0]]);
      }
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

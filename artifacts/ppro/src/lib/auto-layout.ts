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
  inverted?: boolean;
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

  // ── Unified spouse alignment, child downward and parent upward propagation loop ──
  // This keeps the entire pedigree generation-aligned, even when ancestors
  // get auto-created parents (which shifts generations at the top).
  let stable = false;
  let safety = 0;
  while (!stable && safety++ < 100) {
    stable = true;

    for (const n of nodes) {
      const myGen = genOf.get(n.id) ?? 0;

      // 1. Spouse alignment: spouses must be in the same generation
      for (const partnerId of couplesOf.get(n.id) ?? []) {
        const partnerGen = genOf.get(partnerId) ?? 0;
        if (partnerGen !== myGen) {
          const max = Math.max(myGen, partnerGen);
          genOf.set(n.id, max);
          genOf.set(partnerId, max);
          stable = false;
        }
      }

      // 2. Downward child propagation: children must be at least myGen + 1
      for (const childId of childrenOf.get(n.id) ?? []) {
        const childGen = genOf.get(childId) ?? 0;
        if (childGen < myGen + 1) {
          genOf.set(childId, myGen + 1);
          stable = false;
        }
      }

      // 3. Upward parent propagation: parents must be at least myGen - 1
      for (const parentId of parentsOf.get(n.id) ?? []) {
        const parentGen = genOf.get(parentId) ?? 0;
        if (parentGen < myGen - 1) {
          genOf.set(parentId, myGen - 1);
          stable = false;
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
  let anchorGen: number | null = null;
  let anchorY = 0;

  if (respectPinned) {
    for (const gen of sortedGens) {
      const nodeIds = genGroups.get(gen)!;
      const pinnedYs = nodeIds
        .map((id) => nodeMap.get(id))
        .filter((n): n is LayoutNode => !!n?.pinned)
        .map((n) => n.y);
      if (pinnedYs.length > 0) {
        anchorGen = gen;
        anchorY = pinnedYs.reduce((a, b) => a + b, 0) / pinnedYs.length;
        break;
      }
    }
  }

  for (const gen of sortedGens) {
    if (anchorGen !== null) {
      genYOf.set(gen, anchorY + (gen - anchorGen) * GEN_SPACING);
    } else {
      genYOf.set(gen, GEN_Y_START + gen * GEN_SPACING);
    }
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
    const founderGroups: { key: string; ids: string[] }[] = [];
    for (const id of remainingFounders) {
      if (assignedFounders.has(id)) continue;
      const key = `founder_gp_${founderGroupIndex++}`;
      const groupIds = [id];
      assignedFounders.add(id);
      nodeToGroupKey.set(id, key);

      const partners = (couplesOf.get(id) ?? []).filter((p) => remainingFounders.includes(p) && !assignedFounders.has(p));
      if (partners.length > 0 && partners[0]) {
        groupIds.push(partners[0]);
        assignedFounders.add(partners[0]);
        nodeToGroupKey.set(partners[0], key);
      }
      founderGroups.push({ key, ids: groupIds });
    }

    // 4. Build connection graph between founder groups based on child marriages
    const childrenOfFg = new Map<string, Set<string>>();
    for (const fg of founderGroups) {
      const childSet = new Set<string>();
      for (const memberId of fg.ids) {
        for (const childId of childrenOf.get(memberId) ?? []) {
          childSet.add(childId);
        }
      }
      childrenOfFg.set(fg.key, childSet);
    }

    const adjFg = new Map<string, Set<string>>();
    for (const fg of founderGroups) {
      adjFg.set(fg.key, new Set());
    }

    for (let i = 0; i < founderGroups.length; i++) {
      for (let j = i + 1; j < founderGroups.length; j++) {
        const fgA = founderGroups[i]!;
        const fgB = founderGroups[j]!;

        const childrenA = childrenOfFg.get(fgA.key)!;
        const childrenB = childrenOfFg.get(fgB.key)!;

        let connected = false;
        for (const childA of childrenA) {
          const partners = couplesOf.get(childA) ?? [];
          for (const partner of partners) {
            if (childrenB.has(partner)) {
              connected = true;
              break;
            }
          }
          if (connected) break;
        }

        if (connected) {
          adjFg.get(fgA.key)!.add(fgB.key);
          adjFg.get(fgB.key)!.add(fgA.key);
        }
      }
    }

    // 5. Traverse components to order connected founder groups adjacent to each other
    const orderedFgKeys: string[] = [];
    const visitedFg = new Set<string>();

    for (const fg of founderGroups) {
      if (visitedFg.has(fg.key)) continue;

      const component: string[] = [];
      const queue = [fg.key];
      while (queue.length > 0) {
        const curr = queue.shift()!;
        if (visitedFg.has(curr)) continue;
        visitedFg.add(curr);
        component.push(curr);

        for (const neighbor of adjFg.get(curr) ?? []) {
          if (!visitedFg.has(neighbor)) {
            queue.push(neighbor);
          }
        }
      }
      orderedFgKeys.push(...component);
    }

    // 6. Set ordered founder groups X center coordinates
    const founderGroupByKey = new Map(founderGroups.map(fg => [fg.key, fg]));
    let fIdx = 0;
    const spacing = 200;
    for (const key of orderedFgKeys) {
      const fg = founderGroupByKey.get(key)!;
      groupsMap.set(fg.key, fg.ids);
      const cx = CANVAS_CENTER_X + (fIdx - (orderedFgKeys.length - 1) / 2) * spacing;
      groupCenterX.set(fg.key, cx);
      fIdx++;
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
        childrenOf,
        parentsOf,
        knownPos,
        nodeMap,
        edges
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
      nextAvailableX = x + Math.round(NODE_GAP * 1.3);
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
  childrenOf: Map<string, string[]>,
  parentsOf: Map<string, string[]>,
  knownPos: Map<string, { x: number; y: number }>,
  nodeMap: Map<string, LayoutNode>,
  edges: LayoutEdge[]
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
      // Enforce male on the left, female on the right (unless inverted)
      const p1 = nodeMap.get(id);
      const p2 = nodeMap.get(partners[0]);
      
      const coupleEdge = edges.find(
        (e) =>
          (e.type === "couple" || e.type === "consanguinity" || e.type === "divorced" || e.type === "separated") &&
          ((e.sourceId === id && e.targetId === partners[0]) || (e.sourceId === partners[0] && e.targetId === id))
      );
      const isInverted = coupleEdge?.inverted ?? false;

      if (p1 && p2) {
        const shouldSwap = isInverted
          ? (p1.type === "male" || p2.type === "female") // Inverted: female left, male right
          : (p1.type === "female" || p2.type === "male"); // Normal: male left, female right
        if (shouldSwap) {
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

  // Optimize placement order within sibling groups to place spouses closest to their partners
  const ownParentX = avgParentX(nodeIds, parentsOf, couplesOf, knownPos, nodeMap);

  const getSpouseOffset = (groupIds: string[]): number => {
    let offset = 0;
    for (const id of groupIds) {
      const partners = couplesOf.get(id) ?? [];
      for (const p of partners) {
        if (!nodeIds.includes(p)) {
          const spouseParentX = avgParentX([p], parentsOf, couplesOf, knownPos, nodeMap);
          offset += (spouseParentX - ownParentX);
        }
      }
    }
    return offset;
  };

  groups.sort((a, b) => {
    const aOffset = getSpouseOffset(a);
    const bOffset = getSpouseOffset(b);
    if (Math.abs(aOffset - bOffset) > 1) {
      return aOffset - bOffset;
    }

    const aX = avgParentX(a, parentsOf, couplesOf, knownPos, nodeMap);
    const bX = avgParentX(b, parentsOf, couplesOf, knownPos, nodeMap);
    if (Math.abs(aX - bX) > 1) {
      return aX - bX;
    }

    // Tie-breaker: preserve canonical sibling order from parent-child edges
    const getGroupSiblingIndex = (groupIds: string[]): number => {
      const indices = groupIds.map((id) => {
        const pIds = parentsOf.get(id) ?? [];
        if (pIds.length === 0) return 999;
        const pid = pIds[0]!;
        const children = childrenOf.get(pid) ?? [];
        const idx = children.indexOf(id);
        return idx !== -1 ? idx : 999;
      });
      const minIdx = Math.min(...indices);
      if (minIdx === 999) {
        return Math.min(...groupIds.map((id) => nodeIds.indexOf(id)));
      }
      return minIdx;
    };

    const idxA = getGroupSiblingIndex(a);
    const idxB = getGroupSiblingIndex(b);
    
    if (idxA === idxB) {
      const originalIdxA = Math.min(...a.map((id) => nodeIds.indexOf(id)));
      const originalIdxB = Math.min(...b.map((id) => nodeIds.indexOf(id)));
      return originalIdxA - originalIdxB;
    }
    return idxA - idxB;
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

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

import { GEN_GRID, NODE_GAP, NODE_SIZE } from "@/features/pedigree-editor/canvas/types";
import { resolveAllCollisions, recenterAllFamilies, swapCouplePartners, collectSubtree, detectRowCollisions } from "./layout-engine";
const CANVAS_CENTER_X = 700;

export function computeAutoLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  respectPinned: boolean,
  spacing?: { nodeGap: number; genGrid: number },
  canvasWidth?: number
): LayoutNode[] {
  const nodeGap = spacing?.nodeGap ?? NODE_GAP;
  const genGrid = spacing?.genGrid ?? GEN_GRID;
  const genSpacing = genGrid;
  const hSpacing = Math.round(nodeGap * 1.13); // maintain default proportion 110/96.8
  const coupleSpacing = nodeGap;
  if (nodes.length === 0) return nodes;

  const pinnedNodes = respectPinned ? nodes.filter(n => n.pinned) : [];
  let effectiveCenterX = CANVAS_CENTER_X;
  if (pinnedNodes.length > 0) {
    effectiveCenterX = pinnedNodes.reduce((sum, n) => sum + n.x, 0) / pinnedNodes.length;
  } else if (canvasWidth !== undefined) {
    effectiveCenterX = canvasWidth / 2;
  }

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

  const adj = { childrenOf, parentsOf, couplesOf };

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
      const hasParentsSelf = (parentsOf.get(entry.id) ?? []).length > 0;
      const hasParentsPartner = (parentsOf.get(partnerId) ?? []).length > 0;
      const bothOrNeither = (hasParentsSelf && hasParentsPartner) || (!hasParentsSelf && !hasParentsPartner);
      if (bothOrNeither) {
        const partnerGen = genOf.get(partnerId);
        if (partnerGen === undefined || partnerGen < entry.gen) {
          queue.push({ id: partnerId, gen: entry.gen });
        }
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
          const hasParentsSelf = (parentsOf.get(n.id) ?? []).length > 0;
          const hasParentsPartner = (parentsOf.get(partnerId) ?? []).length > 0;
          
          if ((hasParentsSelf && hasParentsPartner) || (!hasParentsSelf && !hasParentsPartner)) {
            const max = Math.max(myGen, partnerGen);
            genOf.set(n.id, max);
            genOf.set(partnerId, max);
            stable = false;
          } else {
            // One has parents, one does not.
            // Keep the founder at min(founderGen, spouseGen) and let the spouse's gen stay.
            const selfIsFounder = !hasParentsSelf;
            const founderId = selfIsFounder ? n.id : partnerId;
            const spouseId = selfIsFounder ? partnerId : n.id;
            const founderGen = genOf.get(founderId) ?? 0;
            const spouseGen = genOf.get(spouseId) ?? 0;
            const newFounderGen = Math.min(founderGen, spouseGen);
            if (founderGen !== newFounderGen) {
              genOf.set(founderId, newFounderGen);
              stable = false;
            }
          }
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
        } else if (parentGen > myGen) {
          const parentHasParents = (parentsOf.get(parentId) ?? []).length > 0;
          if (parentHasParents) {
            genOf.set(parentId, myGen);
            stable = false;
          }
        }
      }
    }
  }

  // Compact and normalize generations to consecutive integers starting at 0
  const allGens = new Set(genOf.values());
  for (const n of nodes) {
    const parentIds = parentsOf.get(n.id) ?? [];
    const myGen = genOf.get(n.id);
    if (myGen === undefined) continue;
    for (const pId of parentIds) {
      const pGen = genOf.get(pId);
      if (pGen === undefined) continue;
      if (myGen > pGen + 1) {
        for (let g = pGen + 1; g < myGen; g++) {
          allGens.add(g);
        }
      }
    }
  }

  const sortedGensList = [...allGens].sort((a, b) => a - b);
  const remap = new Map(sortedGensList.map((g, i) => [g, i]));
  for (const [id, gen] of genOf) {
    genOf.set(id, remap.get(gen)!);
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
      genYOf.set(gen, anchorY + (gen - anchorGen) * genSpacing);
    } else {
      genYOf.set(gen, genGrid + gen * genSpacing);
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
        const cx = pxs.length > 0 ? pxs.reduce((a, b) => a + b, 0) / pxs.length : effectiveCenterX;
        groupCenterX.set(parentKey, cx);
      }
      groupsMap.get(parentKey)!.push(id);
      nodeToGroupKey.set(id, parentKey);
    }

    // 2. Attach married-in founders to their spouse's group
    const remainingFounders: string[] = [];
    const unpinnedSet = new Set(unpinnedIds);
    for (const id of founders) {
      const partners = (couplesOf.get(id) ?? []).filter((p) => unpinnedSet.has(p));
      const nonFounderPartner = partners.find((p) => nodeToGroupKey.has(p));
      if (nonFounderPartner) {
        const parentKey = nodeToGroupKey.get(nonFounderPartner)!;
        groupsMap.get(parentKey)!.push(id);
        nodeToGroupKey.set(id, parentKey);
      } else {
        remainingFounders.push(id);
      }
    }

    // 2.5 Union-Find: Merge sibling groups connected by marriage
    const groupKeys = Array.from(groupsMap.keys());
    const parentGroup = new Map<string, string>();
    for (const key of groupKeys) {
      parentGroup.set(key, key);
    }

    const findGroup = (key: string): string => {
      let root = key;
      while (parentGroup.get(root) !== root) {
        root = parentGroup.get(root)!;
      }
      let curr = key;
      while (curr !== root) {
        const next = parentGroup.get(curr)!;
        parentGroup.set(curr, root);
        curr = next;
      }
      return root;
    };

    const unionGroups = (key1: string, key2: string) => {
      const r1 = findGroup(key1);
      const r2 = findGroup(key2);
      if (r1 !== r2) {
        parentGroup.set(r1, r2);
      }
    };

    for (const id of unpinnedIds) {
      const key1 = nodeToGroupKey.get(id);
      if (!key1) continue;
      for (const partnerId of couplesOf.get(id) ?? []) {
        const key2 = nodeToGroupKey.get(partnerId);
        if (key2 && key1 !== key2) {
          unionGroups(key1, key2);
        }
      }
    }

    const mergedGroupsMap = new Map<string, string[]>();
    const mergedGroupCenters = new Map<string, number[]>();

    for (const key of groupKeys) {
      const root = findGroup(key);
      if (!mergedGroupsMap.has(root)) {
        mergedGroupsMap.set(root, []);
        mergedGroupCenters.set(root, []);
      }
      mergedGroupsMap.get(root)!.push(...groupsMap.get(key)!);
      mergedGroupCenters.get(root)!.push(groupCenterX.get(key) ?? effectiveCenterX);
    }

    groupsMap.clear();
    groupCenterX.clear();
    nodeToGroupKey.clear();

    for (const [root, ids] of mergedGroupsMap) {
      groupsMap.set(root, ids);
      const centers = mergedGroupCenters.get(root) || [CANVAS_CENTER_X];
      const avgCenter = centers.reduce((a, b) => a + b, 0) / centers.length;
      groupCenterX.set(root, avgCenter);
      for (const id of ids) {
        nodeToGroupKey.set(id, root);
      }
    }


    // 3. Group remaining founders (founder couples and single founders)
    const assignedFounders = new Set<string>();
    let founderGroupIndex = 0;
    const founderGroups: { key: string; ids: string[] }[] = [];
    const remainingFoundersSet = new Set(remainingFounders);
    for (const id of remainingFounders) {
      if (assignedFounders.has(id)) continue;
      const key = `founder_gp_${founderGroupIndex++}`;
      const groupIds = [id];
      assignedFounders.add(id);
      nodeToGroupKey.set(id, key);

      const partners = (couplesOf.get(id) ?? []).filter((p) => remainingFoundersSet.has(p) && !assignedFounders.has(p));
      for (const partner of partners) {
        groupIds.push(partner);
        assignedFounders.add(partner);
        nodeToGroupKey.set(partner, key);
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

    // 6. Set ordered founder groups X center coordinates with subtree-aware widths
    const founderGroupByKey = new Map(founderGroups.map(fg => [fg.key, fg]));
    
    // Estimate the horizontal width required by a founder group's subtree
    const getSubtreeWidth = (fgIds: string[]): number => {
      const visited = new Set<string>();
      
      const traverse = (nodeId: string) => {
        if (visited.has(nodeId)) return;
        
        // Find all transitively connected partners
        const partnersQueue = [nodeId];
        const component = new Set<string>([nodeId]);
        let headIdx = 0;
        while (headIdx < partnersQueue.length) {
          const curr = partnersQueue[headIdx]!;
          headIdx++;
          for (const partnerId of couplesOf.get(curr) ?? []) {
            if (!component.has(partnerId)) {
              component.add(partnerId);
              partnersQueue.push(partnerId);
            }
          }
        }

        for (const pId of component) {
          visited.add(pId);
        }

        // Recurse to children of all nodes in this partner component
        for (const pId of component) {
          for (const childId of childrenOf.get(pId) ?? []) {
            traverse(childId);
          }
        }
      };

      for (const id of fgIds) {
        traverse(id);
      }

      // Group visited nodes by generation
      const genCounts = new Map<number, number>();
      for (const id of visited) {
        const g = genOf.get(id) ?? 0;
        genCounts.set(g, (genCounts.get(g) ?? 0) + 1);
      }

      const maxCount = Math.max(0, ...genCounts.values());
      // Minimum width is 2 nodes (couple)
      const calculatedWidth = maxCount > 0 ? (maxCount - 1) * hSpacing + NODE_SIZE : 0;
      return Math.max(nodeGap * 2.06, calculatedWidth);
    };

    const relativeX = new Map<string, number>();
    let currentX = 0;
    const groupWidths = new Map<string, number>();

    for (const key of orderedFgKeys) {
      const fg = founderGroupByKey.get(key)!;
      groupWidths.set(key, getSubtreeWidth(fg.ids));
    }

    for (let i = 0; i < orderedFgKeys.length; i++) {
      const key = orderedFgKeys[i]!;
      const w = groupWidths.get(key) ?? (nodeGap * 2.06);
      if (i > 0) {
        const prevKey = orderedFgKeys[i - 1]!;
        const prevW = groupWidths.get(prevKey) ?? (nodeGap * 2.06);
        currentX += (prevW + w) / 2 + nodeGap;
      }
      relativeX.set(key, currentX);
    }

    const totalSpan = currentX;
    const startX = effectiveCenterX - totalSpan / 2;

    for (const key of orderedFgKeys) {
      const fg = founderGroupByKey.get(key)!;
      groupsMap.set(fg.key, fg.ids);
      const cx = startX + (relativeX.get(key) ?? 0);
      groupCenterX.set(fg.key, cx);
    }


    // Convert to the array shape sibGroups expects
    const sibGroups: { ids: string[]; centerX: number }[] = [];
    for (const [key, ids] of groupsMap) {
      sibGroups.push({ ids, centerX: groupCenterX.get(key) ?? effectiveCenterX });
    }

    // Sort groups by centerX for left-to-right placement
    sibGroups.sort((a, b) => a.centerX - b.centerX);

    // For each group, order nodes (couples together), compute width, and place
    // centered around the group's centerX
    let nextAvailableX = -Infinity;
    let prevGroupNodeIds: string[] | undefined = undefined;
    for (const group of sibGroups) {
      const ordered = orderNodesForGen(
        group.ids,
        couplesOf,
        childrenOf,
        parentsOf,
        knownPos,
        nodeMap,
        edges,
        effectiveCenterX
      );

      let totalWidth = 0;
      for (let i = 1; i < ordered.length; i++) {
        const curr = ordered[i];
        const prev = ordered[i - 1];
        if (!curr || !prev) continue;
        const isCouple = (couplesOf.get(curr) ?? []).includes(prev);
        totalWidth += isCouple ? coupleSpacing : hSpacing;
      }

      const idealStartX = group.centerX - totalWidth / 2;
      
      let shortfall = nextAvailableX - idealStartX;
      if (shortfall > 0 && prevGroupNodeIds && prevGroupNodeIds.length > 0) {
        const shiftSet = new Set<string>();
        for (const id of prevGroupNodeIds) {
          const subtree = collectSubtree(id, adj, undefined, { anchorMarriedIn: true });
          for (const sId of subtree) {
            shiftSet.add(sId);
          }
        }
        let maxPossibleLeftShift = shortfall;
        
        for (const id of shiftSet) {
          const pos = knownPos.get(id);
          if (!pos) continue;
          
          const limitX = pos.x - maxPossibleLeftShift;
          if (limitX < genGrid) {
            maxPossibleLeftShift = pos.x - genGrid;
          }
          
          for (const [otherId, otherPos] of knownPos) {
            if (shiftSet.has(otherId)) continue;
            if (Math.abs(otherPos.y - pos.y) > 1) continue;
            
            if (otherPos.x < pos.x) {
              const minAllowedX = otherPos.x + nodeGap;
              if (pos.x - maxPossibleLeftShift < minAllowedX) {
                maxPossibleLeftShift = pos.x - minAllowedX;
              }
            }
          }
        }
        
        if (maxPossibleLeftShift < 0) maxPossibleLeftShift = 0;
        
        if (maxPossibleLeftShift > 0) {
          // Temporarily apply the shift
          const originalPositions = new Map<string, { x: number; y: number }>();
          for (const id of shiftSet) {
            const pos = knownPos.get(id);
            if (pos) {
              originalPositions.set(id, pos);
              knownPos.set(id, { ...pos, x: pos.x - maxPossibleLeftShift });
            }
          }

          // Build touched Y list
          const touchedYs = new Set<number>();
          for (const id of shiftSet) {
            const pos = knownPos.get(id);
            if (pos) {
              touchedYs.add(pos.y);
            }
          }

          // Validate with detectRowCollisions on all touched rows
          let hasCollision = false;
          const allNodesList = Array.from(knownPos.entries()).map(([id, pos]) => ({
            id,
            x: pos.x,
            y: pos.y,
            type: nodeMap.get(id)?.type ?? "male",
            affected: false,
            carrier: false,
            deceased: false,
            proband: false,
            label: "",
            age: "",
          } as any));

          for (const touchedY of touchedYs) {
            const collisions = detectRowCollisions(allNodesList, touchedY, nodeGap);
            if (collisions.length > 0) {
              hasCollision = true;
              break;
            }
          }

          if (hasCollision) {
            // Revert shift
            for (const [id, originalPos] of originalPositions) {
              knownPos.set(id, originalPos);
            }
            maxPossibleLeftShift = 0;
          } else {
            nextAvailableX -= maxPossibleLeftShift;
          }
        }
      }

      const startX = Math.max(idealStartX, nextAvailableX);

      let x = startX;
      for (let i = 0; i < ordered.length; i++) {
        const curr = ordered[i];
        if (!curr) continue;
        if (i > 0) {
          const prev = ordered[i - 1];
          if (prev) {
            const isCouple = (couplesOf.get(curr) ?? []).includes(prev);
            x += isCouple ? coupleSpacing : hSpacing;
          }
        }
        knownPos.set(curr, { x, y });
      }
      nextAvailableX = x + Math.round(nodeGap * 1.3);
      prevGroupNodeIds = ordered;
    }
  }

  // ── Apply initial positions ──
  const minX = Math.min(...nodes.map(n => (respectPinned && n.pinned) ? n.x : (knownPos.get(n.id)?.x ?? n.x)));
  if (minX < genGrid) {
    const shift = genGrid - minX;
    for (const [id, pos] of knownPos) {
      knownPos.set(id, { ...pos, x: pos.x + shift });
    }
  }

  const initialNodes = nodes.map((n) => {
    if (respectPinned && n.pinned) return n;
    const pos = knownPos.get(n.id);
    if (!pos) return n;
    return { ...n, x: pos.x, y: pos.y };
  });

  // ── Overlap resolution: use shared collision resolver for horizontal overlaps ──
  const pinnedIds = new Set(
    nodes.filter((n) => respectPinned && n.pinned).map((n) => n.id)
  );
  
  const resolvedNodes = resolveAllCollisions(
    initialNodes as any,
    edges as any,
    pinnedIds,
    undefined,
    nodeGap,
    genGrid
  );

  const swappedNodes = swapCouplePartners(resolvedNodes, edges);

  return recenterAllFamilies(swappedNodes as any, edges as any, pinnedIds, nodeGap, genGrid) as any;
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
  edges: LayoutEdge[],
  effectiveCenterX: number
): string[] {
  const seen = new Set<string>();
  const groups: string[][] = [];
  const nodeIdsSet = new Set(nodeIds);

  for (const id of nodeIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const partners = (couplesOf.get(id) ?? []).filter(
      (p) => nodeIdsSet.has(p) && !seen.has(p)
    );
    
    const partnerGroup = [id];
    for (const p of partners) {
      seen.add(p);
      partnerGroup.push(p);
    }
    
    if (partnerGroup.length > 1) {
      partnerGroup.sort((a, b) => {
        const p1 = nodeMap.get(a);
        const p2 = nodeMap.get(b);
        if (!p1 || !p2) return 0;
        
        const edge = edges.find(
          (e) =>
            (e.type === "couple" || e.type === "consanguinity" || e.type === "divorced" || e.type === "separated") &&
            ((e.sourceId === a && e.targetId === b) || (e.sourceId === b && e.targetId === a))
        );
        const isInverted = edge?.inverted ?? false;
        
        if (p1.type !== p2.type) {
          if (isInverted) {
            return p1.type === "female" ? -1 : 1;
          } else {
            return p1.type === "male" ? -1 : 1;
          }
        }
        return 0;
      });
    }
    groups.push(partnerGroup);
  }

  // Optimize placement order within sibling groups to place spouses closest to their partners
  const ownParentX = avgParentX(nodeIds, parentsOf, couplesOf, knownPos, nodeMap, effectiveCenterX);

  const getSpouseOffset = (groupIds: string[]): number => {
    let offset = 0;
    for (const id of groupIds) {
      const partners = couplesOf.get(id) ?? [];
      for (const p of partners) {
        if (!nodeIdsSet.has(p)) {
          const spouseParentX = avgParentX([p], parentsOf, couplesOf, knownPos, nodeMap, effectiveCenterX);
          offset += (spouseParentX - ownParentX);
        }
      }
    }
    return offset;
  };

  const indexMap = new Map<string, number>(nodeIds.map((id, i) => [id, i]));

  groups.sort((a, b) => {
    const aOffset = getSpouseOffset(a);
    const bOffset = getSpouseOffset(b);
    if (Math.abs(aOffset - bOffset) > 1) {
      return aOffset - bOffset;
    }

    const aX = avgParentX(a, parentsOf, couplesOf, knownPos, nodeMap, effectiveCenterX);
    const bX = avgParentX(b, parentsOf, couplesOf, knownPos, nodeMap, effectiveCenterX);
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
        return Math.min(...groupIds.map((id) => indexMap.get(id) ?? 999));
      }
      return minIdx;
    };

    const idxA = getGroupSiblingIndex(a);
    const idxB = getGroupSiblingIndex(b);
    
    if (idxA === idxB) {
      const originalIdxA = Math.min(...a.map((id) => indexMap.get(id) ?? 999));
      const originalIdxB = Math.min(...b.map((id) => indexMap.get(id) ?? 999));
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
  nodeMap: Map<string, LayoutNode>,
  effectiveCenterX: number
): number {
  const xs: number[] = [];
  for (const id of ids) {
    xs.push(...getEffectiveParentXs(id, parentsOf, couplesOf, knownPos, nodeMap));
  }
  return xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : effectiveCenterX;
}

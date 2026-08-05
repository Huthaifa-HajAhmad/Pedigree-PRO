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

import type { LayoutNode, EdgeSubset as LayoutEdge } from "./layout-shared";
export type { LayoutNode, LayoutEdge };

import { NODE_SIZE } from "@/features/pedigree-editor/canvas/types";
import { resolveAllCollisions, recenterAllFamilies, swapCouplePartners, collectSubtree, detectRowCollisions } from "./layout-engine";
import { buildAdjacency, buildGenerations, DEFAULT_LAYOUT_CONFIG, evaluateCostAwareInversion } from "./layout-shared";
import type { LayoutConfig } from "./layout-shared";
import { minimizeCrossings } from "./crossing-minimization";
import { computeNodeStructuralHash, getCacheEntry, setCacheEntry, checkAndClearCache } from "./layout-cache";

function getTwinInfo(
  nodeId: string,
  twinGroupOf: Map<string, string | undefined>,
  twinTypeOf: Map<string, "m" | "d" | undefined>
) {
  const group = twinGroupOf.get(nodeId);
  return group ? { group, type: twinTypeOf.get(nodeId) } : null;
}

export function computeAutoLayout<T extends LayoutNode>(
  nodes: T[],
  edges: LayoutEdge[],
  respectPinned: boolean,
  config?: Partial<LayoutConfig>,
  canvasWidth?: number
): T[] {
  const cfg = { ...DEFAULT_LAYOUT_CONFIG, ...config };
  const { nodeGap, genGrid, hSpacing, coupleSpacing, groupGap, twinGapMono, twinGapDizygotic } = cfg;
  const GROUP_GAP = groupGap;
  const genSpacing = genGrid;

  if (cfg.enableCache !== false) {
    checkAndClearCache(nodeGap, genGrid);
  }

  const DEFAULT_LEFT_MARGIN = 120;

  if (nodes.length === 0) return nodes;
  
  // Sanitize any NaN/Infinite coordinates that may have been passed in or stored in cache
  nodes = nodes.map((n, i) => {
    const x = isFinite(n.x) ? n.x : (i + 1) * nodeGap;
    const y = isFinite(n.y) ? n.y : genGrid;
    return (x !== n.x || y !== n.y) ? { ...n, x, y } as T : n;
  });

  const pinnedNodes = respectPinned ? nodes.filter(n => n.pinned) : [];
  let effectiveCenterX = cfg.canvasCenterX;
  if (pinnedNodes.length > 0) {
    effectiveCenterX = pinnedNodes.reduce((sum, n) => sum + n.x, 0) / pinnedNodes.length;
  } else if (canvasWidth !== undefined) {
    effectiveCenterX = canvasWidth / 2;
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // ── Adjacency and Generation maps (consolidated) ─────────────────────────
  const adj = buildAdjacency(nodes, edges);
  const { childrenOf, parentsOf, couplesOf, twinTypeOf, twinGroupOf } = adj;
  const genOf = buildGenerations(nodes, edges);

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
        .filter((n): n is T => !!n?.pinned)
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
      const parentKey = [...effectiveParents].sort().join("_") || `orphan_group_${id}`;
      
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
      const centers = mergedGroupCenters.get(root) || [effectiveCenterX];
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
      let head = 0;
      while (head < queue.length) {
        const curr = queue[head]!;
        head++;
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
      
      const traverse = (startId: string) => {
        const stack = [startId];
        while (stack.length > 0) {
          const nodeId = stack.pop()!;
          if (visited.has(nodeId)) continue;
          
          // Find all transitively connected partners
          const partnersQueue = [nodeId];
          const component = new Set<string>([nodeId]);
          let headIdx = 0;
          while (headIdx < partnersQueue.length) {
            const curr = partnersQueue[headIdx]!;
            headIdx++;
            for (const partnerId of couplesOf.get(curr) ?? []) {
              if (!component.has(partnerId)) {
                const partnerParents = parentsOf.get(partnerId) ?? [];
                const hasOutsideParents = partnerParents.some(p => !visited.has(p));
                if (hasOutsideParents) {
                  continue;
                }
                component.add(partnerId);
                partnersQueue.push(partnerId);
              }
            }
          }

          for (const pId of component) {
            visited.add(pId);
          }

          // Push children of all nodes in this partner component to stack
          for (const pId of component) {
            const children = childrenOf.get(pId) ?? [];
            for (let i = children.length - 1; i >= 0; i--) {
              const childId = children[i]!;
              const childParents = parentsOf.get(childId) ?? [];
              const allParentsInComponent = childParents.every((p) => component.has(p));
              if (allParentsInComponent && !visited.has(childId)) {
                stack.push(childId);
              }
            }
          }
        }
      };

      for (const id of fgIds) {
        traverse(id);
      }

      // Group visited nodes by generation
      const genNodes = new Map<number, string[]>();
      for (const id of visited) {
        const g = genOf.get(id) ?? 0;
        if (!genNodes.has(g)) genNodes.set(g, []);
        genNodes.get(g)!.push(id);
      }

      let maxRowWidth = 0;
      for (const [, rowNodes] of genNodes.entries()) {
        const N = rowNodes.length;
        let C = 0;
        const rowNodesSet = new Set(rowNodes);
        const counted = new Set<string>();
        for (const id of rowNodes) {
          if (counted.has(id)) continue;
          for (const partnerId of couplesOf.get(id) ?? []) {
            if (rowNodesSet.has(partnerId)) {
              C++;
              counted.add(id);
              counted.add(partnerId);
              break;
            }
          }
        }
        const rowWidth = N > 0 ? (N - 1) * hSpacing + NODE_SIZE + C * (coupleSpacing - hSpacing) : 0;
        if (rowWidth > maxRowWidth) {
          maxRowWidth = rowWidth;
        }
      }

      return Math.max(nodeGap * 2.06, maxRowWidth);
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
    const firstW = orderedFgKeys.length > 0 ? (groupWidths.get(orderedFgKeys[0]!) ?? (nodeGap * 2.06)) : 0;
    const lastW = orderedFgKeys.length > 0 ? (groupWidths.get(orderedFgKeys[orderedFgKeys.length - 1]!) ?? (nodeGap * 2.06)) : 0;
    const totalWidth = totalSpan + firstW / 2 + lastW / 2;
    const startX = effectiveCenterX - totalWidth / 2 + firstW / 2;

    for (const key of orderedFgKeys) {
      const fg = founderGroupByKey.get(key)!;
      groupsMap.set(fg.key, fg.ids);
      const cx = startX + (relativeX.get(key) ?? 0);
      groupCenterX.set(fg.key, cx);
    }


    // Convert to the array shape sibGroups expects
    const sibGroups: { ids: string[]; centerX: number; key?: string; subtreeWidth?: number }[] = [];
    for (const [key, ids] of groupsMap) {
      const subtreeWidth = groupWidths.get(key);
      sibGroups.push({ ids, centerX: groupCenterX.get(key) ?? effectiveCenterX, key, subtreeWidth });
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
        effectiveCenterX,
        twinGroupOf,
        twinTypeOf
      );

      let totalWidth = 0;
      for (let i = 1; i < ordered.length; i++) {
        const curr = ordered[i];
        const prev = ordered[i - 1];
        if (!curr || !prev) continue;
        const isCouple = (couplesOf.get(curr) ?? []).includes(prev);
        const twin1 = getTwinInfo(curr, twinGroupOf, twinTypeOf);
        const twin2 = getTwinInfo(prev, twinGroupOf, twinTypeOf);
        const areTwins = twin1 && twin2 && twin1.group === twin2.group;

        if (areTwins) {
          totalWidth += twin1.type === "m" ? twinGapMono : twinGapDizygotic;
        } else if (isCouple) {
          totalWidth += coupleSpacing;
        } else {
          totalWidth += hSpacing;
        }
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
        const rowMap = new Map<number, { id: string; x: number }[]>();
        for (const [otherId, otherPos] of knownPos.entries()) {
          if (shiftSet.has(otherId)) continue;
          const yKey = Math.round(otherPos.y);
          if (!rowMap.has(yKey)) {
            rowMap.set(yKey, []);
          }
          rowMap.get(yKey)!.push({ id: otherId, x: otherPos.x });
        }
        for (const row of rowMap.values()) {
          row.sort((a, b) => a.x - b.x);
        }

        let maxPossibleLeftShift = shortfall;
        
        for (const id of shiftSet) {
          const pos = knownPos.get(id);
          if (!pos) continue;
          
          const limitX = pos.x - maxPossibleLeftShift;
          if (limitX < DEFAULT_LEFT_MARGIN) {
            maxPossibleLeftShift = pos.x - DEFAULT_LEFT_MARGIN;
          }
          
          const yKey = Math.round(pos.y);
          const rowNodes = rowMap.get(yKey) ?? [];
          
          // Binary search for closest left node
          let closestLeftNode: { id: string; x: number } | null = null;
          let low = 0;
          let high = rowNodes.length - 1;
          while (low <= high) {
            const mid = (low + high) >> 1;
            if (rowNodes[mid]!.x < pos.x) {
              closestLeftNode = rowNodes[mid]!;
              low = mid + 1;
            } else {
              high = mid - 1;
            }
          }
          
          if (closestLeftNode) {
            const minAllowedX = closestLeftNode.x + nodeGap;
            if (pos.x - maxPossibleLeftShift < minAllowedX) {
              maxPossibleLeftShift = pos.x - minAllowedX;
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
          const allNodesList: LayoutNode[] = Array.from(knownPos.entries()).map(([id, pos]) => ({
            id,
            x: pos.x,
            y: pos.y,
            type: nodeMap.get(id)?.type ?? "male",
          }));

          for (const touchedY of touchedYs) {
            const collisions = detectRowCollisions(allNodesList, touchedY, nodeGap, undefined, undefined, adj);
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
            const twin1 = getTwinInfo(curr, twinGroupOf, twinTypeOf);
            const twin2 = getTwinInfo(prev, twinGroupOf, twinTypeOf);
            const areTwins = twin1 && twin2 && twin1.group === twin2.group;

            if (areTwins) {
              x += twin1.type === "m" ? twinGapMono : twinGapDizygotic;
            } else if (isCouple) {
              x += coupleSpacing;
            } else {
              x += hSpacing;
            }
          }
        }
        knownPos.set(curr, { x, y });
      }
      if (gen === 0 && group.key?.startsWith("founder_gp_") && group.subtreeWidth !== undefined) {
        const placedCenter = startX + totalWidth / 2;
        nextAvailableX = placedCenter + group.subtreeWidth / 2 + nodeGap;
      } else {
        nextAvailableX = x + GROUP_GAP;
      }
      prevGroupNodeIds = ordered;
    }
  }

  // ── Apply initial positions (seeding from cache where structure is unchanged) ──
  const unpinnedNodes = nodes.filter(n => !(respectPinned && n.pinned));
  for (const n of unpinnedNodes) {
    const currentHash = computeNodeStructuralHash(n.id, adj);
    const cached = cfg.enableCache !== false ? getCacheEntry(n.id) : undefined;
    if (cached && cached.hash === currentHash) {
      knownPos.set(n.id, { x: cached.x, y: cached.y });
    } else if (!knownPos.has(n.id)) {
      console.warn(`Node ${n.id} is missing from knownPos, assigning default position.`);
      const gen = genOf.get(n.id) ?? 0;
      const y = genYOf.get(gen) ?? genGrid;
      knownPos.set(n.id, { x: DEFAULT_LEFT_MARGIN, y });
    }
  }

  const minX = unpinnedNodes.length > 0
    ? unpinnedNodes.reduce((min, n) => Math.min(min, knownPos.get(n.id)!.x), Infinity)
    : DEFAULT_LEFT_MARGIN;

  if (minX < DEFAULT_LEFT_MARGIN) {
    const shift = DEFAULT_LEFT_MARGIN - minX;
    for (const [id, pos] of knownPos) {
      const node = nodeMap.get(id);
      if (respectPinned && node?.pinned) continue;
      knownPos.set(id, { ...pos, x: pos.x + shift });
    }
  }

  const initialNodes = nodes.map((n) => {
    if (respectPinned && n.pinned) return n;
    const pos = knownPos.get(n.id);
    if (!pos) return n;
    return { ...n, x: pos.x, y: pos.y };
  });

  const optimizedNodes = applyBarycenterHeuristic(initialNodes, edges, genOf, adj, nodeGap, hSpacing, twinGapMono, twinGapDizygotic);

  const pinnedIds = new Set(
    nodes.filter((n) => respectPinned && n.pinned).map((n) => n.id)
  );

  const minimizedNodes = minimizeCrossings(optimizedNodes, edges, genOf, pinnedIds);

  // ── Overlap resolution: use shared collision resolver for horizontal overlaps ──
  const resolvedNodes = resolveAllCollisions(
    minimizedNodes,
    edges,
    pinnedIds,
    nodeGap,
    genGrid,
    genOf,
    canvasWidth
  );

  const swappedNodes = swapCouplePartners(resolvedNodes, edges, nodeGap);

  const result = recenterAllFamilies(
    swappedNodes,
    edges,
    pinnedIds,
    nodeGap,
    genGrid,
    genOf,
    canvasWidth
  ) as T[];



  // Update layout cache with finalized coordinates
  if (cfg.enableCache !== false) {
    for (const resNode of result) {
      const currentHash = computeNodeStructuralHash(resNode.id, adj);
      setCacheEntry(resNode.id, {
        x: resNode.x,
        y: resNode.y,
        hash: currentHash
      });
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
  edges: LayoutEdge[],
  effectiveCenterX: number,
  twinGroupOf: Map<string, string | undefined>,
  twinTypeOf: Map<string, "m" | "d" | undefined>,
): string[] {
  const coupleEdgeMap = new Map<string, LayoutEdge>();
  for (const e of edges) {
    if (e.type === "couple" || e.type === "consanguinity" || e.type === "divorced" || e.type === "separated") {
      const key = e.sourceId < e.targetId ? `${e.sourceId}|${e.targetId}` : `${e.targetId}|${e.sourceId}`;
      coupleEdgeMap.set(key, e);
    }
  }

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
        
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        const edge = coupleEdgeMap.get(key);
        let isInverted = edge?.inverted;
        if (isInverted === undefined) {
          isInverted = evaluateCostAwareInversion(a, b, nodeMap, parentsOf, childrenOf, knownPos);
        }
        
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

  // Merge partner groups of the same twinGroup into a single group
  const twinClusters = new Map<string, string[][]>();
  const nonTwinGroups: string[][] = [];

  for (const g of groups) {
    const childId = g.find((id) => nodeIdsSet.has(id));
    const twinInfo = childId ? getTwinInfo(childId, twinGroupOf, twinTypeOf) : null;
    if (twinInfo) {
      if (!twinClusters.has(twinInfo.group)) {
        twinClusters.set(twinInfo.group, []);
      }
      twinClusters.get(twinInfo.group)!.push(g);
    } else {
      nonTwinGroups.push(g);
    }
  }

  const mergedGroups: string[][] = [...nonTwinGroups];
  for (const [_, memberGroups] of twinClusters.entries()) {
    const clusterTwins = memberGroups.flatMap((g) => g.filter((id) => nodeIdsSet.has(id)));
    const clusterSpouses = memberGroups.flatMap((g) => g.filter((id) => !nodeIdsSet.has(id)));

    clusterTwins.sort((a, b) => {
      const p1 = nodeMap.get(a);
      const p2 = nodeMap.get(b);
      if (p1 && p2 && p1.type !== p2.type) {
        return p1.type === "male" ? -1 : 1;
      }
      return a.localeCompare(b);
    });

    const mergedCluster: string[] = [];
    for (let i = 0; i < clusterTwins.length; i++) {
      const tc = clusterTwins[i];
      if (tc === undefined) continue;
      const tcSpouses = (couplesOf.get(tc) ?? []).filter((p) => clusterSpouses.includes(p));

      if (i === 0) {
        mergedCluster.push(...tcSpouses);
        mergedCluster.push(tc);
      } else if (i === clusterTwins.length - 1) {
        mergedCluster.push(tc);
        mergedCluster.push(...tcSpouses);
      } else {
        mergedCluster.push(tc);
        mergedCluster.push(...tcSpouses);
      }
    }
    mergedGroups.push(mergedCluster);
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

  mergedGroups.sort((a, b) => {
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

  return mergedGroups.flat();
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

function applyBarycenterHeuristic<T extends LayoutNode>(
  nodes: T[],
  edges: LayoutEdge[],
  genOf: Map<string, number>,
  adj: ReturnType<typeof buildAdjacency>,
  nodeGap: number,
  hSpacing: number,
  twinGapMono = NODE_SIZE * 0.55,
  twinGapDizygotic = NODE_SIZE * 0.8
): T[] {
  const genGroups = new Map<number, T[]>();
  for (const n of nodes) {
    const gen = genOf.get(n.id) ?? 0;
    if (!genGroups.has(gen)) genGroups.set(gen, []);
    genGroups.get(gen)!.push(n);
  }

  const sortedGens = [...genGroups.keys()].sort((a, b) => a - b);
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  for (let pass = 0; pass < 2; pass++) {
    const sweepOrder = pass % 2 === 0 ? sortedGens : [...sortedGens].reverse();

    for (const gen of sweepOrder) {
      const genNodes = genGroups.get(gen) ?? [];
      if (genNodes.length <= 1) continue;

      const hasPinnedInGen = genNodes.some(n => n.pinned);
      if (hasPinnedInGen) continue;

      let components: T[][] = [];
      const visited = new Set<string>();

      genNodes.sort((a, b) => a.x - b.x);

      for (const n of genNodes) {
        if (visited.has(n.id)) continue;

        const comp: T[] = [];
        const queue = [n];
        visited.add(n.id);
        let head = 0;
        while (head < queue.length) {
          const curr = queue[head]!;
          head++;
          comp.push(curr);

          const partners = adj.couplesOf.get(curr.id) ?? [];
          const twins = adj.twinsOf.get(curr.id) ?? [];
          const neighbors = [...partners, ...twins];

          for (const neighId of neighbors) {
            if (!visited.has(neighId)) {
              const neighNode = nodeMap.get(neighId);
              if (neighNode && genOf.get(neighId) === gen) {
                visited.add(neighId);
                queue.push(neighNode as T);
              }
            }
          }
        }
        components.push(comp);
      }

      const componentBarycenters = new Map<T[], number>();

      for (const comp of components) {
        let sumX = 0;
        let count = 0;

        for (const node of comp) {
          const parents = adj.parentsOf.get(node.id) ?? [];
          const children = adj.childrenOf.get(node.id) ?? [];
          const neighbors = [...parents, ...children];

          for (const neighId of neighbors) {
            const neighNode = nodeMap.get(neighId);
            if (neighNode) {
              sumX += neighNode.x;
              count++;
            }
          }
        }

        const bary = count > 0 ? sumX / count : comp.reduce((sum, n) => sum + n.x, 0) / comp.length;
        componentBarycenters.set(comp, bary);
      }

      const compInitialIndex = new Map<T[], number>();
      components.forEach((comp, idx) => {
        compInitialIndex.set(comp, idx);
      });

      // Group sibling components (sharing exact same parents) into clusters.
      // Non-sibling components (founders or unknown parentage) each get their own unique cluster.
      const clusters = new Map<string, T[][]>();
      let uniqueCounter = 0;
      components.forEach(comp => {
        let parentKey = "";
        const nodesWithParents = comp.filter(n => {
          const pIds = adj.parentsOf.get(n.id);
          return pIds && pIds.length > 0;
        });


        if (nodesWithParents.length === 1) {
          const pIds = adj.parentsOf.get(nodesWithParents[0]!.id)!;
          parentKey = [...pIds].sort().join("_");
        } else if (nodesWithParents.length > 1) {
          // Cousin marriage: multiple nodes have parents.
          // Deterministically select one to anchor to their sibling group.
          // We prefer the female partner, falling back to ID sorting.
          const femaleNode = nodesWithParents.find(n => n.type === "female");
          const anchorNode = femaleNode ?? [...nodesWithParents].sort((a, b) => a.id.localeCompare(b.id))[0]!;
          const pIds = adj.parentsOf.get(anchorNode.id)!;
          parentKey = [...pIds].sort().join("_");
        }

        const clusterKey = parentKey ? `siblings_${parentKey}` : `unique_${uniqueCounter++}_${compInitialIndex.get(comp)}`;
        if (!clusters.has(clusterKey)) {
          clusters.set(clusterKey, []);
        }
        clusters.get(clusterKey)!.push(comp);
      });

      const clusterList = Array.from(clusters.entries()).map(([key, comps]) => {
        comps.sort((a, b) => {
          const ba = componentBarycenters.get(a)!;
          const bb = componentBarycenters.get(b)!;
          if (Math.abs(ba - bb) < 0.1) {
            return compInitialIndex.get(a)! - compInitialIndex.get(b)!;
          }
          return ba - bb;
        });
        const sumBary = comps.reduce((sum, comp) => sum + componentBarycenters.get(comp)!, 0);
        const avgBary = sumBary / comps.length;
        return { key, comps, barycenter: avgBary, minInitialIndex: compInitialIndex.get(comps[0]!)! };
      });

      clusterList.sort((a, b) => {
        if (Math.abs(a.barycenter - b.barycenter) < 0.1) {
          return a.minInitialIndex - b.minInitialIndex;
        }
        return a.barycenter - b.barycenter;
      });

      components = clusterList.flatMap(c => c.comps);

      let currentX = genNodes.reduce((min, n) => Math.min(min, n.x), Infinity);
      const newNodesOrder = components.flat();

      for (let i = 0; i < newNodesOrder.length; i++) {
        const node = newNodesOrder[i]!;
        if (i > 0) {
          const prev = newNodesOrder[i - 1]!;
          const twin1 = getTwinInfo(node.id, adj.twinGroupOf, adj.twinTypeOf);
          const twin2 = getTwinInfo(prev.id, adj.twinGroupOf, adj.twinTypeOf);
          const areTwins = twin1 && twin2 && twin1.group === twin2.group;

          const isCouple = (adj.couplesOf.get(node.id) ?? []).includes(prev.id);
          let gap = isCouple ? nodeGap : hSpacing;
          if (areTwins) {
            gap = twin1.type === "m" ? twinGapMono : twinGapDizygotic;
          }
          currentX += gap;
        }
        node.x = currentX;
      }
    }
  }

  return nodes;
}

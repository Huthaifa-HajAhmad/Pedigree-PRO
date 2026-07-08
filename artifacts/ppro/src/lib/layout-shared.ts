import { PedigreeNode, PedigreeEdge, NODE_GAP, NODE_SIZE, GEN_GRID } from "@/features/pedigree-editor/canvas/types";

export interface LayoutConfig {
  nodeSize: number;
  nodeGap: number;
  genGrid: number;
  hSpacing: number;
  coupleSpacing: number;
  twinGapMono: number;
  twinGapDizygotic: number;
  groupGap: number;
  canvasCenterX: number;
  rowTolerance: number;
}

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  nodeSize: NODE_SIZE,
  nodeGap: NODE_GAP,
  genGrid: GEN_GRID,
  hSpacing: Math.round(NODE_GAP * 110 / 96.8), // 110
  coupleSpacing: NODE_GAP, // 96.8
  twinGapMono: NODE_SIZE * 0.55, // 24.2
  twinGapDizygotic: NODE_SIZE * 0.8, // 35.2
  groupGap: Math.round(NODE_GAP * 1.3), // 126
  canvasCenterX: 700,
  rowTolerance: GEN_GRID / 2, // 60
};

export interface AdjacencyMaps {
  childrenOf: Map<string, string[]>;
  parentsOf: Map<string, string[]>;
  couplesOf: Map<string, string[]>;
  twinsOf: Map<string, string[]>;
  twinTypeOf: Map<string, "m" | "d" | undefined>;
  twinGroupOf: Map<string, string | undefined>;
}

export interface LayoutQuality {
  collisionCount: number;
  totalEdgeLength: number;
  centeringDeviation: number;
}

/**
 * Builds static adjacency maps from a set of nodes and edges.
 */
export function buildAdjacency(nodes: Array<{ id: string }>, edges: PedigreeEdge[]): AdjacencyMaps {
  const nodeIds = new Set(nodes.map(n => n.id));
  const childrenOf = new Map<string, string[]>();
  const parentsOf = new Map<string, string[]>();
  const couplesOf = new Map<string, string[]>();
  const twinsOf = new Map<string, string[]>();
  const twinTypeOf = new Map<string, "m" | "d" | undefined>();
  const twinGroupOf = new Map<string, string | undefined>();

  for (const n of nodes) {
    childrenOf.set(n.id, []);
    parentsOf.set(n.id, []);
    couplesOf.set(n.id, []);
    twinsOf.set(n.id, []);
  }

  const seenEdges = new Set<string>();
  const twinGroupMap = new Map<string, { group: string; type?: "m" | "d" }>();

  for (const e of edges) {
    if (!nodeIds.has(e.sourceId) || !nodeIds.has(e.targetId)) continue;
    if (e.sourceId === e.targetId) continue; // Skip self-loops

    const edgeKey = `${e.type}:${e.sourceId}:${e.targetId}`;
    if (seenEdges.has(edgeKey)) continue; // Skip duplicate edges
    seenEdges.add(edgeKey);

    if (e.type === "parent-child") {
      const kids = childrenOf.get(e.sourceId)!;
      if (!kids.includes(e.targetId)) kids.push(e.targetId);

      const parents = parentsOf.get(e.targetId)!;
      if (!parents.includes(e.sourceId)) parents.push(e.sourceId);

      if (e.twinGroup) {
        twinGroupMap.set(e.targetId, { group: e.twinGroup, type: e.twinType });
      }
    }
    if (e.type === "couple" || e.type === "consanguinity" || e.type === "divorced" || e.type === "separated") {
      const c1 = couplesOf.get(e.sourceId)!;
      if (!c1.includes(e.targetId)) c1.push(e.targetId);

      const c2 = couplesOf.get(e.targetId)!;
      if (!c2.includes(e.sourceId)) c2.push(e.sourceId);
    }
  }

  // Build twinsOf and twinTypeOf maps
  const groups = new Map<string, string[]>();
  for (const [nodeId, twinInfo] of twinGroupMap.entries()) {
    if (!groups.has(twinInfo.group)) {
      groups.set(twinInfo.group, []);
    }
    groups.get(twinInfo.group)!.push(nodeId);
    twinTypeOf.set(nodeId, twinInfo.type);
    twinGroupOf.set(nodeId, twinInfo.group);
  }

  for (const [, members] of groups.entries()) {
    for (const m of members) {
      twinsOf.set(m, members.filter(id => id !== m));
    }
  }

  return { childrenOf, parentsOf, couplesOf, twinsOf, twinTypeOf, twinGroupOf };
}

/**
 * Builds node-to-generation maps using BFS & generation propagation with cyclic bounds checking.
 */
export function buildGenerations(nodes: Array<{ id: string }>, edges: PedigreeEdge[]): Map<string, number> {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const childrenOf = new Map<string, string[]>();
  const parentsOf = new Map<string, string[]>();
  const couplesOf = new Map<string, string[]>();

  for (const n of nodes) {
    childrenOf.set(n.id, []);
    parentsOf.set(n.id, []);
    couplesOf.set(n.id, []);
  }

  const seenEdges = new Set<string>();

  for (const e of edges) {
    if (!nodeMap.has(e.sourceId) || !nodeMap.has(e.targetId)) continue;
    if (e.sourceId === e.targetId) continue;

    const edgeKey = `${e.type}:${e.sourceId}:${e.targetId}`;
    if (seenEdges.has(edgeKey)) continue;
    seenEdges.add(edgeKey);

    if (e.type === "parent-child") {
      childrenOf.get(e.sourceId)!.push(e.targetId);
      parentsOf.get(e.targetId)!.push(e.sourceId);
    }
    if (e.type === "couple" || e.type === "consanguinity" || e.type === "divorced" || e.type === "separated") {
      couplesOf.get(e.sourceId)!.push(e.targetId);
      couplesOf.get(e.targetId)!.push(e.sourceId);
    }
  }

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

  // Disconnected nodes -> generation 0
  for (const n of nodes) {
    if (!genOf.has(n.id)) genOf.set(n.id, 0);
  }

  // Propagation loop with boundary cap
  let stable = false;
  let safety = 0;
  const MAX_GEN = nodes.length + 1;
  while (!stable && safety++ < 100) {
    stable = true;
    let cycleDetected = false;

    for (const n of nodes) {
      const myGen = genOf.get(n.id) ?? 0;

      // 1. Spouse alignment
      for (const partnerId of couplesOf.get(n.id) ?? []) {
        const partnerGen = genOf.get(partnerId) ?? 0;
        if (partnerGen !== myGen) {
          const hasParentsSelf = (parentsOf.get(n.id) ?? []).length > 0;
          const hasParentsPartner = (parentsOf.get(partnerId) ?? []).length > 0;
          
          if ((hasParentsSelf && hasParentsPartner) || (!hasParentsSelf && !hasParentsPartner)) {
            const max = Math.max(myGen, partnerGen);
            if (max > MAX_GEN) {
              cycleDetected = true;
              break;
            }
            genOf.set(n.id, max);
            genOf.set(partnerId, max);
            stable = false;
          } else {
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
      if (cycleDetected) break;

      // 2. Downward child propagation
      for (const childId of childrenOf.get(n.id) ?? []) {
        const childGen = genOf.get(childId) ?? 0;
        if (childGen < myGen + 1) {
          const nextGen = myGen + 1;
          if (nextGen > MAX_GEN) {
            cycleDetected = true;
            break;
          }
          genOf.set(childId, nextGen);
          stable = false;
        }
      }
      if (cycleDetected) break;

      // 3. Upward parent propagation
      for (const parentId of parentsOf.get(n.id) ?? []) {
        const parentGen = genOf.get(parentId) ?? 0;
        if (parentGen < myGen - 1) {
          const nextGen = myGen - 1;
          genOf.set(parentId, nextGen);
          stable = false;
        } else if (parentGen > myGen) {
          const parentHasParents = (parentsOf.get(parentId) ?? []).length > 0;
          if (parentHasParents) {
            genOf.set(parentId, myGen);
            stable = false;
          }
        }
      }
      if (cycleDetected) break;
    }

    if (cycleDetected) {
      // Clamp generations to a maximum of 3 when a cycle is detected
      for (const [id, gen] of genOf.entries()) {
        if (gen > 3) {
          genOf.set(id, 3);
        }
      }
      stable = true;
    }
  }

  // Compact and normalize generations
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

  return genOf;
}

export function buildNodeMap<T extends { id: string }>(nodes: T[]): Map<string, T> {
  return new Map(nodes.map(n => [n.id, n]));
}

/**
 * Evaluates the visual quality of a pedigree layout.
 */
export function evaluateLayoutQuality(
  nodes: PedigreeNode[],
  edges: PedigreeEdge[],
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG
): LayoutQuality {
  const nodeMap = buildNodeMap(nodes);
  const adj = buildAdjacency(nodes, edges);

  // Group nodes by Y row (snapped by rowTolerance)
  const rowMap = new Map<number, PedigreeNode[]>();
  for (const n of nodes) {
    const rY = Math.round(n.y / config.rowTolerance) * config.rowTolerance;
    if (!rowMap.has(rY)) rowMap.set(rY, []);
    rowMap.get(rY)!.push(n);
  }

  // 1. Calculate collisions
  let collisionCount = 0;
  const minGap = config.nodeGap - 0.05;
  for (const [, rowNodes] of rowMap) {
    rowNodes.sort((a, b) => a.x - b.x);
    for (let i = 0; i < rowNodes.length - 1; i++) {
      const n1 = rowNodes[i]!;
      const n2 = rowNodes[i + 1]!;
      if (n2.x - n1.x < minGap) {
        collisionCount++;
      }
    }
  }

  // 2. Calculate edge length cost
  let totalEdgeLength = 0;
  for (const e of edges) {
    const n1 = nodeMap.get(e.sourceId);
    const n2 = nodeMap.get(e.targetId);
    if (!n1 || !n2) continue;
    totalEdgeLength += Math.abs(n1.x - n2.x);
  }

  // 3. Calculate parent centering deviation
  let totalCenteringDeviation = 0;
  let childWithTwoParentsCount = 0;
  for (const child of nodes) {
    const parents = adj.parentsOf.get(child.id) ?? [];
    if (parents.length === 2) {
      const p1 = nodeMap.get(parents[0]!);
      const p2 = nodeMap.get(parents[1]!);
      if (p1 && p2) {
        const midpoint = (p1.x + p2.x) / 2;
        totalCenteringDeviation += Math.abs(child.x - midpoint);
        childWithTwoParentsCount++;
      }
    }
  }

  return {
    collisionCount,
    totalEdgeLength,
    centeringDeviation: childWithTwoParentsCount > 0 ? totalCenteringDeviation / childWithTwoParentsCount : 0
  };
}

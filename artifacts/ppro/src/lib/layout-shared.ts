import { NODE_GAP, NODE_SIZE, GEN_GRID } from "@/features/pedigree-editor/canvas/types";

export const EPSILON = 0.05;
export const ROW_JITTER_THRESHOLD = 20;
export const FLOAT_TOLERANCE = 0.01;

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
  enableCache?: boolean;
  crossingMinimizationSweeps?: number;
  edgeArcRadius?: number;
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
  enableCache: true,
  crossingMinimizationSweeps: 15,
  edgeArcRadius: 6,
};

export interface AdjacencyMaps {
  childrenOf: Map<string, string[]>;
  parentsOf: Map<string, string[]>;
  couplesOf: Map<string, string[]>;
  twinsOf: Map<string, string[]>;
  twinTypeOf: Map<string, "m" | "d" | undefined>;
  twinGroupOf: Map<string, string | undefined>;
}

export type EdgeType = "couple" | "parent-child" | "consanguinity" | "divorced" | "separated";

export interface EdgeSubset {
  id: string;
  sourceId: string;
  targetId: string;
  type: EdgeType;
  twinType?: "m" | "d";
  twinGroup?: string;
  inverted?: boolean;
}

export type NodeType = "male" | "female" | "unknown" | "pregnancy" | "sab";

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  type?: NodeType;
  pinned?: boolean;
  color2?: string;
}

export interface LayoutQuality {
  collisionCount: number;
  totalEdgeLength: number;
  centeringDeviation: number;
}

/**
 * Builds static adjacency maps from a set of nodes and edges.
 */
export function buildAdjacency(nodes: Array<{ id: string }>, edges: EdgeSubset[]): AdjacencyMaps {
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

export interface FamilyGroup {
  parentIds: string[];
  childIds: string[];
}

/**
 * Standardized family grouping helper to avoid duplication.
 */
export function groupFamiliesByParents(parentsMap: Map<string, string[]>): FamilyGroup[] {
  const families = new Map<string, { parentIds: string[]; childIds: string[] }>();
  for (const [childId, pIds] of parentsMap.entries()) {
    if (pIds.length === 0) continue;
    const key = [...pIds].sort().join("_");
    if (!families.has(key)) {
      families.set(key, { parentIds: [...pIds].sort(), childIds: [] });
    }
    families.get(key)!.childIds.push(childId);
  }
  return Array.from(families.values());
}

/**
 * Precomputes descendant node ID sets for all nodes using memoized DFS with cycle detection.
 * This runs in O(N + E) time and is built once at the entry of layout functions.
 */
export function buildDescendantsMap(adj: AdjacencyMaps): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const visiting = new Set<string>();

  function getDescendants(nodeId: string): Set<string> {
    if (map.has(nodeId)) {
      return map.get(nodeId)!;
    }
    if (visiting.has(nodeId)) {
      return new Set(); // Prevent infinite recursion on malformed cyclic data
    }
    visiting.add(nodeId);
    
    const set = new Set<string>();
    const children = adj.childrenOf.get(nodeId) ?? [];
    for (const childId of children) {
      set.add(childId);
      const childDesc = getDescendants(childId);
      for (const d of childDesc) {
        set.add(d);
      }
    }
    
    visiting.delete(nodeId);
    map.set(nodeId, set);
    return set;
  }

  const allNodes = new Set([
    ...adj.childrenOf.keys(),
    ...adj.parentsOf.keys(),
    ...adj.couplesOf.keys()
  ]);
  for (const nodeId of allNodes) {
    getDescendants(nodeId);
  }
  return map;
}

/**
 * Builds node-to-generation maps using BFS & generation propagation with cyclic bounds checking.
 */
export function buildGenerations(nodes: Array<{ id: string }>, edges: EdgeSubset[]): Map<string, number> {
  
  // 1. Build basic childrenOf, parentsOf, and couplesOf mappings
  const { childrenOf, parentsOf, couplesOf } = buildAdjacency(nodes, edges);

  // 2. Identify couple components (spouses must reside in the same generation component if both or neither have parents)
  const componentOf = new Map<string, string>(); // nodeId -> componentId
  const componentMembers = new Map<string, string[]>(); // componentId -> nodeIds

  const visitedComponents = new Set<string>();
  for (const n of nodes) {
    if (visitedComponents.has(n.id)) continue;
    // BFS to find all connected couple partners
    const componentId = n.id;
    const members: string[] = [];
    const queue = [n.id];
    visitedComponents.add(n.id);
    
    let head = 0;
    while (head < queue.length) {
      const curr = queue[head]!;
      head++;
      members.push(curr);
      componentOf.set(curr, componentId);
      for (const partner of couplesOf.get(curr) ?? []) {
        const hasParentsSelf = (parentsOf.get(curr) ?? []).length > 0;
        const hasParentsPartner = (parentsOf.get(partner) ?? []).length > 0;
        const bothOrNeither = (hasParentsSelf && hasParentsPartner) || (!hasParentsSelf && !hasParentsPartner);
        if (bothOrNeither && !visitedComponents.has(partner)) {
          visitedComponents.add(partner);
          queue.push(partner);
        }
      }
    }
    componentMembers.set(componentId, members);
  }

  // 3. Build DAG between couple components
  const compChildren = new Map<string, Set<string>>(); // compId -> Set of child compIds
  const compParents = new Map<string, Set<string>>(); // compId -> Set of parent compIds
  const compInDegree = new Map<string, number>();

  for (const compId of componentMembers.keys()) {
    compChildren.set(compId, new Set());
    compParents.set(compId, new Set());
    compInDegree.set(compId, 0);
  }

  for (const n of nodes) {
    const parentComp = componentOf.get(n.id)!;
    for (const childId of childrenOf.get(n.id) ?? []) {
      const childComp = componentOf.get(childId)!;
      if (parentComp !== childComp) {
        if (!compChildren.get(parentComp)!.has(childComp)) {
          compChildren.get(parentComp)!.add(childComp);
          compParents.get(childComp)!.add(parentComp);
        }
      }
    }
  }

  // Calculate in-degrees
  for (const [compId, parents] of compParents.entries()) {
    compInDegree.set(compId, parents.size);
  }

  // 4. Run longest-path generation assignment (DAG BFS / topological order)
  const compGen = new Map<string, number>();
  for (const compId of componentMembers.keys()) {
    compGen.set(compId, 0);
  }

  // Topological sort queue
  const queue: string[] = [];
  for (const [compId, inDegree] of compInDegree.entries()) {
    if (inDegree === 0) {
      queue.push(compId);
    }
  }

  let head = 0;
  const topoOrder: string[] = [];

  while (true) {
    while (head < queue.length) {
      const u = queue[head]!;
      head++;
      topoOrder.push(u);
      const uGen = compGen.get(u)!;

      for (const v of compChildren.get(u) ?? []) {
        const nextGen = uGen + 1;
        if (nextGen > compGen.get(v)!) {
          compGen.set(v, nextGen);
        }
        const newInDegree = compInDegree.get(v)! - 1;
        compInDegree.set(v, newInDegree);
        if (newInDegree === 0) {
          queue.push(v);
        }
      }
    }

    if (topoOrder.length === componentMembers.size) {
      break;
    }

    // We have a cycle. Find an unprocessed component to break the cycle.
    // We pick the one with the minimum remaining in-degree > 0.
    let bestCompId: string | null = null;
    let minRemainingInDegree = Infinity;
    for (const [compId, inDegree] of compInDegree.entries()) {
      if (inDegree > 0 && inDegree < minRemainingInDegree) {
        minRemainingInDegree = inDegree;
        bestCompId = compId;
      }
    }

    if (!bestCompId) {
      break;
    }

    // Break the cycle at bestCompId:
    let maxParentGen = -1;
    for (const parentCompId of compParents.get(bestCompId) ?? []) {
      if (topoOrder.includes(parentCompId)) {
        maxParentGen = Math.max(maxParentGen, compGen.get(parentCompId)!);
      }
    }
    compGen.set(bestCompId, maxParentGen !== -1 ? maxParentGen + 1 : 0);
    compInDegree.set(bestCompId, 0);
    queue.push(bestCompId);
  }

  // Upward propagation pass to ensure parentGen >= childGen - 1
  for (let i = topoOrder.length - 1; i >= 0; i--) {
    const u = topoOrder[i]!;
    const uGen = compGen.get(u)!;
    for (const p of compParents.get(u) ?? []) {
      const minParentGen = uGen - 1;
      if (compGen.get(p)! < minParentGen) {
        compGen.set(p, minParentGen);
      }
    }
  }

  // 5. Map component generations back to individual nodes
  const genOf = new Map<string, number>();
  for (const [compId, members] of componentMembers.entries()) {
    const gen = compGen.get(compId) ?? 0;
    for (const m of members) {
      genOf.set(m, gen);
    }
  }

  // 5.5. Align couple partners and propagate generation changes to descendants/parents (NEW-7)
  let changed = true;
  let iterations = 0;
  const maxIterations = nodes.length * 2;
  while (changed && iterations < maxIterations) {
    changed = false;
    
    // Spouses must be on the same generation
    for (const e of edges) {
      if (e.type === "couple" || e.type === "consanguinity" || e.type === "divorced" || e.type === "separated") {
        const genA = genOf.get(e.sourceId) ?? 0;
        const genB = genOf.get(e.targetId) ?? 0;
        if (genA !== genB) {
          const maxGen = Math.max(genA, genB);
          genOf.set(e.sourceId, maxGen);
          genOf.set(e.targetId, maxGen);
          changed = true;
        }
      }
    }
    
    // Children must be at least one generation below parents
    for (const e of edges) {
      if (e.type === "parent-child") {
        const parentGen = genOf.get(e.sourceId) ?? 0;
        const childGen = genOf.get(e.targetId) ?? 0;
        if (childGen < parentGen + 1) {
          genOf.set(e.targetId, parentGen + 1);
          changed = true;
        }
      }
    }
    
    iterations++;
  }

  // 6. Compact and normalize generations
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
  nodes: LayoutNode[],
  edges: EdgeSubset[],
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG
): LayoutQuality {
  const nodeMap = buildNodeMap(nodes);
  const adj = buildAdjacency(nodes, edges);

  // Group nodes by Y row (snapped by rowTolerance)
  const rowMap = new Map<number, LayoutNode[]>();
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

export function evaluateCostAwareInversion(
  nodeId1: string,
  nodeId2: string,
  nodeMap: Map<string, LayoutNode>,
  parentsOf: Map<string, string[]>,
  childrenOf: Map<string, string[]>,
  knownPos?: Map<string, { x: number; y: number }>
): boolean {
  const n1 = nodeMap.get(nodeId1);
  const n2 = nodeMap.get(nodeId2);
  if (!n1 || !n2) return false;

  const getNeighborAvgX = (nodeId: string, spouseId: string) => {
    const parentIds = parentsOf.get(nodeId) ?? [];
    
    // Find children with other spouses
    const otherChildrenIds: string[] = [];
    const childrenIds = childrenOf.get(nodeId) ?? [];
    for (const cId of childrenIds) {
      const pIds = parentsOf.get(cId) ?? [];
      if (pIds.length === 2 && !pIds.includes(spouseId)) {
        otherChildrenIds.push(cId);
      }
    }

    const neighborIds = [...parentIds, ...otherChildrenIds];
    if (neighborIds.length === 0) return undefined;

    let sumX = 0;
    let count = 0;
    for (const id of neighborIds) {
      const pos = knownPos?.get(id) ?? nodeMap.get(id);
      if (pos) {
        sumX += pos.x;
        count++;
      }
    }
    return count > 0 ? sumX / count : undefined;
  };

  const avgX1 = getNeighborAvgX(nodeId1, nodeId2);
  const avgX2 = getNeighborAvgX(nodeId2, nodeId1);

  if (avgX1 !== undefined && avgX2 !== undefined) {
    const isNode1Male = n1.type === "male";
    if (isNode1Male) {
      // Normal: male on left of female -> male.x < female.x -> avgX1 < avgX2
      // Inverted: female on left of male -> female.x < male.x -> avgX2 < avgX1
      return avgX1 > avgX2;
    } else {
      // Normal: female on right of male -> female.x > male.x -> avgX1 > avgX2
      // Inverted: female on left of male -> female.x < male.x -> avgX1 < avgX2
      return avgX1 < avgX2;
    }
  }

  return false;
}

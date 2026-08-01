import { LayoutNode, EdgeSubset, buildAdjacency } from "./layout-shared";

function lineSegmentsCross(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number
): boolean {
  const ccw = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) => {
    return (ry - py) * (qx - px) > (qy - py) * (rx - px);
  };
  return ccw(ax, ay, cx, cy, dx, dy) !== ccw(bx, by, cx, cy, dx, dy) &&
         ccw(ax, ay, bx, by, cx, cy) !== ccw(ax, ay, bx, by, dx, dy);
}

function countIncidentCrossings(
  nodes: LayoutNode[],
  edges: EdgeSubset[],
  dynamicNodeIds: Set<string>
): number {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const dynamicSegments: { ax: number; ay: number; bx: number; by: number }[] = [];
  const staticSegments: { ax: number; ay: number; bx: number; by: number }[] = [];

  for (const e of edges) {
    const n1 = nodeMap.get(e.sourceId);
    const n2 = nodeMap.get(e.targetId);
    if (n1 && n2) {
      const isDynamic = dynamicNodeIds.has(e.sourceId) || dynamicNodeIds.has(e.targetId);
      const seg = { ax: n1.x, ay: n1.y, bx: n2.x, by: n2.y };
      if (isDynamic) {
        dynamicSegments.push(seg);
      } else {
        staticSegments.push(seg);
      }
    }
  }

  let crossings = 0;

  // 1. Crossings between dynamic segments and static segments
  for (const s1 of dynamicSegments) {
    for (const s2 of staticSegments) {
      if (s1.ax === s2.ax && s1.ay === s2.ay) continue;
      if (s1.ax === s2.bx && s1.ay === s2.by) continue;
      if (s1.bx === s2.ax && s1.by === s2.ay) continue;
      if (s1.bx === s2.bx && s1.by === s2.by) continue;

      if (lineSegmentsCross(s1.ax, s1.ay, s1.bx, s1.by, s2.ax, s2.ay, s2.bx, s2.by)) {
        crossings++;
      }
    }
  }

  // 2. Crossings between two dynamic segments
  for (let i = 0; i < dynamicSegments.length; i++) {
    const s1 = dynamicSegments[i]!;
    for (let j = i + 1; j < dynamicSegments.length; j++) {
      const s2 = dynamicSegments[j]!;
      if (s1.ax === s2.ax && s1.ay === s2.ay) continue;
      if (s1.ax === s2.bx && s1.ay === s2.by) continue;
      if (s1.bx === s2.ax && s1.by === s2.ay) continue;
      if (s1.bx === s2.bx && s1.by === s2.by) continue;

      if (lineSegmentsCross(s1.ax, s1.ay, s1.bx, s1.by, s2.ax, s2.ay, s2.bx, s2.by)) {
        crossings++;
      }
    }
  }

  return crossings;
}

export function minimizeCrossings<T extends LayoutNode>(
  nodes: T[],
  edges: EdgeSubset[],
  genIndexOf?: Map<string, number>,
  excludeIds?: Set<string>,
  maxSweeps = 15
): T[] {
  if (!genIndexOf) return nodes;

  const adj = buildAdjacency(nodes, edges);
  const result = nodes.map(n => ({ ...n }));
  const resultNodeMap = new Map(result.map(n => [n.id, n]));

  const getResultCrossings = (dynamicNodeIds: Set<string>) => {
    return countIncidentCrossings(result, edges, dynamicNodeIds);
  };

  const activeExclude = excludeIds ?? new Set<string>();

  // Group nodes by generation
  const genGroups = new Map<number, T[]>();
  for (const n of nodes) {
    const gen = genIndexOf.get(n.id);
    if (gen !== undefined) {
      if (!genGroups.has(gen)) genGroups.set(gen, []);
      genGroups.get(gen)!.push(n);
    }
  }

  for (const [gen, genNodes] of genGroups.entries()) {
    if (genNodes.length <= 1) continue;

    // Group into contiguous clusters (couples and twins)
    const visited = new Set<string>();
    const clusters: T[][] = [];

    // Sort initially by X coordinate
    const sortedGenNodes = [...genNodes].sort((a, b) => {
      const na = resultNodeMap.get(a.id)!;
      const nb = resultNodeMap.get(b.id)!;
      return na.x - nb.x;
    });

    for (const n of sortedGenNodes) {
      if (visited.has(n.id)) continue;
      const cluster: T[] = [];
      const queue = [n.id];
      visited.add(n.id);
      let head = 0;
      while (head < queue.length) {
        const currId = queue[head]!;
        head++;
        const currNode = resultNodeMap.get(currId)!;
        cluster.push(currNode);

        const partners = adj.couplesOf.get(currId) ?? [];
        const twins = adj.twinsOf.get(currId) ?? [];
        const neighbors = [...partners, ...twins];

        for (const neighId of neighbors) {
          if (!visited.has(neighId)) {
            const neighNode = resultNodeMap.get(neighId);
            if (neighNode && genIndexOf.get(neighId) === gen) {
              visited.add(neighId);
              queue.push(neighId);
            }
          }
        }
      }
      clusters.push(cluster);
    }

    if (clusters.length <= 1) continue;

    let changed = true;
    let sweeps = 0;
    while (changed && sweeps < maxSweeps) {
      changed = false;
      sweeps++;

      for (let i = 0; i < clusters.length - 1; i++) {
        const c1 = clusters[i]!;
        const c2 = clusters[i + 1]!;

        const hasPinned = c1.some(n => n.pinned || activeExclude.has(n.id)) ||
                          c2.some(n => n.pinned || activeExclude.has(n.id));
        if (hasPinned) continue;

        const dynamicNodeIds = new Set<string>();
        c1.forEach(n => dynamicNodeIds.add(n.id));
        c2.forEach(n => dynamicNodeIds.add(n.id));

        const initialCrossings = getResultCrossings(dynamicNodeIds);

        const c1Xs = c1.map(n => n.x);
        const c2Xs = c2.map(n => n.x);
        const minX1 = Math.min(...c1Xs);
        const maxX1 = Math.max(...c1Xs);
        const minX2 = Math.min(...c2Xs);
        const maxX2 = Math.max(...c2Xs);

        const c1Offsets = c1.map(n => n.x - minX1);
        const c2Offsets = c2.map(n => n.x - minX2);

        const totalWidth2 = maxX2 - minX2;
        const gap = minX2 - maxX1;

        const newMinX2 = minX1;
        const newMinX1 = minX1 + totalWidth2 + gap;

        c1.forEach((n, idx) => { n.x = newMinX1 + c1Offsets[idx]!; });
        c2.forEach((n, idx) => { n.x = newMinX2 + c2Offsets[idx]!; });

        const swappedCrossings = getResultCrossings(dynamicNodeIds);

        if (swappedCrossings < initialCrossings) {
          clusters[i] = c2;
          clusters[i + 1] = c1;
          changed = true;
        } else {
          c1.forEach((n, idx) => { n.x = minX1 + c1Offsets[idx]!; });
          c2.forEach((n, idx) => { n.x = minX2 + c2Offsets[idx]!; });
        }
      }
    }
  }

  return result;
}

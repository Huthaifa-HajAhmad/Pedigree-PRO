import type { PedigreeNode, PedigreeAnnotation, PedigreeEdge } from "./types";

const ROW_TOLERANCE = 30; // standard tolerance to group nodes on the same horizontal row

/**
 * Finds all nodes horizontally between n1 and n2 on the same generation row.
 */
export function getIntermediateNodes(
  n1: PedigreeNode,
  n2: PedigreeNode,
  allNodes: PedigreeNode[],
  renderOffsets?: Map<string, number>
): PedigreeNode[] {
  const y1 = n1.y + (renderOffsets?.get(n1.id) ?? 0);
  const y2 = n2.y + (renderOffsets?.get(n2.id) ?? 0);

  // They must be on approximately the same row
  if (Math.abs(y1 - y2) > ROW_TOLERANCE) {
    return [];
  }

  const minX = Math.min(n1.x, n2.x);
  const maxX = Math.max(n1.x, n2.x);

  return allNodes.filter((n) => {
    if (n.id === n1.id || n.id === n2.id) return false;
    const ny = n.y + (renderOffsets?.get(n.id) ?? 0);
    // Same row, and horizontally in between (with small margin to avoid floating point matches)
    return Math.abs(ny - y1) <= ROW_TOLERANCE && n.x > minX + 5 && n.x < maxX - 5;
  });
}

/**
 * Computes the vertical height occupied by a node's labels below the node box.
 */
export function computeLabelBelowHeight(node: PedigreeNode, autoLabel?: string): number {
  let h = 0;
  if (autoLabel) h = 13;
  if (node.label) h = autoLabel ? 24 : 14;
  if (node.age || node.dob) h += 11;
  if (node.condition) h += 11;
  return h;
}

/**
 * Computes the lowest coordinate (Y) of annotations/labels for a group of nodes.
 */
export function computeAnnotationMaxBottom(
  parentIds: string[],
  annotations: PedigreeAnnotation[],
  nodeMap: Map<string, PedigreeNode>,
  S: number,
  showAutoLabels: boolean,
  autoLabels?: Map<string, string>,
  parentOffsets?: Map<string, number>,
): number {
  let maxBottom = -Infinity;
  const parentBelowMap = new Map<string, PedigreeAnnotation[]>();
  for (const ann of annotations) {
    if (parentIds.includes(ann.nodeId) && ann.position === "below" && !ann.hidden) {
      if (!parentBelowMap.has(ann.nodeId)) parentBelowMap.set(ann.nodeId, []);
      parentBelowMap.get(ann.nodeId)!.push(ann);
    }
  }
  for (const [, anns] of parentBelowMap) {
    const pid = anns[0]!.nodeId;
    const p = nodeMap.get(pid);
    if (!p) continue;
    const pOff = parentOffsets?.get(pid) ?? 0;
    const autoLabel = showAutoLabels ? autoLabels?.get(p.id) : undefined;
    const labelH = computeLabelBelowHeight(p, autoLabel);
    let stackY = p.y + pOff + S / 2 + labelH + 4;
    for (const ann of anns) {
      const fs = ann.fontSize ?? 12;
      const boxH = fs + 8;
      const bottom = stackY + boxH;
      maxBottom = Math.max(maxBottom, bottom);
      stackY += boxH + 5;
    }
  }
  return maxBottom;
}

/**
 * Computes the exact Y coordinate where the bracket relationship line should route horizontally.
 */
export function computeRelationDropY(
  n1: PedigreeNode,
  n2: PedigreeNode,
  intermediateNodes: PedigreeNode[],
  nodes: PedigreeNode[],
  annotations: PedigreeAnnotation[] = [],
  S: number,
  renderOffsets?: Map<string, number>,
  showAutoLabels: boolean = false,
  autoLabels?: Map<string, string>
): number {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const parentIds = [n1.id, n2.id];
  const intermediateNodeIds = intermediateNodes.map((n) => n.id);

  const maxAnnBottom = computeAnnotationMaxBottom(
    [...parentIds, ...intermediateNodeIds],
    annotations,
    nodeMap,
    S,
    showAutoLabels,
    autoLabels,
    renderOffsets
  );

  let maxNodeBottom = -Infinity;
  for (const n of [...parentIds.map((id) => nodeMap.get(id)), ...intermediateNodes].filter(Boolean) as PedigreeNode[]) {
    const nOff = renderOffsets?.get(n.id) ?? 0;
    const autoLabel = showAutoLabels ? autoLabels?.get(n.id) : undefined;
    const labelH = computeLabelBelowHeight(n, autoLabel);
    const bottom = n.y + nOff + S / 2 + labelH;
    maxNodeBottom = Math.max(maxNodeBottom, bottom);
  }

  const maxBottom = Math.max(maxNodeBottom, maxAnnBottom);
  return maxBottom + 12; // yDrop is 12px below the lowest label/annotation
}

/**
 * Greedily assigns a non-conflicting track index (0, 1, 2...) to overlapping relationship loop edges.
 */
export function computeEdgeLoopTrack(
  edgeId: string,
  allEdges: PedigreeEdge[],
  nodes: PedigreeNode[],
  renderOffsets?: Map<string, number>
): number {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const targetEdge = allEdges.find((e) => e.id === edgeId);
  if (!targetEdge) return 0;

  const src = nodeMap.get(targetEdge.sourceId);
  const tgt = nodeMap.get(targetEdge.targetId);
  if (!src || !tgt) return 0;

  const targetY = src.y + (renderOffsets?.get(src.id) ?? 0);

  // Find all loop edges on this row
  const rowLoopEdges = allEdges.filter((e) => {
    if (e.type === "parent-child") return false;
    const sNode = nodeMap.get(e.sourceId);
    const tNode = nodeMap.get(e.targetId);
    if (!sNode || !tNode) return false;

    const sy = sNode.y + (renderOffsets?.get(sNode.id) ?? 0);
    const ty = tNode.y + (renderOffsets?.get(tNode.id) ?? 0);
    if (Math.abs(sy - targetY) > ROW_TOLERANCE || Math.abs(ty - targetY) > ROW_TOLERANCE) return false;

    return getIntermediateNodes(sNode, tNode, nodes, renderOffsets).length > 0;
  });

  // Map to intervals and sort
  const loopIntervals = rowLoopEdges.map((e) => {
    const sNode = nodeMap.get(e.sourceId)!;
    const tNode = nodeMap.get(e.targetId)!;
    const minX = Math.min(sNode.x, tNode.x);
    const maxX = Math.max(sNode.x, tNode.x);
    return { edgeId: e.id, minX, maxX };
  }).sort((a, b) => b.minX - a.minX || (a.maxX - a.minX) - (b.maxX - b.minX));

  // Greedily assign tracks
  const trackMap = new Map<string, number>();
  for (const item of loopIntervals) {
    let track = 0;
    while (true) {
      let conflict = false;
      for (const other of loopIntervals) {
        const otherTrack = trackMap.get(other.edgeId);
        if (otherTrack === track) {
          // Check overlap
          const overlap = Math.max(item.minX, other.minX) < Math.min(item.maxX, other.maxX) - 5;
          if (overlap) {
            conflict = true;
            break;
          }
        }
      }
      if (!conflict) {
        trackMap.set(item.edgeId, track);
        break;
      }
      track++;
    }
  }

  return trackMap.get(edgeId) ?? 0;
}

/**
 * Computes the maximum track index assigned to any loop edge on the given row.
 */
export function computeMaxLoopTrackOnRow(
  rowY: number,
  allEdges: PedigreeEdge[],
  nodes: PedigreeNode[],
  renderOffsets?: Map<string, number>
): number {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Find all loop edges on this row
  const rowLoopEdges = allEdges.filter((e) => {
    if (e.type === "parent-child") return false;
    const sNode = nodeMap.get(e.sourceId);
    const tNode = nodeMap.get(e.targetId);
    if (!sNode || !tNode) return false;

    const sy = sNode.y + (renderOffsets?.get(sNode.id) ?? 0);
    const ty = tNode.y + (renderOffsets?.get(tNode.id) ?? 0);
    if (Math.abs(sy - rowY) > ROW_TOLERANCE || Math.abs(ty - rowY) > ROW_TOLERANCE) return false;

    return getIntermediateNodes(sNode, tNode, nodes, renderOffsets).length > 0;
  });

  if (rowLoopEdges.length === 0) return 0;

  let maxTrack = 0;
  for (const e of rowLoopEdges) {
    const track = computeEdgeLoopTrack(e.id, allEdges, nodes, renderOffsets);
    if (track > maxTrack) maxTrack = track;
  }

  return maxTrack;
}

/**
 * Computes all X coordinates where vertical drop lines intersect a horizontal loop segment.
 */
export function computeCrossingXCoordinates(
  edge: PedigreeEdge,
  yDrop: number,
  leftX: number,
  rightX: number,
  allEdges: PedigreeEdge[],
  nodes: PedigreeNode[],
  renderOffsets?: Map<string, number>,
  S: number = 44,
  showAutoLabels: boolean = false,
  autoLabels?: Map<string, string>
): number[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const crossXs: number[] = [];

  const targetEdge = allEdges.find((e) => e.id === edge.id);
  if (!targetEdge) return [];
  const targetSrc = nodeMap.get(targetEdge.sourceId);
  if (!targetSrc) return [];
  const targetY = targetSrc.y + (renderOffsets?.get(targetSrc.id) ?? 0);

  // 1. Check all other loop edges' vertical drop lines
  for (const other of allEdges) {
    if (other.id === edge.id) continue;
    if (other.type === "parent-child") continue;

    const sNode = nodeMap.get(other.sourceId);
    const tNode = nodeMap.get(other.targetId);
    if (!sNode || !tNode) continue;

    const sy = sNode.y + (renderOffsets?.get(sNode.id) ?? 0);
    const ty = tNode.y + (renderOffsets?.get(tNode.id) ?? 0);
    if (Math.abs(sy - targetY) > ROW_TOLERANCE || Math.abs(ty - targetY) > ROW_TOLERANCE) continue;

    const otherIntermediates = getIntermediateNodes(sNode, tNode, nodes, renderOffsets);
    if (otherIntermediates.length === 0) continue;

    const otherLeftX = Math.min(sNode.x, tNode.x);
    const otherRightX = Math.max(sNode.x, tNode.x);

    // Compute other loop's Y drop
    const otherBaseY = computeRelationDropY(
      sNode,
      tNode,
      otherIntermediates,
      nodes,
      [],
      S,
      renderOffsets,
      showAutoLabels,
      autoLabels
    );
    const otherTrack = computeEdgeLoopTrack(other.id, allEdges, nodes, renderOffsets);
    const otherYDrop = otherBaseY + otherTrack * 8;

    const nodeY = targetY + S / 2;

    const minVal = Math.min(nodeY, otherYDrop);
    const maxVal = Math.max(nodeY, otherYDrop);

    // Check if yDrop lies within the vertical span of the other loop's drop line
    if (yDrop > minVal && yDrop < maxVal) {
      if (otherLeftX > leftX + 5 && otherLeftX < rightX - 5) {
        crossXs.push(otherLeftX);
      }
      if (otherRightX > leftX + 5 && otherRightX < rightX - 5) {
        crossXs.push(otherRightX);
      }
    }
  }

  // 2. Check all family drop lines (midpoint to sibling bar)
  const pcEdges = allEdges.filter((e) => e.type === "parent-child");
  const childParents = new Map<string, string[]>();
  for (const e of pcEdges) {
    if (!childParents.has(e.targetId)) childParents.set(e.targetId, []);
    childParents.get(e.targetId)!.push(e.sourceId);
  }
  const families = new Map<string, { parentIds: string[]; childIds: string[] }>();
  for (const [childId, pIds] of childParents) {
    const key = [...pIds].sort().join("|");
    if (!families.has(key)) families.set(key, { parentIds: [...pIds].sort(), childIds: [] });
    families.get(key)!.childIds.push(childId);
  }

  for (const [, { parentIds, childIds }] of families) {
    const parents = parentIds.map((id) => nodeMap.get(id)).filter((n): n is PedigreeNode => !!n);
    const children = childIds.map((id) => nodeMap.get(id)).filter((n): n is PedigreeNode => !!n);
    if (parents.length === 0 || children.length === 0) continue;

    const py = parents[0]!.y + (renderOffsets?.get(parents[0]!.id) ?? 0);
    if (Math.abs(py - targetY) > ROW_TOLERANCE) continue;

    const childTopY = Math.min(...children.map((c) => c.y + (renderOffsets?.get(c.id) ?? 0))) - S / 2;

    const intermediateNodeIds: string[] = [];
    if (parentIds.length === 2) {
      const intermediates = getIntermediateNodes(parents[0]!, parents[1]!, nodes, renderOffsets);
      for (const n of intermediates) intermediateNodeIds.push(n.id);
    }

    const maxAnnBottom = computeAnnotationMaxBottom(
      [...parentIds, ...intermediateNodeIds],
      [],
      nodeMap,
      S,
      false,
      undefined,
      renderOffsets
    );

    let maxNodeBottom = -Infinity;
    for (const n of [...parentIds.map((id) => nodeMap.get(id)), ...intermediateNodeIds].filter(Boolean) as PedigreeNode[]) {
      const nOff = renderOffsets?.get(n.id) ?? 0;
      const autoLabel = showAutoLabels ? autoLabels?.get(n.id) : undefined;
      const bottom = n.y + nOff + S / 2 + computeLabelBelowHeight(n, autoLabel);
      maxNodeBottom = Math.max(maxNodeBottom, bottom);
    }
    const maxBottom = Math.max(maxNodeBottom, maxAnnBottom);
    const maxTrackIndex = computeMaxLoopTrackOnRow(py, allEdges, nodes, renderOffsets);
    const barY = Math.max(childTopY - 30, maxBottom + 22 + maxTrackIndex * 8);

    let midX = 0;
    let coupleY = 0;

    if (parents.length === 2) {
      const sortedParents = [...parents].sort((a, b) => a.x - b.x);
      const p1 = sortedParents[0]!;
      const p2 = sortedParents[1]!;
      midX = (p1.x + S / 2 + p2.x - S / 2) / 2;

      const coupleEdge = allEdges.find(
        (e) =>
          (e.type === "couple" ||
            e.type === "consanguinity" ||
            e.type === "divorced" ||
            e.type === "separated") &&
          parentIds.includes(e.sourceId) &&
          parentIds.includes(e.targetId)
      );
      const hasInter = getIntermediateNodes(p1, p2, nodes, renderOffsets).length > 0;
      const trackIndex = coupleEdge && hasInter
        ? computeEdgeLoopTrack(coupleEdge.id, allEdges, nodes, renderOffsets)
        : 0;
      coupleY = hasInter
        ? maxBottom + 12 + trackIndex * 8
        : (p1.y + (renderOffsets?.get(p1.id) ?? 0) + p2.y + (renderOffsets?.get(p2.id) ?? 0)) / 2;
    } else {
      midX = parents[0]!.x;
      coupleY = parents[0]!.y + (renderOffsets?.get(parents[0]!.id) ?? 0) + S / 2;
    }

    if (midX > leftX + 5 && midX < rightX - 5) {
      if (yDrop > coupleY && yDrop < barY) {
        crossXs.push(midX);
      }
    }
  }

  return Array.from(new Set(crossXs)).sort((a, b) => a - b);
}

/**
 * Computes all Y coordinates where a vertical line at `midX` (from `topY` to `bottomY`)
 * crosses other loop edges' horizontal segments on the same generation row.
 * Used by SibshipGroup to render crossover bridges on the family drop line.
 */
export function computeVerticalCrossingYCoordinates(
  midX: number,
  topY: number,
  bottomY: number,
  allEdges: PedigreeEdge[],
  nodes: PedigreeNode[],
  renderOffsets?: Map<string, number>,
  S: number = 44,
  showAutoLabels: boolean = false,
  autoLabels?: Map<string, string>,
  ownEdgeId?: string,
): number[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const crossYs: number[] = [];

  for (const e of allEdges) {
    if (e.type === "parent-child") continue;
    if (e.id === ownEdgeId) continue;

    const sNode = nodeMap.get(e.sourceId);
    const tNode = nodeMap.get(e.targetId);
    if (!sNode || !tNode) continue;

    const intermediates = getIntermediateNodes(sNode, tNode, nodes, renderOffsets);
    if (intermediates.length === 0) continue;

    const loopLeftX = Math.min(sNode.x, tNode.x);
    const loopRightX = Math.max(sNode.x, tNode.x);

    // midX must be within the horizontal span of this loop edge
    if (midX < loopLeftX - 1 || midX > loopRightX + 1) continue;

    // Compute the Y of this loop's horizontal segment
    const baseY = computeRelationDropY(
      sNode, tNode, intermediates, nodes, [], S, renderOffsets, showAutoLabels, autoLabels
    );
    const trackIndex = computeEdgeLoopTrack(e.id, allEdges, nodes, renderOffsets);
    const yDrop = baseY + trackIndex * 8;

    // Check if this yDrop falls between topY and bottomY (with margin)
    if (yDrop > topY + 5 && yDrop < bottomY - 5) {
      crossYs.push(yDrop);
    }
  }

  return Array.from(new Set(crossYs)).sort((a, b) => a - b);
}

/**
 * Greedily assigns a non-conflicting Y-track index (0, 1, 2...) to horizontally
 * overlapping sibling bars on the same generation row.
 */
export function computeSibshipGroupTrack(
  parentIds: string[],
  childIds: string[],
  allEdges: PedigreeEdge[],
  nodes: PedigreeNode[],
  parentOffsets?: Map<string, number>,
  childOffsets?: Map<string, number>,
): number {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const childNode = nodeMap.get(childIds[0] ?? "");
  if (!childNode) return 0;

  const childY = childNode.y + (childOffsets?.get(childNode.id) ?? 0);
  const targetKey = [...parentIds].sort().join("|");

  // 1. Group all parent-child edges into families on the same generation row
  const pcEdges = allEdges.filter((e) => e.type === "parent-child");
  const childParents = new Map<string, string[]>();
  for (const e of pcEdges) {
    if (!childParents.has(e.targetId)) childParents.set(e.targetId, []);
    childParents.get(e.targetId)!.push(e.sourceId);
  }

  const families = new Map<string, { parentIds: string[]; childIds: string[] }>();
  for (const [cId, pIds] of childParents) {
    const cNode = nodeMap.get(cId);
    if (!cNode) continue;
    const cy = cNode.y + (childOffsets?.get(cId) ?? 0);
    if (Math.abs(cy - childY) > ROW_TOLERANCE) continue;

    const key = [...pIds].sort().join("|");
    if (!families.has(key)) families.set(key, { parentIds: [...pIds].sort(), childIds: [] });
    families.get(key)!.childIds.push(cId);
  }

  if (families.size <= 1) return 0;

  // 2. Compute the horizontal span [minX, maxX] for each family's sibling bar
  const intervals: { key: string; minX: number; maxX: number }[] = [];

  for (const [key, fam] of families) {
    const famChildren = fam.childIds.map((id) => nodeMap.get(id)).filter((n): n is PedigreeNode => !!n);
    if (famChildren.length === 0) continue;

    // Find twin groups in this family
    const twinMap = new Map<string, string>();
    for (const e of pcEdges) {
      if (e.twinGroup && fam.childIds.includes(e.targetId)) {
        twinMap.set(e.targetId, e.twinGroup);
      }
    }
    const twinGroups = new Map<string, PedigreeNode[]>();
    for (const c of famChildren) {
      const tg = twinMap.get(c.id);
      if (tg) {
        if (!twinGroups.has(tg)) twinGroups.set(tg, []);
        twinGroups.get(tg)!.push(c);
      }
    }
    const twinChildIds = new Set<string>();
    for (const [, members] of twinGroups) {
      if (members.length >= 2) {
        for (const m of members) twinChildIds.add(m.id);
      }
    }

    const nonTwinXs = famChildren.filter((c) => !twinChildIds.has(c.id)).map((c) => c.x);
    const twinDropMidXs: number[] = [];
    for (const [, members] of twinGroups) {
      if (members.length >= 2) {
        const twinXs = members.map((m) => m.x);
        twinDropMidXs.push(twinXs.reduce((a, b) => a + b, 0) / twinXs.length);
      }
    }
    const allBarXs = [...nonTwinXs, ...twinDropMidXs];
    const pIds = fam.parentIds;
    const parents = pIds.map(id => nodeMap.get(id)).filter((n): n is PedigreeNode => !!n);
    if (parents.length > 0) {
      const parentCenter = parents.length === 2
        ? (parents[0]!.x + parents[1]!.x) / 2
        : parents[0]!.x;
      allBarXs.push(parentCenter);
    }
    if (allBarXs.length === 0) continue;

    const minX = Math.min(...allBarXs);
    const maxX = Math.max(...allBarXs);
    intervals.push({ key, minX, maxX });
  }


  intervals.sort((a, b) => a.minX - b.minX || (a.maxX - a.minX) - (b.maxX - b.minX));

  // 3. Greedily assign Y-track indices
  const trackMap = new Map<string, number>();
  for (const item of intervals) {
    let track = 0;
    while (true) {
      let conflict = false;
      for (const other of intervals) {
        const otherTrack = trackMap.get(other.key);
        if (otherTrack === track) {
          const overlap = Math.max(item.minX, other.minX) <= Math.min(item.maxX, other.maxX) + 5;
          if (overlap) {
            conflict = true;
            break;
          }
        }
      }
      if (!conflict) {
        trackMap.set(item.key, track);
        break;
      }
      track++;
    }
  }

  const res = trackMap.get(targetKey) ?? 0;
  return res;
}

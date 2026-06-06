import { useMemo } from "react";
import type { PedigreeNode, PedigreeAnnotation, PedigreeEdge } from "./types";
import { NODE_SIZE } from "./types";
import { useCanvasConfig } from "@/features/pedigree-editor/context/CanvasConfigContext";
import {
  getIntermediateNodes,
  computeLabelBelowHeight,
  computeAnnotationMaxBottom,
  computeEdgeLoopTrack,
  computeMaxLoopTrackOnRow,
  computeVerticalCrossingYCoordinates,
  computeCrossingXCoordinates,
} from "./canvasUtils";

const MIN_BAR_CHILD_GAP = 30;

function buildVerticalPathWithBridges(x: number, startY: number, endY: number, crossingYs: number[]): string {
  if (crossingYs.length === 0) {
    return `M ${x} ${startY} L ${x} ${endY}`;
  }
  let d = `M ${x} ${startY}`;
  let lastY = startY;
  for (const cy of crossingYs) {
    if (cy - 6 < lastY + 10) {
      const h = (cy + 6) - lastY;
      const ry = h / 2;
      d += ` A 6 ${ry} 0 0 1 ${x} ${cy + 6}`;
    } else {
      d += ` L ${x} ${cy - 6} A 6 6 0 0 1 ${x} ${cy + 6}`;
    }
    lastY = cy + 6;
  }
  d += ` L ${x} ${endY}`;
  return d;
}

export function computeFamilyChildYOffset(
  parentIds: string[],
  childIds: string[],
  nodes: PedigreeNode[],
  annotations: PedigreeAnnotation[],
  nodeSize: number,
  showAutoLabels: boolean,
  autoLabels?: Map<string, string>,
  parentOffsets?: Map<string, number>,
  edges?: PedigreeEdge[],
): Map<string, number> {
  const result = new Map<string, number>();
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const children = childIds.map((id) => nodeMap.get(id)).filter((n): n is PedigreeNode => !!n);
  if (children.length === 0) return result;

  const childTopY = Math.min(...children.map((c) => c.y + (parentOffsets?.get(c.id) ?? 0))) - nodeSize / 2;

  // Find intermediate nodes if there are exactly 2 parents
  const intermediateNodeIds: string[] = [];
  if (parentIds.length === 2) {
    const p1 = nodeMap.get(parentIds[0]!);
    const p2 = nodeMap.get(parentIds[1]!);
    if (p1 && p2) {
      const intermediates = getIntermediateNodes(p1, p2, nodes, parentOffsets);
      for (const n of intermediates) {
        intermediateNodeIds.push(n.id);
      }
    }
  }

  const maxAnnBottom = computeAnnotationMaxBottom(
    [...parentIds, ...intermediateNodeIds],
    annotations,
    nodeMap,
    nodeSize,
    showAutoLabels,
    autoLabels,
    parentOffsets
  );

  let maxNodeBottom = -Infinity;
  for (const n of [...parentIds.map((id) => nodeMap.get(id)), ...intermediateNodeIds].filter(Boolean) as PedigreeNode[]) {
    const nOff = parentOffsets?.get(n.id) ?? 0;
    const autoLabel = showAutoLabels ? autoLabels?.get(n.id) : undefined;
    const labelH = computeLabelBelowHeight(n, autoLabel);
    const bottom = n.y + nOff + nodeSize / 2 + labelH;
    maxNodeBottom = Math.max(maxNodeBottom, bottom);
  }

  const maxBottom = Math.max(maxNodeBottom, maxAnnBottom);

  const p1 = parentIds.length > 0 ? nodeMap.get(parentIds[0]!) : undefined;
  const rowY = p1 ? p1.y + (parentOffsets?.get(p1.id) ?? 0) : 0;
  const maxTrackIndex = edges ? computeMaxLoopTrackOnRow(rowY, edges, nodes, parentOffsets) : 0;

  // The sibling bar must clear the loop (maxBottom + 12 + maxTrackIndex * 8) by a safety gap of 10px, so maxBottom + 22 + maxTrackIndex * 8
  const barY = Math.max(childTopY - MIN_BAR_CHILD_GAP, maxBottom + 22 + maxTrackIndex * 8);
  const delta = Math.max(0, barY - (childTopY - MIN_BAR_CHILD_GAP));

  if (delta > 0) {
    for (const c of children) result.set(c.id, delta);
  }
  return result;
}

export function SibshipGroup({ parentIds, childIds, nodes, edges = [], invalid, edgeType = "couple", annotations = [], showAutoLabels = false, autoLabels, parentOffsets, childOffsets }: {
  parentIds: string[];
  childIds: string[];
  nodes: PedigreeNode[];
  edges?: PedigreeEdge[];
  invalid: boolean;
  edgeType?: "couple" | "consanguinity" | "divorced" | "separated";
  annotations?: PedigreeAnnotation[];
  showAutoLabels?: boolean;
  autoLabels?: Map<string, string>;
  parentOffsets?: Map<string, number>;
  childOffsets?: Map<string, number>;
}) {
  const cfg = useCanvasConfig();
  const S = NODE_SIZE;
  const stroke = invalid ? "hsl(var(--destructive))" : cfg.config.edgeColor.startsWith("hsl(") ? "hsl(var(--foreground) / 0.5)" : cfg.config.edgeColor;
  const sw = invalid ? 2 : cfg.config.edgeWidthNormal;
  const dash = invalid ? "5 3" : undefined;

  const nodeMap = useMemo(() => {
    const map = new Map<string, PedigreeNode>();
    for (const n of nodes) map.set(n.id, n);
    return map;
  }, [nodes]);
  const parents = parentIds.map((id) => nodeMap.get(id)).filter((n): n is PedigreeNode => !!n);
  const children = childIds.map((id) => nodeMap.get(id)).filter((n): n is PedigreeNode => !!n);
  if (parents.length === 0 || children.length === 0) return null;

  const paths: string[] = [];
  const childTopY = Math.min(...children.map((c) => c.y + (childOffsets?.get(c.id) ?? 0))) - S / 2;

  const intermediateNodes = useMemo(() => {
    if (parents.length === 2) {
      return getIntermediateNodes(parents[0]!, parents[1]!, nodes, parentOffsets);
    }
    return [];
  }, [parents, nodes, parentOffsets]);

  const hasIntermediate = intermediateNodes.length > 0;

  const maxAnnBottom = useMemo(
    () => computeAnnotationMaxBottom(
      [...parentIds, ...intermediateNodes.map((n) => n.id)],
      annotations,
      nodeMap,
      S,
      showAutoLabels,
      autoLabels,
      parentOffsets
    ),
    [parentIds, intermediateNodes, annotations, nodeMap, S, showAutoLabels, autoLabels, parentOffsets],
  );

  const maxNodeBottom = useMemo(() => {
    let maxB = -Infinity;
    const idsToCheck = [...parentIds, ...intermediateNodes.map((n) => n.id)];
    for (const id of idsToCheck) {
      const n = nodeMap.get(id);
      if (!n) continue;
      const nOff = parentOffsets?.get(n.id) ?? 0;
      const autoLabel = showAutoLabels ? autoLabels?.get(n.id) : undefined;
      const labelH = computeLabelBelowHeight(n, autoLabel);
      const bottom = n.y + nOff + S / 2 + labelH;
      maxB = Math.max(maxB, bottom);
    }
    return maxB;
  }, [parentIds, intermediateNodes, nodeMap, S, showAutoLabels, autoLabels, parentOffsets]);

  const maxBottom = Math.max(maxNodeBottom, maxAnnBottom);
  const coupleYOffset = edgeType === "consanguinity" ? 3.5 : 0;

  const rowY = parents[0] ? parents[0].y + (parentOffsets?.get(parents[0].id) ?? 0) : 0;
  const maxTrackIndex = computeMaxLoopTrackOnRow(rowY, edges, nodes, parentOffsets);
  const barY = Math.max(childTopY - MIN_BAR_CHILD_GAP, maxBottom + 22 + maxTrackIndex * 8);

  const TWIN_DROP = 16;

  const twinMap = useMemo(() => {
    const map = new Map<string, { twinGroup: string; twinType?: "m" | "d" }>();
    for (const e of edges) {
      if (e.type === "parent-child" && e.twinGroup && childIds.includes(e.targetId)) {
        map.set(e.targetId, { twinGroup: e.twinGroup, twinType: e.twinType });
      }
    }
    return map;
  }, [edges, childIds]);

  const twinGroups = useMemo(() => {
    const groups = new Map<string, PedigreeNode[]>();
    for (const c of children) {
      const t = twinMap.get(c.id);
      if (t) {
        if (!groups.has(t.twinGroup)) groups.set(t.twinGroup, []);
        groups.get(t.twinGroup)!.push(c);
      }
    }
    return groups;
  }, [children, twinMap]);

  const twinChildIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [, members] of twinGroups) {
      if (members.length >= 2) {
        for (const m of members) ids.add(m.id);
      }
    }
    return ids;
  }, [twinGroups]);

  function cy(c: PedigreeNode) { return c.y + (childOffsets?.get(c.id) ?? 0) - S / 2; }

  if (parents.length === 1) {
    const p = parents[0]!;
    const pOff = parentOffsets?.get(p.id) ?? 0;
    const coupleY = p.y + pOff + S / 2;
    if (children.length === 1) {
      const c = children[0]!;
      const verticalCrossings = computeVerticalCrossingYCoordinates(
        p.x, coupleY, barY, edges, nodes, parentOffsets, S, showAutoLabels, autoLabels
      );
      paths.push(buildVerticalPathWithBridges(p.x, coupleY, barY, verticalCrossings), `M ${p.x} ${barY} L ${c.x} ${barY} L ${c.x} ${cy(c)}`);
    } else {
      // C6 fix: bar spans non-twin children + twin drop midpoints (not twin node positions)
      const nonTwinXs = children.filter((c) => !twinChildIds.has(c.id)).map((c) => c.x);
      const twinDropMidXs: number[] = [];
      for (const [, members] of twinGroups) {
        if (members.length >= 2) {
          const twinXs = members.map((m) => m.x);
          twinDropMidXs.push(twinXs.reduce((a, b) => a + b, 0) / twinXs.length);
        }
      }
      const allBarXs = [...nonTwinXs, ...twinDropMidXs];
      const barLeft = Math.min(...allBarXs);
      const barRight = Math.max(...allBarXs);
      
      const parentX = p.x;
      const childCenter = (barLeft + barRight) / 2;
      const isStepped = parentX < barLeft || parentX > barRight;
      
      if (isStepped) {
        const stepY = barY - 15;
        const verticalCrossings = computeVerticalCrossingYCoordinates(
          parentX, coupleY, stepY, edges, nodes, parentOffsets, S, showAutoLabels, autoLabels
        );
        paths.push(
          buildVerticalPathWithBridges(parentX, coupleY, stepY, verticalCrossings),
          `M ${parentX} ${stepY} L ${childCenter} ${stepY} L ${childCenter} ${barY}`,
          `M ${barLeft} ${barY} L ${barRight} ${barY}`
        );
      } else {
        const verticalCrossings = computeVerticalCrossingYCoordinates(
          parentX, coupleY, barY, edges, nodes, parentOffsets, S, showAutoLabels, autoLabels
        );
        paths.push(
          buildVerticalPathWithBridges(parentX, coupleY, barY, verticalCrossings),
          `M ${barLeft} ${barY} L ${barRight} ${barY}`
        );
      }

      for (const [, members] of twinGroups) {
        if (members.length < 2) continue;
        const twinXs = members.map((m) => m.x).sort((a, b) => a - b);
        const midX = twinXs.reduce((a, b) => a + b, 0) / twinXs.length;
        const dropY = barY + TWIN_DROP;
        const isMono = twinMap.get(members[0]!.id)?.twinType === "m";
        paths.push(`M ${midX} ${barY} L ${midX} ${dropY}`);
        for (const m of members) {
          paths.push(`M ${midX} ${dropY} L ${m.x} ${cy(m)}`);
        }
        if (isMono) {
          const firstChild = members[0]!;
          const lastChild = members[members.length - 1]!;
          const twinBarY = (dropY + cy(firstChild)) / 2;
          const barLeft = (midX + firstChild.x) / 2;
          const barRight = (midX + lastChild.x) / 2;
          paths.push(`M ${barLeft} ${twinBarY} L ${barRight} ${twinBarY}`);
        }
      }

      for (const c of children) {
        if (!twinChildIds.has(c.id)) {
          paths.push(`M ${c.x} ${barY} L ${c.x} ${cy(c)}`);
        }
      }
    }
  } else {
    const sorted = [...parents].sort((a, b) => a.x - b.x);
    const p1 = sorted[0]!;
    const p2 = sorted[1]!;
    const p1Off = parentOffsets?.get(p1.id) ?? 0;
    const p2Off = parentOffsets?.get(p2.id) ?? 0;
    const midX = (p1.x + S / 2 + p2.x - S / 2) / 2;
    const coupleEdge = edges.find(
      (e) =>
        (e.type === "couple" ||
          e.type === "consanguinity" ||
          e.type === "divorced" ||
          e.type === "separated") &&
        parentIds.includes(e.sourceId) &&
        parentIds.includes(e.targetId)
    );
    const trackIndex = coupleEdge && hasIntermediate
      ? computeEdgeLoopTrack(coupleEdge.id, edges, nodes, parentOffsets)
      : 0;
    const coupleY = hasIntermediate
      ? maxBottom + 12 + trackIndex * 8
      : (p1.y + p1Off + p2.y + p2Off) / 2 + coupleYOffset;

    const hasBridgeAtMid = coupleEdge && hasIntermediate
      ? computeCrossingXCoordinates(
          coupleEdge,
          coupleY,
          Math.min(p1.x, p2.x),
          Math.max(p1.x, p2.x),
          edges,
          nodes,
          parentOffsets,
          S,
          showAutoLabels,
          autoLabels
        ).some((cx) => Math.abs(cx - midX) < 1)
      : false;
    const startY = hasBridgeAtMid ? coupleY - 6 : coupleY;

    // C6 fix: bar spans non-twin children + twin drop midpoints (not twin node positions)
    const nonTwinXs = children.filter((c) => !twinChildIds.has(c.id)).map((c) => c.x);
    const twinDropMidXs: number[] = [];
    for (const [, members] of twinGroups) {
      if (members.length >= 2) {
        const twinXs = members.map((m) => m.x);
        twinDropMidXs.push(twinXs.reduce((a, b) => a + b, 0) / twinXs.length);
      }
    }
    const allBarXs = [...nonTwinXs, ...twinDropMidXs];
    const barLeft = Math.min(...allBarXs);
    const barRight = Math.max(...allBarXs);
    
    const childCenter = (barLeft + barRight) / 2;
    const isStepped = midX < barLeft || midX > barRight;
    
    if (isStepped) {
      const stepY = barY - 15;
      const verticalCrossings = computeVerticalCrossingYCoordinates(
        midX, startY, stepY, edges, nodes, parentOffsets, S, showAutoLabels, autoLabels, coupleEdge?.id
      );
      paths.push(
        buildVerticalPathWithBridges(midX, startY, stepY, verticalCrossings),
        `M ${midX} ${stepY} L ${childCenter} ${stepY} L ${childCenter} ${barY}`,
        `M ${barLeft} ${barY} L ${barRight} ${barY}`
      );
    } else {
      const verticalCrossings = computeVerticalCrossingYCoordinates(
        midX, startY, barY, edges, nodes, parentOffsets, S, showAutoLabels, autoLabels, coupleEdge?.id
      );
      paths.push(
        buildVerticalPathWithBridges(midX, startY, barY, verticalCrossings),
        `M ${barLeft} ${barY} L ${barRight} ${barY}`
      );
    }

    for (const [, members] of twinGroups) {
      if (members.length < 2) continue;
      const twinXs = members.map((m) => m.x).sort((a, b) => a - b);
      const twinMidX = twinXs.reduce((a, b) => a + b, 0) / twinXs.length;
      const dropY = barY + TWIN_DROP;
      const isMono = twinMap.get(members[0]!.id)?.twinType === "m";
      paths.push(`M ${twinMidX} ${barY} L ${twinMidX} ${dropY}`);
      for (const m of members) {
        paths.push(`M ${twinMidX} ${dropY} L ${m.x} ${cy(m)}`);
      }
      if (isMono) {
        const firstChild = members[0]!;
        const lastChild = members[members.length - 1]!;
        const twinBarY = (dropY + cy(firstChild)) / 2;
        const barLeft = (twinMidX + firstChild.x) / 2;
        const barRight = (twinMidX + lastChild.x) / 2;
        paths.push(`M ${barLeft} ${twinBarY} L ${barRight} ${twinBarY}`);
      }
    }

    for (const c of children) {
      if (!twinChildIds.has(c.id)) {
        paths.push(`M ${c.x} ${barY} L ${c.x} ${cy(c)}`);
      }
    }
  }
  return <path d={paths.join(" ")} fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray={dash} strokeLinecap="square" />;
}

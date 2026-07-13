import { memo } from "react";
import type { PedigreeEdge, PedigreeNode, PedigreeAnnotation } from "./types";
import { useCanvasConfig } from "@/features/pedigree-editor/context/CanvasConfigContext";
import { getIntermediateNodes, computeRelationDropY, computeEdgeLoopTrack, computeCrossingXCoordinates } from "./canvasUtils";

interface EdgeLineProps {
  edge: PedigreeEdge;
  nodes: PedigreeNode[];
  invalid: boolean;
  renderOffsets?: Map<string, number>;
  annotations?: PedigreeAnnotation[];
  edges?: PedigreeEdge[];
  showAutoLabels?: boolean;
  autoLabels?: Map<string, string>;
}

export const EdgeLine = memo(function EdgeLine({ edge, nodes, invalid, renderOffsets, annotations, edges = [], showAutoLabels = false, autoLabels }: EdgeLineProps) {
  const cfg = useCanvasConfig();
  const src = nodes.find((n) => n.id === edge.sourceId);
  const tgt = nodes.find((n) => n.id === edge.targetId);
  if (!src || !tgt) return null;
  const S = cfg.config.nodeSize;
  const edgeStroke = invalid ? "#FF4040" : (cfg.config.edgeColor || "#000000").startsWith("hsl(") ? "hsl(var(--foreground) / 0.5)" : (cfg.config.edgeColor || "#000000");
  const edgeWidth = invalid ? 2 : cfg.config.edgeWidthNormal;
  const edgeDash = invalid ? "5 3" : undefined;

  const [left, right] = src.x <= tgt.x ? [src, tgt] : [tgt, src];
  const leftOff = renderOffsets?.get(left.id) ?? 0;
  const rightOff = renderOffsets?.get(right.id) ?? 0;
  const leftX = left.x, leftY = left.y + leftOff + S / 2;
  const rightX = right.x, rightY = right.y + rightOff + S / 2;

  const intermediateNodes = getIntermediateNodes(left, right, nodes, renderOffsets);
  const hasIntermediate = intermediateNodes.length > 0;
  const baseDropY = hasIntermediate ? computeRelationDropY(left, right, intermediateNodes, nodes, annotations, S, renderOffsets, showAutoLabels, autoLabels, cfg.config) : 0;
  const trackIndex = hasIntermediate ? computeEdgeLoopTrack(edge.id, edges, nodes, renderOffsets) : 0;
  const yDrop = baseDropY + trackIndex * 8;

  const crossings = hasIntermediate
    ? computeCrossingXCoordinates(edge, yDrop, leftX, rightX, edges, nodes, renderOffsets, S, showAutoLabels, autoLabels, cfg.config)
    : [];

  const buildPath = (
    yVal: number,
    leftYVal: number = leftY,
    rightYVal: number = rightY,
    leftXVal: number = leftX,
    rightXVal: number = rightX
  ) => {
    let d = `M ${leftXVal} ${leftYVal} L ${leftXVal} ${yVal}`;
    for (const x of crossings) {
      d += ` L ${x - 6} ${yVal} A 6 6 0 0 1 ${x + 6} ${yVal}`;
    }
    d += ` L ${rightXVal} ${yVal} L ${rightXVal} ${rightYVal}`;
    return d;
  };

  if (edge.type === "couple") {
    if (hasIntermediate) {
      return (
        <path
          d={buildPath(yDrop)}
          stroke={edgeStroke}
          strokeWidth={edgeWidth}
          strokeDasharray={edgeDash}
          fill="none"
        />
      );
    }
    return <line x1={left.x + S / 2} y1={left.y + leftOff} x2={right.x - S / 2} y2={right.y + rightOff} stroke={edgeStroke} strokeWidth={edgeWidth} strokeDasharray={edgeDash} />;
  }

  if (edge.type === "consanguinity") {
    if (hasIntermediate) {
      const d1 = buildPath(yDrop + 1.75, leftY, rightY, leftX - 1.75, rightX + 1.75);
      const d2 = buildPath(yDrop - 1.75, leftY, rightY, leftX + 1.75, rightX - 1.75);
      return (
        <g stroke={edgeStroke} strokeWidth={edgeWidth} strokeDasharray={edgeDash} fill="none">
          <path d={d1} />
          <path d={d2} />
        </g>
      );
    }
    const x1 = left.x + S / 2, y1 = left.y + leftOff;
    const x2 = right.x - S / 2, y2 = right.y + rightOff;
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ox = (-dy / len) * 3.5, oy = (dx / len) * 3.5;
    return (
      <g stroke={edgeStroke} strokeWidth={edgeWidth} strokeDasharray={edgeDash} fill="none">
        <line x1={x1 + ox} y1={y1 + oy} x2={x2 + ox} y2={y2 + oy} />
        <line x1={x1 - ox} y1={y1 - oy} x2={x2 - ox} y2={y2 - oy} />
      </g>
    );
  }

  if (edge.type === "divorced") {
    if (hasIntermediate) {
      const midX = (leftX + rightX) / 2;
      const slashHalfHeight = Math.max(5, edgeWidth * 1.5);
      const slashHalfWidth = Math.max(2, edgeWidth * 0.6);
      const slashGap = Math.max(2, edgeWidth * 0.8);
      return (
        <g stroke={edgeStroke} strokeWidth={edgeWidth} fill="none">
          <path d={buildPath(yDrop)} />
          <line x1={midX - slashGap - slashHalfWidth} y1={yDrop + slashHalfHeight} x2={midX - slashGap + slashHalfWidth} y2={yDrop - slashHalfHeight} />
          <line x1={midX + slashGap - slashHalfWidth} y1={yDrop + slashHalfHeight} x2={midX + slashGap + slashHalfWidth} y2={yDrop - slashHalfHeight} />
        </g>
      );
    }
    const x1 = left.x + S / 2, y1 = left.y + leftOff;
    const x2 = right.x - S / 2, y2 = right.y + rightOff;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const slashHalfHeight = Math.max(5, edgeWidth * 1.5);
    const slashHalfWidth = Math.max(2, edgeWidth * 0.6);
    const slashGap = Math.max(2, edgeWidth * 0.8);

    return (
      <g stroke={edgeStroke} strokeWidth={edgeWidth} fill="none">
        <line x1={x1} y1={y1} x2={x2} y2={y2} />
        <line x1={midX - slashGap - slashHalfWidth} y1={midY + slashHalfHeight} x2={midX - slashGap + slashHalfWidth} y2={midY - slashHalfHeight} />
        <line x1={midX + slashGap - slashHalfWidth} y1={midY + slashHalfHeight} x2={midX + slashGap + slashHalfWidth} y2={midY - slashHalfHeight} />
      </g>
    );
  }

  if (edge.type === "separated") {
    if (hasIntermediate) {
      return (
        <path
          d={buildPath(yDrop)}
          stroke={edgeStroke}
          strokeWidth={edgeWidth}
          strokeDasharray={edgeDash ?? "6 4"}
          fill="none"
        />
      );
    }
    return <line x1={left.x + S / 2} y1={left.y + leftOff} x2={right.x - S / 2} y2={right.y + rightOff} stroke={edgeStroke} strokeWidth={edgeWidth} strokeDasharray={edgeDash ?? "6 4"} />;
  }

  return null;
});
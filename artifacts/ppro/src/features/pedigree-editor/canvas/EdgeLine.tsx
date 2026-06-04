import { memo } from "react";
import type { PedigreeEdge, PedigreeNode } from "./types";
import { useCanvasConfig } from "@/features/pedigree-editor/context/CanvasConfigContext";

interface EdgeLineProps {
  edge: PedigreeEdge;
  nodes: PedigreeNode[];
  invalid: boolean;
  renderOffsets?: Map<string, number>;
}

export const EdgeLine = memo(function EdgeLine({ edge, nodes, invalid, renderOffsets }: EdgeLineProps) {
  const cfg = useCanvasConfig();
  const src = nodes.find((n) => n.id === edge.sourceId);
  const tgt = nodes.find((n) => n.id === edge.targetId);
  if (!src || !tgt) return null;
  const S = cfg.config.nodeSize;
  const edgeStroke = invalid ? "#FF4040" : cfg.config.edgeColor.startsWith("hsl(") ? "hsl(var(--foreground) / 0.5)" : cfg.config.edgeColor;
  const edgeWidth = invalid ? 2 : cfg.config.edgeWidthNormal;
  const edgeDash = invalid ? "5 3" : undefined;

  if (edge.type === "couple") {
    const [left, right] = src.x <= tgt.x ? [src, tgt] : [tgt, src];
    const leftOff = renderOffsets?.get(left.id) ?? 0;
    const rightOff = renderOffsets?.get(right.id) ?? 0;
    return <line x1={left.x + S / 2} y1={left.y + leftOff} x2={right.x - S / 2} y2={right.y + rightOff} stroke={edgeStroke} strokeWidth={edgeWidth} strokeDasharray={edgeDash} />;
  }

  if (edge.type === "consanguinity") {
    const [left, right] = src.x <= tgt.x ? [src, tgt] : [tgt, src];
    const leftOff = renderOffsets?.get(left.id) ?? 0;
    const rightOff = renderOffsets?.get(right.id) ?? 0;
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
    const [left, right] = src.x <= tgt.x ? [src, tgt] : [tgt, src];
    const leftOff = renderOffsets?.get(left.id) ?? 0;
    const rightOff = renderOffsets?.get(right.id) ?? 0;
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
    const [left, right] = src.x <= tgt.x ? [src, tgt] : [tgt, src];
    const leftOff = renderOffsets?.get(left.id) ?? 0;
    const rightOff = renderOffsets?.get(right.id) ?? 0;
    return <line x1={left.x + S / 2} y1={left.y + leftOff} x2={right.x - S / 2} y2={right.y + rightOff} stroke={edgeStroke} strokeWidth={edgeWidth} strokeDasharray={edgeDash ?? "6 4"} />;
  }

  return null;
});
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

  return null;
});
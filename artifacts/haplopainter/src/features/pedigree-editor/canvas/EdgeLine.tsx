import type { PedigreeEdge, PedigreeNode } from "./types";
import { NODE_SIZE } from "./types";

interface EdgeLineProps {
  edge: PedigreeEdge;
  nodes: PedigreeNode[];
  invalid: boolean;
}

export function EdgeLine({ edge, nodes, invalid }: EdgeLineProps) {
  const src = nodes.find((n) => n.id === edge.sourceId);
  const tgt = nodes.find((n) => n.id === edge.targetId);
  if (!src || !tgt) return null;
  const S = NODE_SIZE;
  const isCoupleLike = edge.type === "couple" || edge.type === "consanguinity";
  const edgeStroke = invalid ? "#FF4040" : isCoupleLike ? "hsl(var(--foreground) / 0.5)" : "hsl(var(--foreground) / 0.35)";
  const edgeWidth = invalid ? 2 : 1.5;
  const edgeDash = invalid ? "5 3" : undefined;

  if (edge.type === "couple") {
    const [left, right] = src.x <= tgt.x ? [src, tgt] : [tgt, src];
    return <line x1={left.x + S / 2} y1={left.y} x2={right.x - S / 2} y2={right.y} stroke={edgeStroke} strokeWidth={edgeWidth} strokeDasharray={edgeDash} />;
  }

  if (edge.type === "consanguinity") {
    const [left, right] = src.x <= tgt.x ? [src, tgt] : [tgt, src];
    const x1 = left.x + S / 2, y1 = left.y;
    const x2 = right.x - S / 2, y2 = right.y;
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

  const drop = src.y + S / 2 + 40;
  return <path d={`M ${src.x} ${src.y + S / 2} L ${src.x} ${drop} L ${tgt.x} ${drop} L ${tgt.x} ${tgt.y - S / 2}`} fill="none" stroke={edgeStroke} strokeWidth={edgeWidth} strokeDasharray={edgeDash} />;
}
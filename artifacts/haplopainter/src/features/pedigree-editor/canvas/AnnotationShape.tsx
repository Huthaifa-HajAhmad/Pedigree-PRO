import type { PedigreeAnnotation } from "@/features/pedigree-editor/canvas/types";
import { NODE_SIZE } from "@/features/pedigree-editor/canvas/types";

export function AnnotationShape({
  ann, nodeX, nodeY, isSelected, stackIndex = 0, onClick, onDragStart,
}: {
  ann: PedigreeAnnotation;
  nodeX: number;
  nodeY: number;
  isSelected: boolean;
  stackIndex?: number;
  onClick: () => void;
  onDragStart: (e: React.MouseEvent) => void;
}) {
  const S   = NODE_SIZE;
  const fs  = ann.fontSize;
  const charW = fs * 0.62;
  const textW = Math.max(24, ann.text.length * charW);
  const padX  = 7;
  const padY  = 4;
  const boxW  = textW + padX * 2;
  const boxH  = fs + padY * 2;
  const stackGap = 5;
  const slot = stackIndex * (boxH + stackGap);

  // Base offset from position + vertical stacking so multiple annotations never overlap
  const baseOffsets: Record<string, { dx: number; dy: number }> = {
    above: { dx: -boxW / 2,           dy: -(S / 2 + boxH + 8) - slot },
    below: { dx: -boxW / 2,           dy:  (S / 2 + 8) + slot },
    left:  { dx: -(S / 2 + boxW + 8), dy: -boxH / 2 + slot },
    right: { dx:  (S / 2 + 8),        dy: -boxH / 2 + slot },
  };
  const { dx, dy } = baseOffsets[ann.position] ?? baseOffsets.above;
  const bx = nodeX + dx + (ann.offsetX ?? 0);
  const by = nodeY + dy + (ann.offsetY ?? 0);

  // Leader line: box centre → node centre
  const lx1 = bx + boxW / 2;
  const ly1 = by + boxH / 2;
  const border = isSelected ? ann.color : `${ann.color}70`;

  return (
    <g
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onMouseDown={(e) => { e.stopPropagation(); onDragStart(e); }}
      style={{ cursor: isSelected ? "grabbing" : "grab" }}
    >
      <line x1={lx1} y1={ly1} x2={nodeX} y2={nodeY} stroke={`${ann.color}45`} strokeWidth={1} strokeDasharray="3 2" />
      <rect x={bx} y={by} width={boxW} height={boxH} rx={3}
        fill={`${ann.color}12`} stroke={border} strokeWidth={isSelected ? 1.2 : 0.8} />
      {isSelected && (
        <rect x={bx - 1} y={by - 1} width={boxW + 2} height={boxH + 2} rx={4}
          fill="none" stroke={ann.color} strokeWidth={0.8} strokeDasharray="3 2" opacity={0.6} />
      )}
      <text x={bx + padX} y={by + padY + fs * 0.78} fontSize={fs} fill={ann.color}
        style={{ fontFamily: "JetBrains Mono, monospace", userSelect: "none", pointerEvents: "none" }}>
        {ann.text}
      </text>
    </g>
  );
}
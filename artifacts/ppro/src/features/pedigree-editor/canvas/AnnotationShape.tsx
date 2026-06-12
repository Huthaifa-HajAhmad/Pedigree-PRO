import React from "react";
import type { PedigreeAnnotation } from "@/features/pedigree-editor/canvas/types";
import { useCanvasConfig } from "@/features/pedigree-editor/context/CanvasConfigContext";

export function getAnnotationBaseOffset(
  position: PedigreeAnnotation["position"],
  boxW: number,
  boxH: number,
  nodeSize: number,
  stackIndex: number,
  labelBelowHeight: number = 0,
): { dx: number; dy: number } {
  const stackGap = 5;
  const slot = stackIndex * (boxH + stackGap);
  const slotX = stackIndex * (boxW + stackGap);

  const baseOffsets: Record<string, { dx: number; dy: number }> = {
    above: { dx: -boxW / 2,           dy: -(nodeSize / 2 + boxH + 4) - slot },
    below: { dx: -boxW / 2,           dy:  (nodeSize / 2 + labelBelowHeight + 4) + slot },
    left:  { dx: -(nodeSize / 2 + boxW + 4) - slotX, dy: -boxH / 2 },
    right: { dx:  (nodeSize / 2 + 4) + slotX,        dy: -boxH / 2 },
  };
  return baseOffsets[position] ?? baseOffsets.above ?? { dx: 0, dy: 0 };
}

export function AnnotationShape({
  ann, nodeX, nodeY, isSelected, stackIndex = 0, onClick, onDragStart, onDoubleClick, snapPreview, labelBelowHeight,
}: {
  ann: PedigreeAnnotation;
  nodeX: number;
  nodeY: number;
  isSelected: boolean;
  stackIndex?: number;
  onClick: () => void;
  onDragStart: (e: React.MouseEvent) => void;
  onDoubleClick?: () => void;
  snapPreview?: { dx: number; dy: number } | null;
  labelBelowHeight?: number;
}) {
  const cfg = useCanvasConfig();
  const S   = cfg.config.nodeSize;
  const fs  = ann.fontSize;
  const charW = fs * 0.62;
  const textW = Math.max(24, ann.text.length * charW);
  const padX  = 7;
  const padY  = 4;
  const boxW  = textW + padX * 2;
  const boxH  = fs + padY * 2;

  const isFree = !ann.nodeId;
  const offset = isFree
    ? { dx: -boxW / 2, dy: -boxH / 2 }
    : getAnnotationBaseOffset(ann.position, boxW, boxH, S, stackIndex, labelBelowHeight);
  const { dx, dy } = offset;

  const bx = nodeX + dx + (ann.offsetX ?? 0);
  const by = nodeY + dy + (ann.offsetY ?? 0);

  const lx1 = bx + boxW / 2;
  const ly1 = by + boxH / 2;

  if (ann.hidden) return null;

  const isBold = ann.bold !== undefined ? ann.bold : cfg.config.annBold;
  const isUppercase = ann.uppercase !== undefined ? ann.uppercase : cfg.config.annUppercase;
  const isItalic = ann.italic ?? false;

  return (
    <g
      id={`ann-element-${ann.id}`}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onMouseDown={(e) => { e.stopPropagation(); onDragStart(e); }}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick?.(); }}
      style={{ cursor: isSelected ? "grabbing" : "grab" }}
    >
      {snapPreview && (
        <rect x={nodeX + snapPreview.dx} y={nodeY + snapPreview.dy} width={boxW} height={boxH} rx={3}
          fill="none" stroke={ann.color} strokeWidth={0.8} strokeDasharray="4 3" opacity={0.4} />
      )}
      {isSelected && !isFree && <line x1={lx1} y1={ly1} x2={nodeX} y2={nodeY} stroke={`${ann.color}45`} strokeWidth={1} strokeDasharray="3 2" />}
      <rect x={bx} y={by} width={boxW} height={boxH} rx={3}
        fill="transparent" stroke="none" />
      {isSelected && (
        <rect x={bx - 1} y={by - 1} width={boxW + 2} height={boxH + 2} rx={4}
          fill="none" stroke={ann.color} strokeWidth={0.8} strokeDasharray="3 2" opacity={0.6} />
      )}
      <text x={bx + padX} y={by + padY + fs * 0.78} fontSize={fs} fill={ann.color}
        style={{
          fontFamily: cfg.config.annFontFamily,
          userSelect: "none",
          pointerEvents: "none",
          fontWeight: isBold ? 600 : 400,
          fontStyle: isItalic ? "italic" : "normal",
          textTransform: isUppercase ? "uppercase" : "none"
        }}>
        {isUppercase ? ann.text.toUpperCase() : ann.text}
      </text>
    </g>
  );
}
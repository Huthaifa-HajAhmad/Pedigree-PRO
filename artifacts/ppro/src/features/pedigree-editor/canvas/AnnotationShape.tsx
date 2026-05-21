import { useState, useCallback, useRef, useEffect } from "react";
import type { PedigreeAnnotation } from "@/features/pedigree-editor/canvas/types";
import { useCanvasConfig } from "@/features/pedigree-editor/context/CanvasConfigContext";

export function getAnnotationBaseOffset(
  position: PedigreeAnnotation["position"],
  boxW: number,
  boxH: number,
  nodeSize: number,
  stackIndex: number,
): { dx: number; dy: number } {
  const stackGap = 5;
  const slot = stackIndex * (boxH + stackGap);
  const slotX = stackIndex * (boxW + stackGap);

  const baseOffsets: Record<string, { dx: number; dy: number }> = {
    above: { dx: -boxW / 2,           dy: -(nodeSize / 2 + boxH + 4) - slot },
    below: { dx: -boxW / 2,           dy:  (nodeSize / 2 + 4) + slot },
    left:  { dx: -(nodeSize / 2 + boxW + 4) - slotX, dy: -boxH / 2 },
    right: { dx:  (nodeSize / 2 + 4) + slotX,        dy: -boxH / 2 },
  };
  return baseOffsets[position] ?? baseOffsets.above ?? { dx: 0, dy: 0 };
}

export function AnnotationShape({
  ann, nodeX, nodeY, isSelected, stackIndex = 0, onClick, onDragStart, snapPreview, onUpdateText,
}: {
  ann: PedigreeAnnotation;
  nodeX: number;
  nodeY: number;
  isSelected: boolean;
  stackIndex?: number;
  onClick: () => void;
  onDragStart: (e: React.MouseEvent) => void;
  snapPreview?: { dx: number; dy: number } | null;
  onUpdateText?: (annId: string, text: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(ann.text);
  const inputRef = useRef<HTMLInputElement>(null);
  const cfg = useCanvasConfig();
  const S   = cfg.config.nodeSize;
  const fs  = ann.fontSize;
  const charW = fs * 0.62;
  const textW = Math.max(24, ann.text.length * charW);
  const padX  = 7;
  const padY  = 4;
  const boxW  = textW + padX * 2;
  const boxH  = fs + padY * 2;
  const offset = getAnnotationBaseOffset(ann.position, boxW, boxH, S, stackIndex);
  const { dx, dy } = offset;
  const bx = nodeX + dx + (ann.offsetX ?? 0);
  const by = nodeY + dy + (ann.offsetY ?? 0);

  const lx1 = bx + boxW / 2;
  const ly1 = by + boxH / 2;
  const border = isSelected ? ann.color : `${ann.color}70`;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditText(ann.text);
  }, [ann.text]);

  const commitEdit = useCallback(() => {
    setIsEditing(false);
    const trimmed = editText.trim();
    if (trimmed && trimmed !== ann.text) {
      onUpdateText?.(ann.id, trimmed);
    } else {
      setEditText(ann.text);
    }
  }, [editText, ann.text, ann.id, onUpdateText]);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
    } else if (e.key === "Escape") {
      setEditText(ann.text);
      setIsEditing(false);
    }
  }, [commitEdit, ann.text]);

  return (
    <g
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onMouseDown={(e) => { e.stopPropagation(); onDragStart(e); }}
      onDoubleClick={(e) => { e.stopPropagation(); if (isSelected) setIsEditing(true); }}
      style={{ cursor: isSelected ? "grabbing" : "grab" }}
    >
      {snapPreview && (
        <rect x={nodeX + snapPreview.dx} y={nodeY + snapPreview.dy} width={boxW} height={boxH} rx={3}
          fill="none" stroke={ann.color} strokeWidth={0.8} strokeDasharray="4 3" opacity={0.4} />
      )}
      <line x1={lx1} y1={ly1} x2={nodeX} y2={nodeY} stroke={`${ann.color}45`} strokeWidth={1} strokeDasharray="3 2" />
      <rect x={bx} y={by} width={boxW} height={boxH} rx={3}
        fill="none" stroke={border} strokeWidth={isSelected ? 1.2 : 0.8} />
      {isSelected && (
        <rect x={bx - 1} y={by - 1} width={boxW + 2} height={boxH + 2} rx={4}
          fill="none" stroke={ann.color} strokeWidth={0.8} strokeDasharray="3 2" opacity={0.6} />
      )}
      <text x={bx + padX} y={by + padY + fs * 0.78} fontSize={fs} fill={ann.color}
        style={{ fontFamily: "JetBrains Mono, monospace", userSelect: "none", pointerEvents: "none", fontWeight: 600 }}>
        {ann.text}
      </text>
      {isEditing && (
        <foreignObject x={bx} y={by} width={boxW} height={boxH}>
          <input
            ref={inputRef}
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleEditKeyDown}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              background: "transparent",
              fontSize: fs,
              color: ann.color,
              outline: "none",
              fontFamily: "JetBrains Mono, monospace",
              fontWeight: 600,
              caretColor: ann.color,
            }}
          />
        </foreignObject>
      )}
    </g>
  );
}
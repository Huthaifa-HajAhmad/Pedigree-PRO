import { useRef, useState, useCallback } from "react";
import type { PedigreeNode, PedigreeEdge } from "@/features/pedigree-editor/canvas/types";
import { NODE_SIZE } from "@/features/pedigree-editor/canvas/types";

export function Minimap({
  nodes, edges, viewBox, vbW, vbH, mmW, mmH, onPan, shifted = false, containerClassName = "",
}: {
  nodes: PedigreeNode[];
  edges: PedigreeEdge[];
  viewBox: { x: number; y: number };
  vbW: number;
  vbH: number;
  mmW: number;
  mmH: number;
  onPan: (cx: number, cy: number) => void;
  shifted?: boolean;
  containerClassName?: string;
}) {
  const xs = nodes.length > 0 ? nodes.map((n) => n.x) : [0, 1400];
  const ys = nodes.length > 0 ? nodes.map((n) => n.y) : [0, 900];
  const nodeMinX = Math.min(...xs) - 60;
  const nodeMaxX = Math.max(...xs) + 60;
  const nodeMinY = Math.min(...ys) - 60;
  const nodeMaxY = Math.max(...ys) + 60;

  const minX = nodeMinX;
  const maxX = nodeMaxX;
  const minY = nodeMinY;
  const maxY = nodeMaxY;

  const W = Math.max(maxX - minX, 100);
  const H = Math.max(maxY - minY, 100);

  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // Compute bounding box of visible nodes
  const half = NODE_SIZE / 2;
  const visible = nodes.filter(
    (n) =>
      n.x + half >= viewBox.x &&
      n.x - half <= viewBox.x + vbW &&
      n.y + half >= viewBox.y &&
      n.y - half <= viewBox.y + vbH,
  );

  const hasVisible = visible.length > 0;
  const vX = hasVisible
    ? Math.min(...visible.map((n) => n.x)) - half
    : viewBox.x;
  const vY = hasVisible
    ? Math.min(...visible.map((n) => n.y)) - half
    : viewBox.y;
  const vW = hasVisible
    ? Math.max(...visible.map((n) => n.x)) - vX + NODE_SIZE
    : vbW;
  const vH = hasVisible
    ? Math.max(...visible.map((n) => n.y)) - vY + NODE_SIZE
    : vbH;

  const dragRef = useRef<{ startX: number; startY: number; vbX: number; vbY: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleViewportPointerDown = useCallback((e: React.PointerEvent<SVGRectElement>) => {
    e.stopPropagation();
    (e.target as SVGRectElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, vbX: viewBox.x, vbY: viewBox.y };
    setIsDragging(true);
  }, [viewBox.x, viewBox.y]);

  const handleViewportPointerMove = useCallback((e: React.PointerEvent<SVGRectElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const scale = W / mmW;
    const newVbX = d.vbX + dx * scale;
    const newVbY = d.vbY + dy * scale;
    onPan(newVbX + vbW / 2, newVbY + vbH / 2);
  }, [W, mmW, vbW, vbH, onPan]);

  const handleViewportPointerUp = useCallback((e: React.PointerEvent<SVGRectElement>) => {
    (e.target as SVGRectElement).releasePointerCapture(e.pointerId);
    dragRef.current = null;
    setIsDragging(false);
  }, []);

  return (
    <div
      className={`absolute bottom-4 rounded-lg border border-border/50 overflow-hidden select-none bg-popover/95 backdrop-blur-sm shadow-lg ${shifted ? "right-[296px] z-40" : "right-4 z-20"} ${containerClassName}`}
      style={{ width: mmW, height: mmH }}
      title="Click to pan, drag viewport to scroll"
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const cx = minX + ((e.clientX - rect.left) / mmW) * W;
        const cy = minY + ((e.clientY - rect.top) / mmH) * H;
        onPan(cx, cy);
      }}
    >
      <svg width={mmW} height={mmH} viewBox={`${minX} ${minY} ${W} ${H}`}>
        {nodes.map((n) => (
          <circle
            key={n.id}
            cx={n.x}
            cy={n.y}
            r={5}
            fill={
              n.affected
                ? "hsl(var(--primary))"
                : n.carrier
                ? "hsl(var(--primary))"
                : "hsl(var(--foreground) / 0.4)"
            }
            opacity={0.9}
          />
        ))}
        {edges.map((edge) => {
          const src = nodeById.get(edge.sourceId);
          const tgt = nodeById.get(edge.targetId);
          if (!src || !tgt) return null;
          return (
            <line
              key={edge.id}
              x1={src.x} y1={src.y}
              x2={tgt.x} y2={tgt.y}
              stroke="hsl(var(--foreground) / 0.18)"
              strokeWidth={2}
            />
          );
        })}
        {/* Viewport indicator — interactive, bounds of visible nodes */}
        <g>
          <rect
            x={vX}
            y={vY}
            width={vW}
            height={vH}
            fill="hsl(var(--primary) / 0.14)"
            stroke="hsl(var(--primary))"
            strokeWidth={1.5}
            rx={4}
            style={{ cursor: isDragging ? "grabbing" : "grab" }}
            onPointerDown={handleViewportPointerDown}
            onPointerMove={handleViewportPointerMove}
            onPointerUp={handleViewportPointerUp}
          />
        </g>
      </svg>
    </div>
  );
}

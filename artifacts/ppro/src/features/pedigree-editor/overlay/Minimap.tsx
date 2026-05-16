import type { PedigreeNode, PedigreeEdge } from "@/features/pedigree-editor/canvas/types";

export function Minimap({
  nodes, edges, viewBox, vbW, vbH, mmW, mmH, onPan,
}: {
  nodes: PedigreeNode[];
  edges: PedigreeEdge[];
  viewBox: { x: number; y: number };
  vbW: number;
  vbH: number;
  mmW: number;
  mmH: number;
  onPan: (x: number, y: number) => void;
}) {
  const xs = nodes.length > 0 ? nodes.map((n) => n.x) : [0, 1400];
  const ys = nodes.length > 0 ? nodes.map((n) => n.y) : [0, 900];
  const minX = Math.min(...xs) - 60;
  const maxX = Math.max(...xs) + 60;
  const minY = Math.min(...ys) - 60;
  const maxY = Math.max(...ys) + 60;
  const W = Math.max(maxX - minX, 100);
  const H = Math.max(maxY - minY, 100);

  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  return (
    <div
      className="absolute bottom-4 right-4 z-20 rounded-lg border border-border/50 overflow-hidden cursor-crosshair select-none bg-popover/95 backdrop-blur-sm shadow-lg"
      style={{ width: mmW, height: mmH }}
      title="Click to pan"
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const fx = (e.clientX - rect.left) / mmW;
        const fy = (e.clientY - rect.top) / mmH;
        onPan(fx, fy);
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
        <rect
          x={viewBox.x}
          y={viewBox.y}
          width={vbW}
          height={vbH}
          fill="hsl(var(--primary) / 0.06)"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          rx={6}
          style={{ pointerEvents: "none" }}
        />
      </svg>
    </div>
  );
}
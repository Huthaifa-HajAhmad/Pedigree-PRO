import type { PedigreeNode, PedigreeEdge } from "@/features/pedigree-editor/canvas/types";

const W = 1400;
const H = 900;

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
  return (
    <div
      className="absolute bottom-10 right-3 z-20 rounded border border-border/70 overflow-hidden cursor-crosshair select-none"
      style={{ width: mmW, height: mmH, background: "rgba(8,8,8,0.82)", backdropFilter: "blur(6px)" }}
      title="Click to pan"
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const fx = (e.clientX - rect.left) / mmW;
        const fy = (e.clientY - rect.top) / mmH;
        onPan(fx, fy);
      }}
    >
      <svg width={mmW} height={mmH} viewBox={`0 0 ${W} ${H}`}>
        {nodes.map((n) => (
          <circle
            key={n.id}
            cx={n.x}
            cy={n.y}
            r={10}
            fill={
              n.affected
                ? "hsl(var(--primary))"
                : n.carrier
                ? "#FACC15"
                : "rgba(255,255,255,0.4)"
            }
            opacity={0.9}
          />
        ))}
        {edges.map((edge) => {
          const src = nodes.find((n) => n.id === edge.sourceId);
          const tgt = nodes.find((n) => n.id === edge.targetId);
          if (!src || !tgt) return null;
          return (
            <line
              key={edge.id}
              x1={src.x} y1={src.y}
              x2={tgt.x} y2={tgt.y}
              stroke="rgba(255,255,255,0.18)"
              strokeWidth={4}
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
          strokeWidth={10}
          rx={6}
          style={{ pointerEvents: "none" }}
        />
      </svg>
    </div>
  );
}
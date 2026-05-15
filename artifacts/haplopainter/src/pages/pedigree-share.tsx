import { useParams, Link } from "wouter";
import { memo } from "react";
import { useGetSharedPedigree } from "@workspace/api-client-react";
import type { PedigreeNode, PedigreeEdge } from "@/features/pedigree-editor/canvas/types";

interface CanvasData {
  nodes: PedigreeNode[];
  edges: PedigreeEdge[];
}

function parseCanvas(raw: string | null | undefined): CanvasData {
  if (!raw) return { nodes: [], edges: [] };
  try {
    const parsed = JSON.parse(raw);
    return parsed && Array.isArray(parsed.nodes) ? parsed : { nodes: [], edges: [] };
  } catch {
    return { nodes: [], edges: [] };
  }
}

const NODE_SIZE = 44;
const NEON = "hsl(235 75% 62%)";

const EdgeLine = memo(({ edge, nodes }: { edge: PedigreeEdge; nodes: PedigreeNode[] }) => {
  const src = nodes.find((n) => n.id === edge.sourceId);
  const tgt = nodes.find((n) => n.id === edge.targetId);
  if (!src || !tgt) return null;

  if (edge.type === "couple") {
    return <line x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y} stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} />;
  }

  if (edge.type === "consanguinity") {
    const x1 = src.x + NODE_SIZE / 2, y1 = src.y;
    const x2 = tgt.x - NODE_SIZE / 2, y2 = tgt.y;
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ox = (-dy / len) * 3.5;
    const oy = (dx / len) * 3.5;
    return (
      <g stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} fill="none">
        <line x1={x1 + ox} y1={y1 + oy} x2={x2 + ox} y2={y2 + oy} />
        <line x1={x1 - ox} y1={y1 - oy} x2={x2 - ox} y2={y2 - oy} />
      </g>
    );
  }

  const dropY = src.y + NODE_SIZE / 2 + 20;
  return (
    <g stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} fill="none">
      <line x1={src.x} y1={src.y + NODE_SIZE / 2} x2={src.x} y2={dropY} />
      <line x1={src.x} y1={dropY} x2={tgt.x} y2={dropY} />
      <line x1={tgt.x} y1={dropY} x2={tgt.x} y2={tgt.y - NODE_SIZE / 2} />
    </g>
  );
});

const NodeShape = memo(({ node }: { node: PedigreeNode }) => {
  const stroke = node.affected ? NEON : "rgba(255,255,255,0.45)";
  const fill = node.affected ? "rgba(57,255,20,0.22)" : "rgba(30,30,30,0.85)";

  return (
    <g transform={`translate(${node.x}, ${node.y})`}>
      {node.type === "male" && (
        <rect x={-NODE_SIZE / 2} y={-NODE_SIZE / 2} width={NODE_SIZE} height={NODE_SIZE}
          fill={fill} stroke={stroke} strokeWidth={node.affected ? 2 : 1.5} rx={2}
          style={node.affected ? { filter: `drop-shadow(0 0 6px ${NEON})` } : {}} />
      )}
      {node.type === "female" && (
        <circle cx={0} cy={0} r={NODE_SIZE / 2}
          fill={fill} stroke={stroke} strokeWidth={node.affected ? 2 : 1.5}
          style={node.affected ? { filter: `drop-shadow(0 0 6px ${NEON})` } : {}} />
      )}
      {node.type === "unknown" && (
        <polygon points={`0,${-NODE_SIZE / 2} ${NODE_SIZE / 2},${NODE_SIZE / 4} ${-NODE_SIZE / 2},${NODE_SIZE / 4}`}
          fill={fill} stroke={stroke} strokeWidth={node.affected ? 2 : 1.5}
          style={node.affected ? { filter: `drop-shadow(0 0 6px ${NEON})` } : {}} />
      )}
      {node.type === "sab" && (
        <polygon
          points={`0,${NODE_SIZE * 0.36} ${-NODE_SIZE * 0.38},${-NODE_SIZE * 0.26} ${NODE_SIZE * 0.38},${-NODE_SIZE * 0.26}`}
          fill={node.affected ? "rgba(57,255,20,0.22)" : "rgba(200,200,200,0.22)"}
          stroke={stroke} strokeWidth={node.affected ? 2 : 1.5}
          style={node.affected ? { filter: `drop-shadow(0 0 6px ${NEON})` } : {}}
        />
      )}
      {node.deceased && (
        <line x1={-NODE_SIZE / 2 - 8} y1={NODE_SIZE / 2 + 8}
          x2={NODE_SIZE / 2 + 8} y2={-NODE_SIZE / 2 - 8}
          stroke="rgba(255,255,255,0.55)" strokeWidth={1.5} />
      )}
      {node.proband && (
        <text x={-NODE_SIZE / 2 - 16} y={8} fontSize={16} fill={NEON} style={{ userSelect: "none" }}>→</text>
      )}
      {node.label && (
        <text x={0} y={NODE_SIZE / 2 + 14} textAnchor="middle"
          fontSize={11} fill="rgba(255,255,255,0.7)" style={{ userSelect: "none" }}>
          {node.label}
        </text>
      )}
      {node.age && (
        <text x={0} y={NODE_SIZE / 2 + 26} textAnchor="middle"
          fontSize={9} fill="rgba(255,255,255,0.35)" style={{ userSelect: "none" }}>
          {node.age}y
        </text>
      )}
    </g>
  );
});

export default function PedigreeShare() {
  const { token } = useParams<{ token: string }>();

  const { data: pedigree, isLoading, isError } = useGetSharedPedigree(token ?? "");

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3" style={{ background: "#0a0a0a" }}>
        <div className="text-primary animate-pulse tracking-widest text-sm font-mono">LOADING...</div>
      </div>
    );
  }

  if (isError || !pedigree) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4" style={{ background: "#0a0a0a" }}>
        <div className="text-5xl font-mono" style={{ color: NEON }}>404</div>
        <div className="text-muted-foreground text-sm font-mono">This share link is invalid or has expired.</div>
        <Link href="/">
          <button className="mt-4 px-4 py-2 rounded border border-border text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors font-mono">
            ← Back to Pedigree PRO
          </button>
        </Link>
      </div>
    );
  }

  const canvas = parseCanvas((pedigree as any).canvas_data);

  const xs = canvas.nodes.map((n) => n.x);
  const ys = canvas.nodes.map((n) => n.y);
  const minX = xs.length ? Math.min(...xs) - 80 : 0;
  const minY = ys.length ? Math.min(...ys) - 80 : 0;
  const maxX = xs.length ? Math.max(...xs) + 80 : 800;
  const maxY = ys.length ? Math.max(...ys) + 80 : 500;
  const vbW = maxX - minX;
  const vbH = maxY - minY;

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: "#0a0a0a", fontFamily: "'JetBrains Mono', monospace" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0"
        style={{ borderColor: "#1f1f1f", background: "#111" }}>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold tracking-widest text-primary">PEDIGREE PRO</span>
          <span className="text-muted-foreground text-xs">•</span>
          <span className="text-sm font-semibold">{pedigree.title}</span>
          <span className="px-1.5 py-0.5 rounded text-xs font-mono border text-primary border-primary/25 bg-primary/10">
            READ-ONLY
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          Last updated {new Date((pedigree as any).updated_at).toLocaleDateString()}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-hidden relative" style={{
        backgroundImage: "radial-gradient(circle, #1a1a1a 1px, transparent 1px)",
        backgroundSize: "28px 28px",
      }}>
        {canvas.nodes.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-muted-foreground text-sm font-mono">No pedigree data in this canvas.</span>
          </div>
        ) : (
          <svg className="w-full h-full" viewBox={`${minX} ${minY} ${vbW} ${vbH}`} preserveAspectRatio="xMidYMid meet">
            <g>
              {canvas.edges.map((edge) => (
                <EdgeLine key={edge.id} edge={edge} nodes={canvas.nodes} />
              ))}
            </g>
            <g>
              {canvas.nodes.map((node) => (
                <NodeShape key={node.id} node={node} />
              ))}
            </g>
          </svg>
        )}
      </div>

      {/* Notes footer */}
      {pedigree.notes && (
        <div className="px-5 py-3 border-t flex-shrink-0"
          style={{ borderColor: "#1f1f1f", background: "#111" }}>
          <span className="text-xs text-muted-foreground mr-2 uppercase tracking-widest">Notes:</span>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>{pedigree.notes}</span>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-6 px-5 py-2 border-t flex-shrink-0"
        style={{ borderColor: "#1f1f1f", background: "#0d0d0d" }}>
        {[
          { shape: "square", label: "Male" },
          { shape: "circle", label: "Female" },
          { shape: "diamond", label: "Unknown" },
          { shape: "filled", label: "Affected" },
        ].map(({ shape, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="-7 -7 14 14">
              {shape === "square" && <rect x="-5" y="-5" width="10" height="10" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" rx="1" />}
              {shape === "circle" && <circle cx="0" cy="0" r="5" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" />}
              {shape === "diamond" && <polygon points="0,-5 5,2 -5,2" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" />}
              {shape === "filled" && <circle cx="0" cy="0" r="5" fill="rgba(57,255,20,0.25)" stroke={NEON} strokeWidth="1.2" />}
            </svg>
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
        <span className="ml-auto text-xs text-muted-foreground opacity-50">
          View-only · Shared via Pedigree PRO
        </span>
      </div>
    </div>
  );
}

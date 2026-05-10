import { memo } from "react";
import type { PedigreeNode } from "./types";
import { NODE_SIZE } from "./types";
import { CANVAS_PRIMARY } from "@/lib/canvas-theme";

interface NodeShapeProps {
  node: PedigreeNode;
  selected: boolean;
  isLinkSource: boolean;
  invalid: boolean;
  autoLabel?: string;
  onClick: (e: React.MouseEvent) => void;
  onDragStart: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  animated?: boolean;
}

export const NodeShape = memo(function NodeShape({
  node, selected, isLinkSource, invalid, autoLabel, onClick, onDragStart, onContextMenu, onDoubleClick, animated = true,
}: NodeShapeProps) {
  const ERR = "#FF4040";
  const highlight = isLinkSource ? "#00BFFF" : CANVAS_PRIMARY;
  const stroke = invalid
    ? ERR
    : selected || isLinkSource
    ? highlight
    : "hsl(var(--foreground) / 0.75)";
  const fill = node.affected
    ? "hsl(var(--foreground))"
    : node.carrier
    ? "hsl(var(--primary) / 0.08)"
    : invalid
    ? "rgba(255,64,64,0.07)"
    : "hsl(var(--card))";
  const strokeWidth = selected || isLinkSource || invalid ? 2.5 : 1.5;
  const glow = invalid
    ? { filter: `drop-shadow(0 0 6px ${ERR})` }
    : selected || isLinkSource
    ? { filter: `drop-shadow(0 0 7px ${highlight})` }
    : {};
  const S = NODE_SIZE;

  return (
    <g
      role="img"
      aria-label={`${node.type}${node.label ? `: ${node.label}` : ""}${node.affected ? " (affected)" : ""}${node.carrier ? " (carrier)" : ""}`}
      transform={`translate(${node.x}, ${node.y})`}
      style={{ cursor: "grab", transition: animated ? "transform 0.35s cubic-bezier(0.4,0,0.2,1)" : "none" }}
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(e); }}
      onMouseDown={(e) => { e.stopPropagation(); onDragStart(e); }}
      onContextMenu={(e) => { e.stopPropagation(); onContextMenu(e); }}
    >
      {selected && (
        <rect x={-S / 2 - 5} y={-S / 2 - 5} width={S + 10} height={S + 10}
          fill="none" stroke={highlight} strokeWidth={1} strokeDasharray="3 3" opacity={0.5} rx={4} />
      )}
      {node.pinned && (
        <circle cx={S / 2 + 4} cy={-S / 2 - 4} r={3} fill="hsl(var(--muted-foreground))" opacity={0.6} />
      )}
      {/* Shapes by type */}
      {node.type === "male" && (
        <rect x={-S / 2} y={-S / 2} width={S} height={S} fill={fill} stroke={stroke} strokeWidth={strokeWidth} rx={2} style={glow} />
      )}
      {node.type === "female" && (
        <circle cx={0} cy={0} r={S / 2} fill={fill} stroke={stroke} strokeWidth={strokeWidth} style={glow} />
      )}
      {node.type === "unknown" && (
        <polygon points={`0,${-S / 2} ${S / 2},${S / 4} ${-S / 2},${S / 4}`} fill={fill} stroke={stroke} strokeWidth={strokeWidth} style={glow} />
      )}
      {node.type === "pregnancy" && (
        <>
          <polygon points={`0,${-S / 2} ${S / 2},0 0,${S / 2} ${-S / 2},0`} fill={fill} stroke={stroke} strokeWidth={strokeWidth} style={glow} />
          <text x={0} y={4} textAnchor="middle" fontSize={9} fill={stroke} style={{ userSelect: "none", fontFamily: "JetBrains Mono, monospace" }}>P</text>
        </>
      )}
      {node.type === "sab" && (
        <polygon points={`0,${S * 0.36} ${-S * 0.38},${-S * 0.26} ${S * 0.38},${-S * 0.26}`}
          fill={invalid ? "rgba(255,64,64,0.07)" : node.affected ? "hsl(var(--foreground))" : "hsl(var(--card))"} stroke={stroke} strokeWidth={strokeWidth} style={glow} />
      )}
      {node.carrier && !node.affected && <circle cx={0} cy={0} r={5} fill={CANVAS_PRIMARY} opacity={0.85} />}
      {node.deceased && (
        <line x1={-S / 2 - 8} y1={S / 2 + 8} x2={S / 2 + 8} y2={-S / 2 - 8} stroke="hsl(var(--foreground) / 0.6)" strokeWidth={1.5} />
      )}
      {node.proband && (
        <g>
          <line x1={-S / 2 - 16} y1={S / 2 + 16} x2={-S / 2 - 5} y2={S / 2 + 5} stroke="hsl(var(--foreground))" strokeWidth={2} strokeLinecap="round" />
          <polygon points={`${-S / 2},${S / 2} ${-S / 2 - 2.8},${S / 2 + 8.5} ${-S / 2 - 8.5},${S / 2 + 2.8}`} fill="hsl(var(--foreground))" />
        </g>
      )}
      {/* Labels */}
      {autoLabel && <text x={0} y={S / 2 + 13} textAnchor="middle" fontSize={8} fill="hsl(var(--foreground) / 0.45)" style={{ userSelect: "none", fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.05em" }}>{autoLabel}</text>}
      {node.label && <text x={0} y={autoLabel ? S / 2 + 24 : S / 2 + 14} textAnchor="middle" fontSize={9} fill="hsl(var(--foreground))" style={{ userSelect: "none", fontFamily: "JetBrains Mono, monospace" }}>{node.label}</text>}
      {node.age && <text x={0} y={(autoLabel ? S / 2 + 24 : S / 2 + 14) + (node.label ? 11 : 0)} textAnchor="middle" fontSize={8} fill="hsl(var(--foreground) / 0.55)" style={{ userSelect: "none", fontFamily: "JetBrains Mono, monospace" }}>{node.age}y</text>}
      {node.dob && !node.age && <text x={0} y={(autoLabel ? S / 2 + 24 : S / 2 + 14) + (node.label ? 11 : 0)} textAnchor="middle" fontSize={8} fill="hsl(var(--foreground) / 0.5)" style={{ userSelect: "none", fontFamily: "JetBrains Mono, monospace" }}>b.{node.dob.slice(0, 4)}</text>}
      {node.condition && (
        <text x={0} y={(autoLabel ? S / 2 + 24 : S / 2 + 14) + (node.label ? 11 : 0) + ((node.age || node.dob) ? 11 : 0) + 11}
          textAnchor="middle" fontSize={8} fill="hsl(var(--foreground) / 0.65)" style={{ userSelect: "none", fontFamily: "JetBrains Mono, monospace", fontStyle: "italic" }}>
          {node.condition.length > 18 ? node.condition.slice(0, 17) + "…" : node.condition}
        </text>
      )}
    </g>
  );
});

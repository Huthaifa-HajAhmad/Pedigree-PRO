import { memo, useState, useRef, useCallback, useEffect } from "react";
import type { PedigreeNode } from "./types";
import { useCanvasConfig } from "@/features/pedigree-editor/context/CanvasConfigContext";


interface NodeShapeProps {
  node: PedigreeNode;
  selected: boolean;
  isLinkSource: boolean;
  isTwinCandidate?: boolean;
  invalid: boolean;
  autoLabel?: string;
  hasEdges?: boolean;
  renderOffsetY?: number;
  onClick: (e: React.MouseEvent) => void;
  onDragStart: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  diffStatus?: "added" | "deleted" | "modified" | null;
}

export const NodeShape = memo(function NodeShape({
  node, selected, isLinkSource, isTwinCandidate, invalid, autoLabel, hasEdges = true, renderOffsetY = 0, onClick, onDragStart, onContextMenu, onDoubleClick, diffStatus,
}: NodeShapeProps) {
  const cfg = useCanvasConfig();
  const [showHint, setShowHint] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    hoverTimerRef.current = setTimeout(() => setShowHint(true), 1500);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current !== null) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setShowHint(false);
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current !== null) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const ERR = "#FF4040";
  const DIFF_DELETED = "#EF4444";
  const DIFF_ADDED = "#10B981";
  const DIFF_MODIFIED = "#F59E0B";

  const highlight = isLinkSource ? "#00BFFF" : "hsl(var(--primary))";
  const stroke = invalid
    ? ERR
    : diffStatus === "deleted"
    ? DIFF_DELETED
    : diffStatus === "added"
    ? DIFF_ADDED
    : diffStatus === "modified"
    ? DIFF_MODIFIED
    : selected || isLinkSource
    ? highlight
    : (cfg.config.nodeStrokeColor || "hsl(var(--foreground) / 0.75)");
  const fill = invalid
    ? "rgba(255,64,64,0.07)"
    : node.affected
    ? (node.color || "hsl(var(--foreground))")
    : node.color
    ? node.color
    : node.carrier
    ? "hsl(var(--primary) / 0.08)"
    : "hsl(var(--card))";
  const S = cfg.config.nodeSize;
  const strokeWidth = selected || isLinkSource || invalid || diffStatus ? cfg.config.edgeWidthSelected : cfg.config.edgeWidthNormal;
  const carrierR = cfg.config.carrierDotRadius;
  const glow = invalid
    ? { filter: `drop-shadow(0 0 6px ${ERR})` }
    : diffStatus === "modified"
    ? { filter: `drop-shadow(0 0 6px ${DIFF_MODIFIED})` }
    : selected || isLinkSource
    ? { filter: `drop-shadow(0 0 7px ${highlight})` }
    : {};

  const strokeDash = (diffStatus === "deleted" || diffStatus === "added") ? "4 3" : undefined;

  return (
    <g
      role="img"
      aria-label={`${node.type}${node.label ? `: ${node.label}` : ""}${node.affected ? " (affected)" : ""}${node.carrier ? " (carrier)" : ""}`}
      transform={`translate(${node.x}, ${node.y + renderOffsetY})`}
      style={{ cursor: "grab" }}
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(e); }}
      onMouseDown={(e) => { e.stopPropagation(); if (hoverTimerRef.current !== null) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; } setShowHint(false); onDragStart(e); }}
      onContextMenu={(e) => { e.stopPropagation(); onContextMenu(e); }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {selected && (
        <rect x={-S / 2 - 5} y={-S / 2 - 5} width={S + 10} height={S + 10}
          fill="none" stroke={highlight} strokeWidth={1} strokeDasharray="3 3" opacity={0.5} rx={4} />
      )}
      {isTwinCandidate && (
        <rect x={-S / 2 - 6} y={-S / 2 - 6} width={S + 12} height={S + 12}
          fill="none" stroke="#F59E0B" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.85} rx={4} />
      )}
      {node.pinned && (
        <circle cx={S / 2 + 4} cy={-S / 2 - 4} r={3} fill="hsl(var(--muted-foreground))" opacity={0.6} />
      )}
      {/* Shapes by type */}
      {node.type === "male" && (
        <rect x={-S / 2} y={-S / 2} width={S} height={S} fill={fill} stroke={stroke} strokeWidth={strokeWidth} rx={0} style={glow} strokeDasharray={strokeDash} />
      )}
      {node.type === "female" && (
        <circle cx={0} cy={0} r={S / 2} fill={fill} stroke={stroke} strokeWidth={strokeWidth} style={glow} strokeDasharray={strokeDash} />
      )}
      {node.type === "unknown" && (
        <polygon points={`0,${-S / 2} ${S / 2},0 0,${S / 2} ${-S / 2},0`} fill={fill} stroke={stroke} strokeWidth={strokeWidth} style={glow} strokeDasharray={strokeDash} />
      )}
      {node.type === "pregnancy" && (
        <>
          <polygon points={`0,${-S / 2} ${S / 2},0 0,${S / 2} ${-S / 2},0`} fill={fill} stroke={stroke} strokeWidth={strokeWidth} style={glow} strokeDasharray={strokeDash} />
          {!node.insideText && <text x={0} y={4} textAnchor="middle" fontSize={9} fill={stroke} style={{ userSelect: "none", fontFamily: "JetBrains Mono, monospace" }}>P</text>}
        </>
      )}
      {node.type === "sab" && (
        <polygon points={`0,${S * 0.36} ${-S * 0.38},${-S * 0.26} ${S * 0.38},${-S * 0.26}`}
          fill={fill} stroke={stroke} strokeWidth={strokeWidth} style={glow} strokeDasharray={strokeDash} />
      )}
      {node.insideText && (
        <text x={0} y={4} textAnchor="middle" fontSize={S * 0.38} fill={node.affected ? "white" : "#374151"} style={{ userSelect: "none", fontFamily: "Inter, sans-serif", fontWeight: 600 }}>
          {node.insideText}
        </text>
      )}
      {node.carrier && !node.affected && <circle cx={0} cy={0} r={carrierR} fill={"hsl(var(--primary))"} opacity={0.85} />}
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
      {/* Only show node.label when autoLabel is NOT displayed to avoid garbled/overlapping text */}
      {!autoLabel && node.label && <text x={0} y={S / 2 + 14} textAnchor="middle" fontSize={9} fill="hsl(var(--foreground))" style={{ userSelect: "none", fontFamily: "JetBrains Mono, monospace" }}>{node.label}</text>}
      {node.age && <text x={0} y={(autoLabel ? S / 2 + 24 : S / 2 + 14) + (!autoLabel && node.label ? 11 : 0)} textAnchor="middle" fontSize={8} fill="hsl(var(--foreground) / 0.55)" style={{ userSelect: "none", fontFamily: "JetBrains Mono, monospace" }}>{node.age}y</text>}
      {node.dob && !node.age && <text x={0} y={(autoLabel ? S / 2 + 24 : S / 2 + 14) + (!autoLabel && node.label ? 11 : 0)} textAnchor="middle" fontSize={8} fill="hsl(var(--foreground) / 0.5)" style={{ userSelect: "none", fontFamily: "JetBrains Mono, monospace" }}>{node.dob.length >= 4 ? `b.${node.dob.slice(0, 4)}` : node.dob}</text>}
      {node.condition && (
        <text x={0} y={(autoLabel ? S / 2 + 24 : S / 2 + 14) + (!autoLabel && node.label ? 11 : 0) + ((node.age || node.dob) ? 11 : 0) + 11}
          textAnchor="middle" fontSize={8} fill="hsl(var(--foreground) / 0.65)" style={{ userSelect: "none", fontFamily: "JetBrains Mono, monospace", fontStyle: "italic" }}>
          {node.condition.length > 18 ? node.condition.slice(0, 17) + "…" : node.condition}
        </text>
      )}
      {showHint && hasEdges && (
        <>
          <rect x={-66} y={-S / 2 - 32} width={132} height={26} rx={6}
            fill="hsl(var(--popover))" stroke="hsl(var(--border))" strokeWidth={0.5} opacity={0.98}
            style={{ pointerEvents: "none", filter: "drop-shadow(0 2px 4px hsl(var(--foreground) / 0.12))" }} />
          <text x={0} y={-S / 2 - 15} textAnchor="middle" fontSize={10} fill="hsl(var(--foreground) / 0.9)"
            style={{ userSelect: "none", fontFamily: "Inter, system-ui, sans-serif", pointerEvents: "none", fontWeight: 600, letterSpacing: "0.02em" }}>
            Ctrl+drag → extend line
          </text>
        </>
      )}
    </g>
  );
});

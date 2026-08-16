import React from "react";
import type { SiblingEntry } from "./types";

export interface SiblingPreviewSVGProps {
  siblings: SiblingEntry[];
  displayName: string;
}

export function SiblingPreviewSVG({ siblings, displayName }: SiblingPreviewSVGProps) {
  const W_SVG = 260;
  const H_SVG = 140;

  const allNodes = siblings.map((sb, idx) => {
    if (sb.isSource) {
      return {
        type: sb.type === "sab" || sb.type === "pregnancy" ? "unknown" : sb.type,
        affected: sb.affected,
        carrier: sb.carrier,
        deceased: sb.deceased,
        proband: sb.proband,
        isSource: true,
        label: displayName,
      };
    }
    const sibNum = siblings.filter((s, i) => !s.isSource && i <= idx).length;
    return {
      type: sb.type,
      affected: sb.affected,
      carrier: sb.carrier,
      deceased: sb.deceased,
      proband: sb.proband,
      isSource: false,
      label: `S${sibNum}`,
    };
  });

  const getSiblingCoords = (idx: number, total: number) => {
    if (total === 1) return W_SVG / 2;
    const padding = 30;
    const step = (W_SVG - padding * 2) / (total - 1);
    return padding + idx * step;
  };

  const lineY = 55;
  const nodeY = 85;

  return (
    <div className="rounded-xl border border-border bg-card/45 p-4 flex flex-col items-center justify-center shadow-inner">
      <span className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-wider mb-2.5">Live Pedigree Preview</span>
      <svg width={W_SVG} height={H_SVG} className="overflow-visible bg-transparent">
        <defs>
          <radialGradient id="svgGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(var(--primary) / 0.12)" stopOpacity="1" />
            <stop offset="100%" stopColor="hsl(var(--primary) / 0)" stopOpacity="0" />
          </radialGradient>
          <pattern id="dotPattern" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="hsl(var(--foreground) / 0.04)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dotPattern)" rx={6} />
        <rect width="100%" height="100%" fill="url(#svgGlow)" rx={6} />
        {allNodes.length > 0 && (
          <>
            {/* Sibship horizontal connector line */}
            {allNodes.length > 1 && (
              <>
                <line
                  x1={getSiblingCoords(0, allNodes.length)}
                  y1={lineY}
                  x2={getSiblingCoords(allNodes.length - 1, allNodes.length)}
                  y2={lineY}
                  stroke="hsl(var(--foreground) / 0.25)"
                  strokeWidth={1.5}
                />
                {/* Parent connection line stem */}
                <line
                  x1={W_SVG / 2}
                  y1={lineY}
                  x2={W_SVG / 2}
                  y2={lineY - 15}
                  stroke="hsl(var(--foreground) / 0.25)"
                  strokeWidth={1.5}
                />
              </>
            )}

            {allNodes.map((node, idx) => {
              const cx = getSiblingCoords(idx, allNodes.length);
              const cy = nodeY;
              const r = 11;
              const isSource = node.isSource;

              const fill = node.affected ? (isSource ? "hsl(var(--primary))" : "hsl(var(--foreground))") : "hsl(var(--card))";
              const stroke = isSource ? "hsl(var(--primary))" : (node.affected ? "hsl(var(--foreground))" : "currentColor");
              const sw = isSource ? 2.5 : 1.5;

              const dropLineY2 = cy - r;
              let verticalLine: React.ReactNode;
              if (allNodes.length > 1) {
                verticalLine = (
                  <line
                    x1={cx}
                    y1={lineY}
                    x2={cx}
                    y2={dropLineY2}
                    stroke="hsl(var(--foreground) / 0.25)"
                    strokeWidth={1.5}
                  />
                );
              } else {
                verticalLine = (
                  <line
                    x1={cx}
                    y1={dropLineY2}
                    x2={cx}
                    y2={dropLineY2 - 20}
                    stroke="hsl(var(--foreground) / 0.25)"
                    strokeWidth={1.5}
                  />
                );
              }

              let shapeElement: React.ReactNode;
              if (node.type === "male") {
                shapeElement = <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} fill={fill} stroke={stroke} strokeWidth={sw} rx={0.5} className="transition-all duration-300" />;
              } else if (node.type === "female") {
                shapeElement = <circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth={sw} className="transition-all duration-300" />;
              } else {
                shapeElement = <polygon points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`} fill={fill} stroke={stroke} strokeWidth={sw} className="transition-all duration-300" />;
              }

              return (
                <g key={idx} className="text-foreground cursor-default">
                  {verticalLine}
                  {isSource && (
                    <circle cx={cx} cy={cy} r={r + 4} fill="none" stroke="hsl(var(--primary) / 0.3)" strokeWidth={1} strokeDasharray="3,3" />
                  )}
                  {shapeElement}
                  {node.carrier && !node.affected && (
                    <circle cx={cx} cy={cy} r={2.5} fill={isSource ? "hsl(var(--primary-foreground))" : "hsl(var(--primary))"} />
                  )}
                  {node.deceased && (
                    <line x1={cx - r - 3} y1={cy + r + 3} x2={cx + r + 3} y2={cy - r - 3} stroke={isSource ? "hsl(var(--primary-foreground))" : "currentColor"} strokeWidth={1.5} />
                  )}
                  {node.proband && (
                    <g className={isSource ? "text-primary-foreground" : "text-foreground"}>
                      <line x1={cx - r - 6} y1={cy + r + 6} x2={cx - r - 2} y2={cy + r + 2} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
                      <polygon points={`${cx - r},${cy + r} ${cx - r - 2},${cy + r + 4} ${cx - r - 4},${cy + r + 2}`} fill="currentColor" />
                    </g>
                  )}
                  <text
                    x={cx}
                    y={cy + r + 13}
                    fontSize={8}
                    fontWeight={isSource ? "bold" : "medium"}
                    textAnchor="middle"
                    fill={isSource ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
                    className="font-mono"
                  >
                    {isSource ? "Current" : node.label}
                  </text>
                </g>
              );
            })}
          </>
        )}
      </svg>
    </div>
  );
}

import React from "react";
import type { PedigreeNode } from "@/features/pedigree-editor/canvas/types";

export function DevModeOverlay({
  visibleGenRows,
  viewBox,
  vbW,
  nodes,
  nodeGap,
}: {
  visibleGenRows: number[];
  viewBox: { x: number; y: number; zoom: number };
  vbW: number;
  nodes: PedigreeNode[];
  nodeGap?: number;
}) {
  const nodeGapRadius = (nodeGap ?? 96.8) / 2;

  return (
    <g id="dev-mode-overlay" style={{ pointerEvents: "none" }}>
      {/* Generation Row Y Guides */}
      {visibleGenRows.map((rowY) => (
        <g key={`dev-row-${rowY}`}>
          <line
            x1={viewBox.x} y1={rowY}
            x2={viewBox.x + vbW} y2={rowY}
            stroke="#EF4444" strokeWidth={1} strokeDasharray="3 3" opacity={0.65}
          />
          <rect
            x={viewBox.x + 10} y={rowY - 18}
            width={90} height={16} rx={3}
            fill="#EF4444" opacity={0.8}
          />
          <text
            x={viewBox.x + 15} y={rowY - 6}
            fill="#FFFFFF" fontSize={10} fontWeight="bold"
            fontFamily="JetBrains Mono, monospace"
          >
            Row Y: {rowY}
          </text>
        </g>
      ))}

      {/* Node Bounds, Coordinates & ID overlays */}
      {nodes.map((node) => (
        <g key={`dev-node-${node.id}`}>
          {/* Dashed outer collision boundary of radius NODE_GAP / 2 */}
          <circle
            cx={node.x} cy={node.y} r={nodeGapRadius}
            fill="none" stroke="#10B981" strokeWidth={1.5}
            strokeDasharray="4 4" opacity={0.7}
          />
          {/* Diagnostic text label displaying coordinates and ID */}
          <rect
            x={node.x - 70} y={node.y - 48}
            width={140} height={20} rx={4}
            fill="#1F2937" opacity={0.85}
          />
          <text
            x={node.x} y={node.y - 35}
            textAnchor="middle" fill="#10B981" fontSize={9} fontWeight="bold"
            fontFamily="JetBrains Mono, monospace"
          >
            {node.id} ({Math.round(node.x)}, {Math.round(node.y)})
          </text>
        </g>
      ))}
    </g>
  );
}

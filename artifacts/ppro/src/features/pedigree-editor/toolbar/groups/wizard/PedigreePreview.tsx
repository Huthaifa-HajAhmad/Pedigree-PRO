import React from "react";
import { computeAutoLayout } from "@/lib/auto-layout";
import type { PedigreeWizardConfig } from "./types";
import { generateWizardPedigree } from "./generator";

export function PedigreePreview({ step, config }: { step: number; config: PedigreeWizardConfig }) {
  const rawData = generateWizardPedigree(config, "prev_");
  
  const stepNodes = rawData.nodes.filter(n => {
    if (n.id.endsWith("proband")) return true;
    if (step === 1) return false;
    
    if (n.id.includes("partner") || n.id.includes("son_") || n.id.includes("daughter_")) {
      return step >= 2;
    }
    
    if (n.id.includes("father") || n.id.includes("mother") || n.id.includes("brother_") || n.id.includes("sister_")) {
      return step >= 3;
    }
    
    if (n.id.includes("pgf") || n.id.includes("pgm") || n.id.includes("pat_uncle_") || n.id.includes("pat_aunt_")) {
      return step >= 4;
    }
    
    if (n.id.includes("mgf") || n.id.includes("mgm") || n.id.includes("mat_uncle_") || n.id.includes("mat_aunt_")) {
      return step >= 5;
    }
    
    return true;
  });

  const stepNodeIds = new Set(stepNodes.map(n => n.id));
  const stepEdges = rawData.edges.filter(e => stepNodeIds.has(e.sourceId) && stepNodeIds.has(e.targetId));

  const layoutNodes = stepNodes.map(n => ({ id: n.id, x: 0, y: 0, type: n.type }));
  const layoutEdges = stepEdges.map(e => ({ id: e.id, type: e.type, sourceId: e.sourceId, targetId: e.targetId }));
  const positions = computeAutoLayout(layoutNodes, layoutEdges, false, { enableCache: false });
  
  const nodes = stepNodes.map(n => {
    const pos = positions.find(p => p.id === n.id);
    return pos ? { ...n, x: pos.x, y: pos.y } : { ...n, x: 0, y: 0 };
  });
  const edges = stepEdges;

  if (nodes.length === 0) return null;

  const xs = nodes.map(n => n.x);
  const ys = nodes.map(n => n.y);
  const minX = Math.min(...xs) - 80;
  const maxX = Math.max(...xs) + 80;
  const minY = Math.min(...ys) - 80;
  const maxY = Math.max(...ys) + 120;
  const width = maxX - minX;
  const height = maxY - minY;

  const coupleLines = edges
    .filter(e => e.type === "couple")
    .map(e => {
      const n1 = nodes.find(n => n.id === e.sourceId);
      const n2 = nodes.find(n => n.id === e.targetId);
      if (!n1 || !n2) return null;
      return (
        <line
          key={e.id}
          x1={n1.x}
          y1={n1.y}
          x2={n2.x}
          y2={n2.y}
          className="stroke-slate-300 dark:stroke-slate-700"
          strokeWidth={1.5}
        />
      );
    })
    .filter(Boolean);

  const parentToChildren = new Map<string, string[]>();
  for (const node of nodes) {
    const pEdges = edges.filter(e => e.type === "parent-child" && e.targetId === node.id);
    if (pEdges.length > 0) {
      const pIds = pEdges.map(e => e.sourceId).sort();
      const pKey = pIds.join("|");
      if (!parentToChildren.has(pKey)) {
        parentToChildren.set(pKey, []);
      }
      parentToChildren.get(pKey)!.push(node.id);
    }
  }

  const parentChildLines: React.ReactNode[] = [];
  let lineIndex = 0;

  for (const [pKey, childIds] of parentToChildren) {
    const parentIds = pKey.split("|");
    const childrenNodes = nodes.filter(n => childIds.includes(n.id));
    if (childrenNodes.length === 0) continue;

    if (parentIds.length === 2) {
      const p1 = nodes.find(n => n.id === parentIds[0]);
      const p2 = nodes.find(n => n.id === parentIds[1]);
      if (p1 && p2) {
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        const sibshipY = midY + 45;

        parentChildLines.push(
          <line
            key={`pc_mid_${lineIndex++}`}
            x1={midX}
            y1={midY}
            x2={midX}
            y2={sibshipY}
            className="stroke-slate-300 dark:stroke-slate-700"
            strokeWidth={1.5}
          />
        );

        const childXs = childrenNodes.map(c => c.x);
        const minXBound = Math.min(midX, ...childXs);
        const maxXBound = Math.max(midX, ...childXs);
        if (maxXBound - minXBound > 1) {
          parentChildLines.push(
            <line
              key={`pc_bar_${lineIndex++}`}
              x1={minXBound}
              y1={sibshipY}
              x2={maxXBound}
              y2={sibshipY}
              className="stroke-slate-300 dark:stroke-slate-700"
              strokeWidth={1.5}
            />
          );
        }

        for (const child of childrenNodes) {
          parentChildLines.push(
            <line
              key={`pc_child_${lineIndex++}`}
              x1={child.x}
              y1={sibshipY}
              x2={child.x}
              y2={child.y}
              className="stroke-slate-300 dark:stroke-slate-700"
              strokeWidth={1.5}
            />
          );
        }
      }
    } else if (parentIds.length === 1) {
      const p = nodes.find(n => n.id === parentIds[0]);
      if (p) {
        for (const child of childrenNodes) {
          parentChildLines.push(
            <line
              key={`pc_single_${lineIndex++}`}
              x1={p.x}
              y1={p.y}
              x2={child.x}
              y2={child.y}
              className="stroke-slate-300 dark:stroke-slate-700"
              strokeWidth={1.5}
            />
          );
        }
      }
    }
  }

  return (
    <svg
      viewBox={`${minX} ${minY} ${width} ${height}`}
      className="w-full h-full max-h-[380px] p-2 select-none text-slate-800 dark:text-slate-200"
    >
      <defs>
        <marker
          id="prev-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" className="fill-slate-800 dark:fill-slate-200" />
        </marker>
      </defs>

      <g>{coupleLines}</g>
      <g>{parentChildLines}</g>

      {nodes.map(n => {
        const isMale = n.type === "male";
        const isFemale = n.type === "female";
        const isUnknown = n.type === "unknown";

        return (
          <g key={n.id}>
            {isMale && (
              <rect
                x={n.x - 14}
                y={n.y - 14}
                width={28}
                height={28}
                className={`${
                  n.affected
                    ? "fill-slate-800 dark:fill-slate-200"
                    : "fill-white dark:fill-slate-900"
                } stroke-slate-800 dark:stroke-slate-200`}
                strokeWidth={1.75}
                rx={1.5}
              />
            )}
            {isFemale && (
              <circle
                cx={n.x}
                cy={n.y}
                r={14}
                className={`${
                  n.affected
                    ? "fill-slate-800 dark:fill-slate-200"
                    : "fill-white dark:fill-slate-900"
                } stroke-slate-800 dark:stroke-slate-200`}
                strokeWidth={1.75}
              />
            )}
            {isUnknown && (
              <polygon
                points={`${n.x},${n.y - 18} ${n.x + 18},${n.y} ${n.x},${n.y + 18} ${n.x - 18},${n.y}`}
                className={`${
                  n.affected
                    ? "fill-slate-800 dark:fill-slate-200"
                    : "fill-white dark:fill-slate-900"
                } stroke-slate-800 dark:stroke-slate-200`}
                strokeWidth={1.75}
              />
            )}

            {n.proband && (
              <path
                d={`M ${n.x - 28} ${n.y + 28} L ${n.x - 18} ${n.y + 18}`}
                className="stroke-slate-800 dark:stroke-slate-200 fill-slate-800 dark:fill-slate-200"
                strokeWidth={2}
                markerEnd="url(#prev-arrow)"
              />
            )}

            <text
              x={n.x}
              y={n.y + 28}
              textAnchor="middle"
              fontSize={8.5}
              fontWeight="700"
              className="fill-slate-500 dark:fill-slate-400"
            >
              {n.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

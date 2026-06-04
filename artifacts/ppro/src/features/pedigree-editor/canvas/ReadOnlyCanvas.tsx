import { useMemo } from "react";
import { NodeShape } from "./NodeShape";
import { EdgeLine } from "./EdgeLine";
import { SibshipGroup, computeFamilyChildYOffset } from "./SibshipGroup";
import type { CanvasData, PedigreeNode } from "./types";
import { NODE_SIZE } from "./types";
import { useCanvasConfig } from "@/features/pedigree-editor/context/CanvasConfigContext";

const NOOP_EVENT = (_e: React.MouseEvent) => {};

interface ReadOnlyCanvasProps {
  canvas: CanvasData;
  showGrid?: boolean;
  showAutoLabels?: boolean;
  autoLabels?: Map<string, string>;
}

function computeViewBox(nodes: PedigreeNode[]): { x: number; y: number; w: number; h: number } {
  if (nodes.length === 0) return { x: 0, y: 0, w: 800, h: 500 };
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const labelMaxW = Math.max(...nodes.map((n) => (n.label?.length ?? 0) * 7));
  const padX = Math.max(120, labelMaxW + 40);
  const padY = 100;
  const minX = Math.min(...xs) - padX;
  const minY = Math.min(...ys) - padY;
  const maxX = Math.max(...xs) + padX;
  const maxY = Math.max(...ys) + padY;
  const w = Math.max(maxX - minX, 800);
  const h = Math.max(maxY - minY, 500);
  return { x: minX, y: minY, w, h };
}

function AnnotationReadOnly({ canvas }: { canvas: CanvasData }) {
  const cfg = useCanvasConfig();
  const nodeById = useMemo(() => {
    const map = new Map<string, PedigreeNode>();
    for (const n of canvas.nodes) map.set(n.id, n);
    return map;
  }, [canvas.nodes]);

  return (
    <g>
      {canvas.annotations.map((ann) => {
        if (ann.hidden) return null;
        const node = nodeById.get(ann.nodeId);
        if (!node) return null;
        const fs = ann.fontSize;
        const charW = fs * 0.62;
        const textW = Math.max(24, ann.text.length * charW);
        const padX = 7;
        const padY = 4;
        const boxW = textW + padX * 2;
        const boxH = fs + padY * 2;
        const slot = 0;
        const baseDy = -(NODE_SIZE / 2 + boxH + 4) - slot;
        const bx = node.x + (ann.offsetX ?? 0);
        const by = node.y + baseDy + (ann.offsetY ?? 0);
        const text = cfg.config.annUppercase ? ann.text.toUpperCase() : ann.text;
        return (
          <g key={ann.id}>
            <rect x={bx} y={by} width={boxW} height={boxH} rx={3} fill="transparent" stroke="none" />
            <text x={bx + padX} y={by + padY + fs * 0.78} fontSize={fs} fill={ann.color}
              style={{ fontFamily: cfg.config.annFontFamily, userSelect: "none", pointerEvents: "none", fontWeight: cfg.config.annBold ? 600 : 400, textTransform: cfg.config.annUppercase ? "uppercase" : "none" }}>
              {text}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function SibshipLayer({ edges, nodes, annotations = [], showAutoLabels = false, autoLabels, familyOffsets }: {
  edges: CanvasData["edges"];
  nodes: PedigreeNode[];
  annotations?: CanvasData["annotations"];
  showAutoLabels?: boolean;
  autoLabels?: Map<string, string>;
  familyOffsets?: Map<string, number>;
}) {
  const groups = useMemo(() => {
    const pcEdges = edges.filter((e) => e.type === "parent-child");
    const childParents = new Map<string, string[]>();
    for (const e of pcEdges) {
      if (!childParents.has(e.targetId)) childParents.set(e.targetId, []);
      childParents.get(e.targetId)!.push(e.sourceId);
    }
    const families = new Map<string, { parentIds: string[]; childIds: string[] }>();
    for (const [childId, pIds] of childParents) {
      const key = [...pIds].sort().join("|");
      if (!families.has(key)) families.set(key, { parentIds: [...pIds].sort(), childIds: [] });
      families.get(key)!.childIds.push(childId);
    }
    return [...families.entries()].map(([key, { parentIds, childIds }]) => {
      const coupleEdge = edges.find(
        (e) => (e.type === "couple" || e.type === "consanguinity" || e.type === "divorced" || e.type === "separated") &&
          parentIds.includes(e.sourceId) && parentIds.includes(e.targetId)
      );
      return {
        key: `family-${key}`,
        parentIds,
        childIds,
        nodes,
        invalid: false,
        edgeType: (coupleEdge?.type as "couple" | "consanguinity" | "divorced" | "separated") ?? "couple",
      };
    });
  }, [edges, nodes]);

  return (
    <g>
      {groups.map((g) => (
        <SibshipGroup
          key={g.key}
          parentIds={g.parentIds}
          childIds={g.childIds}
          nodes={g.nodes}
          edges={edges}
          invalid={g.invalid}
          edgeType={g.edgeType}
          annotations={annotations}
          showAutoLabels={showAutoLabels}
          autoLabels={autoLabels}
          parentOffsets={familyOffsets}
          childOffsets={familyOffsets}
        />
      ))}
    </g>
  );
}

export function ReadOnlyCanvas({ canvas, showGrid = false, showAutoLabels = false, autoLabels = new Map<string, string>() }: ReadOnlyCanvasProps) {
  const { x, y, w, h } = computeViewBox(canvas.nodes);
  const nodeIdsWithEdges = useMemo(() => {
    const ids = new Set<string>();
    for (const e of canvas.edges) { ids.add(e.sourceId); ids.add(e.targetId); }
    return ids;
  }, [canvas.edges]);

  const familyOffsets = useMemo(() => {
    const offsets = new Map<string, number>();
    const pcEdges = canvas.edges.filter((e) => e.type === "parent-child");
    const childParents = new Map<string, string[]>();
    for (const e of pcEdges) {
      if (!childParents.has(e.targetId)) childParents.set(e.targetId, []);
      childParents.get(e.targetId)!.push(e.sourceId);
    }
    const families = new Map<string, { parentIds: string[]; childIds: string[] }>();
    for (const [childId, pIds] of childParents) {
      const key = [...pIds].sort().join("|");
      if (!families.has(key)) families.set(key, { parentIds: [...pIds].sort(), childIds: [] });
      families.get(key)!.childIds.push(childId);
    }
    for (const [, { parentIds, childIds }] of families) {
      const familyMap = computeFamilyChildYOffset(parentIds, childIds, canvas.nodes, canvas.annotations, NODE_SIZE, showAutoLabels, autoLabels, offsets);
      for (const [nid, delta] of familyMap) offsets.set(nid, delta);
    }
    return offsets;
  }, [canvas.nodes, canvas.edges, canvas.annotations, showAutoLabels, autoLabels]);

  return (
    <div className={`flex-1 overflow-hidden relative ${showGrid ? "grid-bg" : ""}`}>
      <svg className="w-full h-full" viewBox={`${x} ${y} ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
        <g>
          {canvas.edges.filter((e) => e.type !== "parent-child").map((edge) => (
            <EdgeLine key={edge.id} edge={edge} nodes={canvas.nodes} invalid={false} />
          ))}
        </g>

        <SibshipLayer edges={canvas.edges} nodes={canvas.nodes} annotations={canvas.annotations} showAutoLabels={showAutoLabels} autoLabels={autoLabels} familyOffsets={familyOffsets} />

        <g>
          {canvas.nodes.map((node) => (
            <NodeShape
              key={node.id}
              node={node}
              selected={false}
              isLinkSource={false}
              invalid={false}
              autoLabel={showAutoLabels ? autoLabels.get(node.id) : undefined}
              hasEdges={nodeIdsWithEdges.has(node.id)}
              renderOffsetY={0}
              onClick={NOOP_EVENT}
              onDragStart={NOOP_EVENT}
              onContextMenu={NOOP_EVENT}
              onDoubleClick={NOOP_EVENT}
            />
          ))}
        </g>

        <AnnotationReadOnly canvas={canvas} />
      </svg>
    </div>
  );
}

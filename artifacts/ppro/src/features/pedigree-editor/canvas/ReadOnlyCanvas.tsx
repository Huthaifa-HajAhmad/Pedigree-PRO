import { useMemo } from "react";
import { NodeShape } from "./NodeShape";
import { EdgeLine } from "./EdgeLine";
import { SibshipGroup, computeFamilyChildYOffset } from "./SibshipGroup";
import type { CanvasData, PedigreeNode } from "./types";
import { NODE_SIZE } from "./types";
import { groupFamiliesByParents } from "@/lib/layout-shared";
import { useCanvasConfig } from "@/features/pedigree-editor/context/CanvasConfigContext";
import { getAnnotationBaseOffset } from "./AnnotationShape";

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

  const stackIndexById = useMemo(() => {
    const map = new Map<string, number>();
    const grouped = new Map<string, string[]>();
    for (const a of canvas.annotations) {
      if (!a.nodeId) continue;
      const key = `${a.nodeId}|${a.position}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(a.id);
    }
    for (const ids of grouped.values()) {
      ids.forEach((id, idx) => map.set(id, idx));
    }
    return map;
  }, [canvas.annotations]);

  return (
    <g>
      {canvas.annotations.map((ann) => {
        if (ann.hidden) return null;
        const isFree = !ann.nodeId;
        const node = isFree ? null : nodeById.get(ann.nodeId);
        if (!isFree && !node) return null;

        const fs = ann.fontSize;
        const charW = fs * 0.62;
        const textW = Math.max(24, ann.text.length * charW);
        const padX = 7;
        const padY = 4;
        const boxW = textW + padX * 2;
        const boxH = fs + padY * 2;

        let bx = 0;
        let by = 0;

        if (isFree) {
          bx = (ann.x ?? 0) - boxW / 2;
          by = (ann.y ?? 0) - boxH / 2;
        } else if (node) {
          const stackIndex = stackIndexById.get(ann.id) ?? 0;
          let labelBelowHeight = 0;
          if (node.label) labelBelowHeight = 14;
          if (node.age) labelBelowHeight += 11;
          if (node.condition) labelBelowHeight += 11;

          const offset = getAnnotationBaseOffset(ann.position, boxW, boxH, NODE_SIZE, stackIndex, labelBelowHeight);
          bx = node.x + offset.dx + (ann.offsetX ?? 0);
          by = node.y + offset.dy + (ann.offsetY ?? 0);
        }

        const isBold = ann.bold !== undefined ? ann.bold : cfg.config.annBold;
        const isUppercase = ann.uppercase !== undefined ? ann.uppercase : cfg.config.annUppercase;
        const isItalic = ann.italic ?? false;
        const text = isUppercase ? ann.text.toUpperCase() : ann.text;

        return (
          <g key={ann.id}>
            <rect x={bx} y={by} width={boxW} height={boxH} rx={3} fill="transparent" stroke="none" />
            <text x={bx + padX} y={by + padY + fs * 0.78} fontSize={fs} fill={ann.color}
              style={{
                fontFamily: cfg.config.annFontFamily,
                userSelect: "none",
                pointerEvents: "none",
                fontWeight: isBold ? 600 : 400,
                fontStyle: isItalic ? "italic" : "normal",
                textTransform: isUppercase ? "uppercase" : "none"
              }}>
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
    const familyList = groupFamiliesByParents(childParents);
    return familyList.map(({ parentIds, childIds }) => {
      const key = [...parentIds].sort().join("|");
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
  const { config } = useCanvasConfig();
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
    const familyList = groupFamiliesByParents(childParents);
    const nodeMap = new Map(canvas.nodes.map((n) => [n.id, n]));
    const sortedFamilies = familyList.sort((a, b) => {
      const aParent = a.parentIds[0] ? nodeMap.get(a.parentIds[0]) : null;
      const bParent = b.parentIds[0] ? nodeMap.get(b.parentIds[0]) : null;
      return (aParent?.y ?? 0) - (bParent?.y ?? 0);
    });
    // Group sorted families by parent Y coordinate
    const familiesByRow = new Map<number, { parentIds: string[]; childIds: string[] }[]>();
    for (const fam of sortedFamilies) {
      const parentNode = fam.parentIds[0] ? nodeMap.get(fam.parentIds[0]) : null;
      const py = parentNode?.y ?? 0;
      if (!familiesByRow.has(py)) familiesByRow.set(py, []);
      familiesByRow.get(py)!.push(fam);
    }

    const sortedRowYs = [...familiesByRow.keys()].sort((a, b) => a - b);
    for (const py of sortedRowYs) {
      const rowFamilies = familiesByRow.get(py)!;
      for (const fam of rowFamilies) {
        const familyMap = computeFamilyChildYOffset(
          fam.parentIds,
          fam.childIds,
          canvas.nodes,
          canvas.annotations,
          config.nodeSize,
          showAutoLabels,
          autoLabels,
          offsets,
          canvas.edges,
          config
        );
        for (const [nid, delta] of familyMap) offsets.set(nid, delta);
      }

      // Align couple offsets on the child generation row
      const coupleEdges = canvas.edges.filter(
        (e) => e.type === "couple" || e.type === "consanguinity" || e.type === "divorced" || e.type === "separated"
      );
      for (let pass = 0; pass < 2; pass++) {
        for (const e of coupleEdges) {
          const uNode = nodeMap.get(e.sourceId);
          const vNode = nodeMap.get(e.targetId);
          if (uNode && vNode && Math.abs(uNode.y - vNode.y) < 30) {
            const uOff = offsets.get(e.sourceId) ?? 0;
            const vOff = offsets.get(e.targetId) ?? 0;
            if (uOff !== vOff) {
              const maxOff = Math.max(uOff, vOff);
              offsets.set(e.sourceId, maxOff);
              offsets.set(e.targetId, maxOff);
            }
          }
        }
      }
    }
    return offsets;
  }, [canvas.nodes, canvas.edges, canvas.annotations, showAutoLabels, autoLabels, config.genotypeFontSize, config.genotypeOffset, config.showGenotypes, config.nodeSize]);

  return (
    <div className="flex-1 overflow-hidden relative canvas-spared flex items-center justify-center p-4">
      <div
        className="relative bg-white shadow-md border border-border/75 rounded-lg overflow-hidden flex-shrink-0 theme-light-canvas"
        style={{ aspectRatio: `${w} / ${h}`, width: "100%", height: "100%", maxWidth: "100%", maxHeight: "100%", margin: "auto" }}
      >
        <svg className="w-full h-full" viewBox={`${x} ${y} ${w} ${h}`}>
        <defs>
          <pattern id="grid-pattern-readonly" width="40" height="40" patternUnits="userSpaceOnUse">
            {config.gridStyle === "dots" ? (
              <circle cx="0" cy="0" r="1.5" fill="currentColor" opacity={config.gridOpacity ?? 0.10} />
            ) : config.gridStyle === "crosses" ? (
              <path d="M -4 0 L 4 0 M 0 -4 L 0 4" fill="none" stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={config.gridOpacity ?? 0.10} />
            ) : (
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={config.gridOpacity ?? 0.10} />
            )}
          </pattern>
        </defs>
        <rect x={x} y={y} width={w} height={h} fill="white" />
        {showGrid && (
          <rect x={x} y={y} width={w} height={h} fill="url(#grid-pattern-readonly)" pointerEvents="none" />
        )}
        <g>
          {canvas.edges.filter((e) => e.type !== "parent-child").map((edge) => (
            <EdgeLine key={edge.id} edge={edge} nodes={canvas.nodes} invalid={false} annotations={canvas.annotations} renderOffsets={familyOffsets} edges={canvas.edges} showAutoLabels={showAutoLabels} autoLabels={autoLabels} />
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
    </div>
  );
}

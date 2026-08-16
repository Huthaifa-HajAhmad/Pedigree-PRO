import React, { useMemo } from "react";
import { AnnotationShape } from "@/features/pedigree-editor/canvas/AnnotationShape";
import { computeLabelBelowHeight } from "@/features/pedigree-editor/canvas/canvasUtils";
import { useCanvasConfig } from "@/features/pedigree-editor/context/CanvasConfigContext";
import type { PedigreeNode, CanvasData } from "@/features/pedigree-editor/canvas/types";

export function AnnotationLayer({
  annotations, nodes, selectedAnnotationId,
  onAnnotationClick, onAnnotationDragStart, onAnnotationDoubleClick, autoLabels, showAutoLabels, familyYOffsetMap,
}: {
  annotations: CanvasData["annotations"];
  nodes: PedigreeNode[];
  selectedAnnotationId: string | null;
  canvas: CanvasData;
  onAnnotationClick: (annId: string, nodeId: string) => void;
  onAnnotationDragStart: (annId: string, e: React.MouseEvent) => void;
  onAnnotationDoubleClick?: (annId: string) => void;
  autoLabels: Map<string, string>;
  showAutoLabels: boolean;
  familyYOffsetMap: Map<string, number>;
}) {
  const { config } = useCanvasConfig();
  const nodeById = useMemo(() => {
    const map = new Map<string, PedigreeNode>();
    for (const n of nodes) map.set(n.id, n);
    return map;
  }, [nodes]);

  const stackIndexById = useMemo(() => {
    const map = new Map<string, number>();
    const grouped = new Map<string, string[]>();
    for (const a of annotations) {
      if (!a.nodeId) continue;
      const key = `${a.nodeId}|${a.position}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(a.id);
    }
    for (const ids of grouped.values()) {
      ids.forEach((id, idx) => map.set(id, idx));
    }
    return map;
  }, [annotations]);

  return (
    <g>
      {annotations.map((ann) => {
        const isFree = !ann.nodeId;
        const node = isFree ? null : nodeById.get(ann.nodeId);
        if (!isFree && !node) return null;
        const stackIndex = isFree ? 0 : (stackIndexById.get(ann.id) ?? 0);
        const autoLabel = (node && showAutoLabels) ? autoLabels.get(node.id) : undefined;
        const labelBelowHeight = node ? computeLabelBelowHeight(node, autoLabel, config) : 0;
        const offsetY = node ? (familyYOffsetMap.get(ann.nodeId) ?? 0) : 0;
        const nodeX = node ? node.x : (ann.x ?? 0);
        const nodeY = node ? node.y + offsetY : (ann.y ?? 0);
        return (
          <AnnotationShape key={ann.id} ann={ann}
            nodeX={nodeX} nodeY={nodeY} stackIndex={stackIndex}
            isSelected={selectedAnnotationId === ann.id}
            onClick={() => onAnnotationClick(ann.id, ann.nodeId)}
            onDragStart={(e) => onAnnotationDragStart(ann.id, e)}
            onDoubleClick={() => onAnnotationDoubleClick?.(ann.id)}
            labelBelowHeight={labelBelowHeight}
          />
        );
      })}
    </g>
  );
}

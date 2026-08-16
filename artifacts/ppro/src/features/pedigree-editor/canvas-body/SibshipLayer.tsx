import React, { useMemo } from "react";
import { SibshipGroup } from "@/features/pedigree-editor/canvas/SibshipGroup";
import { groupFamiliesByParents } from "@/lib/layout-shared";
import type { PedigreeNode, CanvasData } from "@/features/pedigree-editor/canvas/types";

export function SibshipLayer({ edges, nodes, invalidEdgeIds, annotations = [], showAutoLabels, autoLabels, familyOffsets }: {
  edges: CanvasData["edges"];
  nodes: PedigreeNode[];
  invalidEdgeIds: Set<string>;
  annotations?: CanvasData["annotations"];
  showAutoLabels?: boolean;
  autoLabels?: Map<string, string>;
  familyOffsets?: Map<string, number>;
  childOffsets?: Map<string, number>;
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
      const allEdges = pcEdges.filter(
        (e) => parentIds.includes(e.sourceId) && childIds.includes(e.targetId)
      );
      const coupleEdge = edges.find(
        (e) => (e.type === "couple" || e.type === "consanguinity" || e.type === "divorced" || e.type === "separated") &&
          parentIds.includes(e.sourceId) && parentIds.includes(e.targetId)
      );
      return {
        key: `family-${key}`,
        parentIds,
        childIds,
        nodes,
        invalid: allEdges.some((e) => invalidEdgeIds.has(e.id)),
        edgeType: (coupleEdge?.type as "couple" | "consanguinity" | "divorced" | "separated") ?? "couple",
      };
    });
  }, [edges, nodes, invalidEdgeIds]);

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

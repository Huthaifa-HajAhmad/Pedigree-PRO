import { useMemo } from "react";
import type { PedigreeNode, PedigreeAnnotation, PedigreeEdge } from "./types";
import { NODE_SIZE } from "./types";
import { useCanvasConfig } from "@/features/pedigree-editor/context/CanvasConfigContext";

function computeLabelBelowHeight(node: PedigreeNode, autoLabel?: string): number {
  let h = 0;
  if (autoLabel) h = 13;
  if (node.label) h = autoLabel ? 24 : 14;
  if (node.age || node.dob) h += 11;
  if (node.condition) h += 11;
  return h;
}

function computeAnnotationMaxBottom(
  parentIds: string[],
  annotations: PedigreeAnnotation[],
  nodeMap: Map<string, PedigreeNode>,
  S: number,
  showAutoLabels: boolean,
  autoLabels?: Map<string, string>,
  parentOffsets?: Map<string, number>,
): number {
  let maxBottom = -Infinity;
  const parentBelowMap = new Map<string, PedigreeAnnotation[]>();
  for (const ann of annotations) {
    if (parentIds.includes(ann.nodeId) && ann.position === "below" && !ann.hidden) {
      if (!parentBelowMap.has(ann.nodeId)) parentBelowMap.set(ann.nodeId, []);
      parentBelowMap.get(ann.nodeId)!.push(ann);
    }
  }
  for (const [, anns] of parentBelowMap) {
    const pid = anns[0]!.nodeId;
    const p = nodeMap.get(pid);
    if (!p) continue;
    const pOff = parentOffsets?.get(pid) ?? 0;
    const autoLabel = showAutoLabels ? autoLabels?.get(p.id) : undefined;
    const labelH = computeLabelBelowHeight(p, autoLabel);
    let stackY = p.y + pOff + S / 2 + labelH + 4;
    for (const ann of anns) {
      const fs = ann.fontSize ?? 12;
      const boxH = fs + 8;
      const bottom = stackY + boxH + (ann.offsetY ?? 0);
      maxBottom = Math.max(maxBottom, bottom);
      stackY += boxH + 5;
    }
  }
  return maxBottom;
}

const MIN_BAR_CHILD_GAP = 30;

export function computeFamilyChildYOffset(
  parentIds: string[],
  childIds: string[],
  nodes: PedigreeNode[],
  annotations: PedigreeAnnotation[],
  nodeSize: number,
  showAutoLabels: boolean,
  autoLabels?: Map<string, string>,
  parentOffsets?: Map<string, number>,
): Map<string, number> {
  const result = new Map<string, number>();
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const children = childIds.map((id) => nodeMap.get(id)).filter((n): n is PedigreeNode => !!n);
  if (children.length === 0) return result;

  const childTopY = Math.min(...children.map((c) => c.y)) - nodeSize / 2;
  const maxAnnBottom = computeAnnotationMaxBottom(parentIds, annotations, nodeMap, nodeSize, showAutoLabels, autoLabels, parentOffsets);
  const barY = Math.max(childTopY - MIN_BAR_CHILD_GAP, maxAnnBottom + 10);
  const delta = Math.max(0, barY - (childTopY - MIN_BAR_CHILD_GAP));

  if (delta > 0) {
    for (const c of children) result.set(c.id, delta);
  }
  return result;
}

export function SibshipGroup({ parentIds, childIds, nodes, edges = [], invalid, edgeType = "couple", annotations = [], showAutoLabels = false, autoLabels, parentOffsets, childOffsets }: {
  parentIds: string[];
  childIds: string[];
  nodes: PedigreeNode[];
  edges?: PedigreeEdge[];
  invalid: boolean;
  edgeType?: "couple" | "consanguinity";
  annotations?: PedigreeAnnotation[];
  showAutoLabels?: boolean;
  autoLabels?: Map<string, string>;
  parentOffsets?: Map<string, number>;
  childOffsets?: Map<string, number>;
}) {
  const cfg = useCanvasConfig();
  const S = NODE_SIZE;
  const stroke = invalid ? "hsl(var(--destructive))" : cfg.config.edgeColor.startsWith("hsl(") ? "hsl(var(--foreground) / 0.5)" : cfg.config.edgeColor;
  const sw = invalid ? 2 : cfg.config.edgeWidthNormal;
  const dash = invalid ? "5 3" : undefined;

  const nodeMap = useMemo(() => {
    const map = new Map<string, PedigreeNode>();
    for (const n of nodes) map.set(n.id, n);
    return map;
  }, [nodes]);
  const parents = parentIds.map((id) => nodeMap.get(id)).filter((n): n is PedigreeNode => !!n);
  const children = childIds.map((id) => nodeMap.get(id)).filter((n): n is PedigreeNode => !!n);
  if (parents.length === 0 || children.length === 0) return null;

  const paths: string[] = [];
  const childTopY = Math.min(...children.map((c) => c.y)) - S / 2;
  const maxAnnBottom = useMemo(
    () => computeAnnotationMaxBottom(parentIds, annotations, nodeMap, S, showAutoLabels, autoLabels, parentOffsets),
    [parentIds, annotations, nodeMap, S, showAutoLabels, autoLabels, parentOffsets],
  );
  const coupleYOffset = edgeType === "consanguinity" ? 3.5 : 0;

  const barY = Math.max(childTopY - MIN_BAR_CHILD_GAP, maxAnnBottom + 10);

  const TWIN_DROP = 16;

  const twinMap = useMemo(() => {
    const map = new Map<string, { twinGroup: string; twinType?: "m" | "d" }>();
    for (const e of edges) {
      if (e.type === "parent-child" && e.twinGroup && childIds.includes(e.targetId)) {
        map.set(e.targetId, { twinGroup: e.twinGroup, twinType: e.twinType });
      }
    }
    return map;
  }, [edges, childIds]);

  const twinGroups = useMemo(() => {
    const groups = new Map<string, PedigreeNode[]>();
    for (const c of children) {
      const t = twinMap.get(c.id);
      if (t) {
        if (!groups.has(t.twinGroup)) groups.set(t.twinGroup, []);
        groups.get(t.twinGroup)!.push(c);
      }
    }
    return groups;
  }, [children, twinMap]);

  const twinChildIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [, members] of twinGroups) {
      if (members.length >= 2) {
        for (const m of members) ids.add(m.id);
      }
    }
    return ids;
  }, [twinGroups]);

  function cy(c: PedigreeNode) { return c.y + (childOffsets?.get(c.id) ?? 0) - S / 2; }

  if (parents.length === 1) {
    const p = parents[0]!;
    const pOff = parentOffsets?.get(p.id) ?? 0;
    if (children.length === 1) {
      const c = children[0]!;
      paths.push(`M ${p.x} ${p.y + pOff + S / 2} L ${p.x} ${barY} L ${c.x} ${barY} L ${c.x} ${cy(c)}`);
    } else {
      // C6 fix: bar spans non-twin children + twin drop midpoints (not twin node positions)
      const nonTwinXs = children.filter((c) => !twinChildIds.has(c.id)).map((c) => c.x);
      const twinDropMidXs: number[] = [];
      for (const [, members] of twinGroups) {
        if (members.length >= 2) {
          const twinXs = members.map((m) => m.x);
          twinDropMidXs.push(twinXs.reduce((a, b) => a + b, 0) / twinXs.length);
        }
      }
      const allBarXs = [...nonTwinXs, ...twinDropMidXs, p.x];
      const barLeft = Math.min(...allBarXs);
      const barRight = Math.max(...allBarXs);
      paths.push(`M ${p.x} ${p.y + pOff + S / 2} L ${p.x} ${barY}`, `M ${barLeft} ${barY} L ${barRight} ${barY}`);

      for (const [, members] of twinGroups) {
        if (members.length < 2) continue;
        const twinXs = members.map((m) => m.x).sort((a, b) => a - b);
        const midX = twinXs.reduce((a, b) => a + b, 0) / twinXs.length;
        const dropY = barY + TWIN_DROP;
        const isMono = twinMap.get(members[0]!.id)?.twinType === "m";
        paths.push(`M ${midX} ${barY} L ${midX} ${dropY}`);
        if (isMono) {
          paths.push(`M ${midX - 4} ${dropY} L ${midX + 4} ${dropY}`);
        }
        for (const m of members) {
          paths.push(`M ${midX} ${dropY} L ${m.x} ${cy(m)}`);
        }
      }

      for (const c of children) {
        if (!twinChildIds.has(c.id)) {
          paths.push(`M ${c.x} ${barY} L ${c.x} ${cy(c)}`);
        }
      }
    }
  } else {
    const sorted = [...parents].sort((a, b) => a.x - b.x);
    const p1 = sorted[0]!;
    const p2 = sorted[1]!;
    const p1Off = parentOffsets?.get(p1.id) ?? 0;
    const p2Off = parentOffsets?.get(p2.id) ?? 0;
    const midX = (p1.x + S / 2 + p2.x - S / 2) / 2;
    const coupleY = (p1.y + p1Off + p2.y + p2Off) / 2 + coupleYOffset;

    // C6 fix: bar spans non-twin children + twin drop midpoints (not twin node positions)
    const nonTwinXs = children.filter((c) => !twinChildIds.has(c.id)).map((c) => c.x);
    const twinDropMidXs: number[] = [];
    for (const [, members] of twinGroups) {
      if (members.length >= 2) {
        const twinXs = members.map((m) => m.x);
        twinDropMidXs.push(twinXs.reduce((a, b) => a + b, 0) / twinXs.length);
      }
    }
    const allBarXs = [...nonTwinXs, ...twinDropMidXs, midX];
    const barLeft = Math.min(...allBarXs);
    const barRight = Math.max(...allBarXs);
    paths.push(`M ${midX} ${coupleY} L ${midX} ${barY}`, `M ${barLeft} ${barY} L ${barRight} ${barY}`);

    for (const [, members] of twinGroups) {
      if (members.length < 2) continue;
      const twinXs = members.map((m) => m.x).sort((a, b) => a - b);
      const twinMidX = twinXs.reduce((a, b) => a + b, 0) / twinXs.length;
      const dropY = barY + TWIN_DROP;
      const isMono = twinMap.get(members[0]!.id)?.twinType === "m";
      paths.push(`M ${twinMidX} ${barY} L ${twinMidX} ${dropY}`);
      if (isMono) {
        paths.push(`M ${twinMidX - 4} ${dropY} L ${twinMidX + 4} ${dropY}`);
      }
      for (const m of members) {
        paths.push(`M ${twinMidX} ${dropY} L ${m.x} ${cy(m)}`);
      }
    }

    for (const c of children) {
      if (!twinChildIds.has(c.id)) {
        paths.push(`M ${c.x} ${barY} L ${c.x} ${cy(c)}`);
      }
    }
  }
  return <path d={paths.join(" ")} fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray={dash} strokeLinecap="square" />;
}

import { useRef, useState, useCallback, useMemo } from "react";
import type { PedigreeNode, PedigreeEdge } from "@/features/pedigree-editor/canvas/types";
import { NODE_SIZE } from "@/features/pedigree-editor/canvas/types";

const S = NODE_SIZE;
const HALF = S / 2;
const SHAPE_R = 8;

function MinimapNode({ node }: { node: PedigreeNode }) {
  const fill = node.affected
    ? "hsl(var(--foreground))"
    : node.carrier
    ? "hsl(var(--primary) / 0.15)"
    : "hsl(var(--card))";
  const stroke = node.affected
    ? "hsl(var(--foreground))"
    : "hsl(var(--foreground) / 0.5)";
  const sw = 1.5;

  let shape: React.ReactNode;
  switch (node.type) {
    case "male":
      shape = <rect x={node.x - SHAPE_R} y={node.y - SHAPE_R} width={SHAPE_R * 2} height={SHAPE_R * 2} fill={fill} stroke={stroke} strokeWidth={sw} rx={1} />;
      break;
    case "female":
      shape = <circle cx={node.x} cy={node.y} r={SHAPE_R} fill={fill} stroke={stroke} strokeWidth={sw} />;
      break;
    case "sab":
      shape = <polygon points={`${node.x},${node.y - SHAPE_R} ${node.x + SHAPE_R},${node.y + SHAPE_R} ${node.x - SHAPE_R},${node.y + SHAPE_R}`} fill={fill} stroke={stroke} strokeWidth={sw} />;
      break;
    default:
      shape = <polygon points={`${node.x},${node.y - SHAPE_R} ${node.x + SHAPE_R},${node.y} ${node.x},${node.y + SHAPE_R} ${node.x - SHAPE_R},${node.y}`} fill={fill} stroke={stroke} strokeWidth={sw} />;
  }

  return (
    <g>
      {shape}
      {node.carrier && !node.affected && (
        <circle cx={node.x} cy={node.y} r={2.5} fill="hsl(var(--primary))" />
      )}
      {node.deceased && (
        <line
          x1={node.x - SHAPE_R} y1={node.y - SHAPE_R}
          x2={node.x + SHAPE_R} y2={node.y + SHAPE_R}
          stroke={stroke} strokeWidth={sw}
        />
      )}
      {node.proband && (
        <polygon
          points={`${node.x + SHAPE_R + 3},${node.y} ${node.x + SHAPE_R + 7},${node.y - 3} ${node.x + SHAPE_R + 7},${node.y + 3}`}
          fill="hsl(var(--primary))"
        />
      )}
    </g>
  );
}

function computeMinimapEdges(
  nodes: PedigreeNode[],
  edges: PedigreeEdge[],
  nodeById: Map<string, PedigreeNode>,
): React.ReactNode[] {
  const nodeMap = nodeById;
  const result: React.ReactNode[] = [];
  const stroke = "hsl(var(--foreground) / 0.25)";
  const sw = 1.5;

  const parentChildEdges = edges.filter((e) => e.type === "parent-child");
  const parentToChildren = new Map<string, string[]>();
  for (const e of parentChildEdges) {
    if (!parentToChildren.has(e.sourceId)) parentToChildren.set(e.sourceId, []);
    parentToChildren.get(e.sourceId)!.push(e.targetId);
  }

  const couplePairs = new Map<string, string>();
  const couplePairKeys = new Set<string>();
  for (const e of edges) {
    if (e.type === "couple" || e.type === "consanguinity" || e.type === "divorced" || e.type === "separated") {
      const left = nodeMap.get(e.sourceId)!;
      const right = nodeMap.get(e.targetId)!;
      if (left && right) {
        const pairKey = left.id < right.id ? `${left.id}:${right.id}` : `${right.id}:${left.id}`;
        if (!couplePairKeys.has(pairKey)) {
          if (e.type === "couple" || e.type === "divorced" || e.type === "separated") {
        result.push(
          <line key={e.id}
            x1={left.x + HALF} y1={left.y}
            x2={right.x - HALF} y2={right.y}
            stroke={stroke} strokeWidth={sw}
          />
        );
      } else {
        const dx = (right.x - HALF) - (left.x + HALF);
        const dy = right.y - left.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const ox = (-dy / len) * 3;
        const oy = (dx / len) * 3;
        result.push(
          <g key={e.id} stroke={stroke} strokeWidth={sw} fill="none">
            <line x1={left.x + HALF + ox} y1={left.y + oy} x2={right.x - HALF + ox} y2={right.y + oy} />
            <line x1={left.x + HALF - ox} y1={left.y - oy} x2={right.x - HALF - ox} y2={right.y - oy} />
          </g>
        );
      }
      const pairKey = [left.id, right.id].sort().join("|");
      couplePairs.set(left.id, right.id);
      couplePairs.set(right.id, left.id);
      couplePairKeys.add(pairKey);
        }
      }
    }
  }

  // Group families: if a parent has a partner, the family key is the sorted pair.
  // Otherwise the family key is the single parent id.
  const familyMap = new Map<string, { parentIds: string[]; childIds: string[] }>();
  const childToFamily = new Map<string, string>();

  for (const [parentId, childIds] of parentToChildren) {
    const partnerId = couplePairs.get(parentId);
    const familyKey = partnerId && parentId < partnerId ? `${parentId}|${partnerId}` : parentId;

    if (!familyMap.has(familyKey)) {
      familyMap.set(familyKey, { parentIds: partnerId ? [parentId, partnerId] : [parentId], childIds: [] });
    }

    const family = familyMap.get(familyKey)!;
    for (const childId of childIds) {
      if (!childToFamily.has(childId)) {
        childToFamily.set(childId, familyKey);
        family.childIds.push(childId);
      }
    }
  }

  for (const [, family] of familyMap) {
    const children = family.childIds
      .map((id) => nodeById.get(id))
      .filter((n): n is PedigreeNode => !!n);
    if (children.length === 0) continue;

    const childTops = children.map((c) => c.y - HALF);
    const minChildTop = Math.min(...childTops);
    const barY = minChildTop - 30; // fixed gap like main canvas MIN_BAR_CHILD_GAP

    const childXs = children.map((c) => c.x);
    const barLeft = Math.min(...childXs);
    const barRight = Math.max(...childXs);

    let dropX: number;
    if (family.parentIds.length === 1) {
      const pid = family.parentIds[0]!;
      const p = nodeById.get(pid);
      if (!p) continue;
      dropX = p.x;
      result.push(
        <path key={`pc-drop-${pid}`}
          d={`M ${dropX} ${p.y + HALF} L ${dropX} ${barY}`}
          fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="square"
        />
      );
    } else {
      const pid1 = family.parentIds[0]!;
      const pid2 = family.parentIds[1]!;
      const p1 = nodeById.get(pid1);
      const p2 = nodeById.get(pid2);
      if (!p1 || !p2) continue;
      const left = p1.x <= p2.x ? p1 : p2;
      const right = p1.x <= p2.x ? p2 : p1;
      dropX = (left.x + HALF + right.x - HALF) / 2;
      result.push(
        <path key={`pc-drop-${pid1}-${pid2}`}
          d={`M ${dropX} ${left.y} L ${dropX} ${barY}`}
          fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="square"
        />
      );
    }

    // Horizontal sibship bar
    result.push(
      <line key={`pc-bar-${family.parentIds.join("-")}`}
        x1={barLeft} y1={barY} x2={barRight} y2={barY}
        stroke={stroke} strokeWidth={sw}
      />
    );

    // Vertical drops to each child
    for (const child of children) {
      result.push(
        <path key={`pc-child-${child.id}`}
          d={`M ${child.x} ${barY} L ${child.x} ${child.y - HALF}`}
          fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="square"
        />
      );
    }
  }

  return result;
}

export function Minimap({
  nodes, edges, viewBox, vbW, vbH, mmW, mmH, onPan, shifted = false, containerClassName = "",
}: {
  nodes: PedigreeNode[];
  edges: PedigreeEdge[];
  viewBox: { x: number; y: number };
  vbW: number;
  vbH: number;
  mmW: number;
  mmH: number;
  onPan: (cx: number, cy: number) => void;
  shifted?: boolean;
  containerClassName?: string;
}) {
  const xs = nodes.length > 0 ? nodes.map((n) => n.x) : [0, 1400];
  const ys = nodes.length > 0 ? nodes.map((n) => n.y) : [0, 900];
  const nodeMinX = Math.min(...xs) - 60;
  const nodeMaxX = Math.max(...xs) + 60;
  const nodeMinY = Math.min(...ys) - 60;
  const nodeMaxY = Math.max(...ys) + 60;

  const minX = nodeMinX;
  const maxX = nodeMaxX;
  const minY = nodeMinY;
  const maxY = nodeMaxY;

  const W = Math.max(maxX - minX, 100);
  const H = Math.max(maxY - minY, 100);

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const visible = nodes.filter(
    (n) =>
      n.x + HALF >= viewBox.x &&
      n.x - HALF <= viewBox.x + vbW &&
      n.y + HALF >= viewBox.y &&
      n.y - HALF <= viewBox.y + vbH,
  );

  const hasVisible = visible.length > 0;
  const vX = hasVisible
    ? Math.min(...visible.map((n) => n.x)) - HALF
    : viewBox.x;
  const vY = hasVisible
    ? Math.min(...visible.map((n) => n.y)) - HALF
    : viewBox.y;
  const vW = hasVisible
    ? Math.max(...visible.map((n) => n.x)) - vX + NODE_SIZE
    : vbW;
  const vH = hasVisible
    ? Math.max(...visible.map((n) => n.y)) - vY + NODE_SIZE
    : vbH;

  const dragRef = useRef<{ startX: number; startY: number; vbX: number; vbY: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleViewportPointerDown = useCallback((e: React.PointerEvent<SVGRectElement>) => {
    e.stopPropagation();
    (e.target as SVGRectElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, vbX: viewBox.x, vbY: viewBox.y };
    setIsDragging(true);
  }, [viewBox.x, viewBox.y]);

  const handleViewportPointerMove = useCallback((e: React.PointerEvent<SVGRectElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const scale = W / mmW;
    const newVbX = d.vbX + dx * scale;
    const newVbY = d.vbY + dy * scale;
    onPan(newVbX + vbW / 2, newVbY + vbH / 2);
  }, [W, mmW, vbW, vbH, onPan]);

  const handleViewportPointerUp = useCallback((e: React.PointerEvent<SVGRectElement>) => {
    (e.target as SVGRectElement).releasePointerCapture(e.pointerId);
    dragRef.current = null;
    setIsDragging(false);
  }, []);

  const edgeElements = useMemo(
    () => computeMinimapEdges(nodes, edges, nodeById),
    [nodes, edges, nodeById],
  );

  return (
    <div
      className={`absolute bottom-4 rounded-lg border border-border/50 overflow-hidden select-none bg-popover/95 backdrop-blur-sm shadow-lg ${shifted ? "right-[296px] z-40" : "right-4 z-20"} ${containerClassName}`}
      style={{ width: mmW, height: mmH }}
      title="Click to pan, drag viewport to scroll"
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const cx = minX + ((e.clientX - rect.left) / mmW) * W;
        const cy = minY + ((e.clientY - rect.top) / mmH) * H;
        onPan(cx, cy);
      }}
    >
      <svg width={mmW} height={mmH} viewBox={`${minX} ${minY} ${W} ${H}`}>
        {edgeElements}
        {nodes.map((n) => (
          <MinimapNode key={n.id} node={n} />
        ))}
        <g>
          <rect
            x={vX}
            y={vY}
            width={vW}
            height={vH}
            fill="hsl(var(--primary) / 0.14)"
            stroke="hsl(var(--primary))"
            strokeWidth={1.5}
            rx={4}
            style={{ cursor: isDragging ? "grabbing" : "grab" }}
            onPointerDown={handleViewportPointerDown}
            onPointerMove={handleViewportPointerMove}
            onPointerUp={handleViewportPointerUp}
          />
        </g>
      </svg>
    </div>
  );
}
import { useMemo } from "react";
import type { PedigreeNode } from "./types";
import { NODE_SIZE } from "./types";

export function SibshipGroup({ parentIds, childIds, nodes, invalid }: {
  parentIds: string[];
  childIds: string[];
  nodes: PedigreeNode[];
  invalid: boolean;
}) {
  const S = NODE_SIZE;
  const stroke = invalid ? "hsl(var(--destructive))" : "hsl(var(--foreground) / 0.35)";
  const sw = invalid ? 2 : 1.5;
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

  if (parents.length === 1) {
    const p = parents[0]!;
    const barY = Math.min(p.y + S / 2 + 40, childTopY - 5);
    if (children.length === 1) {
      const c = children[0]!;
      paths.push(`M ${p.x} ${p.y + S / 2} L ${p.x} ${barY} L ${c.x} ${barY} L ${c.x} ${c.y - S / 2}`);
    } else {
      const xs = children.map((c) => c.x).sort((a, b) => a - b);
      const barLeft = Math.min(p.x, xs[0] ?? p.x);
      const barRight = Math.max(p.x, xs[xs.length - 1] ?? p.x);
      paths.push(`M ${p.x} ${p.y + S / 2} L ${p.x} ${barY}`, `M ${barLeft} ${barY} L ${barRight} ${barY}`);
      for (const c of children) paths.push(`M ${c.x} ${barY} L ${c.x} ${c.y - S / 2}`);
    }
  } else {
    const sorted = [...parents].sort((a, b) => a.x - b.x);
    const p1 = sorted[0]!;
    const p2 = sorted[1]!;
    const midX = (p1.x + S / 2 + p2.x - S / 2) / 2;
    const coupleY = (p1.y + p2.y) / 2;
    if (children.length === 1) {
      const c = children[0]!;
      paths.push(`M ${midX} ${coupleY} L ${midX} ${c.y - S / 2}`);
    } else {
      const barY = Math.min(Math.max(p1.y, p2.y) + S / 2 + 40, childTopY - 5);
      const xs = children.map((c) => c.x).sort((a, b) => a - b);
      const barLeft = Math.min(midX, xs[0] ?? midX);
      const barRight = Math.max(midX, xs[xs.length - 1] ?? midX);
      paths.push(`M ${midX} ${coupleY} L ${midX} ${barY}`, `M ${barLeft} ${barY} L ${barRight} ${barY}`);
      for (const c of children) paths.push(`M ${c.x} ${barY} L ${c.x} ${c.y - S / 2}`);
    }
  }
  return <path d={paths.join(" ")} fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray={dash} />;
}
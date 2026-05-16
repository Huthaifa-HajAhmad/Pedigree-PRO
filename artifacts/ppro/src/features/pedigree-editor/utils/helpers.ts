import type { CanvasData, PedigreeNode } from "../canvas/types";
import { NODE_SIZE, GEN_GRID, NODE_GAP } from "../canvas/types";

export const DEFAULT_CANVAS: CanvasData = { nodes: [], edges: [], annotations: [] };

export function parseCanvas(raw: string | null | undefined): CanvasData {
  if (!raw) return DEFAULT_CANVAS;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.nodes)) return DEFAULT_CANVAS;
    return {
      ...parsed,
      nodes: parsed.nodes.map((n: PedigreeNode) => ({
        ...n,
        carrier: (n as any).carrier ?? false,
        pinned: (n as any).pinned ?? false,
      })),
      annotations: parsed.annotations || [],
    };
  } catch {
    return DEFAULT_CANVAS;
  }
}

export function computeSnapRows(nodes: PedigreeNode[], excludeIds: Set<string>): number[] {
  const ys = nodes.filter((n) => !excludeIds.has(n.id)).map((n) => n.y);
  const rows: number[] = [];
  for (const y of ys) {
    if (!rows.some((r) => Math.abs(r - y) < 20)) rows.push(y);
  }
  for (let r = GEN_GRID; r <= 1200; r += GEN_GRID) {
    if (!rows.some((existing) => Math.abs(existing - r) < 20)) rows.push(r);
  }
  return rows.sort((a, b) => a - b);
}

export function snapToNearestRow(y: number, rows: number[], threshold = 22): number {
  let best = y;
  let bestDist = threshold;
  for (const row of rows) {
    const d = Math.abs(row - y);
    if (d < bestDist) { bestDist = d; best = row; }
  }
  return best;
}

export function findSpawnPos(
  existingNodes: PedigreeNode[],
  viewBox: { x: number; y: number; zoom: number }
): { x: number; y: number } {
  const W = 1400, H = 900;
  const vbW = W * viewBox.zoom, vbH = H * viewBox.zoom;

  if (existingNodes.length === 0) {
    return { x: viewBox.x + vbW / 2, y: viewBox.y + vbH / 2 };
  }
  const visibleNodes = existingNodes.filter(
    (n) => n.y >= viewBox.y - NODE_SIZE && n.y <= viewBox.y + vbH + NODE_SIZE
  );
  const anchorNodes = visibleNodes.length > 0 ? visibleNodes : existingNodes;
  const maxY = Math.max(...anchorNodes.map((n) => n.y));
  const genRow = Math.round(maxY / GEN_GRID) * GEN_GRID;
  const rowNodes = existingNodes.filter((n) => Math.abs(n.y - genRow) < NODE_GAP / 2);
  const startX = rowNodes.length > 0
    ? Math.max(...rowNodes.map((n) => n.x)) + NODE_GAP
    : viewBox.x + NODE_GAP;

  const isFree = (cx: number, cy: number) => existingNodes.every((n) => Math.hypot(n.x - cx, n.y - cy) >= NODE_GAP);

  for (let rowOffset = 0; rowOffset <= 3; rowOffset++) {
    const cy = genRow + rowOffset * GEN_GRID;
    for (let col = 0; col < 12; col++) {
      const cx = startX + col * NODE_GAP;
      if (isFree(cx, cy)) return { x: cx, y: cy };
    }
  }
  const globalMaxY = Math.max(...existingNodes.map((n) => n.y));
  return { x: viewBox.x + vbW / 2, y: globalMaxY + GEN_GRID };
}
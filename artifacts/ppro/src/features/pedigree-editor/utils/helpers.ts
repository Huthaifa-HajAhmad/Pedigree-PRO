import type { CanvasData, PedigreeNode } from "../canvas/types";
import { NODE_SIZE, GEN_GRID, NODE_GAP } from "../canvas/types";

export const DEFAULT_CANVAS: CanvasData = { nodes: [], edges: [], annotations: [] };

export function parseCanvas(raw: string | null | undefined): CanvasData {
  if (!raw) return DEFAULT_CANVAS;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.nodes) return DEFAULT_CANVAS;
    return {
      nodes: (parsed.nodes ?? []).map((n: any, i: number) => {
        const rawX = Number(n.x ?? 0);
        const rawY = Number(n.y ?? 0);
        const x = isFinite(rawX) ? rawX : (i + 1) * NODE_GAP;
        const y = isFinite(rawY) ? rawY : GEN_GRID;
        return {
          id: String(n.id ?? ""),
          type: n.type || "unknown",
          affected: Boolean(n.affected ?? false),
          affectedLevel: typeof n.affectedLevel === "number" ? n.affectedLevel : undefined,
          carrier: Boolean(n.carrier ?? false),
          deceased: Boolean(n.deceased ?? false),
          proband: Boolean(n.proband ?? false),
          adopted: n.adopted !== undefined ? Boolean(n.adopted) : undefined,
          label: String(n.label ?? ""),
          age: String(n.age ?? ""),
          dob: n.dob !== undefined ? String(n.dob) : undefined,
          condition: n.condition !== undefined ? String(n.condition) : undefined,
          notes: n.notes !== undefined ? String(n.notes) : undefined,
          insideText: n.insideText !== undefined ? String(n.insideText) : undefined,
          x,
          y,
          pinned: Boolean(n.pinned ?? false),
          color: n.color !== undefined ? String(n.color) : undefined,
          genotype: n.genotype !== undefined ? String(n.genotype) : undefined,
          shading: n.shading !== undefined ? String(n.shading) : undefined,
          genotype2: n.genotype2 !== undefined ? String(n.genotype2) : undefined,
          additionalGenotypes: Array.isArray(n.additionalGenotypes) ? n.additionalGenotypes.map(String) : undefined,
        };
      }),
      edges: (parsed.edges ?? []).map((e: any) => ({
        id: String(e.id ?? ""),
        type: e.type || "couple",
        sourceId: String(e.sourceId ?? ""),
        targetId: String(e.targetId ?? ""),
        twinGroup: e.twinGroup !== undefined ? String(e.twinGroup) : undefined,
        twinType: e.twinType !== undefined ? String(e.twinType) : undefined,
        inverted: e.inverted !== undefined ? Boolean(e.inverted) : undefined,
      })),
      annotations: (parsed.annotations ?? []).map((a: any) => ({
        id: String(a.id ?? ""),
        nodeId: String(a.nodeId ?? ""),
        text: String(a.text ?? ""),
        color: String(a.color ?? ""),
        fontSize: Number(a.fontSize ?? 12),
        position: a.position || "below",
        offsetX: typeof a.offsetX === "number" ? a.offsetX : undefined,
        offsetY: typeof a.offsetY === "number" ? a.offsetY : undefined,
        hidden: a.hidden !== undefined ? Boolean(a.hidden) : undefined,
        bold: a.bold !== undefined ? Boolean(a.bold) : undefined,
        italic: a.italic !== undefined ? Boolean(a.italic) : undefined,
        uppercase: a.uppercase !== undefined ? Boolean(a.uppercase) : undefined,
        x: typeof a.x === "number" ? a.x : undefined,
        y: typeof a.y === "number" ? a.y : undefined,
      })),
      settings: parsed.settings ? {
        themeId: parsed.settings.themeId !== undefined ? String(parsed.settings.themeId) as any : undefined,
        config: parsed.settings.config ? {
          nodeSize: typeof parsed.settings.config.nodeSize === "number" && isFinite(parsed.settings.config.nodeSize) ? parsed.settings.config.nodeSize : undefined,
          nodeStrokeColor: typeof parsed.settings.config.nodeStrokeColor === "string" ? parsed.settings.config.nodeStrokeColor : undefined,
          edgeColor: typeof parsed.settings.config.edgeColor === "string" ? parsed.settings.config.edgeColor : undefined,
          edgeWidthNormal: typeof parsed.settings.config.edgeWidthNormal === "number" && isFinite(parsed.settings.config.edgeWidthNormal) ? parsed.settings.config.edgeWidthNormal : undefined,
          annFontSize: typeof parsed.settings.config.annFontSize === "number" && isFinite(parsed.settings.config.annFontSize) ? parsed.settings.config.annFontSize : undefined,
          annFontFamily: typeof parsed.settings.config.annFontFamily === "string" ? parsed.settings.config.annFontFamily : undefined,
          annBold: typeof parsed.settings.config.annBold === "boolean" ? parsed.settings.config.annBold : undefined,
          annUppercase: typeof parsed.settings.config.annUppercase === "boolean" ? parsed.settings.config.annUppercase : undefined,
          annDefaultPos: typeof parsed.settings.config.annDefaultPos === "string" ? parsed.settings.config.annDefaultPos as any : undefined,
          toolbarHeight: typeof parsed.settings.config.toolbarHeight === "number" && isFinite(parsed.settings.config.toolbarHeight) ? parsed.settings.config.toolbarHeight : undefined,
        } : undefined,
      } : undefined,
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

export function getQuadrantsForStyle(style?: string): [boolean, boolean, boolean, boolean] {
  if (!style) return [false, false, false, false];
  if (style === "quadrant" || style === "q1") return [true, false, false, false];
  if (style === "q2") return [false, true, false, false];
  if (style === "q3") return [false, false, true, false];
  if (style === "q4") return [false, false, false, true];
  if (style === "left-half" || style === "q2,q3") return [false, true, true, false];
  if (style === "right-half" || style === "q1,q4") return [true, false, false, true];
  if (style === "top-half" || style === "q1,q2") return [true, true, false, false];
  if (style === "bottom-half" || style === "q3,q4") return [false, false, true, true];
  if (style === "solid" || style === "q1,q2,q3,q4") return [true, true, true, true];
  
  // Custom split/comma lists (e.g. "q1,q3")
  const parts = style.split(",");
  return [
    parts.includes("q1"),
    parts.includes("q2"),
    parts.includes("q3"),
    parts.includes("q4")
  ];
}
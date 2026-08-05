import type { PedigreeNode, PedigreeAnnotation } from "@/pages/pedigree-canvas";

interface Edge {
  id: string;
  type: "couple" | "parent-child" | "consanguinity" | "divorced" | "separated";
  sourceId: string;
  targetId: string;
}

interface Canvas {
  nodes: PedigreeNode[];
  edges: Edge[];
  annotations?: PedigreeAnnotation[];
}

const W = 160;
const H = 100;
const PAD = 12;
const NEON = "#16a34a";
const BG   = "#f8f9fa";
const LINE = "#94a3b8";
const NODE_FILL = "#ffffff";
const NODE_STROKE = "#334155";

function makeMapper(nodes: PedigreeNode[]) {
  if (nodes.length === 0) {
    return {
      map: (_x: number, _y: number) => ({ x: W / 2, y: H / 2 }),
      scale: 1
    };
  }
  const xs = nodes.map(n => n.x);
  const ys = nodes.map(n => n.y);
  const minX = Math.min(...xs) - 40;
  const minY = Math.min(...ys) - 40;
  const srcW = Math.max(...xs) + 40 - minX || 1;
  const srcH = Math.max(...ys) + 40 - minY || 1;
  const scale = Math.min((W - PAD * 2) / srcW, (H - PAD * 2) / srcH);
  const drawW = srcW * scale;
  const drawH = srcH * scale;
  const map = (x: number, y: number) => ({
    x: PAD + (W - PAD * 2 - drawW) / 2 + (x - minX) * scale,
    y: PAD + (H - PAD * 2 - drawH) / 2 + (y - minY) * scale,
  });
  return { map, scale };
}

// ---------------------------------------------------------------------------
// SVG path helpers
// ---------------------------------------------------------------------------
function svgRect(x: number, y: number, s: number, fill: string, stroke: string, sw = 0.8) {
  return `<rect x="${(x - s).toFixed(1)}" y="${(y - s).toFixed(1)}" width="${(s*2).toFixed(1)}" height="${(s*2).toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
}

function svgCircle(x: number, y: number, r: number, fill: string, stroke: string, sw = 0.8) {
  return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
}

function svgTriangle(x: number, y: number, s: number, down: boolean, fill: string, stroke: string, sw = 0.8) {
  const pts = down
    ? `${x.toFixed(1)},${(y + s).toFixed(1)} ${(x - s).toFixed(1)},${(y - s * 0.7).toFixed(1)} ${(x + s).toFixed(1)},${(y - s * 0.7).toFixed(1)}`
    : `${x.toFixed(1)},${(y - s).toFixed(1)} ${(x + s).toFixed(1)},${(y + s * 0.7).toFixed(1)} ${(x - s).toFixed(1)},${(y + s * 0.7).toFixed(1)}`;
  return `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
}

// ---------------------------------------------------------------------------
// Main thumbnail generator — returns a data-URL string (SVG)
// ---------------------------------------------------------------------------
function svgDiamond(x: number, y: number, s: number, fill: string, stroke: string, sw = 0.8) {
  const pts = `${x.toFixed(1)},${(y - s).toFixed(1)} ${(x + s).toFixed(1)},${y.toFixed(1)} ${x.toFixed(1)},${(y + s).toFixed(1)} ${(x - s).toFixed(1)},${y.toFixed(1)}`;
  return `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
}

function svgLine(x1: number, y1: number, x2: number, y2: number, color: string, sw = 0.6) {
  return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="${sw}"/>`;
}

// ---------------------------------------------------------------------------
// Main thumbnail generator — returns a data-URL string (SVG)
// ---------------------------------------------------------------------------
export function generateThumbnail(canvas: Canvas): string {
  if (canvas.nodes.length === 0) {
    // Empty pedigree — return a placeholder
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${BG}"/><text x="${W/2}" y="${H/2+3}" font-family="monospace" font-size="9" fill="#2A2A2A" text-anchor="middle">empty</text></svg>`;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }

  const { map, scale } = makeMapper(canvas.nodes);
  const byId = new Map(canvas.nodes.map(n => [n.id, n]));
  const parts: string[] = [];

  // Dynamic node half-size, scaled down for larger pedigrees but constrained
  const s = Math.max(2.5, Math.min(9, 14 * scale));

  // Background
  parts.push(`<rect width="${W}" height="${H}" fill="${BG}"/>`);

  // Edges
  for (const edge of canvas.edges) {
    const src = byId.get(edge.sourceId);
    const tgt = byId.get(edge.targetId);
    if (!src || !tgt) continue;
    const sp = map(src.x, src.y);
    const tp = map(tgt.x, tgt.y);

    if (edge.type === "couple" || edge.type === "divorced" || edge.type === "separated") {
      parts.push(svgLine(sp.x + s * 0.5, sp.y, tp.x - s * 0.5, tp.y, LINE));
    } else if (edge.type === "consanguinity") {
      parts.push(svgLine(sp.x + s * 0.5, sp.y - 1.2 * scale, tp.x - s * 0.5, tp.y - 1.2 * scale, LINE, 0.5));
      parts.push(svgLine(sp.x + s * 0.5, sp.y + 1.2 * scale, tp.x - s * 0.5, tp.y + 1.2 * scale, LINE, 0.5));
    } else {
      // parent-child: elbow
      const dropY = sp.y + s * 0.6 + 4 * scale;
      parts.push(svgLine(sp.x, sp.y + s * 0.6, sp.x, dropY, LINE));
      parts.push(svgLine(sp.x, dropY, tp.x, dropY, LINE));
      parts.push(svgLine(tp.x, dropY, tp.x, tp.y - s * 0.6, LINE));
    }
  }

  // Nodes
  for (const node of canvas.nodes) {
    const { x, y } = map(node.x, node.y);
    const fill   = node.affected ? NEON : node.type === "sab" ? "#e2e8f0" : NODE_FILL;
    const stroke = node.affected ? NEON : node.deceased ? "#9ca3af" : NODE_STROKE;

    const nodeS = node.stillbirth ? s * 0.65 : s;
    if (node.type === "male") {
      parts.push(svgRect(x, y, nodeS, fill, stroke));
    } else if (node.type === "female") {
      parts.push(svgCircle(x, y, nodeS, fill, stroke));
    } else if (node.type === "pregnancy") {
      parts.push(svgDiamond(x, y, nodeS, fill, stroke));
    } else if (node.type === "sab") {
      parts.push(svgTriangle(x, y, nodeS, false, fill, stroke));
    } else {
      parts.push(svgDiamond(x, y, nodeS, fill, stroke));
    }

    // Carrier dot
    if (node.carrier && !node.affected) {
      parts.push(svgCircle(x, y, nodeS * 0.28, NEON, "none"));
    }

    // Deceased slash
    if (node.deceased || node.stillbirth) {
      parts.push(svgLine(x - nodeS - 1 * scale, y + nodeS + 1 * scale, x + nodeS + 1 * scale, y - nodeS - 1 * scale, "#9ca3af", 0.7));
    }

    // Proband arrow
    if (node.proband) {
      parts.push(`<text x="${(x - nodeS - 3 * scale).toFixed(1)}" y="${(y + 3 * scale).toFixed(1)}" font-family="monospace" font-size="${Math.max(4, 8 * scale)}" fill="${NEON}" text-anchor="end">→</text>`);
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join("")}</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

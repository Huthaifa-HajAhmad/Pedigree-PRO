import type { PedigreeNode, PedigreeAnnotation } from "@/pages/pedigree-canvas";

interface Edge {
  id: string;
  type: "couple" | "parent-child" | "consanguinity";
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
const NS = 9;          // node half-size
const PAD = 12;
const NEON = "#39FF14";
const BG   = "#0A0A0A";
const LINE = "#3A3A3A";
const NODE_FILL = "#1E1E1E";
const NODE_STROKE = "#484848";

// ---------------------------------------------------------------------------
// Fit canvas node coordinates into the thumbnail viewport
// ---------------------------------------------------------------------------
function makeMapper(nodes: PedigreeNode[]) {
  if (nodes.length === 0) return (_x: number, _y: number) => ({ x: W / 2, y: H / 2 });
  const xs = nodes.map(n => n.x);
  const ys = nodes.map(n => n.y);
  const minX = Math.min(...xs) - 40;
  const minY = Math.min(...ys) - 40;
  const srcW = Math.max(...xs) + 40 - minX || 1;
  const srcH = Math.max(...ys) + 40 - minY || 1;
  const scale = Math.min((W - PAD * 2) / srcW, (H - PAD * 2) / srcH);
  const drawW = srcW * scale;
  const drawH = srcH * scale;
  return (x: number, y: number) => ({
    x: PAD + (W - PAD * 2 - drawW) / 2 + (x - minX) * scale,
    y: PAD + (H - PAD * 2 - drawH) / 2 + (y - minY) * scale,
  });
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

  const map = makeMapper(canvas.nodes);
  const byId = new Map(canvas.nodes.map(n => [n.id, n]));
  const parts: string[] = [];

  // Background
  parts.push(`<rect width="${W}" height="${H}" fill="${BG}"/>`);

  // Edges
  for (const edge of canvas.edges) {
    const src = byId.get(edge.sourceId);
    const tgt = byId.get(edge.targetId);
    if (!src || !tgt) continue;
    const sp = map(src.x, src.y);
    const tp = map(tgt.x, tgt.y);

    if (edge.type === "couple") {
      parts.push(svgLine(sp.x + NS * 0.5, sp.y, tp.x - NS * 0.5, tp.y, LINE));
    } else if (edge.type === "consanguinity") {
      parts.push(svgLine(sp.x + NS * 0.5, sp.y - 1.2, tp.x - NS * 0.5, tp.y - 1.2, LINE, 0.5));
      parts.push(svgLine(sp.x + NS * 0.5, sp.y + 1.2, tp.x - NS * 0.5, tp.y + 1.2, LINE, 0.5));
    } else {
      // parent-child: elbow
      const dropY = sp.y + NS * 0.6 + 4;
      parts.push(svgLine(sp.x, sp.y + NS * 0.6, sp.x, dropY, LINE));
      parts.push(svgLine(sp.x, dropY, tp.x, dropY, LINE));
      parts.push(svgLine(tp.x, dropY, tp.x, tp.y - NS * 0.6, LINE));
    }
  }

  // Nodes
  for (const node of canvas.nodes) {
    const { x, y } = map(node.x, node.y);
    const fill   = node.affected ? NEON : node.type === "sab" ? "#404040" : NODE_FILL;
    const stroke = node.affected ? NEON : node.deceased ? "#555" : NODE_STROKE;

    if (node.type === "male") {
      parts.push(svgRect(x, y, NS, fill, stroke));
    } else if (node.type === "female") {
      parts.push(svgCircle(x, y, NS, fill, stroke));
    } else if (node.type === "pregnancy") {
      parts.push(svgDiamond(x, y, NS, fill, stroke));
    } else if (node.type === "sab") {
      parts.push(svgTriangle(x, y, NS, true, fill, stroke));
    } else {
      parts.push(svgTriangle(x, y, NS, false, fill, stroke));
    }

    // Carrier dot
    if (node.carrier && !node.affected) {
      parts.push(svgCircle(x, y, NS * 0.28, NEON, "none"));
    }

    // Deceased slash
    if (node.deceased) {
      parts.push(svgLine(x - NS - 1, y + NS + 1, x + NS + 1, y - NS - 1, "#666", 0.7));
    }

    // Proband arrow
    if (node.proband) {
      parts.push(`<text x="${(x - NS - 3).toFixed(1)}" y="${(y + 3).toFixed(1)}" font-family="monospace" font-size="8" fill="${NEON}" text-anchor="end">→</text>`);
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join("")}</svg>`;

  // btoa is safe since SVG only contains ASCII characters here
  try {
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  } catch {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }
}

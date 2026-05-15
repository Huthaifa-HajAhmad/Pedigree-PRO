import { computeRisk } from "@/lib/risk-calculator";
import { validatePedigree } from "@/lib/validate-pedigree";
import { exportPedigreePpro } from "@workspace/api-client-react";

export interface ExportNode {
  id: string;
  type: "male" | "female" | "unknown" | "pregnancy" | "sab";
  affected: boolean;
  carrier: boolean;
  deceased: boolean;
  proband: boolean;
  label: string;
  age: string;
  dob?: string;
  condition?: string;
  notes?: string;
  x: number;
  y: number;
}

export interface ExportEdge {
  id: string;
  type: "couple" | "parent-child" | "consanguinity";
  sourceId: string;
  targetId: string;
}

export interface ExportAnnotation {
  nodeId: string;
  text: string;
  color: string;
  fontSize: number;
  position: "above" | "below" | "left" | "right";
}

export interface ExportCanvas {
  nodes: ExportNode[];
  edges: ExportEdge[];
  annotations?: ExportAnnotation[];
}

export interface ExportInfo {
  title: string;
  patientId?: number | null;
  notes?: string | null;
}

// ---------------------------------------------------------------------------
// Dynamic legend — derived from canvas content
// ---------------------------------------------------------------------------
interface LegendItem { shape: string; label: string }

function computeLegendItems(canvas: ExportCanvas): LegendItem[] {
  const items: LegendItem[] = [];
  const nt = new Set(canvas.nodes.map((n) => n.type));
  const et = new Set(canvas.edges.map((e) => e.type));

  if (nt.has("male"))       items.push({ shape: "square",     label: "Male" });
  if (nt.has("female"))     items.push({ shape: "circle",     label: "Female" });
  if (nt.has("unknown"))    items.push({ shape: "diamond",    label: "Unknown sex" });
  if (nt.has("pregnancy"))  items.push({ shape: "pregnancy",  label: "Pregnancy" });
  if (nt.has("sab"))        items.push({ shape: "sab",        label: "SAB / Stillbirth" });
  if (canvas.nodes.some((n) => n.affected))              items.push({ shape: "filled",  label: "Affected" });
  if (canvas.nodes.some((n) => n.carrier && !n.affected)) items.push({ shape: "carrier", label: "Carrier" });
  if (canvas.nodes.some((n) => n.deceased))              items.push({ shape: "slash",   label: "Deceased" });
  if (canvas.nodes.some((n) => n.proband))               items.push({ shape: "arrow",   label: "Proband" });
  if (et.has("consanguinity")) items.push({ shape: "dbl-line", label: "Consanguineous union" });

  return items;
}

// ---------------------------------------------------------------------------
// Coordinate mapper — fits canvas data into a target rectangle
// ---------------------------------------------------------------------------
function makeMapper(nodes: ExportNode[], targetW: number, targetH: number, padX = 0, padY = 0) {
  if (nodes.length === 0) return (x: number, y: number) => ({ x: padX + x, y: padY + y, scale: 1 });

  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs) - 60;
  const minY = Math.min(...ys) - 60;
  const maxX = Math.max(...xs) + 60;
  const maxY = Math.max(...ys) + 60;
  const srcW = maxX - minX || 1;
  const srcH = maxY - minY || 1;

  const scale = Math.min(targetW / srcW, targetH / srcH);
  const drawW = srcW * scale;
  const drawH = srcH * scale;

  return (cx: number, cy: number) => ({
    x: padX + (targetW - drawW) / 2 + (cx - minX) * scale,
    y: padY + (targetH - drawH) / 2 + (cy - minY) * scale,
    scale,
  });
}

// ---------------------------------------------------------------------------
// JSON export
// ---------------------------------------------------------------------------
export function exportJSON(info: ExportInfo, canvas: ExportCanvas) {
  const payload = {
    format: "pedigree-pro-v1",
    exportedAt: new Date().toISOString(),
    pedigree: { title: info.title, patientId: info.patientId ?? null, notes: info.notes ?? null },
    canvas,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  triggerDownload(blob, `${safeFilename(info.title)}.json`);
}

export async function exportPPRO(pedigreeId: number, exporterKey: string, title: string): Promise<void> {
  const pproJson = await exportPedigreePpro(pedigreeId, exporterKey);
  const blob = new Blob([pproJson], { type: "application/json" });
  triggerDownload(blob, `${safeFilename(title)}.ppro`);
}

// ---------------------------------------------------------------------------
// PDF export — clinical-grade, white background, vector-like drawing
// ---------------------------------------------------------------------------
export async function exportPDF(info: ExportInfo, canvas: ExportCanvas) {
  let jsPDF: typeof import("jspdf").jsPDF;
  try {
    jsPDF = (await import("jspdf")).jsPDF;
  } catch {
    throw new Error("PDF export requires the jspdf library. Run: pnpm add jspdf");
  }

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const PW = 297;
  const PH = 210;
  const M  = 12;

  // ── Header ──────────────────────────────────────────────────────────────
  doc.setFillColor(10, 10, 10);
  doc.rect(0, 0, PW, 22, "F");

  doc.setTextColor(57, 255, 20);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Pedigree PRO", M, 10);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text("Genetic Counseling Pedigree Report", M, 16);

  doc.setTextColor(200, 200, 200);
  doc.setFontSize(8);
  doc.text(
    new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    PW - M, 10, { align: "right" }
  );

  doc.setFontSize(9);
  doc.setTextColor(220, 220, 220);
  doc.text(info.title, PW - M, 16, { align: "right" });

  // ── Dynamic legend ───────────────────────────────────────────────────────
  const LEGEND_Y = PH - 22;
  doc.setFillColor(18, 18, 18);
  doc.rect(0, LEGEND_Y, PW, 22, "F");

  const legendItems = computeLegendItems(canvas);
  let lx = M;
  const LY = LEGEND_Y + 11;
  const LS = 5;
  doc.setFontSize(7);

  for (const item of legendItems) {
    doc.setFillColor(220, 220, 220);
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.4);

    if (item.shape === "square") {
      doc.rect(lx, LY - LS / 2, LS, LS);
    } else if (item.shape === "circle") {
      doc.circle(lx + LS / 2, LY, LS / 2);
    } else if (item.shape === "diamond") {
      // rotated square
      const dc = lx + LS / 2;
      doc.lines([[LS / 2, -LS / 2], [LS / 2, LS / 2], [-LS / 2, LS / 2], [-LS / 2, -LS / 2]], dc, LY, [1, 1], "S", true);
    } else if (item.shape === "pregnancy") {
      // diamond (4-point)
      const dc = lx + LS / 2;
      doc.lines([[LS / 2, 0], [0, LS / 2], [-LS / 2, 0], [0, -LS / 2]], dc, LY - LS / 2, [1, 1], "S", true);
    } else if (item.shape === "sab") {
      // downward-pointing triangle
      doc.setFillColor(170, 170, 170);
      const tx = lx + LS / 2;
      doc.triangle(tx, LY + LS / 2, tx - LS / 2, LY - LS / 3, tx + LS / 2, LY - LS / 3, "FD");
    } else if (item.shape === "filled") {
      doc.setFillColor(57, 255, 20);
      doc.circle(lx + LS / 2, LY, LS / 2, "F");
      doc.setFillColor(220, 220, 220);
    } else if (item.shape === "carrier") {
      doc.circle(lx + LS / 2, LY, LS / 2);
      doc.setFillColor(57, 255, 20);
      doc.circle(lx + LS / 2, LY, LS / 6, "F");
      doc.setFillColor(220, 220, 220);
    } else if (item.shape === "slash") {
      doc.rect(lx, LY - LS / 2, LS, LS);
      doc.setDrawColor(180, 180, 180);
      doc.line(lx, LY + LS / 2, lx + LS, LY - LS / 2);
    } else if (item.shape === "arrow") {
      doc.setTextColor(57, 255, 20);
      doc.text("→", lx, LY + 2);
      doc.setTextColor(160, 160, 160);
    } else if (item.shape === "dbl-line") {
      doc.setDrawColor(160, 160, 160);
      doc.line(lx, LY - 1, lx + LS, LY - 1);
      doc.line(lx, LY + 1, lx + LS, LY + 1);
    }

    doc.setTextColor(160, 160, 160);
    doc.text(item.label, lx + LS + 2, LY + 2);
    lx += LS + doc.getTextWidth(item.label) + 8;
    if (lx > PW - 30) break; // safety overflow guard
  }

  if (info.notes) {
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(6.5);
    doc.text(`Notes: ${info.notes.slice(0, 200)}`, PW - M, LY + 2, { align: "right", maxWidth: 120 });
  }

  // ── Canvas area ──────────────────────────────────────────────────────────
  const CANVAS_TOP    = 26;
  const CANVAS_BOTTOM = LEGEND_Y - 4;
  const CANVAS_H      = CANVAS_BOTTOM - CANVAS_TOP;
  const CANVAS_W      = PW - 2 * M;
  const NS            = 7;

  const map  = makeMapper(canvas.nodes, CANVAS_W, CANVAS_H, M, CANVAS_TOP);
  const byId = new Map(canvas.nodes.map((n) => [n.id, n]));

  // Draw edges first
  doc.setLineWidth(0.35);
  for (const edge of canvas.edges) {
    const src = byId.get(edge.sourceId);
    const tgt = byId.get(edge.targetId);
    if (!src || !tgt) continue;

    const sp  = map(src.x, src.y);
    const tp  = map(tgt.x, tgt.y);
    const sc  = sp.scale ?? 1;
    const ns  = NS * Math.min(1, sc * 0.1 + 0.4);

    doc.setDrawColor(120, 120, 120);

    if (edge.type === "couple") {
      doc.line(sp.x + ns / 2, sp.y, tp.x - ns / 2, tp.y);
    } else if (edge.type === "consanguinity") {
      // Two parallel lines offset perpendicular to the connection
      const dx  = (tp.x - ns / 2) - (sp.x + ns / 2);
      const dy  = tp.y - sp.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const ox  = (-dy / len) * 0.5;
      const oy  = (dx / len) * 0.5;
      doc.line(sp.x + ns / 2 + ox, sp.y + oy, tp.x - ns / 2 + ox, tp.y + oy);
      doc.line(sp.x + ns / 2 - ox, sp.y - oy, tp.x - ns / 2 - ox, tp.y - oy);
    } else {
      const dropY = sp.y + ns / 2 + 4;
      doc.line(sp.x, sp.y + ns / 2, sp.x, dropY);
      doc.line(sp.x, dropY, tp.x, dropY);
      doc.line(tp.x, dropY, tp.x, tp.y - ns / 2);
    }
  }

  // Draw nodes
  for (const node of canvas.nodes) {
    const p  = map(node.x, node.y);
    const sc = p.scale ?? 1;
    const ns = NS * Math.min(1, sc * 0.1 + 0.4);
    const { x, y } = p;

    // Base fill
    if (node.affected) {
      doc.setFillColor(57, 255, 20);
    } else if (node.type === "sab") {
      doc.setFillColor(180, 180, 180);
    } else {
      doc.setFillColor(240, 240, 240);
    }
    doc.setDrawColor(50, 50, 50);
    doc.setLineWidth(node.affected ? 0.6 : 0.4);

    if (node.type === "male") {
      doc.rect(x - ns / 2, y - ns / 2, ns, ns, "FD");
    } else if (node.type === "female") {
      doc.circle(x, y, ns / 2, "FD");
    } else if (node.type === "pregnancy") {
      // 4-point diamond
      const h = ns / 2;
      doc.lines([[h, 0], [0, h], [-h, 0], [0, -h]], x, y - h, [1, 1], "FD", true);
    } else if (node.type === "sab") {
      // Downward-pointing filled triangle
      doc.triangle(x, y + ns * 0.36, x - ns * 0.38, y - ns * 0.26, x + ns * 0.38, y - ns * 0.26, "FD");
    } else {
      // unknown — upward triangle
      doc.setFillColor(
        node.affected ? 57 : 220,
        node.affected ? 255 : 220,
        node.affected ? 20  : 220
      );
      doc.triangle(x, y - ns / 2, x + ns / 2, y + ns / 4, x - ns / 2, y + ns / 4, "FD");
    }

    // Carrier dot
    if (node.carrier && !node.affected) {
      doc.setFillColor(57, 255, 20);
      doc.circle(x, y, ns / 6, "F");
    }

    // Deceased slash
    if (node.deceased) {
      doc.setDrawColor(80, 80, 80);
      doc.setLineWidth(0.5);
      doc.line(x - ns / 2 - 2, y + ns / 2 + 2, x + ns / 2 + 2, y - ns / 2 - 2);
    }

    // Proband arrow
    if (node.proband) {
      doc.setTextColor(57, 255, 20);
      doc.setFontSize(8);
      doc.text("→", x - ns / 2 - 6, y + 1.5);
    }

    // Label
    if (node.label) {
      doc.setTextColor(40, 40, 40);
      doc.setFontSize(5.5);
      doc.setFont("helvetica", node.affected ? "bold" : "normal");
      doc.text(node.label, x, y + ns / 2 + 3.5, { align: "center", maxWidth: 20 });
    }

    // Age
    if (node.age) {
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(4.5);
      doc.setFont("helvetica", "normal");
      doc.text(`${node.age}y`, x, y + ns / 2 + 7, { align: "center" });
    }
  }

  // Annotations
  doc.setFont("helvetica", "normal");
  for (const ann of canvas.annotations ?? []) {
    const node = byId.get(ann.nodeId);
    if (!node) continue;
    const p  = map(node.x, node.y);
    const sc = p.scale ?? 1;
    const ns = NS * Math.min(1, sc * 0.1 + 0.4);
    const fs = Math.max(3.5, ann.fontSize * 0.38);
    const approxW = ann.text.length * fs * 0.58 + 2.5;
    const boxH = fs + 1.5;

    let tx = p.x;
    let ty = p.y;
    if (ann.position === "above")  { tx = p.x; ty = p.y - ns / 2 - boxH - 1.5; }
    if (ann.position === "below")  { tx = p.x; ty = p.y + ns / 2 + 1.5; }
    if (ann.position === "left")   { tx = p.x - ns / 2 - approxW - 2; ty = p.y - boxH / 2; }
    if (ann.position === "right")  { tx = p.x + ns / 2 + 2; ty = p.y - boxH / 2; }

    const r = parseInt(ann.color.slice(1, 3), 16) || 57;
    const g = parseInt(ann.color.slice(3, 5), 16) || 255;
    const b = parseInt(ann.color.slice(5, 7), 16) || 20;

    doc.setFillColor(r, g, b);
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(0.25);
    doc.roundedRect(tx - approxW / 2, ty, approxW, boxH, 0.5, 0.5, "D");
    doc.setTextColor(r, g, b);
    doc.setFontSize(fs);
    doc.text(ann.text, tx, ty + boxH * 0.72, { align: "center" });
  }

  doc.save(`${safeFilename(info.title)}.pdf`);
}

// ---------------------------------------------------------------------------
// Generation helper — BFS from roots to assign each node a generation number
// ---------------------------------------------------------------------------
function computeGenerations(nodes: ExportNode[], edges: ExportEdge[]): Map<string, number> {
  const gen = new Map<string, number>();
  const hasParent = new Set(edges.filter(e => e.type === "parent-child").map(e => e.targetId));
  for (const n of nodes) if (!hasParent.has(n.id)) gen.set(n.id, 1);
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of edges) {
      if (e.type !== "parent-child") continue;
      const pg = gen.get(e.sourceId);
      if (pg === undefined) continue;
      const cg = gen.get(e.targetId) ?? 0;
      if (pg + 1 > cg) { gen.set(e.targetId, pg + 1); changed = true; }
    }
  }
  return gen;
}

const ROMAN = ["I","II","III","IV","V","VI","VII","VIII","IX","X"];
const toRoman = (n: number) => ROMAN[n - 1] ?? `G${n}`;

// ---------------------------------------------------------------------------
// PPTX export — editable PowerPoint shapes (multi-slide clinical deck)
// ---------------------------------------------------------------------------
export async function exportPPTX(info: ExportInfo, canvas: ExportCanvas) {
  let PptxGenJs: typeof import("pptxgenjs").default;
  try {
    PptxGenJs = (await import("pptxgenjs")).default;
  } catch {
    throw new Error("PPTX export requires the pptxgenjs library. Run: pnpm add pptxgenjs");
  }
  const pptx = new PptxGenJs();
  pptx.layout = "LAYOUT_WIDE";
  const SW = 13.33;
  const SH = 7.5;
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  // Computed stats
  const genMap    = computeGenerations(canvas.nodes, canvas.edges);
  const maxGen    = Math.max(0, ...Array.from(genMap.values()));
  const affected  = canvas.nodes.filter(n => n.affected);
  const carriers  = canvas.nodes.filter(n => n.carrier && !n.affected);
  const deceased  = canvas.nodes.filter(n => n.deceased);
  const proband   = canvas.nodes.find(n => n.proband);
  const notable   = canvas.nodes.filter(n => n.affected || n.carrier || n.proband);
  const couples   = canvas.edges.filter(e => e.type === "couple").length;

  // ── SLIDE 1 — Cover ─────────────────────────────────────────────────────
  const cover = pptx.addSlide();
  cover.background = { color: "060A06" };

  // Left panel
  cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 7.2, h: SH, fill: { color: "080E08" }, line: { color: "1A2A1A", width: 0.5 } });

  cover.addText("Pedigree PRO", { x: 0.55, y: 1.1, w: 6.2, h: 0.7, fontSize: 38, bold: true, color: "39FF14", fontFace: "Courier New" });
  cover.addText("Genetic Counseling Pedigree Report", { x: 0.55, y: 1.85, w: 6.2, h: 0.3, fontSize: 11, color: "336633", fontFace: "Courier New" });

  // Divider line
  cover.addShape(pptx.ShapeType.rect, { x: 0.55, y: 2.3, w: 6.2, h: 0.025, fill: { color: "1E3A1E" }, line: { color: "1E3A1E", width: 0 } });

  cover.addText(info.title, { x: 0.55, y: 2.5, w: 6.2, h: 0.55, fontSize: 22, bold: true, color: "D8EDD8", fontFace: "Courier New" });
  if (info.patientId) {
    cover.addText(`Patient ID: #${info.patientId}`, { x: 0.55, y: 3.1, w: 6.2, h: 0.25, fontSize: 10, color: "557755", fontFace: "Courier New" });
  }
  cover.addText(`Generated: ${today}`, { x: 0.55, y: info.patientId ? 3.42 : 3.1, w: 6.2, h: 0.22, fontSize: 9, color: "3A5A3A", fontFace: "Courier New" });

  // Proband box
  if (proband) {
    const probandY = info.patientId ? 4.05 : 3.75;
    cover.addShape(pptx.ShapeType.rect, { x: 0.55, y: probandY, w: 6.2, h: 0.85, fill: { color: "0D1A0D" }, line: { color: "2A5A2A", width: 0.75 } });
    cover.addText("→  PROBAND", { x: 0.75, y: probandY + 0.1, w: 2.5, h: 0.22, fontSize: 7.5, bold: true, color: "39FF14", fontFace: "Courier New" });
    const pDetails = [
      proband.label && `Label: ${proband.label}`,
      proband.age   && `Age: ${proband.age}`,
      proband.condition && `Dx: ${proband.condition}`,
    ].filter(Boolean).join("     ");
    cover.addText(pDetails || `ID: ${proband.id}`, { x: 0.75, y: probandY + 0.38, w: 5.9, h: 0.35, fontSize: 9.5, color: "BBDDBB", fontFace: "Courier New" });
  }

  // Right panel — stats
  cover.addShape(pptx.ShapeType.rect, { x: 7.3, y: 0, w: 6.03, h: SH, fill: { color: "050905" }, line: { color: "1A2A1A", width: 0.5 } });
  cover.addText("PEDIGREE STATISTICS", { x: 7.6, y: 0.65, w: 5.5, h: 0.28, fontSize: 8.5, bold: true, color: "2A4A2A", fontFace: "Courier New" });
  cover.addShape(pptx.ShapeType.rect, { x: 7.6, y: 0.98, w: 5.5, h: 0.02, fill: { color: "1E3A1E" }, line: { color: "1E3A1E", width: 0 } });

  const statsRows: [string, string, boolean][] = [
    ["Total individuals",  `${canvas.nodes.length}`,            false],
    ["Generations",        maxGen > 0 ? `${maxGen}` : "—",      false],
    ["Couple pairs",       `${couples}`,                         false],
    ["",                   "",                                   false],
    ["Affected",           `${affected.length}`,                 affected.length > 0],
    ["Carriers",           `${carriers.length}`,                 carriers.length > 0],
    ["Deceased",           `${deceased.length}`,                 false],
    ["",                   "",                                   false],
    ["Males",              `${canvas.nodes.filter(n=>n.type==="male").length}`,     false],
    ["Females",            `${canvas.nodes.filter(n=>n.type==="female").length}`,   false],
    ["Unknown sex",        `${canvas.nodes.filter(n=>n.type==="unknown").length}`,  false],
    ["Pregnancies",        `${canvas.nodes.filter(n=>n.type==="pregnancy").length}`,false],
    ["SAB / Stillbirth",   `${canvas.nodes.filter(n=>n.type==="sab").length}`,      false],
  ];

  statsRows.forEach(([label, value, highlight], i) => {
    if (!label) return;
    const y = 1.1 + i * 0.35;
    cover.addText(label, { x: 7.6, y, w: 4.2, h: 0.28, fontSize: 9, color: "557755", fontFace: "Courier New" });
    cover.addText(value, { x: 11.9, y, w: 1.2, h: 0.28, fontSize: 9, bold: highlight, color: highlight ? "39FF14" : "889988", fontFace: "Courier New", align: "right" });
  });

  // ── SLIDE 2 — Pedigree diagram ───────────────────────────────────────────
  const slide = pptx.addSlide();
  slide.background = { color: "080808" };

  // Header
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: SW, h: 0.52, fill: { color: "0F0F0F" }, line: { color: "1E1E1E", width: 0.5 } });
  slide.addText("Pedigree PRO", { x: 0.2, y: 0.08, w: 3.5, h: 0.28, fontSize: 11, bold: true, color: "39FF14", fontFace: "Courier New" });
  slide.addText(info.title, { x: 3.8, y: 0.12, w: 5.5, h: 0.22, fontSize: 9, color: "666666", fontFace: "Courier New" });
  slide.addText(`${today}  ·  ${canvas.nodes.length} individuals  ·  ${maxGen} generation${maxGen !== 1 ? "s" : ""}`, {
    x: SW - 4, y: 0.12, w: 3.8, h: 0.22, fontSize: 7.5, color: "444444", align: "right", fontFace: "Courier New",
  });

  // Legend bar
  const LEG_Y = SH - 0.58;
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: LEG_Y, w: SW, h: 0.58, fill: { color: "0F0F0F" }, line: { color: "1E1E1E", width: 0.5 } });
  const legendItems = computeLegendItems(canvas);
  const legendDefs = legendItems.map((item) => {
    if (item.shape === "filled")    return { label: `● ${item.label}`, color: "39FF14" };
    if (item.shape === "carrier")   return { label: `◉ ${item.label}`, color: "39FF14" };
    if (item.shape === "arrow")     return { label: `→ ${item.label}`, color: "39FF14" };
    if (item.shape === "square")    return { label: `□ ${item.label}`, color: "AAAAAA" };
    if (item.shape === "circle")    return { label: `○ ${item.label}`, color: "AAAAAA" };
    if (item.shape === "diamond")   return { label: `◇ ${item.label}`, color: "AAAAAA" };
    if (item.shape === "pregnancy") return { label: `⬦ ${item.label}`, color: "AAAAAA" };
    if (item.shape === "sab")       return { label: `▽ ${item.label}`, color: "888888" };
    if (item.shape === "slash")     return { label: `⊘ ${item.label}`, color: "888888" };
    if (item.shape === "dbl-line")  return { label: `╪ ${item.label}`, color: "888888" };
    return { label: item.label, color: "AAAAAA" };
  });
  const colW = Math.min(2.0, (SW - 0.6) / Math.max(legendDefs.length, 1));
  legendDefs.forEach((item, i) => {
    slide.addText(item.label, { x: 0.3 + i * colW, y: LEG_Y + 0.16, w: colW, h: 0.24, fontSize: 7, color: item.color, fontFace: "Courier New" });
  });
  if (info.notes) {
    slide.addText(`Notes: ${info.notes.slice(0, 130)}`, { x: 0.3, y: LEG_Y + 0.42, w: SW - 0.6, h: 0.13, fontSize: 5.5, color: "3A3A3A", fontFace: "Courier New" });
  }

  // Canvas area — with left margin for generation labels
  const GEN_W      = 0.5;
  const CANVAS_TOP    = 0.62;
  const CANVAS_BOTTOM = LEG_Y - 0.08;
  const CANVAS_H      = CANVAS_BOTTOM - CANVAS_TOP;
  const CANVAS_W      = SW - GEN_W - 0.15;
  const PAD_X         = GEN_W + 0.1;
  const NS_IN         = 0.38;

  const map  = makeMapper(canvas.nodes, CANVAS_W, CANVAS_H, PAD_X, CANVAS_TOP);
  const byId = new Map(canvas.nodes.map((n) => [n.id, n]));

  // Generation labels on left margin
  if (genMap.size > 0) {
    const genYs = new Map<number, number[]>();
    for (const node of canvas.nodes) {
      const g = genMap.get(node.id) ?? 1;
      genYs.set(g, [...(genYs.get(g) ?? []), map(node.x, node.y).y]);
    }
    for (const [gen, ys] of genYs) {
      const avgY = ys.reduce((a, b) => a + b, 0) / ys.length;
      slide.addText(toRoman(gen), {
        x: 0.02, y: avgY - 0.14, w: GEN_W - 0.06, h: 0.28,
        fontSize: 9, bold: true, color: "2A4A2A", fontFace: "Courier New", align: "right",
      });
    }
  }

  // Edges
  for (const edge of canvas.edges) {
    const src = byId.get(edge.sourceId);
    const tgt = byId.get(edge.targetId);
    if (!src || !tgt) continue;
    const sp = map(src.x, src.y);
    const tp = map(tgt.x, tgt.y);
    const ns = NS_IN;
    if (edge.type === "couple") {
      addLine(slide, pptx, sp.x + ns / 2, sp.y, tp.x - ns / 2, tp.y, "3A3A3A", 0.75);
    } else if (edge.type === "consanguinity") {
      const dx = (tp.x - ns / 2) - (sp.x + ns / 2);
      const dy = tp.y - sp.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const ox = (-dy / len) * 0.022;
      const oy = (dx / len) * 0.022;
      addLine(slide, pptx, sp.x + ns / 2 + ox, sp.y + oy, tp.x - ns / 2 + ox, tp.y + oy, "3A3A3A", 0.75);
      addLine(slide, pptx, sp.x + ns / 2 - ox, sp.y - oy, tp.x - ns / 2 - ox, tp.y - oy, "3A3A3A", 0.75);
    } else {
      const dropY = sp.y + ns / 2 + 0.1;
      addLine(slide, pptx, sp.x, sp.y + ns / 2, sp.x, dropY, "3A3A3A", 0.75);
      addLine(slide, pptx, sp.x, dropY, tp.x, dropY, "3A3A3A", 0.75);
      addLine(slide, pptx, tp.x, dropY, tp.x, tp.y - ns / 2, "3A3A3A", 0.75);
    }
  }

  // Nodes
  for (const node of canvas.nodes) {
    const p    = map(node.x, node.y);
    const { x, y } = p;
    const ns   = NS_IN;
    const half = ns / 2;
    const fillColor = node.affected ? "39FF14" : node.type === "sab" ? "404040" : "181818";
    const lineColor = node.affected ? "39FF14" : node.deceased ? "555555" : "484848";
    const lineW = node.affected ? 1.5 : node.proband ? 2.0 : 1.0;

    if (node.type === "male") {
      slide.addShape(pptx.ShapeType.rect,    { x: x-half, y: y-half, w: ns, h: ns, fill: { color: fillColor }, line: { color: lineColor, width: lineW } });
    } else if (node.type === "female") {
      slide.addShape(pptx.ShapeType.ellipse, { x: x-half, y: y-half, w: ns, h: ns, fill: { color: fillColor }, line: { color: lineColor, width: lineW } });
    } else if (node.type === "pregnancy") {
      slide.addShape(pptx.ShapeType.diamond, { x: x-half, y: y-half, w: ns, h: ns, fill: { color: fillColor }, line: { color: lineColor, width: 1.0 } });
    } else if (node.type === "sab") {
      slide.addShape(pptx.ShapeType.triangle, { x: x-half, y: y-half, w: ns, h: ns, fill: { color: fillColor }, line: { color: lineColor, width: 1.0 }, rotate: 180 });
    } else {
      slide.addShape(pptx.ShapeType.triangle, { x: x-half, y: y-half, w: ns, h: ns, fill: { color: fillColor }, line: { color: lineColor, width: lineW } });
    }
    if (node.carrier && !node.affected) {
      slide.addShape(pptx.ShapeType.ellipse, { x: x-ns*0.12, y: y-ns*0.12, w: ns*0.24, h: ns*0.24, fill: { color: "39FF14" }, line: { color: "39FF14", width: 0 } });
    }
    if (node.deceased) {
      addLine(slide, pptx, x-half-0.06, y+half+0.06, x+half+0.06, y-half-0.06, "666666", 1.0);
    }
    if (node.proband) {
      slide.addText("→", { x: x-half-0.34, y: y-0.11, w: 0.3, h: 0.22, fontSize: 12, bold: true, color: "39FF14", fontFace: "Courier New" });
    }
    if (node.label) {
      slide.addText(node.label, {
        x: x-0.52, y: y+half+0.03, w: 1.04, h: 0.18,
        fontSize: 6.5, color: node.affected ? "39FF14" : "888888", align: "center", fontFace: "Courier New", bold: node.affected,
      });
    }
    if (node.age) {
      slide.addText(`${node.age}y`, {
        x: x-0.32, y: y+half+(node.label ? 0.22 : 0.04), w: 0.64, h: 0.14,
        fontSize: 5.5, color: "505050", align: "center", fontFace: "Courier New",
      });
    }
    if (node.condition) {
      const condY = y+half+(node.label?0.22:0.04)+(node.age?0.15:0);
      slide.addText(node.condition.slice(0, 20), {
        x: x-0.6, y: condY, w: 1.2, h: 0.14,
        fontSize: 5, color: "997733", align: "center", fontFace: "Courier New", italic: true,
      });
    }
  }

  // Annotations
  for (const ann of canvas.annotations ?? []) {
    const node = byId.get(ann.nodeId);
    if (!node) continue;
    const p   = map(node.x, node.y);
    const ns  = NS_IN;
    const fs  = Math.max(5, ann.fontSize * 0.42);
    const approxW = Math.max(0.4, ann.text.length * fs * 0.007 + 0.15);
    const boxH = 0.18;
    let tx = p.x - approxW / 2;
    let ty = p.y;
    if (ann.position === "above") { ty = p.y - ns/2 - boxH - 0.05; }
    if (ann.position === "below") { ty = p.y + ns/2 + 0.05; }
    if (ann.position === "left")  { tx = p.x - ns/2 - approxW - 0.06; ty = p.y - boxH/2; }
    if (ann.position === "right") { tx = p.x + ns/2 + 0.06; ty = p.y - boxH/2; }
    const hex = ann.color.replace("#", "").padEnd(6, "0");
    slide.addText(ann.text, { x: tx, y: ty, w: approxW, h: boxH, fontSize: fs, color: hex, fontFace: "Courier New", align: "center" } as any);
  }

  // ── SLIDE 3 — Clinical Roster ────────────────────────────────────────────
  if (notable.length > 0) {
    const s3 = pptx.addSlide();
    s3.background = { color: "060A06" };
    s3.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: SW, h: 0.52, fill: { color: "0F0F0F" }, line: { color: "1E1E1E", width: 0.5 } });
    s3.addText("Pedigree PRO", { x: 0.2, y: 0.1, w: 3.5, h: 0.28, fontSize: 11, bold: true, color: "39FF14", fontFace: "Courier New" });
    s3.addText("Clinical Roster — Affected & Notable Individuals", { x: 3.9, y: 0.13, w: 7.5, h: 0.24, fontSize: 9, color: "557755", fontFace: "Courier New" });
    s3.addText(`${info.title}  ·  ${today}`, { x: SW-4, y: 0.13, w: 3.8, h: 0.24, fontSize: 7, color: "3A5A3A", align: "right", fontFace: "Courier New" });

    const colXs = [0.25, 1.35, 2.2,  3.05, 4.45, 5.25, 9.6 ];
    const colWs = [1.05, 0.8,  0.8,  1.35, 0.75, 4.3,  3.5 ];
    const heads = ["Label","Type","Gen.","Status","Age","Diagnosis","Notes"];
    const hY = 0.68;
    s3.addShape(pptx.ShapeType.rect, { x: 0.2, y: hY, w: SW-0.4, h: 0.3, fill: { color: "0C180C" }, line: { color: "1A2A1A", width: 0.5 } });
    heads.forEach((h, ci) => s3.addText(h.toUpperCase(), { x: colXs[ci], y: hY+0.05, w: colWs[ci], h: 0.2, fontSize: 6.5, bold: true, color: "2E6A2E", fontFace: "Courier New" }));

    notable.forEach((node, ri) => {
      const rowY = hY + 0.32 + ri * 0.31;
      if (rowY > SH - 0.35) return;
      s3.addShape(pptx.ShapeType.rect, { x: 0.2, y: rowY, w: SW-0.4, h: 0.29, fill: { color: ri%2===0 ? "090D09" : "070B07" }, line: { color: "131913", width: 0.3 } });
      const gen = genMap.get(node.id);
      const statusParts = [node.affected&&"Affected",node.carrier&&"Carrier",node.proband&&"Proband",node.deceased&&"Deceased"].filter(Boolean).join(", ");
      const typeLabel = ({male:"Male □",female:"Female ○",unknown:"Unknown ◇",pregnancy:"Pregnancy ◈",sab:"SAB △"} as Record<string,string>)[node.type] ?? node.type;
      const cells = [
        node.label||"—", typeLabel, gen?toRoman(gen):"—",
        statusParts||"—", node.age?`${node.age}y`:(node.dob??"—"),
        node.condition||"—", node.notes?(node.notes.slice(0,60)):"—",
      ];
      cells.forEach((cell, ci) => {
        const hl = ci===3 && node.affected;
        s3.addText(cell, {
          x: colXs[ci], y: rowY+0.05, w: colWs[ci], h: 0.2,
          fontSize: 7, color: hl?"39FF14":ci===0?"88CC88":ci===5&&node.condition?"997733":"5A6A5A",
          fontFace: "Courier New", bold: ci===0||hl, italic: ci===5&&!!node.condition,
        });
      });
    });
    s3.addText("Only affected, carrier, and proband individuals listed.", { x: 0.3, y: SH-0.3, w: SW-0.6, h: 0.2, fontSize: 5.5, color: "2A3A2A", fontFace: "Courier New", italic: true });
  }

  // ── SLIDE 4 — Clinical Notes ─────────────────────────────────────────────
  if (info.notes && info.notes.length > 10) {
    const s4 = pptx.addSlide();
    s4.background = { color: "060A06" };
    s4.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: SW, h: 0.52, fill: { color: "0F0F0F" }, line: { color: "1E1E1E", width: 0.5 } });
    s4.addText("Pedigree PRO", { x: 0.2, y: 0.1, w: 3.5, h: 0.28, fontSize: 11, bold: true, color: "39FF14", fontFace: "Courier New" });
    s4.addText("Clinical Notes", { x: 3.9, y: 0.13, w: 6, h: 0.24, fontSize: 9, color: "557755", fontFace: "Courier New" });
    s4.addShape(pptx.ShapeType.rect, { x: 0.4, y: 0.72, w: SW-0.8, h: SH-1.15, fill: { color: "080C08" }, line: { color: "1A2A1A", width: 0.5 } });
    s4.addText(info.notes, { x: 0.65, y: 0.88, w: SW-1.3, h: SH-1.4, fontSize: 11, color: "99BB99", fontFace: "Courier New", wrap: true, valign: "top" });
  }

  await pptx.writeFile({ fileName: `${safeFilename(info.title)}.pptx` });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function addLine(
  slide: ReturnType<InstanceType<typeof import("pptxgenjs").default>["addSlide"]>,
  pptx: InstanceType<typeof import("pptxgenjs").default>,
  x1: number, y1: number, x2: number, y2: number,
  color: string, width: number
) {
  const lx    = Math.min(x1, x2);
  const ly    = Math.min(y1, y2);
  const lw    = Math.abs(x2 - x1) || 0.001;
  const lh    = Math.abs(y2 - y1) || 0.001;
  const flipH = x2 < x1;
  const flipV = y2 < y1;
  slide.addShape(pptx.ShapeType.line, {
    x: lx, y: ly, w: lw, h: lh,
    flipH, flipV,
    line: { color, width, dashType: "solid" },
  });
}

// ---------------------------------------------------------------------------
// Clinical Report — 2-page portrait PDF with risk analysis & validation
// ---------------------------------------------------------------------------
export async function exportClinicalReport(info: ExportInfo, canvas: ExportCanvas) {
  let jsPDF: typeof import("jspdf").jsPDF;
  try {
    jsPDF = (await import("jspdf")).jsPDF;
  } catch {
    throw new Error("Clinical report export requires the jspdf library. Run: pnpm add jspdf");
  }

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = 210;
  const PH = 297;
  const M  = 12;
  const CW = PW - 2 * M;

  const NR = 57, NG = 255, NB = 20; // neon green
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const byId  = new Map(canvas.nodes.map((n) => [n.id, n]));

  // ── shared helpers ────────────────────────────────────────────────────────
  function pageHeader(subtitle: string, showTitle = true) {
    doc.setFillColor(10, 10, 10);
    doc.rect(0, 0, PW, 20, "F");
    doc.setTextColor(NR, NG, NB);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Pedigree PRO", M, 8);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(subtitle, M, 14);
    if (showTitle) {
      doc.setTextColor(190, 190, 190);
      doc.setFontSize(8);
      doc.text(info.title, PW - M, 8, { align: "right" });
    }
    doc.setTextColor(110, 110, 110);
    doc.setFontSize(6.5);
    doc.text(today, PW - M, 14, { align: "right" });
  }

  function pageFooter(page: number, total: number) {
    const fy = PH - 8;
    doc.setDrawColor(28, 28, 28);
    doc.setLineWidth(0.3);
    doc.line(M, fy, PW - M, fy);
    doc.setTextColor(65, 65, 65);
    doc.setFontSize(5.5);
    doc.setFont("helvetica", "normal");
    doc.text("For use by licensed genetic counselors only. Not for independent patient distribution.", M, fy + 4);
    doc.text(`Page ${page} of ${total}`, PW - M, fy + 4, { align: "right" });
  }

  function sectionBar(title: string, y: number): number {
    doc.setFillColor(20, 20, 20);
    doc.rect(0, y, PW, 7, "F");
    doc.setDrawColor(NR, NG, NB);
    doc.setLineWidth(0.4);
    doc.line(M, y + 7, PW - M, y + 7);
    doc.setTextColor(NR, NG, NB);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text(title, M, y + 5);
    return y + 9;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 1 — Pedigree Diagram
  // ══════════════════════════════════════════════════════════════════════════
  pageHeader("Genetic Counseling Pedigree Report");

  // Title strip
  doc.setFillColor(18, 18, 18);
  doc.rect(0, 20, PW, 9, "F");
  doc.setTextColor(215, 215, 215);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(info.title, M, 26.5);
  if (info.patientId) {
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(`Patient #${info.patientId}`, PW - M, 26.5, { align: "right" });
  }

  // White pedigree area
  const DT = 29, DH = 150;
  doc.setFillColor(255, 255, 255);
  doc.rect(0, DT, PW, DH, "F");

  const map = makeMapper(canvas.nodes, CW, DH - 4, M, DT + 2);
  const NS  = 6;

  // Edges
  doc.setLineWidth(0.35);
  for (const edge of canvas.edges) {
    const src = byId.get(edge.sourceId);
    const tgt = byId.get(edge.targetId);
    if (!src || !tgt) continue;
    const sp = map(src.x, src.y);
    const tp = map(tgt.x, tgt.y);
    const sc = sp.scale ?? 1;
    const ns = NS * Math.min(1, sc * 0.1 + 0.4);
    doc.setDrawColor(80, 80, 80);
    if (edge.type === "couple") {
      doc.line(sp.x + ns / 2, sp.y, tp.x - ns / 2, tp.y);
    } else if (edge.type === "consanguinity") {
      const dx = (tp.x - ns / 2) - (sp.x + ns / 2);
      const dy = tp.y - sp.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const ox = (-dy / len) * 0.55; const oy = (dx / len) * 0.55;
      doc.line(sp.x + ns / 2 + ox, sp.y + oy, tp.x - ns / 2 + ox, tp.y + oy);
      doc.line(sp.x + ns / 2 - ox, sp.y - oy, tp.x - ns / 2 - ox, tp.y - oy);
    } else {
      const dropY = sp.y + ns / 2 + 3;
      doc.line(sp.x, sp.y + ns / 2, sp.x, dropY);
      doc.line(sp.x, dropY, tp.x, dropY);
      doc.line(tp.x, dropY, tp.x, tp.y - ns / 2);
    }
  }

  // Nodes
  for (const node of canvas.nodes) {
    const p = map(node.x, node.y); const sc = p.scale ?? 1;
    const ns = NS * Math.min(1, sc * 0.1 + 0.4);
    const { x, y } = p;
    if (node.affected)       doc.setFillColor(NR, NG, NB);
    else if (node.type === "sab") doc.setFillColor(175, 175, 175);
    else                     doc.setFillColor(235, 235, 235);
    doc.setDrawColor(60, 60, 60);
    doc.setLineWidth(node.affected ? 0.55 : 0.35);
    if (node.type === "male") {
      doc.rect(x - ns / 2, y - ns / 2, ns, ns, "FD");
    } else if (node.type === "female") {
      doc.circle(x, y, ns / 2, "FD");
    } else if (node.type === "pregnancy") {
      const h = ns / 2;
      doc.lines([[h, 0], [0, h], [-h, 0], [0, -h]], x, y - h, [1, 1], "FD", true);
    } else if (node.type === "sab") {
      doc.triangle(x, y + ns * 0.36, x - ns * 0.38, y - ns * 0.26, x + ns * 0.38, y - ns * 0.26, "FD");
    } else {
      doc.setFillColor(node.affected ? NR : 215, node.affected ? NG : 215, node.affected ? NB : 215);
      doc.triangle(x, y - ns / 2, x + ns / 2, y + ns / 4, x - ns / 2, y + ns / 4, "FD");
    }
    if (node.carrier && !node.affected) {
      doc.setFillColor(NR, NG, NB); doc.circle(x, y, ns / 6, "F");
    }
    if (node.deceased) {
      doc.setDrawColor(80, 80, 80); doc.setLineWidth(0.45);
      doc.line(x - ns / 2 - 1, y + ns / 2 + 1, x + ns / 2 + 1, y - ns / 2 - 1);
    }
    if (node.proband) {
      doc.setTextColor(NR, NG, NB); doc.setFontSize(7);
      doc.text("→", x - ns / 2 - 5, y + 1.5);
    }
    if (node.label) {
      doc.setTextColor(40, 40, 40); doc.setFontSize(4.5);
      doc.setFont("helvetica", node.affected ? "bold" : "normal");
      doc.text(node.label, x, y + ns / 2 + 3, { align: "center", maxWidth: 18 });
    }
    if (node.age) {
      doc.setTextColor(110, 110, 110); doc.setFontSize(3.5);
      doc.setFont("helvetica", "normal");
      doc.text(`${node.age}y`, x, y + ns / 2 + 6.5, { align: "center" });
    }
  }

  // Annotations in diagram
  doc.setFont("helvetica", "normal");
  for (const ann of canvas.annotations ?? []) {
    const node = byId.get(ann.nodeId);
    if (!node) continue;
    const p = map(node.x, node.y); const sc = p.scale ?? 1;
    const ns = NS * Math.min(1, sc * 0.1 + 0.4);
    const fs = Math.max(3, ann.fontSize * 0.3);
    const approxW = ann.text.length * fs * 0.58 + 2;
    const boxH = fs + 1.4;
    let tx = p.x; let ty = p.y;
    if (ann.position === "above")  { ty = p.y - ns / 2 - boxH - 1.2; }
    if (ann.position === "below")  { ty = p.y + ns / 2 + 1.2; }
    if (ann.position === "left")   { tx = p.x - ns / 2 - approxW - 1.5; ty = p.y - boxH / 2; }
    if (ann.position === "right")  { tx = p.x + ns / 2 + 1.5; ty = p.y - boxH / 2; }
    const r = parseInt(ann.color.slice(1, 3), 16) || 80;
    const g = parseInt(ann.color.slice(3, 5), 16) || 130;
    const b = parseInt(ann.color.slice(5, 7), 16) || 80;
    doc.setDrawColor(r, g, b); doc.setLineWidth(0.18);
    doc.roundedRect(tx - approxW / 2, ty, approxW, boxH, 0.35, 0.35, "D");
    doc.setTextColor(r, g, b); doc.setFontSize(fs);
    doc.text(ann.text, tx, ty + boxH * 0.72, { align: "center" });
  }

  // Legend bar
  const LY0 = DT + DH;
  doc.setFillColor(16, 16, 16);
  doc.rect(0, LY0, PW, 13, "F");
  const legendItems = computeLegendItems(canvas);
  let lx = M; const LYc = LY0 + 7.5; const LS = 3.8;
  doc.setFontSize(5.5);
  for (const item of legendItems) {
    doc.setFillColor(205, 205, 205); doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.25);
    if (item.shape === "square")   { doc.rect(lx, LYc - LS / 2, LS, LS); }
    else if (item.shape === "circle")   { doc.circle(lx + LS / 2, LYc, LS / 2); }
    else if (item.shape === "diamond")  { const dc = lx + LS / 2; doc.lines([[LS / 2, -LS / 2], [LS / 2, LS / 2], [-LS / 2, LS / 2], [-LS / 2, -LS / 2]], dc, LYc, [1, 1], "S", true); }
    else if (item.shape === "pregnancy"){ const dc = lx + LS / 2; doc.lines([[LS / 2, 0], [0, LS / 2], [-LS / 2, 0], [0, -LS / 2]], dc, LYc - LS / 2, [1, 1], "S", true); }
    else if (item.shape === "sab")      { doc.setFillColor(165, 165, 165); doc.triangle(lx + LS / 2, LYc + LS / 2, lx, LYc - LS / 3, lx + LS, LYc - LS / 3, "FD"); }
    else if (item.shape === "filled")   { doc.setFillColor(NR, NG, NB); doc.circle(lx + LS / 2, LYc, LS / 2, "F"); doc.setFillColor(205, 205, 205); }
    else if (item.shape === "carrier")  { doc.circle(lx + LS / 2, LYc, LS / 2); doc.setFillColor(NR, NG, NB); doc.circle(lx + LS / 2, LYc, LS / 5, "F"); doc.setFillColor(205, 205, 205); }
    else if (item.shape === "slash")    { doc.rect(lx, LYc - LS / 2, LS, LS); doc.line(lx, LYc + LS / 2, lx + LS, LYc - LS / 2); }
    else if (item.shape === "arrow")    { doc.setTextColor(NR, NG, NB); doc.text("→", lx, LYc + 1.5); doc.setTextColor(145, 145, 145); }
    else if (item.shape === "dbl-line") { doc.line(lx, LYc - 0.6, lx + LS, LYc - 0.6); doc.line(lx, LYc + 0.6, lx + LS, LYc + 0.6); }
    doc.setTextColor(140, 140, 140);
    doc.text(item.label, lx + LS + 1.5, LYc + 1.5);
    lx += LS + doc.getTextWidth(item.label) + 5;
    if (lx > PW - 25) break;
  }

  // Notes strip
  const notesY = LY0 + 13;
  const notesH = info.notes ? 22 : 6;
  doc.setFillColor(13, 13, 13);
  doc.rect(0, notesY, PW, notesH, "F");
  if (info.notes) {
    doc.setTextColor(95, 95, 95); doc.setFontSize(6); doc.setFont("helvetica", "italic");
    const noteLines = doc.splitTextToSize(`Clinical Notes: ${info.notes}`, CW);
    doc.text(noteLines.slice(0, 3), M, notesY + 5);
  }

  pageFooter(1, 2);

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 2 — Clinical Analysis
  // ══════════════════════════════════════════════════════════════════════════
  doc.addPage();
  pageHeader("Clinical Analysis Report");

  const proband = canvas.nodes.find((n) => n.proband)
               ?? canvas.nodes.find((n) => n.affected)
               ?? canvas.nodes[0];

  let cy = 22;

  // ── Risk Analysis ─────────────────────────────────────────────────────────
  cy = sectionBar("INHERITANCE RISK ANALYSIS", cy);

  if (proband) {
    const probLabel = proband.label || `Individual (${proband.type})`;
    const probTag   = proband.proband ? " — Proband" : proband.affected ? " — Affected" : "";
    doc.setTextColor(155, 155, 155); doc.setFontSize(6.5); doc.setFont("helvetica", "italic");
    doc.text(`Analysis subject: ${probLabel}${probTag}`, M, cy + 3.5);
    cy += 7;

    type ModeId = "AD" | "AR" | "XLR" | "XLD";
    const MODES_LIST: { id: ModeId; title: string }[] = [
      { id: "AD",  title: "Autosomal Dominant" },
      { id: "AR",  title: "Autosomal Recessive" },
      { id: "XLR", title: "X-Linked Recessive" },
      { id: "XLD", title: "X-Linked Dominant" },
    ];

    const colW  = (CW - 5) / 2;
    const col2X = M + colW + 5;

    const results = MODES_LIST.map((m) => ({
      ...m,
      result: computeRisk(canvas.nodes, canvas.edges, proband.id, m.id),
    }));

    function drawCol(items: typeof results, startX: number, startY: number): number {
      let ly = startY;
      for (const { title, result } of items) {
        // Mode header
        doc.setFillColor(26, 26, 26);
        doc.rect(startX, ly, colW, 5, "F");
        doc.setTextColor(210, 210, 210); doc.setFontSize(6); doc.setFont("helvetica", "bold");
        doc.text(title, startX + 2, ly + 3.5);
        // Confidence tag (right-aligned)
        const confC = result.confidence === "strong"   ? [NR, NG, NB] as const
                    : result.confidence === "inferred" ? [250, 204, 21] as const
                    :                                    [105, 105, 105] as const;
        const confT = result.confidence === "strong" ? "● verified"
                    : result.confidence === "inferred" ? "◐ inferred" : "○ assumed";
        doc.setTextColor(confC[0], confC[1], confC[2]); doc.setFontSize(4.8); doc.setFont("helvetica", "normal");
        doc.text(confT, startX + colW - 1, ly + 3.5, { align: "right" });
        ly += 6;

        if (result.entries.length === 0) {
          doc.setTextColor(75, 75, 75); doc.setFontSize(5.5);
          doc.text("No result available.", startX + 2, ly + 3);
          ly += 6;
        }
        for (const e of result.entries) {
          const bW = colW - 4;
          const tC = e.tier === "low" ? [NR, NG, NB] as const
                   : e.tier === "moderate" ? [250, 204, 21] as const
                   : [255, 64, 64] as const;
          // Label + percent on same row
          const labelW = bW - doc.getTextWidth(e.percent) - 2;
          const labelLines = doc.splitTextToSize(e.label, labelW);
          doc.setTextColor(130, 130, 130); doc.setFontSize(5.5); doc.setFont("helvetica", "normal");
          doc.text(labelLines[0], startX + 2, ly + 3.5);
          doc.setTextColor(tC[0], tC[1], tC[2]); doc.setFontSize(5.5); doc.setFont("helvetica", "bold");
          doc.text(e.percent, startX + 2 + bW, ly + 3.5, { align: "right" });
          ly += 4.5;
          // Bar
          doc.setFillColor(34, 34, 34);
          doc.rect(startX + 2, ly, bW, 1.3, "F");
          if (e.value > 0) {
            doc.setFillColor(tC[0], tC[1], tC[2]);
            doc.rect(startX + 2, ly, Math.max(0.5, bW * Math.min(1, e.value)), 1.3, "F");
          }
          ly += 3.8;
        }
        // Basis (first line only)
        if (result.basis.length > 0) {
          const bLines = doc.splitTextToSize(result.basis[0], colW - 3);
          doc.setTextColor(65, 65, 65); doc.setFontSize(4.5); doc.setFont("helvetica", "italic");
          doc.text(bLines[0], startX + 2, ly + 2.5);
          ly += 5;
        }
        ly += 3;
      }
      return ly;
    }

    const leftEnd  = drawCol(results.slice(0, 2), M,     cy);
    const rightEnd = drawCol(results.slice(2, 4), col2X, cy);
    cy = Math.max(leftEnd, rightEnd) + 2;
  } else {
    doc.setTextColor(75, 75, 75); doc.setFontSize(6.5);
    doc.text("No individuals present in pedigree.", M, cy + 4);
    cy += 10;
  }

  // ── Pedigree Summary ──────────────────────────────────────────────────────
  cy = sectionBar("PEDIGREE SUMMARY", cy + 2);

  const summaryItems = [
    { l: "Total individuals",  v: `${canvas.nodes.length}` },
    { l: "Affected",           v: `${canvas.nodes.filter((n) => n.affected).length}` },
    { l: "Carriers",           v: `${canvas.nodes.filter((n) => n.carrier && !n.affected).length}` },
    { l: "Deceased",           v: `${canvas.nodes.filter((n) => n.deceased).length}` },
    { l: "Couple relationships", v: `${canvas.edges.filter((e) => e.type !== "parent-child").length}` },
    { l: "Parent-child links", v: `${canvas.edges.filter((e) => e.type === "parent-child").length}` },
  ];

  const SC = CW / 3;
  for (let i = 0; i < summaryItems.length; i++) {
    const { l, v } = summaryItems[i];
    const sx = M + (i % 3) * SC;
    const sy = cy + Math.floor(i / 3) * 8;
    doc.setTextColor(90, 90, 90); doc.setFontSize(5.5); doc.setFont("helvetica", "normal");
    doc.text(l, sx, sy + 3);
    doc.setTextColor(195, 195, 195); doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.text(v, sx, sy + 8.5);
  }
  cy += 20;

  // ── Validation Findings ───────────────────────────────────────────────────
  cy = sectionBar("VALIDATION FINDINGS", cy + 2);

  const vResult = validatePedigree({ nodes: canvas.nodes, edges: canvas.edges });
  if (vResult.issues.length === 0) {
    doc.setTextColor(NR, NG, NB); doc.setFontSize(7); doc.setFont("helvetica", "normal");
    doc.text("✓  No validation issues found.", M, cy + 4);
    cy += 10;
  } else {
    const maxShow = 7;
    for (let i = 0; i < Math.min(vResult.issues.length, maxShow); i++) {
      const iss = vResult.issues[i];
      const isErr = iss.severity === "error";
      doc.setTextColor(isErr ? 255 : 250, isErr ? 64 : 204, isErr ? 64 : 21);
      doc.setFontSize(6.5); doc.setFont("helvetica", "bold");
      doc.text(isErr ? "✕" : "⚠", M, cy + 3.5);
      doc.setFont("helvetica", "normal"); doc.setTextColor(175, 175, 175);
      doc.text(iss.message, M + 5, cy + 3.5);
      cy += 5.5;
      if (iss.detail) {
        doc.setTextColor(90, 90, 90); doc.setFontSize(5);
        doc.text(iss.detail, M + 5, cy + 2.5);
        cy += 4;
      }
    }
    if (vResult.issues.length > maxShow) {
      doc.setTextColor(75, 75, 75); doc.setFontSize(5.5);
      doc.text(`… and ${vResult.issues.length - maxShow} more issue(s)`, M, cy + 3);
      cy += 6;
    }
    cy += 2;
  }

  // ── Condition & Clinical Notes per node ──────────────────────────────────
  const nodesWithData = canvas.nodes.filter((n) => n.condition || n.notes);
  if (nodesWithData.length > 0) {
    cy = sectionBar("CLINICAL DATA", cy + 2);
    for (const n of nodesWithData) {
      if (cy > PH - 28) { doc.addPage(); pageHeader("Clinical Data (continued)", false); pageFooter(2, 2); cy = 26; }
      const nameLabel = n.label ? `${n.label}` : n.type;
      doc.setFillColor(20, 20, 20);
      doc.rect(M, cy, CW, 6.5, "F");
      doc.setTextColor(195, 195, 195); doc.setFontSize(6.5); doc.setFont("helvetica", "bold");
      doc.text(nameLabel, M + 2, cy + 4.5);
      if (n.age)  { doc.setTextColor(100, 100, 100); doc.setFontSize(5.5); doc.text(`${n.age}y`, M + 28, cy + 4.5); }
      if (n.dob)  { doc.setTextColor(80,  80,  80);  doc.setFontSize(5);   doc.text(`b.${n.dob.slice(0, 4)}`, M + 38, cy + 4.5); }
      const flags = [n.affected && "affected", n.carrier && "carrier", n.deceased && "deceased", n.proband && "proband"].filter(Boolean).join(", ");
      if (flags) { doc.setTextColor(NR, NG, NB); doc.setFontSize(5.5); doc.text(flags, PW - M - 2, cy + 4.5, { align: "right" }); }
      cy += 7;
      if (n.condition) {
        doc.setTextColor(200, 160, 20); doc.setFontSize(6); doc.setFont("helvetica", "bolditalic");
        doc.text("Condition:", M + 2, cy + 3.5);
        doc.setFont("helvetica", "italic"); doc.setTextColor(185, 150, 20);
        doc.text(n.condition, M + 22, cy + 3.5);
        cy += 6;
      }
      if (n.notes) {
        doc.setTextColor(90, 90, 90); doc.setFontSize(5.5); doc.setFont("helvetica", "normal");
        const noteLines = doc.splitTextToSize(n.notes, CW - 4);
        for (const line of noteLines.slice(0, 6)) {
          if (cy > PH - 28) break;
          doc.text(line, M + 2, cy + 3.5);
          cy += 5;
        }
      }
      cy += 3;
    }
    cy += 2;
  }

  // ── Annotations ───────────────────────────────────────────────────────────
  const allAnns = canvas.annotations ?? [];
  if (allAnns.length > 0) {
    cy = sectionBar("ANNOTATIONS", cy + 2);
    const maxAnns = 12;
    for (let i = 0; i < Math.min(allAnns.length, maxAnns); i++) {
      const ann  = allAnns[i];
      const node = byId.get(ann.nodeId);
      const nl   = node?.label || node?.type || ann.nodeId;
      const r = parseInt(ann.color.slice(1, 3), 16) || 80;
      const g = parseInt(ann.color.slice(3, 5), 16) || 130;
      const b = parseInt(ann.color.slice(5, 7), 16) || 80;
      doc.setTextColor(r, g, b); doc.setFontSize(6); doc.setFont("helvetica", "bold");
      doc.text(`${nl}:`, M, cy + 3.5);
      const nlW = doc.getTextWidth(`${nl}: `);
      doc.setFont("helvetica", "normal"); doc.setTextColor(155, 155, 155);
      const annLines = doc.splitTextToSize(ann.text, CW - nlW - 12);
      doc.text(annLines[0], M + nlW + 1, cy + 3.5);
      doc.setTextColor(70, 70, 70); doc.setFontSize(5);
      doc.text(`(${ann.position})`, PW - M, cy + 3.5, { align: "right" });
      cy += 6;
    }
    if (allAnns.length > maxAnns) {
      doc.setTextColor(65, 65, 65); doc.setFontSize(5.5);
      doc.text(`… and ${allAnns.length - maxAnns} more annotation(s)`, M, cy + 3);
    }
  }

  pageFooter(2, 2);
  doc.save(`${safeFilename(info.title)}_clinical_report.pdf`);
}

/**
 * Export pedigree as SVG string.
 * Serializes the current SVG DOM element on the pedigree canvas page
 * and downloads it as an .svg file.
 */
export async function exportSVG(info: ExportInfo, _canvas: ExportCanvas): Promise<void> {
  const svgEl = document.querySelector('svg[data-canvas-svg="true"]') ?? document.querySelector("svg");
  if (!svgEl) {
    alert("No pedigree canvas SVG found on the page.");
    return;
  }
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  // Remove the lasso rectangle from the export
  clone.querySelector("rect[lasso]")?.remove();
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clone);
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  triggerDownload(blob, `${safeFilename(info.title)}_pedigree.svg`);
}

/**
 * Export pedigree as PNG image.
 * Renders the current SVG DOM element to a canvas and downloads it as a .png file.
 */
export async function exportPNG(info: ExportInfo, _canvas: ExportCanvas): Promise<void> {
  const svgEl = document.querySelector('svg[data-canvas-svg="true"]') ?? document.querySelector("svg");
  if (!svgEl) {
    alert("No pedigree canvas SVG found on the page.");
    return;
  }
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.querySelector("rect[lasso]")?.remove();
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clone);
  const img = new Image();
  const blob = await new Promise<Blob>((resolve, reject) => {
    img.onload = () => {
      // Scale 2x for retina-quality export
      const w = clone.viewBox.baseVal.width || 1400;
      const h = clone.viewBox.baseVal.height || 900;
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas 2D context unavailable")); return; }
      ctx.fillStyle = "#0a0a0f";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error("Canvas toBlob returned null"));
      }, "image/png");
    };
    img.onerror = () => reject(new Error("Failed to render SVG to image"));
    const svgBlob = new Blob([svgString], { type: "image/svg+xml" });
    img.src = URL.createObjectURL(svgBlob);
  });
  triggerDownload(blob, `${safeFilename(info.title)}_pedigree.png`);
  URL.revokeObjectURL(img.src);
}

function safeFilename(title: string) {
  return title.replace(/[^a-z0-9\-_. ]/gi, "_").replace(/\s+/g, "_").slice(0, 60);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href    = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, 5000);
}

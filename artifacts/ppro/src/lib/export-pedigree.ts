import { computeRisk } from "@/lib/risk-calculator";
import { validatePedigree } from "@/lib/validate-pedigree";
import { exportPedigreePpro } from "@workspace/api-client-react";

export interface ExportNode {
  id: string;
  type: "male" | "female" | "unknown" | "pregnancy" | "sab";
  affected: boolean;
  affectedLevel?: number;
  carrier: boolean;
  deceased: boolean;
  proband: boolean;
  adopted?: boolean;
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
// SVG-capture — clone the live canvas SVG, inline styles, render to PNG
// ---------------------------------------------------------------------------
function computeExportViewBox(nodes: ExportNode[]): { x: number; y: number; w: number; h: number } {
  if (nodes.length === 0) return { x: 0, y: 0, w: 800, h: 500 };

  // Calculate maximum text / marker extension beyond node centers.
  // NodeShape positions text at S/2 + 13..47 below center (label/age/condition),
  // and the proband arrow at S/2 + 16 below & S/2 + 16 left of center.
  // NODE_SIZE = 44, so worst-case: 22 + 47 = 69 below, 22 + 16 = 38 to sides.
  let maxBelowCenter = 0;
  let maxSideExtent = 0;
  for (const n of nodes) {
    const hasLabel = !!n.label;
    const hasAge = !!(n.age || n.dob);
    const hasCondition = !!n.condition;

    // Text rows stacked below node (see NodeShape.tsx lines 125-135)
    let rows = 1; // at least the label or autoLabel
    if (hasLabel) rows = 1;
    if (hasAge) rows = Math.max(rows, 2);
    if (hasCondition) rows = Math.max(rows, (hasAge ? 3 : 2));

    // ~11 SVG units per row of text below the node bottom (S/2 ≈ 22)
    const textBelow = 22 + 13 + (rows - 1) * 11;
    maxBelowCenter = Math.max(maxBelowCenter, textBelow);

    // Proband arrow extends ~38 SVG units below center and ~38 to the side
    if (n.proband) {
      maxBelowCenter = Math.max(maxBelowCenter, 22 + 16);
      maxSideExtent = Math.max(maxSideExtent, 22 + 16);
    }
  }

  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const labelMaxW = Math.max(...nodes.map((n) => (n.label?.length ?? 0) * 7));
  const padX = Math.max(80, Math.ceil(labelMaxW / 2) + 30, maxSideExtent + 20);
  const padY = Math.max(60, maxBelowCenter + 15);
  const minX = Math.min(...xs) - padX;
  const minY = Math.min(...ys) - padY;
  const maxX = Math.max(...xs) + padX;
  const maxY = Math.max(...ys) + padY;
  return { x: minX, y: minY, w: Math.max(maxX - minX, 800), h: Math.max(maxY - minY, 500) };
}

function inlineComputedStyles(original: SVGSVGElement, clone: SVGSVGElement) {
  const origElements = original.querySelectorAll("*");
  const cloneElements = clone.querySelectorAll("*");
  origElements.forEach((origEl, i) => {
    const cloneEl = cloneElements[i];
    if (!(origEl instanceof SVGElement) || !(cloneEl instanceof SVGElement)) return;
    const computed = getComputedStyle(origEl);
    for (const attr of ["fill", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "stroke-linejoin", "opacity", "font-size", "font-weight"]) {
      const val = cloneEl.getAttribute(attr);
      if (val && (val.includes("var(") || val.includes("hsl("))) {
        const resolved = computed.getPropertyValue(attr);
        if (resolved && resolved !== "none") cloneEl.setAttribute(attr, resolved);
      }
    }
    if (cloneEl.style.length > 0) {
      for (let i = 0; i < cloneEl.style.length; i++) {
        const prop = cloneEl.style.item(i);
        const val = cloneEl.style.getPropertyValue(prop);
        if (val.includes("var(") || val.includes("hsl(")) {
          cloneEl.style.setProperty(prop, computed.getPropertyValue(prop));
        }
      }
    }
    // Ensure text elements embed a safe font-family for external viewers
    if (cloneEl.tagName === "text" || cloneEl.tagName === "tspan") {
      const fontFamily = computed.getPropertyValue("font-family");
      if (fontFamily) {
        const ff = fontFamily.toLowerCase();
        const needsFallback = ff.includes("inter") || ff.includes("manrope") || ff.includes("plus jakarta");
        cloneEl.setAttribute("font-family", needsFallback ? "sans-serif" : fontFamily);
      }
    }
  });
}

function prepareSvgForExport(
  svgEl: SVGSVGElement | null,
  nodes: ExportNode[]
): { clone: SVGSVGElement; vb: { x: number; y: number; w: number; h: number } } {
  if (!svgEl) throw new Error("No pedigree canvas SVG found on the page.");

  const clone = svgEl.cloneNode(true) as SVGSVGElement;

  // Resolve CSS custom properties (hsl(var(--…))) to concrete values
  // MUST run before any element removal — otherwise index-based matching
  // between original and clone breaks, producing wrong colors.
  inlineComputedStyles(svgEl, clone);

  // Remove interactive/transient elements
  clone.querySelector("rect[lasso]")?.remove();
  clone.querySelectorAll('rect[stroke-dasharray]').forEach((el) => {
    if (el.getAttribute("stroke-dasharray") === "3 3" || el.getAttribute("stroke-dasharray") === "4 3") el.remove();
  });
  clone.querySelectorAll('circle[r="3"][opacity]').forEach((el) => {
    if (parseFloat(el.getAttribute("opacity") ?? "0") < 1) el.remove();
  });

  // Compute viewBox from actual rendered bounding box (includes text, arrows,
  // labels) rather than node-center approximation which misses proband arrow
  // asymmetry and causes left-shifted pedigree.
  let vb: { x: number; y: number; w: number; h: number };
  try {
    clone.style.position = "absolute";
    clone.style.visibility = "hidden";
    clone.style.pointerEvents = "none";
    document.body.appendChild(clone);
    const b = clone.getBBox();
    const PAD = 40;
    vb = { x: b.x - PAD, y: b.y - PAD, w: b.width + PAD * 2, h: b.height + PAD * 2 };
  } catch {
    vb = computeExportViewBox(nodes);
  } finally {
    if (clone.parentNode) document.body.removeChild(clone);
    clone.removeAttribute("style");
  }
  clone.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  clone.setAttribute("width", String(vb.w));
  clone.setAttribute("height", String(vb.h));

  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("x", String(vb.x));
  bg.setAttribute("y", String(vb.y));
  bg.setAttribute("width", String(vb.w));
  bg.setAttribute("height", String(vb.h));
  bg.setAttribute("fill", "#FFFFFF");
  clone.insertBefore(bg, clone.firstChild);

  clone.removeAttribute("onmousemove");
  clone.removeAttribute("onmouseup");
  clone.removeAttribute("onmousedown");
  clone.removeAttribute("ontouchstart");
  clone.removeAttribute("ontouchmove");
  clone.removeAttribute("ontouchend");
  clone.removeAttribute("style");
  clone.querySelectorAll("*").forEach((el) => {
    if (el instanceof SVGElement) {
      el.style.cursor = "";
      if (el.getAttribute("cursor") === "grab") el.removeAttribute("cursor");
    }
  });

  clone.querySelectorAll("text").forEach((el) => {
    const style = el.getAttribute("style");
    if (style && style.includes("JetBrains Mono")) {
      el.setAttribute("style", style.replace(/JetBrains Mono,\s*monospace/g, "monospace"));
    }
  });

  return { clone, vb };
}

async function capturePedigreeImage(nodes: ExportNode[]): Promise<string> {
  const svgEl = document.querySelector('svg[data-canvas-svg="true"]') ?? document.querySelector("svg");
  const { clone, vb } = prepareSvgForExport(svgEl as SVGSVGElement, nodes);

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clone);
  const svgBlob = new Blob([svgString], { type: "image/svg+xml" });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  const DPI = 3;
  const dataUrl = await new Promise<string>((resolve, reject) => {
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = vb.w * DPI;
      canvas.height = vb.h * DPI;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas 2D context unavailable")); return; }
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Failed to render SVG to image"));
    img.src = url;
  });

  URL.revokeObjectURL(url);
  return dataUrl;
}

// ---------------------------------------------------------------------------
// JSON export
// ---------------------------------------------------------------------------
export async function exportJSON(info: ExportInfo, canvas: ExportCanvas): Promise<void> {
  const payload = {
    format: "pedigree-pro-v1",
    exportedAt: new Date().toISOString(),
    pedigree: { title: info.title, patientId: info.patientId ?? null, notes: info.notes ?? null },
    canvas,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  await triggerDownload(blob, `${safeFilename(info.title)}.json`);
}

export async function exportPPRO(pedigreeId: number, exporterKey: string, title: string): Promise<void> {
  const pproJson = await exportPedigreePpro(pedigreeId, exporterKey);
  const blob = new Blob([pproJson], { type: "application/json" });
  await triggerDownload(blob, `${safeFilename(title)}.ppro`);
}

// ---------------------------------------------------------------------------
// PDF export — clinical-grade, captures live SVG rendering as high-DPI image
// ---------------------------------------------------------------------------
export async function exportPDF(info: ExportInfo, canvas: ExportCanvas) {
  let jsPDF: typeof import("jspdf").jsPDF;
  try {
    jsPDF = (await import("jspdf")).jsPDF;
  } catch {
    throw new Error("PDF export requires the jspdf library. Run: pnpm add jspdf");
  }

  const dataUrl = await capturePedigreeImage(canvas.nodes);

  const vb = computeExportViewBox(canvas.nodes);
  const usePortrait = vb.h / vb.w > 1.3;
  const doc = new jsPDF({ orientation: usePortrait ? "portrait" : "landscape", unit: "mm", format: "a4" });
  const PW = usePortrait ? 210 : 297;
  const PH = usePortrait ? 297 : 210;
  const M  = 12;

  // ── Header ──────────────────────────────────────────────────────────────
  const HEADER_H = 18;
  doc.setFillColor(245, 245, 245);
  doc.rect(0, 0, PW, HEADER_H, "F");
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(1.2);
  doc.line(0, 0, PW, 0);

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Pedigree PRO", M, 8);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text("Genetic Counseling Pedigree Report", M, 14);

  doc.setTextColor(80, 80, 80);
  doc.setFontSize(8);
  doc.text(
    new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    PW - M, 8, { align: "right" }
  );

  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);
  doc.text(info.title, PW - M, 14, { align: "right" });

  // ── Legend ──────────────────────────────────────────────────────────────
  const LEGEND_H = 16;
  const LEGEND_Y = PH - LEGEND_H;
  doc.setFillColor(245, 245, 245);
  doc.rect(0, LEGEND_Y, PW, LEGEND_H, "F");
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(0, LEGEND_Y, PW, LEGEND_Y);

  const legendItems = computeLegendItems(canvas);
  let lx = M;
  const LY = LEGEND_Y + LEGEND_H / 2;
  const LS = 5;
  doc.setFontSize(8);

  for (const item of legendItems) {
    doc.setFillColor(220, 220, 220);
    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(0.4);

    if (item.shape === "square") {
      doc.rect(lx, LY - LS / 2, LS, LS);
    } else if (item.shape === "circle") {
      doc.circle(lx + LS / 2, LY, LS / 2);
    } else if (item.shape === "diamond") {
      const dc = lx + LS / 2;
      doc.lines([[0, -LS / 2], [LS / 2, LS / 2], [-LS / 2, LS / 2], [-LS / 2, -LS / 2]], dc, LY, [1, 1], "S", true);
    } else if (item.shape === "pregnancy") {
      const dc = lx + LS / 2;
      doc.lines([[0, -LS / 2], [LS / 2, LS / 2], [-LS / 2, LS / 2], [-LS / 2, -LS / 2]], dc, LY, [1, 1], "S", true);
    } else if (item.shape === "sab") {
      doc.setFillColor(170, 170, 170);
      const tx = lx + LS / 2;
      const ty = LY + LS / 6;
      doc.triangle(tx, ty + LS / 2, tx - LS / 2, ty - LS / 3, tx + LS / 2, ty - LS / 3, "FD");
    } else if (item.shape === "filled") {
      doc.setFillColor(22, 163, 74);
      doc.circle(lx + LS / 2, LY, LS / 2, "F");
      doc.setFillColor(220, 220, 220);
    } else if (item.shape === "carrier") {
      doc.circle(lx + LS / 2, LY, LS / 2);
      doc.setFillColor(22, 163, 74);
      doc.circle(lx + LS / 2, LY, LS / 6, "F");
      doc.setFillColor(220, 220, 220);
    } else if (item.shape === "slash") {
      doc.rect(lx, LY - LS / 2, LS, LS);
      doc.setDrawColor(100, 100, 100);
      doc.line(lx, LY + LS / 2, lx + LS, LY - LS / 2);
    } else if (item.shape === "arrow") {
      doc.setTextColor(22, 163, 74);
      const arrowLabel = "-> ";
      doc.text(arrowLabel, lx, LY + 1);
      const aw = doc.getTextWidth(arrowLabel);
      doc.setTextColor(80, 80, 80);
      doc.text(item.label, lx + aw, LY + 1);
      lx += aw + doc.getTextWidth(item.label) + 6;
      continue;
    } else if (item.shape === "dbl-line") {
      doc.setDrawColor(80, 80, 80);
      doc.line(lx, LY - 1, lx + LS, LY - 1);
      doc.line(lx, LY + 1, lx + LS, LY + 1);
    }

    doc.setTextColor(80, 80, 80);
    doc.text(item.label, lx + LS + 2, LY + 1);
    lx += LS + doc.getTextWidth(item.label) + 8;
    if (lx > PW - 30) break;
  }

  if (info.notes) {
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(6.5);
    doc.text(`Notes: ${info.notes.slice(0, 200)}`, PW - M, LY + 2, { align: "right", maxWidth: 120 });
  }

  // ── Pedigree image ──────────────────────────────────────────────────────
  const CANVAS_TOP = HEADER_H + 4;
  const CANVAS_BOTTOM = LEGEND_Y - 4;
  const CANVAS_H = CANVAS_BOTTOM - CANVAS_TOP;
  const CANVAS_W = PW - 2 * M;

  const imgW = vb.w;
  const imgH = vb.h;
  const scale = Math.min(CANVAS_W / imgW, CANVAS_H / imgH);
  const drawW = imgW * scale;
  const drawH = imgH * scale;
  const offsetX = M + (CANVAS_W - drawW) / 2;
  const offsetY = CANVAS_TOP + (CANVAS_H - drawH) / 2;

  doc.addImage(dataUrl, "PNG", offsetX, offsetY, drawW, drawH);

  const pdfBlob = doc.output("blob");
  await triggerDownload(pdfBlob as Blob, `${safeFilename(info.title)}.pdf`);
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

  const dataUrl = await capturePedigreeImage(canvas.nodes);
  const vb = computeExportViewBox(canvas.nodes);

  const pptx = new PptxGenJs();
  pptx.layout = "LAYOUT_WIDE";
  const SW = 13.33;
  const SH = 7.5;
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const PIX_FORMAT_VERSION = "1.0";
  const PIX_EXPORT_META = {
    format_version: PIX_FORMAT_VERSION,
    exported_at: new Date().toISOString(),
    exported_by: "Pedigree PRO",
    schema: "pedigree-pro-v1",
  };

  pptx.author = "Pedigree PRO";
  pptx.company = "Pedigree PRO";
  pptx.subject = `Pedigree: ${info.title}`;
  pptx.title = info.title;

  // Computed stats
  const genMap    = computeGenerations(canvas.nodes, canvas.edges);
  const maxGen    = Math.max(0, ...Array.from(genMap.values()));
  const affected  = canvas.nodes.filter(n => n.affected);
  const carriers  = canvas.nodes.filter(n => n.carrier && !n.affected);
  const deceased  = canvas.nodes.filter(n => n.deceased);
  const proband   = canvas.nodes.find(n => n.proband);
  const notable   = canvas.nodes.filter(n => n.affected || n.carrier || n.proband);
  const couples   = canvas.edges.filter(e => e.type === "couple" || e.type === "consanguinity").length;

  // ── SLIDE 1 — Cover ─────────────────────────────────────────────────────
  const cover = pptx.addSlide();
  cover.background = { color: "FFFFFF" };

  // Left panel
  cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 7.2, h: SH, fill: { color: "F5F5F5" }, line: { color: "DDDDDD", width: 0.5 } });

  cover.addText("Pedigree PRO", { x: 0.55, y: 1.1, w: 6.2, h: 0.7, fontSize: 38, bold: true, color: "1E1E1E", fontFace: "Courier New" });
  cover.addText("Genetic Counseling Pedigree Report", { x: 0.55, y: 1.85, w: 6.2, h: 0.3, fontSize: 11, color: "666666", fontFace: "Courier New" });

  // Divider line
  cover.addShape(pptx.ShapeType.rect, { x: 0.55, y: 2.3, w: 6.2, h: 0.025, fill: { color: "2563EB" }, line: { color: "2563EB", width: 0 } });

  cover.addText(info.title, { x: 0.55, y: 2.5, w: 6.2, h: 0.55, fontSize: 22, bold: true, color: "1E1E1E", fontFace: "Courier New" });
  if (info.patientId) {
    cover.addText(`Patient ID: #${info.patientId}`, { x: 0.55, y: 3.1, w: 6.2, h: 0.25, fontSize: 10, color: "666666", fontFace: "Courier New" });
  }
  cover.addText(`Generated: ${today}`, { x: 0.55, y: info.patientId ? 3.42 : 3.1, w: 6.2, h: 0.22, fontSize: 9, color: "888888", fontFace: "Courier New" });

  cover.addNotes(JSON.stringify({ ...PIX_EXPORT_META, slide: "cover", title: info.title, patientId: info.patientId, nodeCount: canvas.nodes.length, edgeCount: canvas.edges.length, proband: proband ? { label: proband.label, type: proband.type, affected: proband.affected } : null }));

  // Proband box
  if (proband) {
    const probandY = info.patientId ? 4.05 : 3.75;
    cover.addShape(pptx.ShapeType.rect, { x: 0.55, y: probandY, w: 6.2, h: 0.85, fill: { color: "EFF6FF" }, line: { color: "2563EB", width: 0.75 } });
    cover.addText("\u2192  PROBAND", { x: 0.75, y: probandY + 0.1, w: 2.5, h: 0.22, fontSize: 7.5, bold: true, color: "16A34A", fontFace: "Courier New" });
    const pDetails = [
      proband.label && `Label: ${proband.label}`,
      proband.age   && `Age: ${proband.age}`,
      proband.condition && `Dx: ${proband.condition}`,
    ].filter(Boolean).join("     ");
    cover.addText(pDetails || `ID: ${proband.id}`, { x: 0.75, y: probandY + 0.38, w: 5.9, h: 0.35, fontSize: 9.5, color: "444444", fontFace: "Courier New" });
  }

  // Right panel — stats
  cover.addShape(pptx.ShapeType.rect, { x: 7.3, y: 0, w: 6.03, h: SH, fill: { color: "FAFAFA" }, line: { color: "DDDDDD", width: 0.5 } });

  cover.addText("PEDIGREE STATISTICS", { x: 7.6, y: 0.65, w: 5.5, h: 0.28, fontSize: 8.5, bold: true, color: "888888", fontFace: "Courier New" });
  cover.addShape(pptx.ShapeType.rect, { x: 7.6, y: 0.98, w: 5.5, h: 0.02, fill: { color: "CCCCCC" }, line: { color: "CCCCCC", width: 0 } });

  const statsRows: [string, string, boolean][] = [
    ["Total individuals",  `${canvas.nodes.length}`,            false],
    ["Generations",        maxGen > 0 ? `${maxGen}` : "\u2014", false],
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
    cover.addText(label, { x: 7.6, y, w: 4.2, h: 0.28, fontSize: 9, color: "666666", fontFace: "Courier New" });
    cover.addText(value, { x: 11.9, y, w: 1.2, h: 0.28, fontSize: 9, bold: highlight, color: highlight ? "16A34A" : "444444", fontFace: "Courier New", align: "right" });
  });

  // ── SLIDE 2 — Pedigree diagram ───────────────────────────────────────────
  const slide = pptx.addSlide();
  slide.background = { color: "FFFFFF" };

  // Header
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: SW, h: 0.52, fill: { color: "F5F5F5" }, line: { color: "DDDDDD", width: 0.5 } });
  slide.addText("Pedigree PRO", { x: 0.2, y: 0.08, w: 3.5, h: 0.28, fontSize: 11, bold: true, color: "1E1E1E", fontFace: "Courier New" });
  slide.addText(info.title, { x: 3.8, y: 0.12, w: 5.5, h: 0.22, fontSize: 9, color: "666666", fontFace: "Courier New" });
  slide.addText(`${today}  \u00B7  ${canvas.nodes.length} individuals  \u00B7  ${maxGen} generation${maxGen !== 1 ? "s" : ""}`, {
    x: SW - 4, y: 0.12, w: 3.8, h: 0.22, fontSize: 7.5, color: "888888", align: "right", fontFace: "Courier New",
  });

  // Legend bar
  const LEG_Y = SH - 0.58;
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: LEG_Y, w: SW, h: 0.58, fill: { color: "F5F5F5" }, line: { color: "DDDDDD", width: 0.5 } });
  const legendItems = computeLegendItems(canvas);
  const legendDefs = legendItems.map((item) => {
    if (item.shape === "filled")    return { label: `\u25CF ${item.label}`, color: "16A34A" };
    if (item.shape === "carrier")   return { label: `\u25C9 ${item.label}`, color: "16A34A" };
    if (item.shape === "arrow")     return { label: `\u2192 ${item.label}`, color: "16A34A" };
    if (item.shape === "square")    return { label: `\u25A1 ${item.label}`, color: "555555" };
    if (item.shape === "circle")    return { label: `\u25CB ${item.label}`, color: "555555" };
    if (item.shape === "diamond")   return { label: `\u25C7 ${item.label}`, color: "555555" };
    if (item.shape === "pregnancy") return { label: `\u2B26 ${item.label}`, color: "555555" };
    if (item.shape === "sab")       return { label: `\u25BD ${item.label}`, color: "777777" };
    if (item.shape === "slash")     return { label: `\u2298 ${item.label}`, color: "777777" };
    if (item.shape === "dbl-line")  return { label: `\u256A ${item.label}`, color: "777777" };
    return { label: item.label, color: "555555" };
  });
  const colW = Math.min(2.0, (SW - 0.6) / Math.max(legendDefs.length, 1));
  legendDefs.forEach((item, i) => {
    slide.addText(item.label, { x: 0.3 + i * colW, y: LEG_Y + 0.16, w: colW, h: 0.24, fontSize: 8, color: item.color, fontFace: "Courier New" });
  });
  if (info.notes) {
    slide.addText(`Notes: ${info.notes.slice(0, 130)}`, { x: 0.3, y: LEG_Y + 0.42, w: SW - 0.6, h: 0.13, fontSize: 5.5, color: "888888", fontFace: "Courier New" });
  }

  // Pedigree image — captured from live SVG
  const CANVAS_TOP = 0.62;
  const CANVAS_BOTTOM = LEG_Y - 0.08;
  const CANVAS_H = CANVAS_BOTTOM - CANVAS_TOP;
  const CANVAS_W = SW - 0.2;

  const imgW = vb.w;
  const imgH = vb.h;
  const imgScale = Math.min(CANVAS_W / imgW, CANVAS_H / imgH);
  const drawW = imgW * imgScale;
  const drawH = imgH * imgScale;
  const imgX = 0.1 + (CANVAS_W - drawW) / 2;
  const imgY = CANVAS_TOP + (CANVAS_H - drawH) / 2;

  slide.addImage({ data: dataUrl, x: imgX, y: imgY, w: drawW, h: drawH });

  slide.addNotes(JSON.stringify({ ...PIX_EXPORT_META, slide: "pedigree-diagram", nodeCount: canvas.nodes.length, edgeCount: canvas.edges.length, generationCount: maxGen }));

  // ── SLIDE 3 — Clinical Roster ────────────────────────────────────────────
  if (notable.length > 0) {
    const s3 = pptx.addSlide();
    s3.background = { color: "FFFFFF" };
    s3.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: SW, h: 0.52, fill: { color: "F5F5F5" }, line: { color: "DDDDDD", width: 0.5 } });
    s3.addText("Pedigree PRO", { x: 0.2, y: 0.1, w: 3.5, h: 0.28, fontSize: 11, bold: true, color: "1E1E1E", fontFace: "Courier New" });
    s3.addText("Clinical Roster \u2014 Affected & Notable Individuals", { x: 3.9, y: 0.13, w: 7.5, h: 0.24, fontSize: 9, color: "666666", fontFace: "Courier New" });
    s3.addText(`${info.title}  \u00B7  ${today}`, { x: SW-4, y: 0.13, w: 3.8, h: 0.24, fontSize: 7, color: "888888", align: "right", fontFace: "Courier New" });

    const colXs = [0.25, 1.35, 2.2,  3.05, 4.45, 5.25, 9.6 ];
    const colWs = [1.05, 0.8,  0.8,  1.35, 0.75, 4.3,  3.5 ];
    const heads = ["Label","Type","Gen.","Status","Age","Diagnosis","Notes"];
    const hY = 0.68;
    s3.addShape(pptx.ShapeType.rect, { x: 0.2, y: hY, w: SW-0.4, h: 0.3, fill: { color: "E5E5E5" }, line: { color: "CCCCCC", width: 0.5 } });
    heads.forEach((h, ci) => s3.addText(h.toUpperCase(), { x: colXs[ci], y: hY+0.05, w: colWs[ci], h: 0.2, fontSize: 6.5, bold: true, color: "444444", fontFace: "Courier New" }));

    notable.forEach((node, ri) => {
      const rowY = hY + 0.32 + ri * 0.31;
      if (rowY > SH - 0.35) return;
      s3.addShape(pptx.ShapeType.rect, { x: 0.2, y: rowY, w: SW-0.4, h: 0.29, fill: { color: ri%2===0 ? "FAFAFA" : "F0F0F0" }, line: { color: "E0E0E0", width: 0.3 } });
      const gen = genMap.get(node.id);
      const statusParts = [node.affected&&"Affected",node.carrier&&"Carrier",node.proband&&"Proband",node.deceased&&"Deceased"].filter(Boolean).join(", ");
      const typeLabel = ({male:"Male \u25A1",female:"Female \u25CB",unknown:"Unknown \u25C7",pregnancy:"Pregnancy \u25C8",sab:"SAB \u25B3"} as Record<string,string>)[node.type] ?? node.type;
      const cells = [
        node.label||"\u2014", typeLabel, gen?toRoman(gen):"\u2014",
        statusParts||"\u2014", node.age?`${node.age}y`:(node.dob??"\u2014"),
        node.condition||"\u2014", node.notes?(node.notes.slice(0,60)):"\u2014",
      ];
      cells.forEach((cell, ci) => {
        const hl = ci===3 && node.affected;
        s3.addText(cell, {
          x: colXs[ci], y: rowY+0.05, w: colWs[ci], h: 0.2,
          fontSize: 7, color: hl?"16A34A":ci===0?"444444":ci===5&&node.condition?"B47820":"555555",
          fontFace: "Courier New", bold: ci===0||hl, italic: ci===5&&!!node.condition,
        });
      });
    });
    s3.addText("Only affected, carrier, and proband individuals listed.", { x: 0.3, y: SH-0.3, w: SW-0.6, h: 0.2, fontSize: 5.5, color: "999999", fontFace: "Courier New", italic: true });
  }

  // ── SLIDE 4 — Clinical Notes ─────────────────────────────────────────────
  if (info.notes && info.notes.length > 10) {
    const s4 = pptx.addSlide();
    s4.background = { color: "FFFFFF" };
    s4.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: SW, h: 0.52, fill: { color: "F5F5F5" }, line: { color: "DDDDDD", width: 0.5 } });
    s4.addText("Pedigree PRO", { x: 0.2, y: 0.1, w: 3.5, h: 0.28, fontSize: 11, bold: true, color: "1E1E1E", fontFace: "Courier New" });
    s4.addText("Clinical Notes", { x: 3.9, y: 0.13, w: 6, h: 0.24, fontSize: 9, color: "666666", fontFace: "Courier New" });
    s4.addShape(pptx.ShapeType.rect, { x: 0.4, y: 0.72, w: SW-0.8, h: SH-1.15, fill: { color: "FAFAFA" }, line: { color: "DDDDDD", width: 0.5 } });
    s4.addText(info.notes, { x: 0.65, y: 0.88, w: SW-1.3, h: SH-1.4, fontSize: 11, color: "444444", fontFace: "Courier New", wrap: true, valign: "top" });
  }

  const blob = (await pptx.write({ outputType: "blob" })) as Blob;
  await triggerDownload(blob, `${safeFilename(info.title)}.pptx`);
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

  const dataUrl = await capturePedigreeImage(canvas.nodes);

  const NR = 22, NG = 163, NB = 74;
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const byId  = new Map(canvas.nodes.map((n) => [n.id, n]));

  // ── shared helpers ────────────────────────────────────────────────────────
  function pageHeader(subtitle: string, showTitle = true) {
    doc.setFillColor(245, 245, 245);
    doc.rect(0, 0, PW, 20, "F");
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(1.2);
    doc.line(0, 0, PW, 0);
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Pedigree PRO", M, 8);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(subtitle, M, 14);
    if (showTitle) {
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(8);
      doc.text(info.title, PW - M, 8, { align: "right" });
    }
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(6.5);
    doc.text(today, PW - M, 14, { align: "right" });
  }

  function pageFooter(page: number) {
    const fy = PH - 8;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(M, fy, PW - M, fy);
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(5.5);
    doc.setFont("helvetica", "normal");
    doc.text("For use by licensed genetic counselors only. Not for independent patient distribution.", M, fy + 4);
    doc.text(`Page ${page}`, PW - M, fy + 4, { align: "right" });
  }

  function sectionBar(title: string, y: number): number {
    doc.setFillColor(240, 240, 240);
    doc.rect(0, y, PW, 7, "F");
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(0.4);
    doc.line(M, y + 7, PW - M, y + 7);
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text(title, M, y + 5);
    return y + 9;
  }

  let pageNum = 1;

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 1 — Pedigree Diagram
  // ══════════════════════════════════════════════════════════════════════════
  pageHeader("Genetic Counseling Pedigree Report");

  // Title strip
  doc.setFillColor(245, 245, 245);
  doc.rect(0, 20, PW, 9, "F");
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(info.title, M, 26.5);
  if (info.patientId) {
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(`Patient #${info.patientId}`, PW - M, 26.5, { align: "right" });
  }

  // White pedigree area — captured from live SVG
  const DT = 29, DH = 150;
  doc.setFillColor(255, 255, 255);
  doc.rect(0, DT, PW, DH, "F");

  const vb = computeExportViewBox(canvas.nodes);
  const imgW = vb.w;
  const imgH = vb.h;
  const imgCW = CW;
  const imgCH = DH - 4;
  const imgScale = Math.min(imgCW / imgW, imgCH / imgH);
  const drawW = imgW * imgScale;
  const drawH = imgH * imgScale;
  const imgX = M + (imgCW - drawW) / 2;
  const imgY = DT + 2 + (imgCH - drawH) / 2;

  doc.addImage(dataUrl, "PNG", imgX, imgY, drawW, drawH);

  // Legend bar
  const LY0 = DT + DH;
  doc.setFillColor(245, 245, 245);
  doc.rect(0, LY0, PW, 13, "F");
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(0, LY0, PW, LY0);
  const legendItems = computeLegendItems(canvas);
  let lx = M; const LYc = LY0 + 7.5; const LS = 3.8;
  doc.setFontSize(5.5);
  for (const item of legendItems) {
    doc.setFillColor(205, 205, 205); doc.setDrawColor(100, 100, 100); doc.setLineWidth(0.25);
    if (item.shape === "square")   { doc.rect(lx, LYc - LS / 2, LS, LS); }
    else if (item.shape === "circle")   { doc.circle(lx + LS / 2, LYc, LS / 2); }
    else if (item.shape === "diamond")  { const dc = lx + LS / 2; doc.lines([[0, -LS / 2], [LS / 2, LS / 2], [-LS / 2, LS / 2], [-LS / 2, -LS / 2]], dc, LYc, [1, 1], "S", true); }
    else if (item.shape === "pregnancy"){ const dc = lx + LS / 2; doc.lines([[0, -LS / 2], [LS / 2, LS / 2], [-LS / 2, LS / 2], [-LS / 2, -LS / 2]], dc, LYc, [1, 1], "S", true); }
    else if (item.shape === "sab")      { doc.setFillColor(165, 165, 165); const tx = lx + LS / 2; const ty = LYc + LS / 6; doc.triangle(tx, ty + LS / 2, tx - LS / 2, ty - LS / 3, tx + LS / 2, ty - LS / 3, "FD"); }
    else if (item.shape === "filled")   { doc.setFillColor(NR, NG, NB); doc.circle(lx + LS / 2, LYc, LS / 2, "F"); doc.setFillColor(205, 205, 205); }
    else if (item.shape === "carrier")  { doc.circle(lx + LS / 2, LYc, LS / 2); doc.setFillColor(NR, NG, NB); doc.circle(lx + LS / 2, LYc, LS / 5, "F"); doc.setFillColor(205, 205, 205); }
    else if (item.shape === "slash")    { doc.rect(lx, LYc - LS / 2, LS, LS); doc.line(lx, LYc + LS / 2, lx + LS, LYc - LS / 2); }
    else if (item.shape === "arrow")    {
      doc.setTextColor(NR, NG, NB);
      const arrowLabel = "-> ";
      doc.text(arrowLabel, lx, LYc + 0.8);
      const aw = doc.getTextWidth(arrowLabel);
      doc.setTextColor(80, 80, 80);
      doc.text(item.label, lx + aw, LYc + 0.8);
      lx += aw + doc.getTextWidth(item.label) + 4;
      continue;
    }
    else if (item.shape === "dbl-line") { doc.line(lx, LYc - 0.6, lx + LS, LYc - 0.6); doc.line(lx, LYc + 0.6, lx + LS, LYc + 0.6); }
    doc.setTextColor(80, 80, 80);
    doc.text(item.label, lx + LS + 1.5, LYc + 0.8);
    lx += LS + doc.getTextWidth(item.label) + 5;
    if (lx > PW - 25) break;
  }

  // Notes strip
  const notesY = LY0 + 13;
  const notesH = info.notes ? 22 : 6;
  doc.setFillColor(250, 250, 250);
  doc.rect(0, notesY, PW, notesH, "F");
  if (info.notes) {
    doc.setTextColor(80, 80, 80); doc.setFontSize(6); doc.setFont("helvetica", "italic");
    const noteLines = doc.splitTextToSize(`Clinical Notes: ${info.notes}`, CW);
    doc.text(noteLines.slice(0, 3), M, notesY + 5);
  }

  pageFooter(pageNum);

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 2 — Clinical Analysis
  // ══════════════════════════════════════════════════════════════════════════
  pageNum++;
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
    doc.setTextColor(80, 80, 80); doc.setFontSize(6.5); doc.setFont("helvetica", "italic");
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
        doc.setFillColor(235, 235, 235);
        doc.rect(startX, ly, colW, 5, "F");
        doc.setTextColor(30, 30, 30); doc.setFontSize(6); doc.setFont("helvetica", "bold");
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
          doc.setTextColor(120, 120, 120); doc.setFontSize(5.5);
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
          doc.setTextColor(80, 80, 80); doc.setFontSize(5.5); doc.setFont("helvetica", "normal");
          doc.text(labelLines[0], startX + 2, ly + 3.5);
          doc.setTextColor(tC[0], tC[1], tC[2]); doc.setFontSize(5.5); doc.setFont("helvetica", "bold");
          doc.text(e.percent, startX + 2 + bW, ly + 3.5, { align: "right" });
          ly += 4.5;
          // Bar
          doc.setFillColor(220, 220, 220);
          doc.rect(startX + 2, ly, bW, 1.3, "F");
          if (e.value > 0) {
            doc.setFillColor(tC[0], tC[1], tC[2]);
            doc.rect(startX + 2, ly, Math.max(0.5, bW * Math.min(1, e.value)), 1.3, "F");
          }
          ly += 3.8;
        }
        // Basis (first line only)
        if (result.basis.length > 0 && result.basis[0]) {
          const bLines = doc.splitTextToSize(result.basis[0], colW - 3);
          doc.setTextColor(100, 100, 100); doc.setFontSize(4.5); doc.setFont("helvetica", "italic");
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
    doc.setTextColor(120, 120, 120); doc.setFontSize(6.5);
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
    const item = summaryItems[i];
    if (!item) continue;
    const { l, v } = item;
    const sx = M + (i % 3) * SC;
    const sy = cy + Math.floor(i / 3) * 8;
    doc.setTextColor(80, 80, 80); doc.setFontSize(5.5); doc.setFont("helvetica", "normal");
    doc.text(l, sx, sy + 3);
    doc.setTextColor(30, 30, 30); doc.setFontSize(9); doc.setFont("helvetica", "bold");
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
      if (!iss) continue;
      const isErr = iss.severity === "error";
      doc.setTextColor(isErr ? 255 : 250, isErr ? 64 : 204, isErr ? 64 : 21);
      doc.setFontSize(6.5); doc.setFont("helvetica", "bold");
      doc.text(isErr ? "✕" : "⚠", M, cy + 3.5);
    doc.setFont("helvetica", "normal"); doc.setTextColor(50, 50, 50);
    doc.text(iss.message, M + 5, cy + 3.5);
      cy += 5.5;
      if (iss.detail) {
      doc.setTextColor(100, 100, 100); doc.setFontSize(5);
      doc.text(iss.detail, M + 5, cy + 2.5);
        cy += 4;
      }
    }
    if (vResult.issues.length > maxShow) {
      doc.setTextColor(120, 120, 120); doc.setFontSize(5.5);
      doc.text(`\u2026 and ${vResult.issues.length - maxShow} more issue(s)`, M, cy + 3);
      cy += 6;
    }
    cy += 2;
  }

  // ── Condition & Clinical Notes per node ──────────────────────────────────
  const nodesWithData = canvas.nodes.filter((n) => n.condition || n.notes);
  if (nodesWithData.length > 0) {
    cy = sectionBar("CLINICAL DATA", cy + 2);
    for (const n of nodesWithData) {
      if (cy > PH - 28) { pageFooter(pageNum); pageNum++; doc.addPage(); pageHeader("Clinical Data (continued)", false); cy = 26; }
      const nameLabel = n.label ? `${n.label}` : n.type;
      doc.setFillColor(235, 235, 235);
      doc.rect(M, cy, CW, 6.5, "F");
      doc.setTextColor(30, 30, 30); doc.setFontSize(6.5); doc.setFont("helvetica", "bold");
      doc.text(nameLabel, M + 2, cy + 4.5);
      if (n.age)  { doc.setTextColor(100, 100, 100); doc.setFontSize(5.5); doc.text(`${n.age}y`, M + 28, cy + 4.5); }
      if (n.dob)  { doc.setTextColor(120, 120, 120);  doc.setFontSize(5);   doc.text(`b.${n.dob.slice(0, 4)}`, M + 38, cy + 4.5); }
      const flags = [n.affected && "affected", n.carrier && "carrier", n.deceased && "deceased", n.proband && "proband"].filter(Boolean).join(", ");
      if (flags) { doc.setTextColor(NR, NG, NB); doc.setFontSize(5.5); doc.text(flags, PW - M - 2, cy + 4.5, { align: "right" }); }
      cy += 7;
      if (n.condition) {
        doc.setTextColor(180, 120, 20); doc.setFontSize(6); doc.setFont("helvetica", "bolditalic");
        doc.text("Condition:", M + 2, cy + 3.5);
        doc.setFont("helvetica", "italic"); doc.setTextColor(160, 110, 20);
        doc.text(n.condition, M + 22, cy + 3.5);
        cy += 6;
      }
      if (n.notes) {
        doc.setTextColor(100, 100, 100); doc.setFontSize(5.5); doc.setFont("helvetica", "normal");
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
      if (!ann) continue;
      const node = byId.get(ann.nodeId);
      const nl   = node?.label || node?.type || ann.nodeId;
      const r = parseInt(ann.color.slice(1, 3), 16) || 80;
      const g = parseInt(ann.color.slice(3, 5), 16) || 130;
      const b = parseInt(ann.color.slice(5, 7), 16) || 80;
      doc.setTextColor(r, g, b); doc.setFontSize(6); doc.setFont("helvetica", "bold");
      doc.text(`${nl}:`, M, cy + 3.5);
      const nlW = doc.getTextWidth(`${nl}: `);
    doc.setFont("helvetica", "normal"); doc.setTextColor(80, 80, 80);
    const annLines = doc.splitTextToSize(ann.text, CW - nlW - 12);
    if (annLines[0]) doc.text(annLines[0], M + nlW + 1, cy + 3.5);
    doc.setTextColor(120, 120, 120); doc.setFontSize(5);
      doc.text(`(${ann.position})`, PW - M, cy + 3.5, { align: "right" });
      cy += 6;
    }
    if (allAnns.length > maxAnns) {
      doc.setTextColor(120, 120, 120); doc.setFontSize(5.5);
      doc.text(`\u2026 and ${allAnns.length - maxAnns} more annotation(s)`, M, cy + 3);
    }
  }

  pageFooter(pageNum);
  const crBlob = doc.output("blob");
  await triggerDownload(crBlob as Blob, `${safeFilename(info.title)}_clinical_report.pdf`);
}

/**
 * Export pedigree as SVG string.
 * Serializes the current SVG DOM element on the pedigree canvas page
 * and downloads it as an .svg file.
 */
export async function exportSVG(info: ExportInfo, canvas: ExportCanvas): Promise<void> {
  const svgEl = document.querySelector('svg[data-canvas-svg="true"]') ?? document.querySelector("svg");
  try {
    const { clone } = prepareSvgForExport(svgEl as SVGSVGElement, canvas.nodes);
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clone);
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    await triggerDownload(blob, `${safeFilename(info.title)}_pedigree.svg`);
  } catch {
    alert("No pedigree canvas SVG found on the page.");
  }
}

/**
 * Export pedigree as PNG image.
 * Renders the current SVG DOM element to a canvas and downloads it as a .png file.
 */
export async function exportPNG(info: ExportInfo, canvas: ExportCanvas): Promise<void> {
  const svgEl = document.querySelector('svg[data-canvas-svg="true"]') ?? document.querySelector("svg");
  let svgBlobUrl: string | null = null;
  try {
    const { clone, vb } = prepareSvgForExport(svgEl as SVGSVGElement, canvas.nodes);
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clone);
    const img = new Image();
    const blob = await new Promise<Blob>((resolve, reject) => {
      img.onload = () => {
        const scale = 2;
        const cvs = document.createElement("canvas");
        cvs.width = vb.w * scale;
        cvs.height = vb.h * scale;
        const ctx = cvs.getContext("2d");
        if (!ctx) { reject(new Error("Canvas 2D context unavailable")); return; }
        ctx.fillStyle = "#f8f9fa";
        ctx.fillRect(0, 0, cvs.width, cvs.height);
        ctx.drawImage(img, 0, 0, cvs.width, cvs.height);
        cvs.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error("Canvas toBlob returned null"));
        }, "image/png");
      };
      img.onerror = () => reject(new Error("Failed to render SVG to image"));
      const svgBlob = new Blob([svgString], { type: "image/svg+xml" });
      svgBlobUrl = URL.createObjectURL(svgBlob);
      img.src = svgBlobUrl;
    });
    await triggerDownload(blob, `${safeFilename(info.title)}_pedigree.png`);
  } catch {
    alert("No pedigree canvas SVG found on the page.");
  } finally {
    if (svgBlobUrl) URL.revokeObjectURL(svgBlobUrl);
  }
}

function safeFilename(title: string) {
  return title.replace(/[^a-z0-9\-_. ]/gi, "_").replace(/\s+/g, "_").slice(0, 60);
}

function browserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, 5000);
}

async function triggerDownload(blob: Blob, filename: string) {
  if (typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)) {
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const ext = filename.split(".").pop() || "";
      const path = await save({
        defaultPath: filename,
        filters: ext ? [{ name: ext.toUpperCase(), extensions: [ext] }] : undefined,
      });
      if (!path) return; // user cancelled

      const { writeTextFile, writeFile } = await import("@tauri-apps/plugin-fs");
      const isText = blob.type.startsWith("text/") || blob.type === "application/json" || blob.type === "image/svg+xml";

      if (isText) {
        const text = await blob.text();
        await writeTextFile(path, text);
      } else {
        const buffer = await blob.arrayBuffer();
        await writeFile(path, new Uint8Array(buffer));
      }
    } catch (err) {
      console.error("Tauri save failed:", err);
      browserDownload(blob, filename);
    }
  } else {
    browserDownload(blob, filename);
  }
}

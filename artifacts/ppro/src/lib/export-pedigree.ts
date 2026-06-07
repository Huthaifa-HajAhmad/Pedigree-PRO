import { computeRisk } from "@/lib/risk-calculator";
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
  type: "couple" | "parent-child" | "consanguinity" | "divorced" | "separated";
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

  let w = maxX - minX;
  let h = maxY - minY;
  let x = minX;
  let y = minY;

  const minW = 600;
  const minH = 400;

  if (w < minW) {
    const diff = minW - w;
    x -= diff / 2;
    w = minW;
  }
  if (h < minH) {
    const diff = minH - h;
    y -= diff / 2;
    h = minH;
  }

  return { x, y, w, h };
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
  nodes: ExportNode[],
  options?: { transparentBg?: boolean }
): { clone: SVGSVGElement; vb: { x: number; y: number; w: number; h: number } } {
  if (!svgEl) throw new Error("No pedigree canvas SVG found on the page.");

  const clone = svgEl.cloneNode(true) as SVGSVGElement;

  // Resolve CSS custom properties (hsl(var(--…))) to concrete values
  // MUST run before any element removal — otherwise index-based matching
  // between original and clone breaks, producing wrong colors.
  inlineComputedStyles(svgEl, clone);

  // Remove interactive/transient elements
  clone.querySelector("rect[lasso]")?.remove();
  clone.querySelector('rect[data-lasso="true"]')?.remove();
  clone.querySelectorAll("rect").forEach((el) => {
    const dash = el.getAttribute("stroke-dasharray");
    if (dash && (dash.includes("8 4") || dash.includes("8, 4") || dash.replace(/[\s,]+/g, "") === "84")) {
      el.remove();
    }
  });

  clone.querySelectorAll('rect[stroke-dasharray]').forEach((el) => {
    const dash = el.getAttribute("stroke-dasharray");
    if (dash === "3 3" || dash === "3, 3" || dash === "4 3" || dash === "4, 3") el.remove();
  });
  clone.querySelectorAll('circle[r="3"][opacity]').forEach((el) => {
    if (parseFloat(el.getAttribute("opacity") ?? "0") < 1) el.remove();
  });

  // Remove background grid lines so they don't bloat the bounding box calculation
  clone.querySelectorAll("line").forEach((el) => {
    const dash = el.getAttribute("stroke-dasharray");
    if (dash && (dash.includes("8 5") || dash.includes("8, 5") || dash.replace(/[\s,]+/g, "") === "85")) {
      el.remove();
    }
    // Also remove alignment guide lines
    if (dash && (dash.includes("4 4") || dash.includes("4, 4") || dash.replace(/[\s,]+/g, "") === "44")) {
      el.remove();
    }
  });

  // Reposition generation rail relative to the leftmost node of the pedigree diagram
  const validNodes = nodes.filter((n) => typeof n.x === "number" && !isNaN(n.x));
  const minX = validNodes.length > 0 ? Math.min(...validNodes.map((n) => n.x)) : null;

  if (minX !== null) {
    const railGroup = clone.querySelector('g[data-generation-rail="true"]');
    if (railGroup) {
      // Remove interactive editor-only helper elements (hit rect and line)
      railGroup.querySelector("rect")?.remove();
      railGroup.querySelector("line")?.remove();

      // Align generation roman numerals closely to the left of the pedigree nodes
      railGroup.querySelectorAll("text").forEach((textEl) => {
        textEl.setAttribute("x", String(minX - 50));
      });
    }
  } else {
    clone.querySelector('g[data-generation-rail="true"]')?.remove();
  }

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
    if (b.width < 10 || b.height < 10) {
      vb = computeExportViewBox(nodes);
    } else {
      const PAD = Math.max(16, Math.min(40, Math.min(b.width, b.height) * 0.15));
      vb = { x: b.x - PAD, y: b.y - PAD, w: b.width + PAD * 2, h: b.height + PAD * 2 };
    }
  } catch {
    vb = computeExportViewBox(nodes);
  } finally {
    if (clone.parentNode) document.body.removeChild(clone);
    clone.removeAttribute("style");
  }
  clone.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  clone.setAttribute("width", String(vb.w));
  clone.setAttribute("height", String(vb.h));

  if (!options?.transparentBg) {
    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("x", String(vb.x));
    bg.setAttribute("y", String(vb.y));
    bg.setAttribute("width", String(vb.w));
    bg.setAttribute("height", String(vb.h));
    bg.setAttribute("fill", "#FFFFFF");
    clone.insertBefore(bg, clone.firstChild);
  }

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

async function capturePedigreeImage(nodes: ExportNode[]): Promise<{ dataUrl: string; vb: { x: number; y: number; w: number; h: number } }> {
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
  return { dataUrl, vb };
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

  const { dataUrl, vb } = await capturePedigreeImage(canvas.nodes);
  const usePortrait = vb.h / vb.w > 1.3;
  const doc = new jsPDF({ orientation: usePortrait ? "portrait" : "landscape", unit: "mm", format: "a4" });
  const PW = usePortrait ? 210 : 297;
  const PH = usePortrait ? 297 : 210;
  const M  = 12;
  const CW = PW - 2 * M;

  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  // ── Header ──────────────────────────────────────────────────────────────
  // Taller clinical-grade header
  doc.setFillColor(15, 23, 42); // Slate-900 top accent
  doc.rect(0, 0, PW, 1.5, "F");

  // Horizontal divider line at y = 26
  doc.setDrawColor(226, 232, 240); // Slate-200 border
  doc.setLineWidth(0.35);
  doc.line(M, 26, PW - M, 26);

  // Modern styled double-bar accent
  doc.setFillColor(15, 23, 42);
  doc.rect(M, 8.5, 2.0, 13, "F");
  doc.setFillColor(13, 148, 136);
  doc.rect(M + 2.8, 8.5, 0.8, 13, "F");

  // Left Side Branding
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("PEDIGREE DIAGRAM PRINTOUT", M + 5.5, 12.5);

  doc.setTextColor(100, 116, 139); // Slate-500
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.text("GENETIC COUNSELING & FAMILY HEALTH HISTORY", M + 5.5, 16.5);

  doc.setTextColor(13, 148, 136); // Teal-500 subtitle
  doc.setFontSize(6);
  doc.setFont("helvetica", "bold");
  doc.text("FAMILY pedigree diagram chart".toUpperCase(), M + 5.5, 20.5);

  // Right Side Metadata Card
  const cardX = PW - M - 50;
  const cardY = 8;
  const cardW = 50;
  const cardH = 14;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.25);
  doc.roundedRect(cardX, cardY, cardW, cardH, 1, 1, "FD");

  doc.line(cardX + 25, cardY, cardX + 25, cardY + cardH);

  // Col 1: Family ID
  doc.setTextColor(100, 116, 139); doc.setFont("helvetica", "normal"); doc.setFontSize(5.5);
  doc.text("FAMILY ID", cardX + 3, cardY + 4.5);
  doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
  doc.text(info.title, cardX + 3, cardY + 9.5);

  // Col 2: Date
  doc.setTextColor(100, 116, 139); doc.setFont("helvetica", "normal"); doc.setFontSize(5.5);
  doc.text("PRINT DATE", cardX + 28, cardY + 4.5);
  doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
  doc.text(today, cardX + 28, cardY + 9.5);

  // ── Legend ──────────────────────────────────────────────────────────────
  const LEGEND_H = 13;
  const LEGEND_Y = PH - LEGEND_H - 10; // leave 10mm gap at bottom (well within margins)
  
  // Draw rounded card for legend
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.35);
  doc.roundedRect(M, LEGEND_Y, CW, LEGEND_H, 2, 2, "FD");

  const legendItems = computeLegendItems(canvas);
  let lx = M + 4;
  const LYc = LEGEND_Y + LEGEND_H / 2;
  const LS = 4;
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");

  for (const item of legendItems) {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(71, 85, 105);
    doc.setLineWidth(0.35);

    if (item.shape === "square") {
      doc.rect(lx, LYc - LS / 2, LS, LS, "FD");
    } else if (item.shape === "circle") {
      doc.circle(lx + LS / 2, LYc, LS / 2, "FD");
    } else if (item.shape === "diamond" || item.shape === "pregnancy") {
      const dc = lx + LS / 2;
      doc.lines([[LS / 2, LS / 2], [-LS / 2, LS / 2], [-LS / 2, -LS / 2]], dc, LYc - LS / 2, [1, 1], "FD", true);
    } else if (item.shape === "sab") {
      doc.setFillColor(100, 116, 139);
      const tx = lx + LS / 2;
      const ty = LYc + LS / 6;
      doc.triangle(tx, ty + LS / 2, tx - LS / 2, ty - LS / 3, tx + LS / 2, ty - LS / 3, "FD");
    } else if (item.shape === "filled") {
      doc.setFillColor(225, 29, 72); // Crimson
      doc.circle(lx + LS / 2, LYc, LS / 2, "FD");
    } else if (item.shape === "carrier") {
      doc.circle(lx + LS / 2, LYc, LS / 2, "FD");
      doc.setFillColor(13, 148, 136); // Teal
      doc.circle(lx + LS / 2, LYc, LS / 5, "FD");
    } else if (item.shape === "slash") {
      doc.rect(lx, LYc - LS / 2, LS, LS, "FD");
      doc.line(lx, LYc + LS / 2, lx + LS, LYc - LS / 2);
    } else if (item.shape === "arrow") {
      doc.setDrawColor(30, 41, 59); // Slate-800
      doc.setFillColor(30, 41, 59); // Slate-800
      doc.setLineWidth(0.45);
      // Shaft
      doc.line(lx, LYc + 1.5, lx + 2.2, LYc - 0.7);
      // Filled arrowhead triangle
      doc.triangle(
        lx + 3.0, LYc - 1.5, // tip
        lx + 1.2, LYc - 1.5, // back top-left
        lx + 3.0, LYc + 0.3, // back bottom-right
        "FD"
      );
      
      doc.setTextColor(71, 85, 105);
      doc.text(item.label, lx + LS + 2, LYc + 1.2);
      lx += LS + doc.getTextWidth(item.label) + 8;
      continue;
    } else if (item.shape === "dbl-line") {
      doc.setDrawColor(71, 85, 105);
      doc.line(lx, LYc - 0.8, lx + LS, LYc - 0.8);
      doc.line(lx, LYc + 0.8, lx + LS, LYc + 0.8);
    }

    doc.setTextColor(71, 85, 105);
    doc.text(item.label, lx + LS + 2, LYc + 1.2);
    lx += LS + doc.getTextWidth(item.label) + 8;
    if (lx > PW - 40) break;
  }

  if (info.notes) {
    doc.setTextColor(148, 163, 184); // Slate-400
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "italic");
    doc.text(`Notes: ${info.notes.slice(0, 150)}`, PW - M - 2, LYc + 1.2, { align: "right", maxWidth: 100 });
  }

  // Footer label & divider line
  const fy = PH - 6;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.35);
  doc.line(M, fy - 2, PW - M, fy - 2);

  doc.setTextColor(148, 163, 184);
  doc.setFontSize(5.5);
  doc.setFont("helvetica", "normal");
  doc.text("Pedigree PRO - Generated diagram printout. Licensed clinical use only.", M, fy + 2);

  // ── Pedigree image ──────────────────────────────────────────────────────
  const CANVAS_TOP = 30;
  const CANVAS_H = LEGEND_Y - CANVAS_TOP - 4;
  const CANVAS_W = PW - 2 * M;

  // Draw rounded card border around diagram
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.35);
  doc.roundedRect(M, CANVAS_TOP, CANVAS_W, CANVAS_H, 2.5, 2.5, "FD");

  const imgW = vb.w;
  const imgH = vb.h;
  const scale = Math.min((CANVAS_W - 12) / imgW, (CANVAS_H - 12) / imgH);
  const drawW = imgW * scale;
  const drawH = imgH * scale;
  const offsetX = M + 6 + (CANVAS_W - 12 - drawW) / 2;
  const offsetY = CANVAS_TOP + 6 + (CANVAS_H - 12 - drawH) / 2;

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

  const pptx = new PptxGenJs();
  pptx.layout = "LAYOUT_WIDE";
  const SW = 13.33;
  const SH = 7.5;

  pptx.author = "Pedigree PRO";
  pptx.company = "Pedigree PRO";
  pptx.subject = `Pedigree: ${info.title}`;
  pptx.title = info.title;

  const slide = pptx.addSlide();
  slide.background = { color: "FFFFFF" };

  // Slide Title (Editable)
  slide.addText(`Family Pedigree Chart: ${info.title}`, {
    x: 0.6,
    y: 0.3,
    w: 8.0,
    h: 0.4,
    fontSize: 16,
    bold: true,
    color: "0F172A",
    fontFace: "Arial"
  });

  slide.addText(`Exported: ${new Date().toLocaleDateString()}`, {
    x: SW - 4.6,
    y: 0.3,
    w: 4.0,
    h: 0.4,
    fontSize: 9,
    color: "64748B",
    fontFace: "Arial",
    align: "right"
  });

  const margin = 0.6;
  const dw = SW - 2 * margin; // 12.13
  const dh = SH - 2 * margin - 0.8; // 5.5

  const xs = canvas.nodes.map(n => n.x);
  const ys = canvas.nodes.map(n => n.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // Add margin in SVG coordinates
  const padX = 60;
  const padY = 60;
  const boxMinX = minX - padX;
  const boxMaxX = maxX + padX;
  const boxMinY = minY - padY;
  const boxMaxY = maxY + padY;

  const boxW = boxMaxX - boxMinX;
  const boxH = boxMaxY - boxMinY;

  const scale = Math.min(dw / boxW, dh / boxH);
  const nodeSize = Math.max(0.38, Math.min(44 * scale, 0.8));

  // Map nodes to screen coordinates
  const nodePosMap = new Map<string, { px: number; py: number }>();
  for (const n of canvas.nodes) {
    const px = margin + (dw - boxW * scale) / 2 + (n.x - boxMinX) * scale;
    const py = 0.8 + (dh - boxH * scale) / 2 + (n.y - boxMinY) * scale;
    nodePosMap.set(n.id, { px, py });

    // Draw main node shape
    let shapeType = pptx.ShapeType.rect;
    let shapeOpts: any = {
      x: px - nodeSize / 2,
      y: py - nodeSize / 2,
      w: nodeSize,
      h: nodeSize,
      fill: { color: n.affected ? "0F172A" : "FFFFFF" },
      line: { color: "0F172A", width: 1.5 }
    };

    if (n.type === "female") {
      shapeType = pptx.ShapeType.ellipse;
    } else if (n.type === "unknown" || n.type === "pregnancy") {
      shapeType = pptx.ShapeType.diamond;
    } else if (n.type === "sab") {
      shapeType = pptx.ShapeType.triangle;
      shapeOpts.rotate = 180;
      shapeOpts.fill = { color: "64748B" };
      shapeOpts.line = { color: "64748B", width: 1 };
    }

    slide.addShape(shapeType, shapeOpts);

    // Carrier indicator
    if (n.carrier && !n.affected) {
      const dotSize = nodeSize * 0.28;
      slide.addShape(pptx.ShapeType.ellipse, {
        x: px - dotSize / 2,
        y: py - dotSize / 2,
        w: dotSize,
        h: dotSize,
        fill: { color: "0D9488" },
        line: { color: "0D9488", width: 0 }
      });
    }

    // Deceased indicator
    if (n.deceased) {
      slide.addShape(pptx.ShapeType.line, {
        x: px - nodeSize * 0.85,
        y: py,
        w: nodeSize * 1.7,
        h: 0,
        rotate: -45,
        line: { color: "0F172A", width: 2 }
      });
    }

    // Proband indicator
    if (n.proband) {
      slide.addShape(pptx.ShapeType.line, {
        x: px - nodeSize * 1.203,
        y: py + nodeSize * 0.85,
        w: nodeSize * 0.707,
        h: 0,
        rotate: -45,
        line: { color: "0F172A", width: 2, endArrowType: "triangle" }
      });
    }

    // Text labels
    const texts: string[] = [];
    if (n.label) texts.push(n.label);
    if (n.age) texts.push(`${n.age}y`);
    if (n.condition) texts.push(n.condition);

    if (texts.length > 0) {
      slide.addText(texts.join("\n"), {
        x: px - 1.0,
        y: py + nodeSize / 2 + 0.05,
        w: 2.0,
        h: 0.8,
        fontSize: 7.5,
        color: "334155",
        fontFace: "Arial",
        align: "center",
        valign: "top"
      });
    }
  }

  // Draw relationship lines and parent-child drop lines
  // First, draw couple lines
  const coupleEdges = canvas.edges.filter(e => e.type === "couple" || e.type === "consanguinity" || e.type === "divorced" || e.type === "separated");
  for (const edge of coupleEdges) {
    const p1 = nodePosMap.get(edge.sourceId);
    const p2 = nodePosMap.get(edge.targetId);
    if (!p1 || !p2) continue;

    const left = p1.px < p2.px ? p1 : p2;
    const right = p1.px < p2.px ? p2 : p1;

    const xStart = left.px + nodeSize / 2;
    const xEnd = right.px - nodeSize / 2;
    const y = left.py;

    slide.addShape(pptx.ShapeType.line, {
      x: xStart,
      y: y,
      w: xEnd - xStart,
      h: 0,
      line: { color: "0F172A", width: edge.type === "consanguinity" ? 2.5 : 1.5 }
    });

    // Divorce/Separation slashes
    if (edge.type === "divorced" || edge.type === "separated") {
      const midX = (xStart + xEnd) / 2;
      slide.addShape(pptx.ShapeType.line, {
        x: midX - 0.09,
        y: y,
        w: 0.18,
        h: 0,
        rotate: -63,
        line: { color: "0F172A", width: 1.5 }
      });
      if (edge.type === "divorced") {
        slide.addShape(pptx.ShapeType.line, {
          x: midX - 0.05,
          y: y,
          w: 0.18,
          h: 0,
          rotate: -63,
          line: { color: "0F172A", width: 1.5 }
        });
      }
    }
  }

  // Group children by unique parent sets
  const childEdges = canvas.edges.filter(e => e.type === "parent-child");
  const parentPairMap = new Map<string, string[]>(); // key: sorted comma-separated parent IDs -> children IDs
  for (const n of canvas.nodes) {
    const parents = childEdges.filter(e => e.targetId === n.id).map(e => e.sourceId).sort();
    if (parents.length > 0) {
      const key = parents.join(",");
      if (!parentPairMap.has(key)) parentPairMap.set(key, []);
      parentPairMap.get(key)!.push(n.id);
    }
  }

  for (const [parentKey, childrenIds] of parentPairMap.entries()) {
    const parentIds = parentKey.split(",");
    const children = childrenIds.map(id => {
      const n = canvas.nodes.find(node => node.id === id);
      const pos = nodePosMap.get(id);
      return n && pos ? { node: n, ...pos } : null;
    }).filter(Boolean) as { node: ExportNode; px: number; py: number }[];

    if (children.length === 0) continue;

    // Get drop start coordinate (midpoint of parents)
    let mx = 0;
    let my = 0;

    if (parentIds.length === 2) {
      const p1 = nodePosMap.get(parentIds[0]!);
      const p2 = nodePosMap.get(parentIds[1]!);
      if (p1 && p2) {
        mx = (p1.px + p2.px) / 2;
        my = p1.py;
      } else if (p1) {
        mx = p1.px;
        my = p1.py + nodeSize / 2;
      }
    } else if (parentIds.length === 1) {
      const p1 = nodePosMap.get(parentIds[0]!);
      if (p1) {
        mx = p1.px;
        my = p1.py + nodeSize / 2;
      }
    }

    if (mx === 0) continue;

    const cy = children[0]!.py;
    const midY = my + (cy - nodeSize / 2 - my) / 2;

    // Draw vertical drop line to midY
    slide.addShape(pptx.ShapeType.line, {
      x: mx,
      y: my,
      w: 0,
      h: midY - my,
      line: { color: "0F172A", width: 1.5 }
    });

    // Draw horizontal rail
    const cxList = children.map(c => c.px);
    const minCX = Math.min(...cxList);
    const maxCX = Math.max(...cxList);

    slide.addShape(pptx.ShapeType.line, {
      x: minCX,
      y: midY,
      w: maxCX - minCX,
      h: 0,
      line: { color: "0F172A", width: 1.5 }
    });

    // Draw lines to children
    for (const c of children) {
      slide.addShape(pptx.ShapeType.line, {
        x: c.px,
        y: midY,
        w: 0,
        h: (c.py - nodeSize / 2) - midY,
        line: { color: "0F172A", width: 1.5 }
      });
    }
  }

  // Draw clean, editable legend at the bottom of the slide
  const legY = SH - 0.7;
  const legW = 1.3;
  const legendItems = computeLegendItems(canvas);

  legendItems.forEach((item, i) => {
    const lx = 0.6 + i * legW;
    const ly = legY + 0.15;
    const lSize = 0.2;

    let shapeType = pptx.ShapeType.rect;
    let shapeOpts: any = {
      x: lx,
      y: ly - lSize / 2,
      w: lSize,
      h: lSize,
      fill: { color: "FFFFFF" },
      line: { color: "0F172A", width: 1 }
    };

    if (item.shape === "circle") {
      shapeType = pptx.ShapeType.ellipse;
    } else if (item.shape === "diamond" || item.shape === "pregnancy") {
      shapeType = pptx.ShapeType.diamond;
    } else if (item.shape === "sab") {
      shapeType = pptx.ShapeType.triangle;
      shapeOpts.rotate = 180;
      shapeOpts.fill = { color: "64748B" };
      shapeOpts.line = { color: "64748B", width: 1 };
    } else if (item.shape === "filled") {
      shapeOpts.fill = { color: "0F172A" };
    } else if (item.shape === "carrier") {
      slide.addShape(pptx.ShapeType.ellipse, {
        x: lx,
        y: ly - lSize / 2,
        w: lSize,
        h: lSize,
        fill: { color: "FFFFFF" },
        line: { color: "0F172A", width: 1 }
      });
      const dotSize = lSize * 0.3;
      slide.addShape(pptx.ShapeType.ellipse, {
        x: lx + lSize / 2 - dotSize / 2,
        y: ly - dotSize / 2,
        w: dotSize,
        h: dotSize,
        fill: { color: "0D9488" },
        line: { color: "0D9488", width: 0 }
      });
    } else if (item.shape === "slash") {
      slide.addShape(pptx.ShapeType.rect, {
        x: lx,
        y: ly - lSize / 2,
        w: lSize,
        h: lSize,
        fill: { color: "FFFFFF" },
        line: { color: "0F172A", width: 1 }
      });
      slide.addShape(pptx.ShapeType.line, {
        x: lx + lSize / 2 - (lSize + 0.1) * 0.707,
        y: ly,
        w: (lSize + 0.1) * 1.414,
        h: 0,
        rotate: -45,
        line: { color: "0F172A", width: 1.5 }
      });
    } else if (item.shape === "arrow") {
      slide.addShape(pptx.ShapeType.line, {
        x: lx - 0.05 - 0.25 * lSize,
        y: ly - 0.1 * lSize,
        w: 1.7 * lSize,
        h: 0,
        rotate: -45,
        line: { color: "0F172A", width: 1.5, endArrowType: "triangle" }
      });
    } else if (item.shape === "dbl-line") {
      slide.addShape(pptx.ShapeType.line, {
        x: lx,
        y: ly - 0.03,
        w: lSize,
        h: 0,
        line: { color: "0F172A", width: 1 }
      });
      slide.addShape(pptx.ShapeType.line, {
        x: lx,
        y: ly + 0.03,
        w: lSize,
        h: 0,
        line: { color: "0F172A", width: 1 }
      });
    }

    if (item.shape !== "carrier" && item.shape !== "slash" && item.shape !== "arrow" && item.shape !== "dbl-line") {
      slide.addShape(shapeType, shapeOpts);
    }

    slide.addText(item.label, {
      x: lx + lSize + 0.06,
      y: ly - 0.12,
      w: legW - lSize - 0.08,
      h: 0.3,
      fontSize: 8,
      color: "475569",
      fontFace: "Arial",
      align: "left",
      valign: "middle"
    });
  });

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

  const { dataUrl, vb } = await capturePedigreeImage(canvas.nodes);

  const genMap = computeGenerations(canvas.nodes, canvas.edges);
  const maxGen = Math.max(0, ...Array.from(genMap.values()));
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const byId  = new Map(canvas.nodes.map((n) => [n.id, n]));

  // ── shared helpers ────────────────────────────────────────────────────────
  function pageHeader(subtitle: string, showTitle = true) {
    // Draw a clean top border line
    doc.setFillColor(15, 23, 42); // Slate-900 top accent
    doc.rect(0, 0, PW, 1.5, "F");

    // Horizontal divider line at y = 28
    doc.setDrawColor(226, 232, 240); // Slate-200 border
    doc.setLineWidth(0.35);
    doc.line(M, 28, PW - M, 28);

    // Modern styled double-bar accent
    // Bar 1: Slate-900 (wide)
    doc.setFillColor(15, 23, 42);
    doc.rect(M, 9.5, 2.0, 13, "F");
    // Bar 2: Teal-500 (thin)
    doc.setFillColor(13, 148, 136);
    doc.rect(M + 2.8, 9.5, 0.8, 13, "F");

    // Left Side Branding
    doc.setTextColor(15, 23, 42); // Slate-900
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("PEDIGREE CLINICAL REPORT", M + 5.5, 13.5);

    doc.setTextColor(100, 116, 139); // Slate-500
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.text("GENETIC COUNSELING & FAMILY HEALTH HISTORY", M + 5.5, 17.5);

    if (subtitle) {
      doc.setTextColor(13, 148, 136); // Teal-600/Teal-500 for the subtitle label
      doc.setFontSize(6);
      doc.setFont("helvetica", "bold");
      doc.text(subtitle.toUpperCase(), M + 5.5, 21.5);
    }

    // Right Side Metadata
    doc.setFontSize(6.5);
    if (showTitle) {
      // Background shading card for metadata (Slate-50)
      const cardX = PW - M - 75;
      const cardY = 9;
      const cardW = 75;
      const cardH = 14;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.25);
      doc.roundedRect(cardX, cardY, cardW, cardH, 1, 1, "FD");

      // Grid vertical lines for 3 columns of metadata
      doc.line(cardX + 25, cardY, cardX + 25, cardY + cardH);
      doc.line(cardX + 50, cardY, cardX + 50, cardY + cardH);

      // Col 1: Family ID
      doc.setTextColor(100, 116, 139); doc.setFont("helvetica", "normal"); doc.setFontSize(5.5);
      doc.text("FAMILY ID", cardX + 3, cardY + 4.5);
      doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
      doc.text(info.title, cardX + 3, cardY + 9.5);

      // Col 2: Patient ID
      doc.setTextColor(100, 116, 139); doc.setFont("helvetica", "normal"); doc.setFontSize(5.5);
      doc.text("PATIENT ID", cardX + 28, cardY + 4.5);
      doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
      const pidStr = info.patientId ? `#${info.patientId}` : "N/A";
      doc.text(pidStr, cardX + 28, cardY + 9.5);

      // Col 3: Report Date
      doc.setTextColor(100, 116, 139); doc.setFont("helvetica", "normal"); doc.setFontSize(5.5);
      doc.text("REPORT DATE", cardX + 53, cardY + 4.5);
      doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
      doc.text(today, cardX + 53, cardY + 9.5);
    } else {
      // Subsequent pages metadata block (simpler card)
      const cardX = PW - M - 50;
      const cardY = 9;
      const cardW = 50;
      const cardH = 14;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.25);
      doc.roundedRect(cardX, cardY, cardW, cardH, 1, 1, "FD");

      doc.line(cardX + 25, cardY, cardX + 25, cardY + cardH);

      // Col 1: Family ID
      doc.setTextColor(100, 116, 139); doc.setFont("helvetica", "normal"); doc.setFontSize(5.5);
      doc.text("FAMILY ID", cardX + 3, cardY + 4.5);
      doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
      doc.text(info.title, cardX + 3, cardY + 9.5);

      // Col 2: Report Date
      doc.setTextColor(100, 116, 139); doc.setFont("helvetica", "normal"); doc.setFontSize(5.5);
      doc.text("REPORT DATE", cardX + 28, cardY + 4.5);
      doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
      doc.text(today, cardX + 28, cardY + 9.5);
    }
  }

  function pageFooter(page: number) {
    const fy = PH - 8;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.35);
    doc.line(M, fy, PW - M, fy);
    
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(5.5);
    doc.setFont("helvetica", "normal");
    doc.text("For use by licensed genetic counselors only. Not for independent patient distribution.", M, fy + 4);
    doc.text(`Page ${page}`, PW - M, fy + 4, { align: "right" });
  }

  function sectionBar(title: string, y: number): number {
    // Draw background rect respecting margins (from M to PW - M)
    doc.setFillColor(248, 250, 252);
    doc.rect(M, y, CW, 9, "F");
    
    // Bottom divider line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(M, y + 9, PW - M, y + 9);
    
    // Headline Text
    doc.setTextColor(15, 23, 42); // Slate-900
    doc.setFontSize(8); // increased font size
    doc.setFont("helvetica", "bold");
    doc.text(title, M + 3, y + 6.2); // positioned with M+3 left indent and vertical alignment
    
    // Returns y + 14 (allows 9 units of card height + 5 units of subspace buffer)
    return y + 14;
  }

  let pageNum = 1;

  // ══════════════════════════════════════════════════════════════════════════
  // PAGE 1 — Pedigree Diagram
  // ══════════════════════════════════════════════════════════════════════════
  pageHeader("");

  const notesText = info.notes?.trim();
  const hasNotes = !!(notesText && notesText !== "" && notesText !== "No general pedigree notes documented." && notesText.toLowerCase() !== "no general pedigree notes documented");

  // White pedigree area with rounded border card (Moved up to DT=32 and sized to DH dynamically)
  const DT = 32;
  const DH = hasNotes ? 110 : 125;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.35);
  doc.roundedRect(M, DT, CW, DH, 2.5, 2.5, "FD");

  const imgW = vb.w;
  const imgH = vb.h;
  const imgCW = CW - 6;
  const imgCH = DH - 6;
  const imgScale = Math.min(imgCW / imgW, imgCH / imgH);
  const drawW = imgW * imgScale;
  const drawH = imgH * imgScale;
  const imgX = M + 3 + (imgCW - drawW) / 2;
  const imgY = DT + 3 + (imgCH - drawH) / 2;

  doc.addImage(dataUrl, "PNG", imgX, imgY, drawW, drawH);

  // Overlay Patient ID inside pedigree card
  if (info.patientId) {
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text(`Patient ID: #${info.patientId}`, M + 5, DT + 6);
  }

  // Legend bar as a rounded card
  const LY0 = DT + DH + 4;
  const LEG_CARD_H = 13;
  
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.35);
  doc.roundedRect(M, LY0, CW, LEG_CARD_H, 2, 2, "FD");

  const legendItems = computeLegendItems(canvas);
  let lx = M + 4; const LYc = LY0 + LEG_CARD_H / 2; const LS = 3.8;
  doc.setFontSize(6.5);
  
  for (const item of legendItems) {
    // Default style: white fill, slate border
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(71, 85, 105);
    doc.setLineWidth(0.35);
    
    if (item.shape === "square") {
      doc.roundedRect(lx, LYc - LS / 2, LS, LS, 0.5, 0.5, "FD");
    }
    else if (item.shape === "circle") {
      doc.circle(lx + LS / 2, LYc, LS / 2, "FD");
    }
    else if (item.shape === "diamond" || item.shape === "pregnancy") {
      const dc = lx + LS / 2;
      doc.lines([[LS / 2, LS / 2], [-LS / 2, LS / 2], [-LS / 2, -LS / 2]], dc, LYc - LS / 2, [1, 1], "FD", true);
    }
    else if (item.shape === "sab") {
      doc.setFillColor(100, 116, 139);
      const tx = lx + LS / 2;
      const ty = LYc + LS / 6;
      doc.triangle(tx, ty + LS / 2, tx - LS / 2, ty - LS / 3, tx + LS / 2, ty - LS / 3, "FD");
    }
    else if (item.shape === "filled") {
      doc.setFillColor(225, 29, 72); // Crimson fill
      doc.circle(lx + LS / 2, LYc, LS / 2, "FD");
    }
    else if (item.shape === "carrier") {
      doc.circle(lx + LS / 2, LYc, LS / 2, "FD"); // White outer circle
      doc.setFillColor(13, 148, 136); // Teal dot
      doc.circle(lx + LS / 2, LYc, LS / 5, "FD");
    }
    else if (item.shape === "slash") {
      doc.rect(lx, LYc - LS / 2, LS, LS, "FD"); // White outer
      doc.line(lx, LYc + LS / 2, lx + LS, LYc - LS / 2); // Deceased slash
    }
    else if (item.shape === "arrow") {
      doc.setDrawColor(30, 41, 59); // Slate-800
      doc.setFillColor(30, 41, 59); // Slate-800
      doc.setLineWidth(0.45);
      // Shaft
      doc.line(lx, LYc + 1.5, lx + 2.2, LYc - 0.7);
      // Filled arrowhead triangle
      doc.triangle(
        lx + 3.0, LYc - 1.5, // tip
        lx + 1.2, LYc - 1.5, // back top-left
        lx + 3.0, LYc + 0.3, // back bottom-right
        "FD"
      );
      
      doc.setTextColor(71, 85, 105);
      doc.setFont("helvetica", "normal");
      doc.text(item.label, lx + LS + 2, LYc + 1.0);
      lx += LS + doc.getTextWidth(item.label) + 6;
      continue;
    }
    else if (item.shape === "dbl-line") {
      doc.setDrawColor(71, 85, 105);
      doc.setLineWidth(0.35);
      doc.line(lx, LYc - 0.6, lx + LS, LYc - 0.6);
      doc.line(lx, LYc + 0.6, lx + LS, LYc + 0.6);
    }
    
    doc.setTextColor(71, 85, 105);
    doc.setFont("helvetica", "normal");
    doc.text(item.label, lx + LS + 2, LYc + 1.0);
    lx += LS + doc.getTextWidth(item.label) + 6;
    if (lx > PW - 25) break;
  }

  // Notes card (Only drawn if notes actually exist and are not the placeholder)
  const notesY = LY0 + LEG_CARD_H + 4;
  let notesH = 0;

  if (hasNotes) {
    notesH = 20;
    doc.setFillColor(250, 250, 250);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.35);
    doc.roundedRect(M, notesY, CW, notesH, 1.5, 1.5, "FD");
    
    doc.setTextColor(15, 23, 42); doc.setFontSize(6.5); doc.setFont("helvetica", "bold");
    doc.text("Clinical Indication & Notes:", M + 3, notesY + 5);
    doc.setTextColor(71, 85, 105); doc.setFont("helvetica", "normal");
    const noteLines = doc.splitTextToSize(notesText!, CW - 6);
    doc.text(noteLines.slice(0, 3), M + 3, notesY + 9.5);
  }

  // ── Pedigree Summary (on Page 1) ──────────────────────────────────────────
  let p1Y = notesY + (notesH ? notesH + 4 : 0);
  p1Y = sectionBar("PEDIGREE SUMMARY METRICS", p1Y);

  const totalCount = canvas.nodes.length;
  const maleCount = canvas.nodes.filter(n => n.type === "male").length;
  const femaleCount = canvas.nodes.filter(n => n.type === "female").length;
  const unknownCount = canvas.nodes.filter(n => n.type === "unknown" || n.type === "pregnancy" || n.type === "sab").length;

  const affectedCount = canvas.nodes.filter(n => n.affected).length;
  const carrierCount = canvas.nodes.filter(n => n.carrier && !n.affected).length;
  const deceasedCount = canvas.nodes.filter(n => n.deceased).length;

  const couplesCount = canvas.edges.filter(e => e.type !== "parent-child").length;
  const linksCount = canvas.edges.filter(e => e.type === "parent-child").length;

  const sumColW = (CW - 6) / 3;
  const sumColH = 30;

  function drawSumCard(title: string, items: { label: string; val: string }[], startX: number, startY: number) {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.35);
    doc.roundedRect(startX, startY, sumColW, sumColH, 1.5, 1.5, "FD");

    // Title
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(startX + 0.1, startY + 0.1, sumColW - 0.2, 6, 1.5, 1.5, "F");
    doc.rect(startX + 0.1, startY + 5, sumColW - 0.2, 1.1, "F");
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.35);
    doc.line(startX, startY + 6, startX + sumColW, startY + 6);

    doc.setTextColor(71, 85, 105); doc.setFontSize(7); doc.setFont("helvetica", "bold");
    doc.text(title.toUpperCase(), startX + 3.5, startY + 4.5);

    let ly = startY + 11.5;
    for (const item of items) {
      doc.setTextColor(100, 116, 139); doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
      doc.text(item.label, startX + 3.5, ly);
      doc.setTextColor(15, 23, 42); doc.setFontSize(6.5); doc.setFont("helvetica", "bold");
      doc.text(item.val, startX + sumColW - 3.5, ly, { align: "right" });
      ly += 5.5;
    }
  }

  drawSumCard("Demographics", [
    { label: "Total Individuals", val: `${totalCount}` },
    { label: "Males / Females", val: `${maleCount} / ${femaleCount}` },
    { label: "Other / Unknown", val: `${unknownCount}` }
  ], M, p1Y);

  drawSumCard("Clinical Status", [
    { label: "Affected Individuals", val: `${affectedCount}` },
    { label: "Carrier Status", val: `${carrierCount}` },
    { label: "Deceased Members", val: `${deceasedCount}` }
  ], M + sumColW + 3, p1Y);

  drawSumCard("Pedigree Structure", [
    { label: "Generations", val: `${maxGen}` },
    { label: "Relationships", val: `${couplesCount}` },
    { label: "Parent-Child Links", val: `${linksCount}` }
  ], M + 2 * sumColW + 6, p1Y);

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

  let cy = 32;

  // ── Risk Analysis (at the top of Page 2) ─────────────────────────────
  cy = sectionBar("INHERITANCE RISK ANALYSIS", cy);

  if (proband) {
    const probLabel = proband.label || `Individual (${proband.type})`;
    const probTag   = proband.proband ? " - Proband" : proband.affected ? " - Affected" : "";
    doc.setTextColor(100, 116, 139); doc.setFontSize(7); doc.setFont("helvetica", "italic");
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
    const colH  = 44; // static card height
    const col2X = M + colW + 5;

    const results = MODES_LIST.map((m) => ({
      ...m,
      result: computeRisk(canvas.nodes, canvas.edges, proband.id, m.id),
    }));

    function drawRiskCard(item: typeof results[0], startX: number, startY: number) {
      const { title, result } = item;
      // Draw card border
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.35);
      doc.roundedRect(startX, startY, colW, colH, 1.5, 1.5, "FD");

      // Draw card header background
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(startX + 0.1, startY + 0.1, colW - 0.2, 7, 1.5, 1.5, "F");
      // Top-fill correction to keep headers square at the bottom
      doc.rect(startX + 0.1, startY + 5, colW - 0.2, 2.1, "F");
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.35);
      doc.line(startX, startY + 7, startX + colW, startY + 7);

      // Title
      doc.setTextColor(15, 23, 42); doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
      doc.text(title, startX + 3, startY + 5);

      // Confidence badge
      const confColors = result.confidence === "strong"   ? { bg: [209, 250, 229] as [number, number, number], text: [6, 95, 70] as [number, number, number], label: "Verified" }
                       : result.confidence === "inferred" ? { bg: [254, 243, 199] as [number, number, number], text: [146, 64, 14] as [number, number, number], label: "Inferred" }
                       :                                    { bg: [241, 245, 249] as [number, number, number], text: [71, 85, 105] as [number, number, number], label: "Assumed" };
      
      const badgeW = doc.getTextWidth(confColors.label) + 4;
      const badgeX = startX + colW - badgeW - 3;
      doc.setFillColor(confColors.bg[0], confColors.bg[1], confColors.bg[2]);
      doc.roundedRect(badgeX, startY + 1.8, badgeW, 3.4, 0.7, 0.7, "F");
      doc.setTextColor(confColors.text[0], confColors.text[1], confColors.text[2]);
      doc.setFontSize(5);
      doc.setFont("helvetica", "bold");
      doc.text(confColors.label, badgeX + 2, startY + 4.2);

      let ly = startY + 11;

      if (result.entries.length === 0) {
        doc.setTextColor(148, 163, 184); doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
        doc.text("No entries calculated", startX + 4, ly + 4);
      } else {
        const entriesToShow = result.entries.slice(0, 2);
        for (const e of entriesToShow) {
          const tC = e.tier === "low" ? [13, 148, 136] as const // Teal
                   : e.tier === "moderate" ? [234, 88, 12] as const // Orange
                   : [225, 29, 72] as const; // Crimson
          
          doc.setTextColor(51, 65, 85); doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
          const labelLines = doc.splitTextToSize(e.label, colW - 22);
          doc.text(labelLines[0] || "", startX + 4, ly);
          
          doc.setTextColor(tC[0], tC[1], tC[2]); doc.setFontSize(6.5); doc.setFont("helvetica", "bold");
          doc.text(e.percent, startX + colW - 4, ly, { align: "right" });
          
          ly += 2.5;
          // Progress gauge track
          doc.setFillColor(241, 245, 249);
          doc.roundedRect(startX + 4, ly, colW - 8, 1.6, 0.8, 0.8, "F");
          
          // Progress gauge fill
          if (e.value > 0) {
            doc.setFillColor(tC[0], tC[1], tC[2]);
            doc.roundedRect(startX + 4, ly, Math.max(1, (colW - 8) * Math.min(1, e.value)), 1.6, 0.8, 0.8, "F");
          }
          ly += 6.5;
        }
      }

      // Basis / Notes
      if (result.basis && result.basis.length > 0 && result.basis[0]) {
        doc.setTextColor(100, 116, 139); doc.setFontSize(5.5); doc.setFont("helvetica", "italic");
        const bLines = doc.splitTextToSize(`Basis: ${result.basis[0]}`, colW - 8);
        doc.text(bLines.slice(0, 2), startX + 4, startY + colH - 6.5);
      }
    }

    drawRiskCard(results[0]!, M, cy);
    drawRiskCard(results[1]!, col2X, cy);
    cy += colH + 4;
    drawRiskCard(results[2]!, M, cy);
    drawRiskCard(results[3]!, col2X, cy);
    cy += colH + 4;
  } else {
    doc.setTextColor(148, 163, 184); doc.setFontSize(7);
    doc.text("No individuals present in pedigree.", M, cy + 4);
    cy += 10;
  }



  // ── Condition & Clinical Notes per node ──────────────────────────────────
  const clinicalNodes = canvas.nodes.filter((n) => n.affected || n.carrier || n.condition || n.notes || n.proband);
  if (clinicalNodes.length > 0) {
    if (cy > PH - 35) { pageFooter(pageNum); pageNum++; doc.addPage(); pageHeader("Clinical Roster & Notes", false); cy = 32; }
    cy = sectionBar("CLINICAL ROSTER & NOTES", cy + 2);
    
    const colWs = [30, 14, 28, 38, 76] as const;
    const colXs = [
      M,
      M + colWs[0],
      M + colWs[0] + colWs[1],
      M + colWs[0] + colWs[1] + colWs[2],
      M + colWs[0] + colWs[1] + colWs[2] + colWs[3]
    ] as const;
    
    function drawTableHeader(y: number) {
      doc.setFillColor(15, 23, 42); // Slate-900 header
      doc.rect(M, y, CW, 7, "F");
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "bold");
      
      doc.text("Individual", colXs[0] + 2, y + 4.8);
      doc.text("Gen", colXs[1] + 2, y + 4.8);
      doc.text("Status", colXs[2] + 2, y + 4.8);
      doc.text("Condition / Diagnosis", colXs[3] + 2, y + 4.8);
      doc.text("Clinical Notes", colXs[4] + 2, y + 4.8);
    }
    
    drawTableHeader(cy);
    cy += 7;
    
    let isAlt = false;
    for (const n of clinicalNodes) {
      const nameLabel = n.label ? `${n.label} (${n.id})` : `${n.type} (${n.id})`;
      const genNum = genMap.get(n.id) ?? 1;
      const genStr = toRoman(genNum);
      
      const statusParts = [
        n.proband && "Proband",
        n.affected && "Affected",
        n.carrier && "Carrier",
        n.deceased && "Deceased"
      ].filter(Boolean).join(", ") || "Normal";
      
      const condStr = n.condition || "-";
      const notesStr = n.notes || "-";
      
      // Calculate wrapped height of clinical notes and condition
      const wrappedNotes = doc.splitTextToSize(notesStr, colWs[4] - 4);
      const wrappedCond = doc.splitTextToSize(condStr, colWs[3] - 4);
      const wrappedName = doc.splitTextToSize(nameLabel, colWs[0] - 4);
      
      const linesCount = Math.max(wrappedNotes.length, wrappedCond.length, wrappedName.length, 1);
      const rowH = linesCount * 4.5 + 2.5; // row height depends on text lines
      
      if (cy + rowH > PH - 25) {
        pageFooter(pageNum);
        pageNum++;
        doc.addPage();
        pageHeader("Clinical Roster & Notes (continued)", false);
        cy = 32;
        drawTableHeader(cy);
        cy += 7;
      }
      
      // Alternating slate rows
      doc.setFillColor(isAlt ? 248 : 255, isAlt ? 250 : 255, isAlt ? 252 : 255); // #f8fafc vs #ffffff
      doc.rect(M, cy, CW, rowH, "F");
      
      // Bottom border for the row
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.25);
      doc.line(M, cy + rowH, M + CW, cy + rowH);
      
      // Draw grid lines
      doc.line(colXs[1], cy, colXs[1], cy + rowH);
      doc.line(colXs[2], cy, colXs[2], cy + rowH);
      doc.line(colXs[3], cy, colXs[3], cy + rowH);
      doc.line(colXs[4], cy, colXs[4], cy + rowH);
      
      // Text drawing
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      
      // Col 1: Name / ID
      doc.setTextColor(15, 23, 42);
      if (n.proband || n.affected) doc.setFont("helvetica", "bold");
      for (let i = 0; i < wrappedName.length; i++) {
        doc.text(wrappedName[i]!, colXs[0] + 2, cy + 4.5 + i * 4.5);
      }
      
      // Col 2: Gen
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(genStr, colXs[1] + 2, cy + 4.5);
      
      // Col 3: Status
      if (n.affected) {
        doc.setTextColor(225, 29, 72); // Crimson
        doc.setFont("helvetica", "bold");
      } else if (n.carrier) {
        doc.setTextColor(13, 148, 136); // Teal
        doc.setFont("helvetica", "bold");
      } else {
        doc.setTextColor(100, 116, 139);
        doc.setFont("helvetica", "normal");
      }
      doc.text(statusParts, colXs[2] + 2, cy + 4.5);
      
      // Col 4: Condition
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
      if (n.condition) {
        doc.setFont("helvetica", "bolditalic");
        doc.setTextColor(180, 120, 20); // Gold
      }
      for (let i = 0; i < wrappedCond.length; i++) {
        doc.text(wrappedCond[i]!, colXs[3] + 2, cy + 4.5 + i * 4.5);
      }
      
      // Col 5: Notes
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      for (let i = 0; i < wrappedNotes.length; i++) {
        doc.text(wrappedNotes[i]!, colXs[4] + 2, cy + 4.5 + i * 4.5);
      }
      
      cy += rowH;
      isAlt = !isAlt;
    }
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
      doc.text(`... and ${allAnns.length - maxAnns} more annotation(s)`, M, cy + 3);
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
export async function exportSVG(
  info: ExportInfo,
  canvas: ExportCanvas,
  options?: { transparent?: boolean }
): Promise<void> {
  const svgEl = document.querySelector('svg[data-canvas-svg="true"]') ?? document.querySelector("svg");
  try {
    const { clone } = prepareSvgForExport(svgEl as SVGSVGElement, canvas.nodes, { transparentBg: options?.transparent });
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
export async function exportPNG(
  info: ExportInfo,
  canvas: ExportCanvas,
  options?: { transparent?: boolean }
): Promise<void> {
  const svgEl = document.querySelector('svg[data-canvas-svg="true"]') ?? document.querySelector("svg");
  let svgBlobUrl: string | null = null;
  try {
    const { clone, vb } = prepareSvgForExport(svgEl as SVGSVGElement, canvas.nodes, { transparentBg: options?.transparent });
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
        if (!options?.transparent) {
          ctx.fillStyle = "#f8f9fa";
          ctx.fillRect(0, 0, cvs.width, cvs.height);
        }
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

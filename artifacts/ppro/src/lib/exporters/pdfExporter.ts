import { getQuadrantsForStyle } from "@/features/pedigree-editor/utils/helpers";
import { computeLegendItems } from "./legend";
import { capturePedigreeImage } from "./svgCapture";
import type { ExportCanvas, ExportInfo } from "./types";
import { safeFilename, triggerDownload } from "./utils";

export function drawShadedCircleInPdf(doc: any, lx: number, LYc: number, LS: number, style: string): void {
  const r = LS / 2;
  const cx = lx + r;
  const cy = LYc;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(71, 85, 105);
  doc.setLineWidth(0.35);
  doc.circle(cx, cy, r, "FD");

  doc.setFillColor(71, 85, 105);
  doc.setDrawColor(71, 85, 105);

  const drawWedge = (startAngle: number, endAngle: number) => {
    const steps = 8;
    const angleStep = (endAngle - startAngle) / steps;
    for (let i = 0; i < steps; i++) {
      const a1 = startAngle + i * angleStep;
      const a2 = a1 + angleStep;
      doc.triangle(
        cx, cy,
        cx + r * Math.cos(a1), cy + r * Math.sin(a1),
        cx + r * Math.cos(a2), cy + r * Math.sin(a2),
        "F"
      );
    }
  };

  if (style === "solid") {
    doc.circle(cx, cy, r, "FD");
  } else if (style === "striped") {
    doc.setLineWidth(0.3);
    const offset = r * 0.707;
    doc.line(cx - offset, cy + offset, cx + offset, cy - offset);
    doc.line(cx - offset * 0.5, cy, cx, cy - offset * 0.5);
    doc.line(cx, cy + offset * 0.5, cx + offset * 0.5, cy);
  } else if (style === "cross-hatched") {
    doc.setLineWidth(0.3);
    const offset = r * 0.707;
    doc.line(cx - offset, cy + offset, cx + offset, cy - offset);
    doc.line(cx - offset * 0.5, cy, cx, cy - offset * 0.5);
    doc.line(cx, cy + offset * 0.5, cx + offset * 0.5, cy);
    doc.line(cx - offset, cy - offset, cx + offset, cy + offset);
    doc.line(cx - offset * 0.5, cy, cx, cy + offset * 0.5);
    doc.line(cx, cy - offset * 0.5, cx + offset * 0.5, cy);
  } else if (style === "dots") {
    doc.circle(cx, cy, 0.35, "F");
    doc.circle(cx - r * 0.4, cy - r * 0.4, 0.25, "F");
    doc.circle(cx + r * 0.4, cy - r * 0.4, 0.25, "F");
    doc.circle(cx - r * 0.4, cy + r * 0.4, 0.25, "F");
    doc.circle(cx + r * 0.4, cy + r * 0.4, 0.25, "F");
  } else {
    const [q1, q2, q3, q4] = getQuadrantsForStyle(style);
    if (q1) drawWedge(-Math.PI / 2, 0);
    if (q2) drawWedge(Math.PI, Math.PI * 1.5);
    if (q3) drawWedge(Math.PI / 2, Math.PI);
    if (q4) drawWedge(0, Math.PI / 2);
  }
}

export async function exportPDF(info: ExportInfo, canvas: ExportCanvas): Promise<void> {
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
  doc.setFillColor(15, 23, 42); // Slate-900 top accent
  doc.rect(0, 0, PW, 1.5, "F");

  doc.setDrawColor(226, 232, 240); // Slate-200 border
  doc.setLineWidth(0.35);
  doc.line(M, 26, PW - M, 26);

  doc.setFillColor(15, 23, 42);
  doc.rect(M, 8.5, 2.0, 13, "F");
  doc.setFillColor(13, 148, 136);
  doc.rect(M + 2.8, 8.5, 0.8, 13, "F");

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("PEDIGREE DIAGRAM PRINTOUT", M + 5.5, 12.5);

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.text("GENETIC COUNSELING & FAMILY HEALTH HISTORY", M + 5.5, 16.5);

  doc.setTextColor(13, 148, 136);
  doc.setFontSize(6);
  doc.setFont("helvetica", "bold");
  doc.text("FAMILY pedigree diagram chart".toUpperCase(), M + 5.5, 20.5);

  const cardX = PW - M - 50;
  const cardY = 8;
  const cardW = 50;
  const cardH = 14;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.25);
  doc.roundedRect(cardX, cardY, cardW, cardH, 1, 1, "FD");

  doc.line(cardX + 25, cardY, cardX + 25, cardY + cardH);

  doc.setTextColor(100, 116, 139); doc.setFont("helvetica", "normal"); doc.setFontSize(5.5);
  doc.text("FAMILY ID", cardX + 3, cardY + 4.5);
  doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
  doc.text(info.title, cardX + 3, cardY + 9.5);

  doc.setTextColor(100, 116, 139); doc.setFont("helvetica", "normal"); doc.setFontSize(5.5);
  doc.text("PRINT DATE", cardX + 28, cardY + 4.5);
  doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
  doc.text(today, cardX + 28, cardY + 9.5);

  // ── Legend ──────────────────────────────────────────────────────────────
  const LEGEND_H = 13;
  const LEGEND_Y = PH - LEGEND_H - 10;
  
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
      doc.triangle(tx, ty - LS / 2, tx - LS / 2, ty + LS / 3, tx + LS / 2, ty + LS / 3, "FD");
    } else if (item.shape === "stillbirth") {
      const scaleLS = LS * 0.65;
      const offset = (LS - scaleLS) / 2;
      const lxScaled = lx + offset;
      const lycScaled = LYc;
      doc.rect(lxScaled, lycScaled - scaleLS / 2, scaleLS, scaleLS, "FD");
      doc.line(lxScaled - 1, lycScaled + scaleLS / 2 + 1, lxScaled + scaleLS + 1, lycScaled - scaleLS / 2 - 1);
      doc.setFontSize(4);
      doc.text("SB", lxScaled + scaleLS + 1, lycScaled + scaleLS / 2);
    } else if (item.shape === "filled") {
      doc.setFillColor(225, 29, 72);
      doc.circle(lx + LS / 2, LYc, LS / 2, "FD");
    } else if (item.shape === "carrier") {
      doc.circle(lx + LS / 2, LYc, LS / 2, "FD");
      doc.setFillColor(13, 148, 136);
      doc.circle(lx + LS / 2, LYc, LS / 5, "FD");
    } else if (item.shape === "slash") {
      doc.rect(lx, LYc - LS / 2, LS, LS, "FD");
      doc.line(lx, LYc + LS / 2, lx + LS, LYc - LS / 2);
    } else if (item.shape === "arrow") {
      doc.setDrawColor(30, 41, 59);
      doc.setFillColor(30, 41, 59);
      doc.setLineWidth(0.45);
      doc.line(lx, LYc + 1.5, lx + 2.2, LYc - 0.7);
      doc.triangle(
        lx + 3.0, LYc - 1.5,
        lx + 1.2, LYc - 1.5,
        lx + 3.0, LYc + 0.3,
        "FD"
      );
      
      doc.setTextColor(71, 85, 105);
      doc.text(item.label, lx + LS + 2, LYc + 1.2);
      lx += LS + doc.getTextWidth(item.label) + 8;
      continue;
    } else if (item.shape.startsWith("shading-")) {
      const style = item.shape.replace("shading-", "");
      drawShadedCircleInPdf(doc, lx, LYc, LS, style);
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
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "italic");
    doc.text(`Notes: ${info.notes.slice(0, 150)}`, PW - M - 2, LYc + 1.2, { align: "right", maxWidth: 100 });
  }

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

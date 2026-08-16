import { computeRisk } from "@/lib/risk-calculator";
import { computeLegendItems } from "./legend";
import { drawShadedCircleInPdf } from "./pdfExporter";
import { capturePedigreeImage } from "./svgCapture";
import type { ExportCanvas, ExportInfo } from "./types";
import { safeFilename, triggerDownload, computeGenerations, toRoman } from "./utils";

export async function exportClinicalReport(info: ExportInfo, canvas: ExportCanvas): Promise<void> {
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

  function pageHeader(subtitle: string, showTitle = true) {
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, PW, 1.5, "F");

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.35);
    doc.line(M, 28, PW - M, 28);

    doc.setFillColor(15, 23, 42);
    doc.rect(M, 9.5, 2.0, 13, "F");
    doc.setFillColor(13, 148, 136);
    doc.rect(M + 2.8, 9.5, 0.8, 13, "F");

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("PEDIGREE CLINICAL REPORT", M + 5.5, 13.5);

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.text("GENETIC COUNSELING & FAMILY HEALTH HISTORY", M + 5.5, 17.5);

    if (subtitle) {
      doc.setTextColor(13, 148, 136);
      doc.setFontSize(6);
      doc.setFont("helvetica", "bold");
      doc.text(subtitle.toUpperCase(), M + 5.5, 21.5);
    }

    doc.setFontSize(6.5);
    if (showTitle) {
      const cardX = PW - M - 75;
      const cardY = 9;
      const cardW = 75;
      const cardH = 14;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.25);
      doc.roundedRect(cardX, cardY, cardW, cardH, 1, 1, "FD");

      doc.line(cardX + 25, cardY, cardX + 25, cardY + cardH);
      doc.line(cardX + 50, cardY, cardX + 50, cardY + cardH);

      doc.setTextColor(100, 116, 139); doc.setFont("helvetica", "normal"); doc.setFontSize(5.5);
      doc.text("FAMILY ID", cardX + 3, cardY + 4.5);
      doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
      doc.text(info.title, cardX + 3, cardY + 9.5);

      doc.setTextColor(100, 116, 139); doc.setFont("helvetica", "normal"); doc.setFontSize(5.5);
      doc.text("PATIENT ID", cardX + 28, cardY + 4.5);
      doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
      const pidStr = info.patientId ? `#${info.patientId}` : "N/A";
      doc.text(pidStr, cardX + 28, cardY + 9.5);

      doc.setTextColor(100, 116, 139); doc.setFont("helvetica", "normal"); doc.setFontSize(5.5);
      doc.text("REPORT DATE", cardX + 53, cardY + 4.5);
      doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
      doc.text(today, cardX + 53, cardY + 9.5);
    } else {
      const cardX = PW - M - 50;
      const cardY = 9;
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
    doc.setFillColor(248, 250, 252);
    doc.rect(M, y, CW, 9, "F");
    
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(M, y + 9, PW - M, y + 9);
    
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(title, M + 3, y + 6.2);
    
    return y + 14;
  }

  let pageNum = 1;

  // PAGE 1 — Pedigree Diagram
  pageHeader("");

  const notesText = info.notes?.trim();
  const hasNotes = !!(notesText && notesText !== "" && notesText !== "No general pedigree notes documented." && notesText.toLowerCase() !== "no general pedigree notes documented");

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

  if (info.patientId) {
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text(`Patient ID: #${info.patientId}`, M + 5, DT + 6);
  }

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
      doc.triangle(tx, ty - LS / 2, tx - LS / 2, ty + LS / 3, tx + LS / 2, ty + LS / 3, "FD");
    }
    else if (item.shape === "stillbirth") {
      const scaleLS = LS * 0.65;
      const offset = (LS - scaleLS) / 2;
      const lxScaled = lx + offset;
      const lycScaled = LYc;
      doc.rect(lxScaled, lycScaled - scaleLS / 2, scaleLS, scaleLS, "FD");
      doc.line(lxScaled - 1, lycScaled + scaleLS / 2 + 1, lxScaled + scaleLS + 1, lycScaled - scaleLS / 2 - 1);
      doc.setFontSize(4);
      doc.text("SB", lxScaled + scaleLS + 1, lycScaled + scaleLS / 2);
    }
    else if (item.shape === "filled") {
      doc.setFillColor(225, 29, 72);
      doc.circle(lx + LS / 2, LYc, LS / 2, "FD");
    }
    else if (item.shape === "carrier") {
      doc.circle(lx + LS / 2, LYc, LS / 2, "FD");
      doc.setFillColor(13, 148, 136);
      doc.circle(lx + LS / 2, LYc, LS / 5, "FD");
    }
    else if (item.shape === "slash") {
      doc.rect(lx, LYc - LS / 2, LS, LS, "FD");
      doc.line(lx, LYc + LS / 2, lx + LS, LYc - LS / 2);
    }
    else if (item.shape === "arrow") {
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
      doc.setFont("helvetica", "normal");
      doc.text(item.label, lx + LS + 2, LYc + 1.0);
      lx += LS + doc.getTextWidth(item.label) + 6;
      continue;
    }
    else if (item.shape.startsWith("shading-")) {
      const style = item.shape.replace("shading-", "");
      drawShadedCircleInPdf(doc, lx, LYc, LS, style);
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

  // PAGE 2 — Clinical Analysis
  pageNum++;
  doc.addPage();
  pageHeader("Clinical Analysis Report");

  const proband = canvas.nodes.find((n) => n.proband)
               ?? canvas.nodes.find((n) => n.affected)
               ?? canvas.nodes[0];

  let cy = 32;

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
    const colH  = 44;
    const col2X = M + colW + 5;

    const results = MODES_LIST.map((m) => ({
      ...m,
      result: computeRisk(canvas.nodes, canvas.edges, proband.id, m.id),
    }));

    function drawRiskCard(item: typeof results[0], startX: number, startY: number) {
      const { title, result } = item;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.35);
      doc.roundedRect(startX, startY, colW, colH, 1.5, 1.5, "FD");

      doc.setFillColor(248, 250, 252);
      doc.roundedRect(startX + 0.1, startY + 0.1, colW - 0.2, 7, 1.5, 1.5, "F");
      doc.rect(startX + 0.1, startY + 5, colW - 0.2, 2.1, "F");
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.35);
      doc.line(startX, startY + 7, startX + colW, startY + 7);

      doc.setTextColor(15, 23, 42); doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
      doc.text(title, startX + 3, startY + 5);

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
          const tC = e.tier === "low" ? [13, 148, 136] as const
                   : e.tier === "moderate" ? [234, 88, 12] as const
                   : [225, 29, 72] as const;
          
          doc.setTextColor(51, 65, 85); doc.setFontSize(6.5); doc.setFont("helvetica", "normal");
          const labelLines = doc.splitTextToSize(e.label, colW - 22);
          doc.text(labelLines[0] || "", startX + 4, ly);
          
          doc.setTextColor(tC[0], tC[1], tC[2]); doc.setFontSize(6.5); doc.setFont("helvetica", "bold");
          doc.text(e.percent, startX + colW - 4, ly, { align: "right" });
          
          ly += 2.5;
          doc.setFillColor(241, 245, 249);
          doc.roundedRect(startX + 4, ly, colW - 8, 1.6, 0.8, 0.8, "F");
          
          if (e.value > 0) {
            doc.setFillColor(tC[0], tC[1], tC[2]);
            doc.roundedRect(startX + 4, ly, Math.max(1, (colW - 8) * Math.min(1, e.value)), 1.6, 0.8, 0.8, "F");
          }
          ly += 6.5;
        }
      }

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
      doc.setFillColor(15, 23, 42);
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
      
      const wrappedNotes = doc.splitTextToSize(notesStr, colWs[4] - 4);
      const wrappedCond = doc.splitTextToSize(condStr, colWs[3] - 4);
      const wrappedName = doc.splitTextToSize(nameLabel, colWs[0] - 4);
      
      const linesCount = Math.max(wrappedNotes.length, wrappedCond.length, wrappedName.length, 1);
      const rowH = linesCount * 4.5 + 2.5;
      
      if (cy + rowH > PH - 25) {
        pageFooter(pageNum);
        pageNum++;
        doc.addPage();
        pageHeader("Clinical Roster & Notes (continued)", false);
        cy = 32;
        drawTableHeader(cy);
        cy += 7;
      }
      
      doc.setFillColor(isAlt ? 248 : 255, isAlt ? 250 : 255, isAlt ? 252 : 255);
      doc.rect(M, cy, CW, rowH, "F");
      
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.25);
      doc.line(M, cy + rowH, M + CW, cy + rowH);
      
      doc.line(colXs[1], cy, colXs[1], cy + rowH);
      doc.line(colXs[2], cy, colXs[2], cy + rowH);
      doc.line(colXs[3], cy, colXs[3], cy + rowH);
      doc.line(colXs[4], cy, colXs[4], cy + rowH);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      
      doc.setTextColor(15, 23, 42);
      if (n.proband || n.affected) doc.setFont("helvetica", "bold");
      for (let i = 0; i < wrappedName.length; i++) {
        doc.text(wrappedName[i]!, colXs[0] + 2, cy + 4.5 + i * 4.5);
      }
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(genStr, colXs[1] + 2, cy + 4.5);
      
      if (n.affected) {
        doc.setTextColor(225, 29, 72);
        doc.setFont("helvetica", "bold");
      } else if (n.carrier) {
        doc.setTextColor(13, 148, 136);
        doc.setFont("helvetica", "bold");
      } else {
        doc.setTextColor(100, 116, 139);
        doc.setFont("helvetica", "normal");
      }
      doc.text(statusParts, colXs[2] + 2, cy + 4.5);
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
      if (n.condition) {
        doc.setFont("helvetica", "bolditalic");
        doc.setTextColor(180, 120, 20);
      }
      for (let i = 0; i < wrappedCond.length; i++) {
        doc.text(wrappedCond[i]!, colXs[3] + 2, cy + 4.5 + i * 4.5);
      }
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      for (let i = 0; i < wrappedNotes.length; i++) {
        doc.text(wrappedNotes[i]!, colXs[4] + 2, cy + 4.5 + i * 4.5);
      }
      
      cy += rowH;
      isAlt = !isAlt;
    }
  }

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

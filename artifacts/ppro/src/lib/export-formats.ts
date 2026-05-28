import type { ExportCanvas, ExportInfo } from "./export-pedigree";

function safeFilenameLocal(title: string): string {
  return title.replace(/[^a-z0-9\-_. ]/gi, "_").replace(/\s+/g, "_").slice(0, 60);
}

export function exportPED(info: ExportInfo, canvas: ExportCanvas): string {
  const familyId = info.title.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 20) || "FAM001";

  const nodeParentMap = new Map<string, { fatherId: string | null; motherId: string | null }>();
  for (const edge of canvas.edges) {
    if (edge.type === "parent-child") {
      const childId = edge.targetId;
      const parentId = edge.sourceId;
      const existing = nodeParentMap.get(childId) ?? { fatherId: null as string | null, motherId: null as string | null };
      const parentNode = canvas.nodes.find(n => n.id === parentId);
      if (parentNode?.type === "male") existing.fatherId = parentId;
      else if (parentNode?.type === "female") existing.motherId = parentId;
      else { if (!existing.fatherId) existing.fatherId = parentId; else if (!existing.motherId) existing.motherId = parentId; }
      nodeParentMap.set(childId, existing);
    }
  }

  const lines: string[] = [`# Exported from Pedigree PRO - ${new Date().toISOString()}`, `# Title: ${info.title}`];
  canvas.nodes.forEach((node, idx) => {
    const individualId = node.label || `IND${idx + 1}`;
    const sexCode = node.type === "male" ? "1" : node.type === "female" ? "2" : "0";
    const phenoCode = node.affected ? "2" : "1";
    const parents = nodeParentMap.get(node.id);
    const fatherLabel = parents?.fatherId ? (canvas.nodes.find(n => n.id === parents.fatherId)?.label ?? parents.fatherId) : "0";
    const motherLabel = parents?.motherId ? (canvas.nodes.find(n => n.id === parents.motherId)?.label ?? parents.motherId) : "0";
    lines.push([familyId, individualId, fatherLabel, motherLabel, sexCode, phenoCode].join("\t"));
  });

  return lines.join("\n");
}

export function exportHaploPainterCSV(info: ExportInfo, canvas: ExportCanvas): string {
  const familyId = info.title.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 20) || "FAM001";

  const nodeParentMap = new Map<string, { fatherId: string | null; motherId: string | null }>();
  for (const edge of canvas.edges) {
    if (edge.type === "parent-child") {
      const childId = edge.targetId;
      const parentId = edge.sourceId;
      const existing = nodeParentMap.get(childId) ?? { fatherId: null as string | null, motherId: null as string | null };
      const parentNode = canvas.nodes.find(n => n.id === parentId);
      if (parentNode?.type === "male") existing.fatherId = parentId;
      else if (parentNode?.type === "female") existing.motherId = parentId;
      else { if (!existing.fatherId) existing.fatherId = parentId; else if (!existing.motherId) existing.motherId = parentId; }
      nodeParentMap.set(childId, existing);
    }
  }

  const HEADER = "FAMILY\tPERSON\tFATHER\tMOTHER\tGENDER\tAFFECTION\tIS_DECEASED\tIS_SAB_OR_TOP\tIS_PROBAND\tIS_ADOPTED\tARE_TWINS\tARE_CONSANGUINEOUS\tTEXT_INSIDE\tTEXT_BESIDE\tTEXT1_BELOW\tTEXT2_BELOW\tTEXT3_BELOW\tTEXT4_BELOW\tTEXT5_BELOW";
  const lines: string[] = [HEADER];

  for (const node of canvas.nodes) {
    const idx = canvas.nodes.indexOf(node);
    const person = node.label || `IND${idx + 1}`;
    const parents = nodeParentMap.get(node.id);
    const fatherLabel = parents?.fatherId ? (canvas.nodes.find(n => n.id === parents.fatherId)?.label ?? parents.fatherId) : "0";
    const motherLabel = parents?.motherId ? (canvas.nodes.find(n => n.id === parents.motherId)?.label ?? parents.motherId) : "0";

    const gender = node.type === "male" ? "1" : node.type === "female" ? "2" : "0";
    const affection = node.affected ? String(node.affectedLevel ?? 2) : "0";
    const isDeceased = node.deceased ? "1" : "0";
    const isSab = node.type === "sab" ? "1" : "0";
    const isProband = node.proband ? "1" : "0";
    const isAdopted = node.adopted ? "1" : "0";

    // Find twin group from edges
    const twinEdge = canvas.edges.find(e => e.targetId === node.id && "twinGroup" in e && e.twinGroup);
    const areTwins = twinEdge && "twinGroup" in twinEdge && twinEdge.twinGroup
      ? `${(twinEdge as Record<string, unknown>).twinType === "m" ? "m" : "d"}_${(twinEdge as Record<string, unknown>).twinGroup}`
      : "0";

    const coupleEdge = canvas.edges.find(e =>
      (e.type === "couple" || e.type === "consanguinity") &&
      (e.sourceId === node.id || e.targetId === node.id) &&
      e.type === "consanguinity"
    );
    const areConsanguineous = coupleEdge ? "yes" : "0";

    const textInside = "";
    const textBeside = node.label || "";

    const belowTexts: string[] = [];
    if (node.age) belowTexts.push(`Age: ${node.age}`);
    if (node.condition) belowTexts.push(node.condition);

    const cols = [
      familyId, person, fatherLabel, motherLabel, gender, affection,
      isDeceased, isSab, isProband, isAdopted,
      areTwins, areConsanguineous,
      textInside, textBeside,
      ...belowTexts,
      ...Array(Math.max(0, 5 - belowTexts.length)).fill(""),
    ];

    lines.push(cols.slice(0, 19).join("\t"));
  }

  return lines.join("\n");
}

export function downloadPED(info: ExportInfo, canvas: ExportCanvas): void {
  const content = exportPED(info, canvas);
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${safeFilenameLocal(info.title)}.ped`;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); document.body.removeChild(a); }, 5000);
}

export function downloadHaploPainterCSV(info: ExportInfo, canvas: ExportCanvas): void {
  const content = exportHaploPainterCSV(info, canvas);
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${safeFilenameLocal(info.title)}.hp`;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); document.body.removeChild(a); }, 5000);
}
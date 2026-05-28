import type { ExportCanvas, ExportInfo } from "./export-pedigree";
import { exportPDF, exportPPTX, exportJSON, exportClinicalReport } from "./export-pedigree";
import { downloadPED, downloadHaploPainterCSV } from "./export-formats";

export type BatchExportFormat = "pdf" | "pptx" | "json" | "ped" | "hp" | "clinical_report";

export interface BatchExportJob {
  pedigrees: { id: number; title: string; patientId?: number | null; notes?: string | null; canvasData: string }[];
  format: BatchExportFormat;
  onProgress?: (completed: number, total: number) => void;
}

function parseCanvasData(canvasDataStr: string): ExportCanvas {
  const parsed = JSON.parse(canvasDataStr);
  return {
    nodes: (parsed.nodes ?? []).map((n: Record<string, unknown>) => ({
      id: String(n.id ?? ""),
      type: (n.type as ExportCanvas["nodes"][number]["type"]) ?? "unknown",
      affected: !!n.affected,
      carrier: !!n.carrier,
      deceased: !!n.deceased,
      proband: !!n.proband,
      label: String(n.label ?? ""),
      age: String(n.age ?? ""),
      dob: n.dob ? String(n.dob) : undefined,
      condition: n.condition ? String(n.condition) : undefined,
      notes: n.notes ? String(n.notes) : undefined,
      x: Number(n.x ?? 0),
      y: Number(n.y ?? 0),
    })),
    edges: (parsed.edges ?? []).map((e: Record<string, unknown>) => ({
      id: String(e.id ?? ""),
      type: (e.type as ExportCanvas["edges"][number]["type"]) ?? "parent-child",
      sourceId: String(e.sourceId ?? ""),
      targetId: String(e.targetId ?? ""),
    })),
  };
}

export async function batchExport(job: BatchExportJob): Promise<void> {
  const { pedigrees, format, onProgress } = job;
  let completed = 0;

  for (const pedigree of pedigrees) {
    const canvas = parseCanvasData(pedigree.canvasData);
    const info: ExportInfo = {
      title: pedigree.title,
      patientId: pedigree.patientId,
      notes: pedigree.notes,
    };

    switch (format) {
      case "pdf":
        await exportPDF(info, canvas);
        break;
      case "pptx":
        await exportPPTX(info, canvas);
        break;
      case "json":
        exportJSON(info, canvas);
        break;
      case "ped":
        downloadPED(info, canvas);
        break;
      case "hp":
        downloadHaploPainterCSV(info, canvas);
        break;
      case "clinical_report":
        await exportClinicalReport(info, canvas);
        break;
    }

    completed++;
    onProgress?.(completed, pedigrees.length);

    // Small delay between downloads to avoid browser throttling
    if (completed < pedigrees.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}
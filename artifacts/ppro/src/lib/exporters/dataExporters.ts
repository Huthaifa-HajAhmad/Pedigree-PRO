import { exportPedigreePpro } from "@workspace/api-client-react";
import { buildAdjacency, buildNodeMap } from "../layout-shared";
import type { ExportCanvas, ExportInfo } from "./types";
import { safeFilename, triggerDownload } from "./utils";

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

export async function exportPED(info: ExportInfo, canvas: ExportCanvas): Promise<void> {
  const adj = buildAdjacency(canvas.nodes, canvas.edges);
  const nodeMap = buildNodeMap(canvas.nodes);
  const famId = safeFilename(info.title) || "FAM1";

  // PED is tab/space delimited: an individual id containing whitespace would
  // silently shift every following column.
  const pedId = (id: string) => id.replace(/[\s\t\n\r]+/g, "_") || "0";

  const lines: string[] = [];
  for (const node of canvas.nodes) {
    const pIds = adj.parentsOf.get(node.id) ?? [];
    let fatherId = "0";
    let motherId = "0";
    for (const pId of pIds) {
      const parentNode = nodeMap.get(pId);
      if (parentNode) {
        if (parentNode.type === "male") {
          fatherId = pedId(parentNode.id);
        } else if (parentNode.type === "female") {
          motherId = pedId(parentNode.id);
        }
      }
    }

    // Pregnancy/SAB nodes are not individuals; PED has no representation for
    // them, so they degrade to "unknown sex" rather than being dropped.
    const sexCode = node.type === "male" ? "1" : node.type === "female" ? "2" : "0";
    const phenoCode = node.affected ? "2" : "1";

    lines.push(`${famId}\t${pedId(node.id)}\t${fatherId}\t${motherId}\t${sexCode}\t${phenoCode}`);
  }

  const content = lines.join("\n") + "\n";
  const blob = new Blob([content], { type: "text/plain" });
  await triggerDownload(blob, `${safeFilename(info.title)}.ped`);
}

export async function exportPPRO(pedigreeId: number, exporterKey: string, title: string): Promise<void> {
  const pproJson = await exportPedigreePpro(pedigreeId, exporterKey);
  const blob = new Blob([pproJson], { type: "application/json" });
  await triggerDownload(blob, `${safeFilename(title)}.ppro`);
}

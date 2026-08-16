import type { ExportCanvas, LegendItem } from "./types";

export function computeLegendItems(canvas: ExportCanvas): LegendItem[] {
  const items: LegendItem[] = [];
  const nt = new Set(canvas.nodes.map((n) => n.type));
  const et = new Set(canvas.edges.map((e) => e.type));

  if (nt.has("male"))       items.push({ shape: "square",     label: "Male" });
  if (nt.has("female"))     items.push({ shape: "circle",     label: "Female" });
  if (nt.has("unknown"))    items.push({ shape: "diamond",    label: "Unknown sex" });
  if (nt.has("pregnancy"))  items.push({ shape: "pregnancy",  label: "Pregnancy" });
  if (nt.has("sab"))        items.push({ shape: "sab",        label: "Spontaneous Abortion (SAB)" });
  if (canvas.nodes.some(n => n.stillbirth)) items.push({ shape: "stillbirth", label: "Stillbirth (SB)" });
  
  if (canvas.nodes.some((n) => n.affected && (!n.shading || n.shading === "solid") && !n.condition)) {
    items.push({ shape: "filled",  label: "Affected" });
  }
  if (canvas.nodes.some((n) => n.carrier && !n.affected)) items.push({ shape: "carrier", label: "Carrier" });
  if (canvas.nodes.some((n) => n.deceased))              items.push({ shape: "slash",   label: "Deceased" });
  if (canvas.nodes.some((n) => n.proband))               items.push({ shape: "arrow",   label: "Proband" });
  if (et.has("consanguinity")) items.push({ shape: "dbl-line", label: "Consanguineous union" });

  // Add custom shading patterns to export legend
  const shadingLabels = new Map<string, string>();
  canvas.nodes.forEach((n) => {
    if (n.shading) {
      if (n.shading === "solid" && !n.condition) {
        return;
      }
      const cond = n.condition || "";
      if (cond) {
        shadingLabels.set(n.shading, cond);
      } else if (!shadingLabels.has(n.shading)) {
        shadingLabels.set(n.shading, "...");
      }
    }
  });

  shadingLabels.forEach((label, shadingKey) => {
    items.push({ shape: `shading-${shadingKey}`, label });
  });

  return items;
}

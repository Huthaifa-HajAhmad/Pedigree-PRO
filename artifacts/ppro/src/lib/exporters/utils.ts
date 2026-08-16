import type { ExportNode, ExportEdge } from "./types";

export function safeFilename(title: string): string {
  return title.replace(/[^a-z0-9\-_. ]/gi, "_").replace(/\s+/g, "_").slice(0, 60);
}

export function browserDownload(blob: Blob, filename: string): void {
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

export async function triggerDownload(blob: Blob, filename: string): Promise<void> {
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

export function computeGenerations(nodes: ExportNode[], edges: ExportEdge[]): Map<string, number> {
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

export const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
export const toRoman = (n: number): string => ROMAN[n - 1] ?? `G${n}`;

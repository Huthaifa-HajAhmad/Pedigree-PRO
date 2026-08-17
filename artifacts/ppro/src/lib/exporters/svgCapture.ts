import type { ExportNode, ExportCanvas, ExportInfo } from "./types";
import { safeFilename, triggerDownload } from "./utils";

export function computeExportViewBox(nodes: ExportNode[]): { x: number; y: number; w: number; h: number } {
  if (nodes.length === 0) return { x: 0, y: 0, w: 800, h: 500 };

  let maxBelowCenter = 0;
  let maxSideExtent = 0;
  for (const n of nodes) {
    const hasLabel = !!n.label;
    const hasAge = !!(n.age || n.dob);
    const hasCondition = !!n.condition;

    let rows = 1;
    if (hasLabel) rows = 1;
    if (hasAge) rows = Math.max(rows, 2);
    if (hasCondition) rows = Math.max(rows, (hasAge ? 3 : 2));

    const textBelow = 22 + 13 + (rows - 1) * 11;
    maxBelowCenter = Math.max(maxBelowCenter, textBelow);

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

export function inlineComputedStyles(original: SVGSVGElement, clone: SVGSVGElement): void {
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
      for (let j = 0; j < cloneEl.style.length; j++) {
        const prop = cloneEl.style.item(j);
        const val = cloneEl.style.getPropertyValue(prop);
        if (val.includes("var(") || val.includes("hsl(")) {
          cloneEl.style.setProperty(prop, computed.getPropertyValue(prop));
        }
      }
    }
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

export function prepareSvgForExport(
  svgEl: SVGSVGElement | null,
  nodes: ExportNode[],
  options?: { transparentBg?: boolean }
): { clone: SVGSVGElement; vb: { x: number; y: number; w: number; h: number } } {
  if (!svgEl) throw new Error("No pedigree canvas SVG found on the page.");

  const clone = svgEl.cloneNode(true) as SVGSVGElement;

  inlineComputedStyles(svgEl, clone);

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

  clone.querySelectorAll('rect[data-canvas-background="true"]').forEach((el) => el.remove());
  clone.querySelectorAll('rect[fill="url(#grid-pattern)"]').forEach((el) => el.remove());
  clone.querySelectorAll('rect[data-grid-rect="true"]').forEach((el) => el.remove());

  clone.querySelectorAll("line").forEach((el) => {
    const dash = el.getAttribute("stroke-dasharray");
    if (dash && (dash.includes("8 5") || dash.includes("8, 5") || dash.replace(/[\s,]+/g, "") === "85")) {
      el.remove();
    }
    if (dash && (dash.includes("4 4") || dash.includes("4, 4") || dash.replace(/[\s,]+/g, "") === "44")) {
      el.remove();
    }
  });

  const validNodes = nodes.filter((n) => typeof n.x === "number" && !isNaN(n.x));
  const minX = validNodes.length > 0 ? Math.min(...validNodes.map((n) => n.x)) : null;

  if (minX !== null) {
    const railGroups = clone.querySelectorAll('g[data-generation-rail="true"]');
    railGroups.forEach((railGroup) => {
      railGroup.querySelector("rect")?.remove();
      railGroup.querySelector("line")?.remove();
    });
  } else {
    clone.querySelectorAll('g[data-generation-rail="true"]').forEach((g) => g.remove());
  }

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

export async function capturePedigreeImage(nodes: ExportNode[]): Promise<{ dataUrl: string; vb: { x: number; y: number; w: number; h: number } }> {
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

export async function exportSVG(
  info: ExportInfo,
  canvas: ExportCanvas,
  options?: { transparent?: boolean }
): Promise<void> {
  const svgEl = document.querySelector('svg[data-canvas-svg="true"]') ?? document.querySelector("svg");
  if (!svgEl) {
    throw new Error("No pedigree canvas SVG element found on the page.");
  }
  const { clone } = prepareSvgForExport(svgEl as SVGSVGElement, canvas.nodes, { transparentBg: options?.transparent });
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clone);
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  await triggerDownload(blob, `${safeFilename(info.title)}_pedigree.svg`);
}

export async function exportPNG(
  info: ExportInfo,
  canvas: ExportCanvas,
  options?: { transparent?: boolean }
): Promise<void> {
  const svgEl = document.querySelector('svg[data-canvas-svg="true"]') ?? document.querySelector("svg");
  if (!svgEl) {
    throw new Error("No pedigree canvas SVG element found on the page.");
  }
  let svgBlobUrl: string | null = null;
  try {
    const { clone, vb } = prepareSvgForExport(svgEl as SVGSVGElement, canvas.nodes, { transparentBg: options?.transparent });
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clone);
    const img = new Image();
    const blob = await new Promise<Blob>((resolve, reject) => {
      img.onload = () => {
        const scale = 4;
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
  } finally {
    if (svgBlobUrl) URL.revokeObjectURL(svgBlobUrl);
  }
}

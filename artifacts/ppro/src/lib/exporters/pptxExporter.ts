import { getQuadrantsForStyle } from "@/features/pedigree-editor/utils/helpers";
import { computeLegendItems } from "./legend";
import type { ExportNode, ExportCanvas, ExportInfo } from "./types";
import { safeFilename, triggerDownload } from "./utils";

export async function exportPPTX(info: ExportInfo, canvas: ExportCanvas): Promise<void> {
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
  const dw = SW - 2 * margin;
  const dh = SH - 2 * margin - 0.8;

  const xs = canvas.nodes.map(n => n.x);
  const ys = canvas.nodes.map(n => n.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

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

  const nodePosMap = new Map<string, { px: number; py: number }>();
  for (const n of canvas.nodes) {
    const px = margin + (dw - boxW * scale) / 2 + (n.x - boxMinX) * scale;
    const py = 0.8 + (dh - boxH * scale) / 2 + (n.y - boxMinY) * scale;
    nodePosMap.set(n.id, { px, py });

    const nodeS = n.stillbirth ? nodeSize * 0.65 : nodeSize;
    let shapeType = pptx.ShapeType.rect;
    let shapeOpts: any = {
      x: px - nodeS / 2,
      y: py - nodeS / 2,
      w: nodeS,
      h: nodeS,
      fill: { color: n.affected ? "0F172A" : "FFFFFF" },
      line: { color: "0F172A", width: 1.5 }
    };

    if (n.type === "female") {
      shapeType = pptx.ShapeType.ellipse;
    } else if (n.type === "unknown" || n.type === "pregnancy") {
      shapeType = pptx.ShapeType.diamond;
    } else if (n.type === "sab") {
      shapeType = pptx.ShapeType.triangle;
      shapeOpts.fill = { color: "64748B" };
      shapeOpts.line = { color: "64748B", width: 1 };
    }

    slide.addShape(shapeType, shapeOpts);

    if (n.carrier && !n.affected) {
      const dotSize = nodeS * 0.28;
      slide.addShape(pptx.ShapeType.ellipse, {
        x: px - dotSize / 2,
        y: py - dotSize / 2,
        w: dotSize,
        h: dotSize,
        fill: { color: "0D9488" },
        line: { color: "0D9488", width: 0 }
      });
    }

    if (n.deceased || n.stillbirth) {
      slide.addShape(pptx.ShapeType.line, {
        x: px - nodeS * 0.85,
        y: py,
        w: nodeS * 1.7,
        h: 0,
        rotate: -45,
        line: { color: "0F172A", width: 2 }
      });
    }

    if (n.stillbirth) {
      slide.addText("SB", {
        x: px + nodeS / 2,
        y: py + nodeS / 2 - 0.05,
        w: 0.2,
        h: 0.15,
        fontSize: 8,
        color: "0F172A",
        bold: true
      });
    }

    if (n.proband) {
      slide.addShape(pptx.ShapeType.line, {
        x: px - nodeS * 1.203,
        y: py + nodeS * 0.85,
        w: nodeS * 0.707,
        h: 0,
        rotate: -45,
        line: { color: "0F172A", width: 2, endArrowType: "triangle" }
      });
    }

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

  const childEdges = canvas.edges.filter(e => e.type === "parent-child");
  const parentPairMap = new Map<string, string[]>();
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

    slide.addShape(pptx.ShapeType.line, {
      x: mx,
      y: my,
      w: 0,
      h: midY - my,
      line: { color: "0F172A", width: 1.5 }
    });

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
    } else if (item.shape.startsWith("shading-")) {
      const style = item.shape.replace("shading-", "");
      slide.addShape(pptx.ShapeType.ellipse, {
        x: lx,
        y: ly - lSize / 2,
        w: lSize,
        h: lSize,
        fill: { color: "FFFFFF" },
        line: { color: "0F172A", width: 1 }
      });

      if (style === "solid") {
        slide.addShape(pptx.ShapeType.ellipse, {
          x: lx,
          y: ly - lSize / 2,
          w: lSize,
          h: lSize,
          fill: { color: "64748B" },
          line: { color: "64748B", width: 0 }
        });
      } else if (style && (style === "left-half" || style === "right-half" || style === "top-half" || style === "bottom-half" || style === "quadrant" || style.startsWith("q"))) {
        const [q1, q2, q3, q4] = getQuadrantsForStyle(style);
        if (q1) {
          slide.addShape(pptx.ShapeType.rect, {
            x: lx + lSize / 2,
            y: ly - lSize / 2,
            w: lSize / 2,
            h: lSize / 2,
            fill: { color: "64748B" },
            line: { color: "64748B", width: 0 }
          });
        }
        if (q2) {
          slide.addShape(pptx.ShapeType.rect, {
            x: lx,
            y: ly - lSize / 2,
            w: lSize / 2,
            h: lSize / 2,
            fill: { color: "64748B" },
            line: { color: "64748B", width: 0 }
          });
        }
        if (q3) {
          slide.addShape(pptx.ShapeType.rect, {
            x: lx,
            y: ly,
            w: lSize / 2,
            h: lSize / 2,
            fill: { color: "64748B" },
            line: { color: "64748B", width: 0 }
          });
        }
        if (q4) {
          slide.addShape(pptx.ShapeType.rect, {
            x: lx + lSize / 2,
            y: ly,
            w: lSize / 2,
            h: lSize / 2,
            fill: { color: "64748B" },
            line: { color: "64748B", width: 0 }
          });
        }
        slide.addShape(pptx.ShapeType.ellipse, {
          x: lx,
          y: ly - lSize / 2,
          w: lSize,
          h: lSize,
          fill: { color: "transparent" },
          line: { color: "0F172A", width: 1 }
        });
      } else if (style === "striped") {
        slide.addShape(pptx.ShapeType.line, {
          x: lx + 0.05,
          y: ly,
          w: lSize - 0.1,
          h: 0,
          line: { color: "64748B", width: 1.5 },
          rotate: 45
        });
      } else if (style === "cross-hatched") {
        slide.addShape(pptx.ShapeType.line, {
          x: lx + 0.05,
          y: ly,
          w: lSize - 0.1,
          h: 0,
          line: { color: "64748B", width: 1.2 },
          rotate: 45
        });
        slide.addShape(pptx.ShapeType.line, {
          x: lx + 0.05,
          y: ly,
          w: lSize - 0.1,
          h: 0,
          line: { color: "64748B", width: 1.2 },
          rotate: -45
        });
      } else if (style === "dots") {
        slide.addShape(pptx.ShapeType.ellipse, {
          x: lx + lSize / 2 - 0.03,
          y: ly - 0.03,
          w: 0.06,
          h: 0.06,
          fill: { color: "64748B" },
          line: { color: "64748B", width: 0 }
        });
      }
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

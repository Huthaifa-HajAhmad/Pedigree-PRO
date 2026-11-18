import { beforeEach, expect, it, vi } from "vitest";
import { exportPPTX } from "@/lib/exporters/pptxExporter";
import type { ExportNode } from "@/lib/exporters/types";

type Run = { text: string; options?: { italic?: boolean; breakLine?: boolean } };
const { texts } = vi.hoisted(() => ({ texts: [] as (string | Run[])[] }));
vi.mock("pptxgenjs", () => ({
  default: class {
    ShapeType = { rect: "rect", ellipse: "ellipse", diamond: "diamond", line: "line" };
    addSlide() {
      return {
        background: {},
        addShape() {},
        addText(text: string | Run[]) {
          texts.push(text);
        },
      };
    }
    async write() {
      return new Blob();
    }
  },
}));
vi.mock("@/lib/exporters/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/exporters/utils")>()),
  triggerDownload: vi.fn(),
}));
beforeEach(() => {
  texts.length = 0;
});

it.each(["+/-", undefined])("does not append a blank line to node details (%s)", async (genotype) => {
  const node: ExportNode = {
    id: "person",
    type: "male",
    affected: false,
    carrier: false,
    deceased: false,
    proband: false,
    label: "Person",
    age: "40",
    x: 100,
    y: 100,
    genotype,
  };
  await exportPPTX({ title: "Synthetic pedigree" }, { nodes: [node], edges: [] });
  const runs = texts.find((text): text is Run[] => Array.isArray(text));
  expect(runs).toBeDefined();
  expect(runs!.at(-1)!.options?.breakLine).toBe(false);
  expect(runs!.slice(0, -1).every((run) => run.options?.breakLine)).toBe(true);
  if (genotype) expect(runs!.at(-1)).toMatchObject({ text: "+/-", options: { italic: true } });
});

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NodeShape } from "@/features/pedigree-editor/canvas/NodeShape";
import type { PedigreeNode } from "@/features/pedigree-editor/canvas/types";
import { parseGenotypeSegments } from "@/lib/genotypeFormatting";

describe("parseGenotypeSegments", () => {
  it("keeps pure allele and chromosome symbols non-italic", () => {
    expect(parseGenotypeSegments("+/-")).toEqual([{ text: "+/-", italic: false }]);
    expect(parseGenotypeSegments("+/+")).toEqual([{ text: "+/+", italic: false }]);
    expect(parseGenotypeSegments("-/-")).toEqual([{ text: "-/-", italic: false }]);
    expect(parseGenotypeSegments("+/Y")).toEqual([{ text: "+/Y", italic: false }]);
    expect(parseGenotypeSegments("-/Y")).toEqual([{ text: "-/Y", italic: false }]);
    expect(parseGenotypeSegments("X/Y")).toEqual([{ text: "X/Y", italic: false }]);
  });

  it("italicises written gene names while keeping symbols upright", () => {
    expect(parseGenotypeSegments("BRCA1 +/-")).toEqual([
      { text: "BRCA1", italic: true },
      { text: " +/-", italic: false },
    ]);
    expect(parseGenotypeSegments("BRCA1: (+/-)")).toEqual([
      { text: "BRCA1", italic: true },
      { text: ": (+/-)", italic: false },
    ]);
    expect(parseGenotypeSegments("BRCA1-/-")).toEqual([
      { text: "BRCA1", italic: true },
      { text: "-/-", italic: false },
    ]);
    expect(parseGenotypeSegments("F8 +/Y")).toEqual([
      { text: "F8", italic: true },
      { text: " +/Y", italic: false },
    ]);
    expect(parseGenotypeSegments("HLA-B +/-")).toEqual([
      { text: "HLA-B", italic: true },
      { text: " +/-", italic: false },
    ]);
    expect(parseGenotypeSegments("BRCA1 +/+, TP53 +/-")).toEqual([
      { text: "BRCA1", italic: true },
      { text: " +/+, ", italic: false },
      { text: "TP53", italic: true },
      { text: " +/-", italic: false },
    ]);
  });

  it("does not italicise HGVS variants, karyotypes, or allele status words", () => {
    expect(parseGenotypeSegments("BRCA1 c.68_69del/+")).toEqual([
      { text: "BRCA1", italic: true },
      { text: " c.68_69del/+", italic: false },
    ]);
    expect(parseGenotypeSegments("CFTR ΔF508/+")).toEqual([
      { text: "CFTR", italic: true },
      { text: " ΔF508/+", italic: false },
    ]);
    expect(parseGenotypeSegments("46,XY")).toEqual([{ text: "46,XY", italic: false }]);
    expect(parseGenotypeSegments("BRCA1 (VUS)")).toEqual([
      { text: "BRCA1", italic: true },
      { text: " (VUS)", italic: false },
    ]);
    expect(parseGenotypeSegments("wt/mut")).toEqual([{ text: "wt/mut", italic: false }]);
    expect(parseGenotypeSegments("INS +/-")).toEqual([
      { text: "INS", italic: true },
      { text: " +/-", italic: false },
    ]);
  });
});

describe("NodeShape genotype rendering", () => {
  const baseNode: PedigreeNode = {
    id: "n1",
    type: "female",
    affected: false,
    carrier: true,
    deceased: false,
    proband: false,
    label: "",
    age: "",
    x: 0,
    y: 0,
  };

  const noop = vi.fn();

  it("renders written gene names italic and symbols normal in SVG", () => {
    const { container } = render(
      <svg>
        <NodeShape
          node={{ ...baseNode, genotype: "BRCA1 +/-", genotype2: "+/Y" }}
          selected={false}
          isLinkSource={false}
          invalid={false}
          onClick={noop}
          onDragStart={noop}
          onContextMenu={noop}
          onDoubleClick={noop}
        />
      </svg>,
    );

    const tspans = Array.from(container.querySelectorAll("tspan"));
    const brca = tspans.find((el) => el.textContent === "BRCA1");
    expect(brca).toBeDefined();
    expect(brca?.getAttribute("font-style")).toBe("italic");

    const nonGeneTspans = tspans.filter((el) => el.textContent !== "BRCA1");
    expect(nonGeneTspans.length).toBeGreaterThan(0);
    for (const el of nonGeneTspans) {
      expect(el.getAttribute("font-style")).toBe("normal");
    }
  });
});

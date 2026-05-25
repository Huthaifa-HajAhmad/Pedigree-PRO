import { describe, it, expect } from "vitest";
import { parseHaploPainterCSV, parseFile } from "@/lib/import-pedigree";

describe("parseHaploPainterCSV", () => {
  it("parses a basic 3-generation tab-delimited pedigree", () => {
    const lines = [
      "FAM001\t1\t0\t0\t1\t1\t0\t0\t0\t0\t.\t.\t.\t.\t.\t.\t.\t.\t.",
      "FAM001\t2\t0\t0\t2\t1\t0\t0\t0\t0\t.\t.\t.\t.\t.\t.\t.\t.\t.",
      "FAM001\t3\t1\t2\t1\t1\t0\t0\t0\t0\t.\t.\t.\t.\t.\t.\t.\t.\t.",
      "FAM001\t4\t1\t2\t2\t1\t0\t0\t0\t0\t.\t.\t.\t.\t.\t.\t.\t.\t.",
    ];
    const result = parseHaploPainterCSV(lines.join("\n"), "test.utf8");
    expect(result.warnings).toHaveLength(0);
    expect(result.canvasData.nodes).toHaveLength(4);
    expect(result.canvasData.edges).toHaveLength(5); // 1 couple + 4 parent-child
    const coupleEdges = result.canvasData.edges.filter((e) => e.type === "couple");
    expect(coupleEdges).toHaveLength(1);
  });

  it("parses deceased, proband, and SAB flags", () => {
    const lines = [
      "FAM001\t1\t0\t0\t1\t1\t1\t1\t1\t0\t.\t.\t.\t.\t.\t.\t.\t.\t.",
    ];
    const result = parseHaploPainterCSV(lines.join("\n"), "test.utf8");
    const node = result.canvasData.nodes[0];
    expect(node.deceased).toBe(true);
    expect(node.proband).toBe(true);
    expect(node.notes).toContain("(SAB)");
  });

  it("parses twin groups and sets twinGroup on edges", () => {
    const lines = [
      "FAM001\t1\t0\t0\t1\t1\t0\t0\t0\t0\t.\t.\t.\t.\t.\t.\t.\t.\t.",
      "FAM001\t2\t0\t0\t2\t1\t0\t0\t0\t0\t.\t.\t.\t.\t.\t.\t.\t.\t.",
      "FAM001\t3\t1\t2\t1\t1\t0\t0\t0\t0\tm_A\t.\t.\t.\t.\t.\t.\t.\t.",
      "FAM001\t4\t1\t2\t1\t1\t0\t0\t0\t0\tm_A\t.\t.\t.\t.\t.\t.\t.\t.",
      "FAM001\t5\t1\t2\t2\t1\t0\t0\t0\t0\t.\t.\t.\t.\t.\t.\t.\t.\t.",
    ];
    const result = parseHaploPainterCSV(lines.join("\n"), "test.utf8");
    const twinEdges = result.canvasData.edges.filter((e) => e.twinGroup === "A");
    expect(twinEdges).toHaveLength(4); // 2 children × 2 parents
    expect(twinEdges[0]?.twinType).toBe("m");
  });

  it("parses consanguinity and creates consanguinity edge", () => {
    const lines = [
      "FAM001\t1\t0\t0\t1\t1\t0\t0\t0\t0\t.\tC\t.\t.\t.\t.\t.\t.\t.",
      "FAM001\t2\t0\t0\t2\t1\t0\t0\t0\t0\t.\tC\t.\t.\t.\t.\t.\t.\t.",
      "FAM001\t3\t1\t2\t1\t1\t0\t0\t0\t0\t.\t.\t.\t.\t.\t.\t.\t.\t.",
    ];
    const result = parseHaploPainterCSV(lines.join("\n"), "test.utf8");
    const consangEdge = result.canvasData.edges.find((e) => e.type === "consanguinity");
    expect(consangEdge).toBeDefined();
  });

  it("collects text fields into notes", () => {
    const lines = [
      "FAM001\t1\t0\t0\t1\t1\t0\t0\t0\t0\t.\t.\tA\tB\tC\tD\tE\t.\t.",
    ];
    const result = parseHaploPainterCSV(lines.join("\n"), "test.utf8");
    expect(result.canvasData.nodes[0]?.notes).toContain("Inner: A");
    expect(result.canvasData.nodes[0]?.notes).toContain("Side: B");
    expect(result.canvasData.nodes[0]?.notes).toContain("C");
    expect(result.canvasData.nodes[0]?.notes).toContain("D");
    expect(result.canvasData.nodes[0]?.notes).toContain("E");
  });

  it("strips UTF-8 BOM", () => {
    const lines = [
      "FAM001\t1\t0\t0\t1\t1\t0\t0\t0\t0\t.\t.\t.\t.\t.\t.\t.\t.\t.",
    ];
    const bomContent = "\uFEFF" + lines.join("\n");
    const result = parseHaploPainterCSV(bomContent, "test.utf8");
    expect(result.canvasData.nodes).toHaveLength(1);
    expect(result.warnings).toHaveLength(0);
  });

  it("caps warnings at 20 errors", () => {
    const lines = Array.from({ length: 25 }, (_, i) =>
      `FAM001\t${i + 1}\t0\t0\t9\t1\t0\t0\t0\t0\t.\t.\t.\t.\t.\t.\t.\t.\t.`
    );
    const result = parseHaploPainterCSV(lines.join("\n"), "test.utf8");
    expect(result.warnings.length).toBeGreaterThanOrEqual(20);
    expect(result.warnings.length).toBeLessThanOrEqual(25);
  });
});

describe("parseFile auto-detect for HaploPainter CSV", () => {
  it("routes tab-delimited with gender code to parseHaploPainterCSV", () => {
    const content = "FAM001\t1\t0\t0\t1\t1\t0\t0\t0\t0\t.\t.\t.\t.\t.\t.\t.\t.\t.";
    const result = parseFile(content, "family.csv");
    expect(result.canvasData.nodes).toHaveLength(1);
    expect(result.suggestedTitle).toContain("FAM001");
  });

  it("routes headed .utf8 file to parseHaploPainterCSV via header peeking", () => {
    const lines = [
      "FAMILY\tPERSON\tFATHER\tMOTHER\tGENDER\tAFFECTION\tIS_DECEASED\tIS_PROBAND\t.\t.\t.\t.\t.\t.\t.\t.\t.\t.\t.",
      "FAM001\t1\t0\t0\t1\t1\t0\t0\t0\t0\t.\t.\t.\t.\t.\t.\t.\t.\t.",
      "FAM001\t2\t0\t0\t2\t1\t0\t0\t0\t0\t.\t.\t.\t.\t.\t.\t.\t.\t.",
    ];
    const result = parseFile(lines.join("\n"), "family.utf8");
    expect(result.canvasData.nodes).toHaveLength(2);
    expect(result.suggestedTitle).toContain("FAM001");
  });

  it("routes .utf8 extension to HaploPainter parser", () => {
    const content = "Individual: ID=1, Sex=Male, Father=0, Mother=0";
    const result = parseFile(content, "family.utf8");
    expect(result.canvasData.nodes).toHaveLength(1);
  });
});

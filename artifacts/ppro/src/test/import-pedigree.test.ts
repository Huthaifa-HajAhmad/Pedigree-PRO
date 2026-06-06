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

describe("parseHaploPainterCSV robustness enhancements", () => {
  it("parses semicolon-delimited files correctly", () => {
    const lines = [
      "FAM001;1;0;0;1;1;0;0;0;0;.;.;.;.;.;.;.;.;."
    ];
    const result = parseHaploPainterCSV(lines.join("\n"), "test.csv");
    expect(result.canvasData.nodes).toHaveLength(1);
    expect(result.canvasData.nodes[0]?.label).toBe("1");
  });

  it("parses comma-delimited files correctly", () => {
    const lines = [
      "FAM001,1,0,0,1,1,0,0,0,0,.,.,.,.,.,.,.,.,."
    ];
    const result = parseHaploPainterCSV(lines.join("\n"), "test.csv");
    expect(result.canvasData.nodes).toHaveLength(1);
    expect(result.canvasData.nodes[0]?.label).toBe("1");
  });

  it("parses double-quoted fields correctly", () => {
    const lines = [
      "\"FAM001\"\t\"1\"\t\"0\"\t\"0\"\t\"1\"\t\"1\"\t\"0\"\t\"0\"\t\"0\"\t\"0\"\t\".\"\t\".\"\t\".\"\t\".\"\t\".\"\t\".\"\t\".\"\t\".\"\t\".\""
    ];
    const result = parseHaploPainterCSV(lines.join("\n"), "test.csv");
    expect(result.canvasData.nodes).toHaveLength(1);
    expect(result.canvasData.nodes[0]?.label).toBe("1");
  });

  it("detects and skips prefix-free header rows without generating warnings", () => {
    const lines = [
      "FAMILY\tPERSON\tFATHER\tMOTHER\tGENDER\tAFFECTION\tIS_DECEASED",
      "FAM001\t1\t0\t0\t1\t1\t0"
    ];
    const result = parseHaploPainterCSV(lines.join("\n"), "test.csv");
    expect(result.canvasData.nodes).toHaveLength(1);
    expect(result.warnings).toHaveLength(0);
  });

  it("parses full-word and case-insensitive gender and affection codes", () => {
    const lines = [
      "FAM001\t1\t0\t0\tMale\tAffected\t0",
      "FAM001\t2\t0\t0\tfemale\tunaffected\t0",
      "FAM001\t3\t0\t0\tunknown\t-9\t0"
    ];
    const result = parseHaploPainterCSV(lines.join("\n"), "test.csv");
    expect(result.canvasData.nodes).toHaveLength(3);
    expect(result.canvasData.nodes[0]?.type).toBe("male");
    expect(result.canvasData.nodes[1]?.type).toBe("female");
    expect(result.canvasData.nodes[2]?.type).toBe("unknown");
  });

  it("parses word-based and case-insensitive boolean flags", () => {
    const lines = [
      "FAM001\t1\t0\t0\t1\t1\tdeceased\tSAB\tproband\tadopted\t.\t.\t.\t.\t.\t.\t.\t.\t."
    ];
    const result = parseHaploPainterCSV(lines.join("\n"), "test.csv");
    expect(result.canvasData.nodes).toHaveLength(1);
    const node = result.canvasData.nodes[0]!;
    expect(node.deceased).toBe(true);
    expect(node.proband).toBe(true);
    expect(node.adopted).toBe(true);
    expect(node.notes).toContain("(SAB)");
  });

  it("parses twin groups with dashes or no delimiters", () => {
    const lines = [
      "FAM001\t1\t0\t0\t1\t1\t0\t0\t0\t0\tm-A\t.\t.\t.\t.\t.\t.\t.\t.",
      "FAM001\t2\t0\t0\t1\t1\t0\t0\t0\t0\tmA\t.\t.\t.\t.\t.\t.\t.\t."
    ];
    const result = parseHaploPainterCSV(lines.join("\n"), "test.csv");
    expect(result.canvasData.nodes).toHaveLength(2);
  });

  it("warns when referenced parents are missing from the file", () => {
    const lines = [
      "FAM001\t1\tFATHER_1\tMOTHER_1\t1\t1\t0"
    ];
    const result = parseHaploPainterCSV(lines.join("\n"), "test.csv");
    expect(result.canvasData.nodes).toHaveLength(1);
    expect(result.warnings).toContain('Individual "1" references father "FATHER_1" but this father is not defined in the file.');
    expect(result.warnings).toContain('Individual "1" references mother "MOTHER_1" but this mother is not defined in the file.');
  });

  it("aligns spouses and sibling groups horizontally on the same Y-row", () => {
    const lines = [
      "1\tI:1\t1\t2\t1\t1\t0\t0\t0\t0\t.\t.\t.\t.\t.\t.\t.\t.\t.",
      "1\tI:2\t0\t0\t2\t1\t0\t0\t0\t0\t.\t.\t.\t.\t.\t.\t.\t.\t.",
      "1\tI:3\t1\t2\t1\t1\t0\t0\t0\t0\t.\t.\t.\t.\t.\t.\t.\t.\t.",
      "1\tI:4\t0\t0\t2\t1\t0\t0\t0\t0\t.\t.\t.\t.\t.\t.\t.\t.\t.",
      "1\tII:1\tI:3\tI:4\t1\t1\t0\t0\t0\t0\t.\t.\t.\t.\t.\t.\t.\t.\t.",
      "1\tII:2\tI:1\tI:2\t2\t1\t0\t0\t0\t0\t.\t.\t.\t.\t.\t.\t.\t.\t.",
      "1\tII:3\tI:1\tI:2\t1\t1\t0\t0\t0\t0\t.\t.\t.\t.\t.\t.\t.\t.\t.",
      "1\tII:4\tI:3\tI:4\t2\t1\t0\t0\t0\t0\t.\t.\t.\t.\t.\t.\t.\t.\t.",
      "1\t1\t0\t0\t1\t1\t0\t0\t0\t0\t.\t.\t.\t.\t.\t.\t.\t.\t.",
      "1\t2\t0\t0\t2\t1\t0\t0\t0\t0\t.\t.\t.\t.\t.\t.\t.\t.\t."
    ];
    const result = parseHaploPainterCSV(lines.join("\n"), "test.csv");
    const nodeMap = new Map(result.canvasData.nodes.map(n => [n.label, n]));

    const checkSpouses = (id1: string, id2: string) => {
      const n1 = nodeMap.get(id1);
      const n2 = nodeMap.get(id2);
      expect(n1).toBeDefined();
      expect(n2).toBeDefined();
      expect(n1!.y).toBe(n2!.y);
    };

    checkSpouses("1", "2");
    checkSpouses("I:1", "I:2");
    checkSpouses("I:3", "I:4");
    checkSpouses("II:1", "II:2");
    checkSpouses("II:3", "II:4");

    expect(nodeMap.get("II:1")!.y).toBe(nodeMap.get("II:2")!.y);
    expect(nodeMap.get("II:3")!.y).toBe(nodeMap.get("II:4")!.y);
    expect(nodeMap.get("II:1")!.y).toBe(nodeMap.get("II:3")!.y);
  });

  it("correctly parses and layouts hpcsv_family-1.utf8 (cousin marriages)", () => {
    const fs = require("fs");
    const content = fs.readFileSync("c:/Users/HSA19/Pedigree PRO/hpcsv_family-1.utf8", "utf8");
    const result = parseFile(content, "hpcsv_family-1.utf8");
    expect(result.warnings).toHaveLength(0);
    
    const nodeMap = new Map(result.canvasData.nodes.map(n => [n.label, n]));
    
    // Spouses must share the same Y row
    const checkSpouses = (id1: string, id2: string) => {
      const n1 = nodeMap.get(id1);
      const n2 = nodeMap.get(id2);
      expect(n1).toBeDefined();
      expect(n2).toBeDefined();
      expect(n1!.y).toBe(n2!.y);
    };
    
    checkSpouses("1", "2");
    checkSpouses("I:1", "I:2");
    checkSpouses("I:3", "I:4");
    checkSpouses("II:1", "II:2");
    checkSpouses("II:3", "II:4");

    // Sibling groups for III:1-8 and III:9-12 must not overlap in X space
    const child1_8 = Array.from({ length: 8 }, (_, i) => nodeMap.get(`III:${i + 1}`)!);
    const child9_12 = Array.from({ length: 4 }, (_, i) => nodeMap.get(`III:${i + 9}`)!);
    
    const maxX_1_8 = Math.max(...child1_8.map(c => c.x));
    const minX_9_12 = Math.min(...child9_12.map(c => c.x));
    
    // There must be a gap between the two sibships to prevent sibling bar merging
    expect(minX_9_12).toBeGreaterThan(maxX_1_8);
  });
});

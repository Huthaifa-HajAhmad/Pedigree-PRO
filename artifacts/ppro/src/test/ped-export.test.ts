import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { exportPED } from "@/lib/export-pedigree";
import { exportPED as exportPEDString } from "@/lib/export-formats";
import type { ExportCanvas } from "@/lib/export-pedigree";

describe("exportPED", () => {
  let createdElement: any;
  let clicked = false;

  beforeEach(() => {
    createdElement = {
      style: {},
      click: () => { clicked = true; },
      setAttribute: () => {},
    };
    clicked = false;

    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:mock-url"),
      revokeObjectURL: vi.fn(),
    });

    vi.stubGlobal("document", {
      createElement: vi.fn(() => createdElement),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exports a basic pedigree structure correctly as tab-separated PED format", async () => {
    const canvas: ExportCanvas = {
      nodes: [
        { id: "father", type: "male", affected: false, carrier: false, deceased: false, proband: false, label: "Father", age: "40", x: 100, y: 100 },
        { id: "mother", type: "female", affected: false, carrier: false, deceased: false, proband: false, label: "Mother", age: "38", x: 220, y: 100 },
        { id: "child", type: "unknown", affected: true, carrier: false, deceased: false, proband: true, label: "Proband", age: "10", x: 160, y: 220 },
      ],
      edges: [
        { id: "e1", type: "couple", sourceId: "father", targetId: "mother" },
        { id: "e2", type: "parent-child", sourceId: "father", targetId: "child" },
        { id: "e3", type: "parent-child", sourceId: "mother", targetId: "child" },
      ],
    };

    let passedBlob: Blob | null = null;
    URL.createObjectURL = vi.fn((blob: Blob) => {
      passedBlob = blob;
      return "blob:mock-url";
    });

    await exportPED({ title: "My test pedigree", patientId: null, notes: null }, canvas);

    expect(passedBlob).not.toBeNull();
    
    const text = await (passedBlob as any).text();
    const lines = text.trim().split("\n");
    expect(lines).toHaveLength(3);

    // Columns: FamilyID IndividualID FatherID MotherID Sex Phenotype
    expect(lines[0]).toBe("My_test_pedigree\tfather\t0\t0\t1\t1");
    expect(lines[1]).toBe("My_test_pedigree\tmother\t0\t0\t2\t1");
    expect(lines[2]).toBe("My_test_pedigree\tchild\tfather\tmother\t0\t2");

    expect(createdElement.download).toBe("My_test_pedigree.ped");
    expect(clicked).toBe(true);
  });
});

describe("exportPED (batch format, string output)", () => {
  const canvas: ExportCanvas = {
    nodes: [
      { id: "n1", type: "male", affected: false, carrier: false, deceased: false, proband: false, label: "Pat. GF", age: "", x: 0, y: 0 },
      { id: "n2", type: "female", affected: false, carrier: false, deceased: false, proband: false, label: "Pat GF", age: "", x: 0, y: 0 },
      { id: "n3", type: "unknown", affected: true, carrier: false, deceased: false, proband: true, label: "Proband", age: "", x: 0, y: 0 },
    ],
    edges: [
      { id: "e1", type: "parent-child", sourceId: "n1", targetId: "n3" },
      { id: "e2", type: "parent-child", sourceId: "n2", targetId: "n3" },
    ],
  };

  it("emits whitespace-free, unique individual ids and links parents by them", () => {
    const rows = exportPEDString({ title: "Fam", patientId: null, notes: null }, canvas)
      .split("\n")
      .filter((l) => !l.startsWith("#"));

    expect(rows).toHaveLength(3);
    for (const row of rows) {
      const cols = row.split("\t");
      expect(cols).toHaveLength(6);
      expect(cols[1]).not.toMatch(/\s/);
    }

    const ids = rows.map((r) => r.split("\t")[1]);
    expect(new Set(ids).size).toBe(ids.length);

    const child = rows.find((r) => r.includes("\tProband\t"))!;
    const cols = child.split("\t");
    expect(cols[2]).toBe(ids[0]);
    expect(cols[3]).toBe(ids[1]);
  });
});

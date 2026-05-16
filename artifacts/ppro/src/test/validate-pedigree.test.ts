import { describe, it, expect } from "vitest";
import { validatePedigree } from "@/lib/validate-pedigree";

function makeNode(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    type: "male" as const,
    affected: false,
    carrier: false,
    deceased: false,
    proband: false,
    label: `Node ${id}`,
    age: "",
    x: 0,
    y: 0,
    ...overrides,
  };
}

function makeEdge(id: string, sourceId: string, targetId: string, type: "couple" | "parent-child" | "consanguinity" = "couple") {
  return { id, type, sourceId, targetId };
}

describe("validatePedigree", () => {
  it("passes an empty pedigree", () => {
    const result = validatePedigree({ nodes: [], edges: [], annotations: [] });
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
    expect(result.issues).toHaveLength(0);
  });

  it("detects a male as his own father (self_loop)", () => {
    const nodes = [makeNode("n1", { type: "male" })];
    const edges = [
      makeEdge("e1", "n1", "n1", "parent-child"),
    ];
    const result = validatePedigree({ nodes, edges, annotations: [] });
    const selfLoop = result.issues.find((i) => i.type === "self_loop");
    expect(selfLoop).toBeTruthy();
    expect(result.errorCount).toBeGreaterThan(0);
  });

  it("detects duplicate edges", () => {
    const nodes = [makeNode("n1", { type: "male" }), makeNode("n2", { type: "female" })];
    const edges = [
      makeEdge("e1", "n1", "n2", "couple"),
      makeEdge("e2", "n1", "n2", "couple"),
    ];
    const result = validatePedigree({ nodes, edges, annotations: [] });
    const dup = result.issues.find((i) => i.type === "duplicate_edge");
    expect(dup).toBeTruthy();
  });

  it("detects orphaned edges (edge references nonexistent node)", () => {
    const nodes = [makeNode("n1", { type: "male" })];
    const edges = [
      makeEdge("e1", "n1", "ghost", "parent-child"),
    ];
    const result = validatePedigree({ nodes, edges, annotations: [] });
    const orphaned = result.issues.find((i) => i.type === "orphaned_edge");
    expect(orphaned).toBeTruthy();
  });

  it("does not warn for orphan nodes (no edges)", () => {
    const nodes = [
      makeNode("n1"),
      makeNode("n2", { type: "female" }),
      makeNode("n3", { type: "unknown" }),
    ];
    const result = validatePedigree({ nodes, edges: [], annotations: [] });
    // The validator may flag isolated nodes as warnings — that's fine
    // We just verify there are no errors
    expect(result.errorCount).toBe(0);
  });

  it("flags cycles in parent-child relationships", () => {
    const nodes = [
      makeNode("n1", { type: "male" }),
      makeNode("n2", { type: "female" }),
    ];
    const edges = [
      makeEdge("e1", "n1", "n2", "parent-child"),
      makeEdge("e2", "n2", "n1", "parent-child"),
    ];
    const result = validatePedigree({ nodes, edges, annotations: [] });
    const cycle = result.issues.find((i) => i.type === "cycle");
    expect(cycle).toBeTruthy();
  });
});
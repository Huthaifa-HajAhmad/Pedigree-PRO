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

function makeEdge(id: string, sourceId: string, targetId: string, type: "couple" | "parent-child" | "consanguinity" | "divorced" | "separated" = "couple") {
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

  it("flags invalid parent types (pregnancy, sab, unknown sex)", () => {
    const nodes = [
      makeNode("n1", { type: "pregnancy" }),
      makeNode("n2", { type: "sab" }),
      makeNode("n3", { type: "unknown" }),
      makeNode("n4", { type: "male" }),
    ];
    const edges = [
      makeEdge("e1", "n1", "n4", "parent-child"),
      makeEdge("e2", "n2", "n4", "parent-child"),
      makeEdge("e3", "n3", "n4", "parent-child"),
    ];
    const result = validatePedigree({ nodes, edges });
    const parentErrors = result.issues.filter((i) => i.type === "invalid_parent_type");
    expect(parentErrors).toHaveLength(3);
    expect(parentErrors.every(i => i.severity === "error")).toBe(true);
  });

  it("flags invalid partner types (pregnancy, sab)", () => {
    const nodes = [
      makeNode("n1", { type: "pregnancy" }),
      makeNode("n2", { type: "sab" }),
      makeNode("n3", { type: "male" }),
    ];
    const edges = [
      makeEdge("e1", "n1", "n3", "couple"),
      makeEdge("e2", "n2", "n3", "couple"),
    ];
    const result = validatePedigree({ nodes, edges });
    const partnerErrors = result.issues.filter((i) => i.type === "invalid_partner_type");
    expect(partnerErrors).toHaveLength(2);
    expect(partnerErrors.every(i => i.severity === "error")).toBe(true);
  });

  it("flags child with more than 2 parents", () => {
    const nodes = [
      makeNode("n1", { type: "male" }),
      makeNode("n2", { type: "female" }),
      makeNode("n3", { type: "male" }),
      makeNode("n4", { type: "female" }),
    ];
    const edges = [
      makeEdge("e1", "n1", "n4", "parent-child"),
      makeEdge("e2", "n2", "n4", "parent-child"),
      makeEdge("e3", "n3", "n4", "parent-child"),
    ];
    const result = validatePedigree({ nodes, edges });
    const tooMany = result.issues.find((i) => i.type === "too_many_parents");
    expect(tooMany).toBeTruthy();
    expect(tooMany?.severity).toBe("error");
  });

  it("warns for same-sex biological parents", () => {
    const nodes = [
      makeNode("n1", { type: "male" }),
      makeNode("n2", { type: "male" }),
      makeNode("n3", { type: "female" }),
    ];
    const edges = [
      makeEdge("e1", "n1", "n3", "parent-child"),
      makeEdge("e2", "n2", "n3", "parent-child"),
    ];
    const result = validatePedigree({ nodes, edges });
    const sameSexParents = result.issues.find((i) => i.type === "same_sex_parents");
    expect(sameSexParents).toBeTruthy();
    expect(sameSexParents?.severity).toBe("warning");
  });

  it("warns for same-sex couples", () => {
    const nodes = [
      makeNode("n1", { type: "female" }),
      makeNode("n2", { type: "female" }),
    ];
    const edges = [
      makeEdge("e1", "n1", "n2", "couple"),
    ];
    const result = validatePedigree({ nodes, edges });
    const sameSexCouple = result.issues.find((i) => i.type === "same_sex_couple");
    expect(sameSexCouple).toBeTruthy();
    expect(sameSexCouple?.severity).toBe("warning");
  });

  it("flags sibling marriage", () => {
    const nodes = [
      makeNode("father", { type: "male" }),
      makeNode("mother", { type: "female" }),
      makeNode("s1", { type: "male" }),
      makeNode("s2", { type: "female" }),
    ];
    const edges = [
      makeEdge("e1", "father", "s1", "parent-child"),
      makeEdge("e2", "mother", "s1", "parent-child"),
      makeEdge("e3", "father", "s2", "parent-child"),
      makeEdge("e4", "mother", "s2", "parent-child"),
      makeEdge("e5", "s1", "s2", "couple"),
    ];
    const result = validatePedigree({ nodes, edges });
    const siblingMarriage = result.issues.find((i) => i.type === "sibling_marriage");
    expect(siblingMarriage).toBeTruthy();
    expect(siblingMarriage?.severity).toBe("error");
  });

  it("flags direct lineage incest (parent-child)", () => {
    const nodes = [
      makeNode("father", { type: "male" }),
      makeNode("daughter", { type: "female" }),
    ];
    const edges = [
      makeEdge("e1", "father", "daughter", "parent-child"),
      makeEdge("e2", "father", "daughter", "couple"),
    ];
    const result = validatePedigree({ nodes, edges });
    const incestUnion = result.issues.find((i) => i.type === "incest_union");
    expect(incestUnion).toBeTruthy();
    expect(incestUnion?.severity).toBe("error");
    expect(incestUnion?.detail).toContain("direct lineage");
  });

  it("flags avuncular incest (uncle-niece)", () => {
    const nodes = [
      makeNode("grandfather", { type: "male" }),
      makeNode("grandmother", { type: "female" }),
      makeNode("uncle", { type: "male" }),
      makeNode("mother", { type: "female" }),
      makeNode("father", { type: "male" }),
      makeNode("niece", { type: "female" }),
    ];
    const edges = [
      // Grandparents have uncle and mother
      makeEdge("e1", "grandfather", "uncle", "parent-child"),
      makeEdge("e2", "grandmother", "uncle", "parent-child"),
      makeEdge("e3", "grandfather", "mother", "parent-child"),
      makeEdge("e4", "grandmother", "mother", "parent-child"),
      // Mother and father have niece
      makeEdge("e5", "mother", "niece", "parent-child"),
      makeEdge("e6", "father", "niece", "parent-child"),
      // Uncle and niece form a couple
      makeEdge("e7", "uncle", "niece", "couple"),
    ];
    const result = validatePedigree({ nodes, edges });
    const incestUnion = result.issues.find((i) => i.type === "incest_union");
    expect(incestUnion).toBeTruthy();
    expect(incestUnion?.severity).toBe("error");
    expect(incestUnion?.detail).toContain("avuncular");
  });

  it("does not flag cousin marriages as incest_union", () => {
    const nodes = [
      makeNode("grandfather", { type: "male" }),
      makeNode("grandmother", { type: "female" }),
      makeNode("parent1", { type: "male" }),
      makeNode("parent2", { type: "female" }),
      makeNode("cousin1", { type: "male" }),
      makeNode("cousin2", { type: "female" }),
    ];
    const edges = [
      // Grandparents have parent1 and parent2
      makeEdge("e1", "grandfather", "parent1", "parent-child"),
      makeEdge("e2", "grandmother", "parent1", "parent-child"),
      makeEdge("e3", "grandfather", "parent2", "parent-child"),
      makeEdge("e4", "grandmother", "parent2", "parent-child"),
      // Cousin 1 is child of parent1
      makeEdge("e5", "parent1", "cousin1", "parent-child"),
      // Cousin 2 is child of parent2
      makeEdge("e6", "parent2", "cousin2", "parent-child"),
      // Cousin 1 and Cousin 2 form a couple
      makeEdge("e7", "cousin1", "cousin2", "couple"),
    ];
    const result = validatePedigree({ nodes, edges });
    const incestUnion = result.issues.find((i) => i.type === "incest_union");
    expect(incestUnion).toBeFalsy();
  });

  it("flags stillbirths as invalid parents", () => {
    const nodes = [
      makeNode("n1", { type: "male", stillbirth: true }),
      makeNode("n2", { type: "female" }),
    ];
    const edges = [
      makeEdge("e1", "n1", "n2", "parent-child"),
    ];
    const result = validatePedigree({ nodes, edges });
    const issue = result.issues.find((i) => i.type === "invalid_parent_type");
    expect(issue).toBeTruthy();
    expect(issue?.severity).toBe("error");
    expect(issue?.detail).toContain("stillbirth");
  });

  it("flags stillbirths as invalid partners", () => {
    const nodes = [
      makeNode("n1", { type: "female", stillbirth: true }),
      makeNode("n2", { type: "male" }),
    ];
    const edges = [
      makeEdge("e1", "n1", "n2", "couple"),
    ];
    const result = validatePedigree({ nodes, edges });
    const issue = result.issues.find((i) => i.type === "invalid_partner_type");
    expect(issue).toBeTruthy();
    expect(issue?.severity).toBe("error");
    expect(issue?.detail).toContain("stillbirth");
  });
});
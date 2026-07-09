import { describe, it, expect } from "vitest";
import { calculateInbreeding } from "@/lib/inbreeding";
import type { PedigreeNode, PedigreeEdge } from "@/features/pedigree-editor/canvas/types";

describe("calculateInbreeding", () => {
  it("returns 0.25 (25%) inbreeding coefficient for sibling offspring", () => {
    const nodes: PedigreeNode[] = [
      { id: "pg1", type: "male", affected: false, carrier: false, deceased: false, proband: false, label: "GF", age: "", x: 0, y: 0 },
      { id: "pg2", type: "female", affected: false, carrier: false, deceased: false, proband: false, label: "GM", age: "", x: 0, y: 0 },
      { id: "s1", type: "male", affected: false, carrier: false, deceased: false, proband: false, label: "Father", age: "", x: 0, y: 0 },
      { id: "s2", type: "female", affected: false, carrier: false, deceased: false, proband: false, label: "Mother", age: "", x: 0, y: 0 },
      { id: "c", type: "unknown", affected: false, carrier: false, deceased: false, proband: true, label: "Child", age: "", x: 0, y: 0 },
    ];
    const edges: PedigreeEdge[] = [
      { id: "e1", type: "parent-child", sourceId: "pg1", targetId: "s1" },
      { id: "e2", type: "parent-child", sourceId: "pg2", targetId: "s1" },
      { id: "e3", type: "parent-child", sourceId: "pg1", targetId: "s2" },
      { id: "e4", type: "parent-child", sourceId: "pg2", targetId: "s2" },
      { id: "e5", type: "parent-child", sourceId: "s1", targetId: "c" },
      { id: "e6", type: "parent-child", sourceId: "s2", targetId: "c" },
    ];

    const results = calculateInbreeding(nodes, edges);
    expect(results).toHaveLength(1);
    expect(results[0].nodeId).toBe("c");
    expect(results[0].fValue).toBe(0.25);
  });

  it("returns 0.0625 (6.25%) inbreeding coefficient for first-cousin offspring", () => {
    const nodes: PedigreeNode[] = [
      { id: "gp1", type: "male", affected: false, carrier: false, deceased: false, proband: false, label: "GP1", age: "", x: 0, y: 0 },
      { id: "gp2", type: "female", affected: false, carrier: false, deceased: false, proband: false, label: "GP2", age: "", x: 0, y: 0 },
      
      { id: "sib1", type: "male", affected: false, carrier: false, deceased: false, proband: false, label: "Sib1", age: "", x: 0, y: 0 },
      { id: "sp1", type: "female", affected: false, carrier: false, deceased: false, proband: false, label: "Sp1", age: "", x: 0, y: 0 },
      
      { id: "sib2", type: "female", affected: false, carrier: false, deceased: false, proband: false, label: "Sib2", age: "", x: 0, y: 0 },
      { id: "sp2", type: "male", affected: false, carrier: false, deceased: false, proband: false, label: "Sp2", age: "", x: 0, y: 0 },
      
      { id: "c1", type: "male", affected: false, carrier: false, deceased: false, proband: false, label: "C1 (Father)", age: "", x: 0, y: 0 },
      { id: "c2", type: "female", affected: false, carrier: false, deceased: false, proband: false, label: "C2 (Mother)", age: "", x: 0, y: 0 },
      
      { id: "child", type: "unknown", affected: false, carrier: false, deceased: false, proband: true, label: "Child", age: "", x: 0, y: 0 },
    ];
    const edges: PedigreeEdge[] = [
      // gp1/gp2 parents of sib1 and sib2
      { id: "e1", type: "parent-child", sourceId: "gp1", targetId: "sib1" },
      { id: "e2", type: "parent-child", sourceId: "gp2", targetId: "sib1" },
      { id: "e3", type: "parent-child", sourceId: "gp1", targetId: "sib2" },
      { id: "e4", type: "parent-child", sourceId: "gp2", targetId: "sib2" },
      
      // c1 child of sib1 + sp1
      { id: "e5", type: "parent-child", sourceId: "sib1", targetId: "c1" },
      { id: "e6", type: "parent-child", sourceId: "sp1", targetId: "c1" },
      
      // c2 child of sib2 + sp2
      { id: "e7", type: "parent-child", sourceId: "sib2", targetId: "c2" },
      { id: "e8", type: "parent-child", sourceId: "sp2", targetId: "c2" },
      
      // child child of c1 + c2
      { id: "e9", type: "parent-child", sourceId: "c1", targetId: "child" },
      { id: "e10", type: "parent-child", sourceId: "c2", targetId: "child" },
    ];

    const results = calculateInbreeding(nodes, edges);
    expect(results).toHaveLength(1);
    expect(results[0].nodeId).toBe("child");
    expect(results[0].fValue).toBe(0.0625);
  });

  it("returns 0 for non-inbred pedigrees", () => {
    const nodes: PedigreeNode[] = [
      { id: "f", type: "male", affected: false, carrier: false, deceased: false, proband: false, label: "Father", age: "", x: 0, y: 0 },
      { id: "m", type: "female", affected: false, carrier: false, deceased: false, proband: false, label: "Mother", age: "", x: 0, y: 0 },
      { id: "c", type: "unknown", affected: false, carrier: false, deceased: false, proband: true, label: "Child", age: "", x: 0, y: 0 },
    ];
    const edges: PedigreeEdge[] = [
      { id: "e1", type: "parent-child", sourceId: "f", targetId: "c" },
      { id: "e2", type: "parent-child", sourceId: "m", targetId: "c" },
    ];

    const results = calculateInbreeding(nodes, edges);
    expect(results).toHaveLength(0);
  });
});

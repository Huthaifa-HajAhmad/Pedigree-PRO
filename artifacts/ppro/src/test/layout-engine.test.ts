import { describe, it, expect } from "vitest";
import {
  computeSubtreeBBox,
  detectRowCollisions,
  resolveAllCollisions,
  recenterParents,
  buildAdjacency,
  buildNodeMap,
  ROW_TOLERANCE,
} from "../lib/layout-engine";
import { PedigreeNode, PedigreeEdge } from "@/features/pedigree-editor/canvas/types";

// Base node default
const baseNode = {
  affected: false,
  carrier: false,
  deceased: false,
  proband: false,
  label: "",
  age: "",
};

describe("layout-engine", () => {
  describe("computeSubtreeBBox", () => {
    it("computes bbox for a 1-node tree", () => {
      const nodes: PedigreeNode[] = [{ id: "n1", x: 100, y: 100, type: "male", ...baseNode }];
      const edges: PedigreeEdge[] = [];
      const adj = buildAdjacency(nodes, edges);
      const nodeMap = buildNodeMap(nodes);
      const bbox = computeSubtreeBBox("n1", nodeMap, adj);
      
      expect(bbox.left).toBe(100 - 22); // NODE_SIZE is 44, so half is 22
      expect(bbox.right).toBe(100 + 22);
      expect(bbox.top).toBe(100 - 22);
      expect(bbox.bottom).toBe(100 + 22);
    });

    it("computes bbox for a 2-parent 1-child tree", () => {
      const nodes: PedigreeNode[] = [
        { id: "f1", x: 100, y: 100, type: "male", ...baseNode },
        { id: "m1", x: 196.8, y: 100, type: "female", ...baseNode }, // 100 + 96.8 (NODE_GAP)
        { id: "c1", x: 148.4, y: 220, type: "male", ...baseNode },
      ];
      const edges: PedigreeEdge[] = [
        { id: "e1", sourceId: "f1", targetId: "m1", type: "couple" },
        { id: "e2", sourceId: "f1", targetId: "c1", type: "parent-child" },
        { id: "e3", sourceId: "m1", targetId: "c1", type: "parent-child" },
      ];
      const adj = buildAdjacency(nodes, edges);
      const nodeMap = buildNodeMap(nodes);
      
      const bbox = computeSubtreeBBox("f1", nodeMap, adj);
      
      expect(bbox.left).toBe(100 - 22); // father's left
      expect(bbox.right).toBe(196.8 + 22); // mother's right
      expect(bbox.top).toBe(100 - 22); // parents' top
      expect(bbox.bottom).toBe(220 + 22); // child's bottom
    });
  });

  describe("detectRowCollisions", () => {
    it("detects overlap between two families", () => {
      const fam1 = {
        id: "f_f1_m1",
        parentIds: ["f1", "m1"],
        childIds: [],
        memberIds: new Set(["f1", "m1"]),
        bbox: { left: 100, right: 200, top: 100, bottom: 144 }
      };
      const fam2 = {
        id: "f_f2_m2",
        parentIds: ["f2", "m2"],
        childIds: [],
        memberIds: new Set(["f2", "m2"]),
        bbox: { left: 150, right: 250, top: 100, bottom: 144 } // overlapping with fam1
      };
      
      const collisions = detectRowCollisions([fam1, fam2], 122, 96.8); // 96.8 is NODE_GAP
      expect(collisions).toHaveLength(1);
      expect(collisions[0]!.overlap).toBeGreaterThan(0);
    });

    it("does not detect overlap when spaced sufficiently", () => {
      const fam1 = {
        id: "f_f1_m1",
        parentIds: ["f1", "m1"],
        childIds: [],
        memberIds: new Set(["f1", "m1"]),
        bbox: { left: 100, right: 200, top: 100, bottom: 144 }
      };
      const fam2 = {
        id: "f_f2_m2",
        parentIds: ["f2", "m2"],
        childIds: [],
        memberIds: new Set(["f2", "m2"]),
        bbox: { left: 300, right: 400, top: 100, bottom: 144 } 
      };
      
      const collisions = detectRowCollisions([fam1, fam2], 122, 96.8);
      expect(collisions).toHaveLength(0);
    });
  });

  describe("resolveAllCollisions", () => {
    it("resolves overlap between adjacent families", () => {
      const nodes: PedigreeNode[] = [
        // Fam 1
        { id: "f1", x: 120, y: 100, type: "male", ...baseNode },
        { id: "m1", x: 216.8, y: 100, type: "female", ...baseNode },
        { id: "c1", x: 168.4, y: 220, type: "male", ...baseNode },
        // Fam 2 overlapping Fam 1
        { id: "f2", x: 170, y: 100, type: "male", ...baseNode },
        { id: "m2", x: 266.8, y: 100, type: "female", ...baseNode },
        { id: "c2", x: 218.4, y: 220, type: "male", ...baseNode },
      ];
      const edges: PedigreeEdge[] = [
        { id: "e1", sourceId: "f1", targetId: "m1", type: "couple" },
        { id: "e2", sourceId: "f1", targetId: "c1", type: "parent-child" },
        { id: "e3", sourceId: "m1", targetId: "c1", type: "parent-child" },
        { id: "e4", sourceId: "f2", targetId: "m2", type: "couple" },
        { id: "e5", sourceId: "f2", targetId: "c2", type: "parent-child" },
        { id: "e6", sourceId: "m2", targetId: "c2", type: "parent-child" },
      ];

      const resolved = resolveAllCollisions(nodes, edges);
      
      // Fam 2 should be pushed right relative to Fam 1, keeping internal distances
      const newF1 = resolved.find(n => n.id === "f1")!;
      const newM1 = resolved.find(n => n.id === "m1")!;
      const newF2 = resolved.find(n => n.id === "f2")!;
      
      expect(newM1.x - newF1.x).toBeCloseTo(96.8); // Internal spacing kept
      expect(newF2.x - newM1.x).toBeGreaterThanOrEqual(96.8 - 0.1); // Space between families
    });
  });



  describe("recenterParents", () => {
    it("centers parents over children", () => {
      const nodes: PedigreeNode[] = [
        { id: "f1", x: 100, y: 100, type: "male", ...baseNode },
        { id: "m1", x: 196.8, y: 100, type: "female", ...baseNode },
        { id: "c1", x: 300, y: 220, type: "male", ...baseNode }, // child is far to the right
      ];
      const edges: PedigreeEdge[] = [
        { id: "e1", sourceId: "f1", targetId: "m1", type: "couple" },
        { id: "e2", sourceId: "f1", targetId: "c1", type: "parent-child" },
        { id: "e3", sourceId: "m1", targetId: "c1", type: "parent-child" },
      ];

      const resolved = recenterParents(nodes, edges, ["f1", "m1"], ["c1"]);
      const newF1 = resolved.find(n => n.id === "f1")!;
      const newM1 = resolved.find(n => n.id === "m1")!;
      
      const parentCenter = (newF1.x + newM1.x) / 2;
      expect(parentCenter).toBeCloseTo(300);
    });
  });
});

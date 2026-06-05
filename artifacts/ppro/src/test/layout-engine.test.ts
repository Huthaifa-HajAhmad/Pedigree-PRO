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
    it("detects overlap between two nodes", () => {
      const n1 = { id: "n1", x: 100, y: 122, type: "male" as const, ...baseNode };
      const n2 = { id: "n2", x: 150, y: 122, type: "female" as const, ...baseNode }; // overlapping with n1
      
      const collisions = detectRowCollisions([n1, n2], 122, 96.8); // 96.8 is NODE_GAP
      expect(collisions).toHaveLength(1);
      expect(collisions[0]!.overlap).toBeCloseTo(96.8 - 50);
    });

    it("does not detect overlap when spaced sufficiently", () => {
      const n1 = { id: "n1", x: 100, y: 122, type: "male" as const, ...baseNode };
      const n2 = { id: "n2", x: 300, y: 122, type: "female" as const, ...baseNode };
      
      const collisions = detectRowCollisions([n1, n2], 122, 96.8);
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

    it("does not inflate spaces when pushing blockers", () => {
      const nodes: PedigreeNode[] = [
        // Family 1 (needs to center at 200, so parents target 150 & 250)
        { id: "f1", x: 100, y: 100, type: "male", ...baseNode },
        { id: "m1", x: 200, y: 100, type: "female", ...baseNode },
        { id: "c1_1", x: 150, y: 220, type: "male", ...baseNode },
        { id: "c1_2", x: 250, y: 220, type: "male", ...baseNode },

        // Family 2 (blocker on parent row at 300, child at 350)
        { id: "f2", x: 300, y: 100, type: "male", ...baseNode },
        { id: "m2", x: 400, y: 100, type: "female", ...baseNode },
        { id: "c2_1", x: 350, y: 220, type: "male", ...baseNode },
      ];
      const edges: PedigreeEdge[] = [
        { id: "e1", sourceId: "f1", targetId: "m1", type: "couple" },
        { id: "e2", sourceId: "f1", targetId: "c1_1", type: "parent-child" },
        { id: "e3", sourceId: "m1", targetId: "c1_1", type: "parent-child" },
        { id: "e4", sourceId: "f1", targetId: "c1_2", type: "parent-child" },
        { id: "e5", sourceId: "m1", targetId: "c1_2", type: "parent-child" },

        { id: "e6", sourceId: "f2", targetId: "m2", type: "couple" },
        { id: "e7", sourceId: "f2", targetId: "c2_1", type: "parent-child" },
        { id: "e8", sourceId: "m2", targetId: "c2_1", type: "parent-child" },
      ];

      // Recentering parents of Family 1 (target 150, 250) should push f2 (originally 300)
      // because target 250 overlaps with f2 at 300 (gap 50 < 96.8)
      const result = recenterParents(nodes, edges, ["f1", "m1"], ["c1_1", "c1_2"]);
      const newF2 = result.find(n => n.id === "f2")!;
      const newM2 = result.find(n => n.id === "m2")!;
      const newC2_1 = result.find(n => n.id === "c2_1")!;

      // We expect Family 2 to be pushed by EXACTLY the amount needed to maintain NODE_GAP (96.8)
      // from Family 1's right parent (target 248.4).
      // So newF2 should be at 248.4 + 96.8 = 345.2
      // And because f2 shifted by 45.2 (from 300 to 345.2), m2 and c2_1 must also shift by exactly 45.2.
      expect(newF2.x).toBeCloseTo(345.2, 1);
      expect(newM2.x).toBeCloseTo(445.2, 1);
      expect(newC2_1.x).toBeCloseTo(395.2, 1);
    });

    it("anchors parents of origin and does not shift them when both have parents", () => {
      const nodes: PedigreeNode[] = [
        // Grandparents 1
        { id: "gf1", x: 100, y: 100, type: "male", ...baseNode },
        { id: "gm1", x: 196.8, y: 100, type: "female", ...baseNode },
        // Grandparents 2
        { id: "gf2", x: 400, y: 100, type: "male", ...baseNode },
        { id: "gm2", x: 496.8, y: 100, type: "female", ...baseNode },
        // Parents (who are children of grandparents)
        { id: "f1", x: 148.4, y: 220, type: "male", ...baseNode },
        { id: "m1", x: 448.4, y: 220, type: "female", ...baseNode },
        // Child
        { id: "c1", x: 350, y: 340, type: "male", ...baseNode }, // child centers at 350, but parents are anchored at 148.4 & 448.4
      ];
      const edges: PedigreeEdge[] = [
        { id: "eg1", sourceId: "gf1", targetId: "gm1", type: "couple" },
        { id: "eg1_c", sourceId: "gf1", targetId: "f1", type: "parent-child" },
        { id: "eg1_m", sourceId: "gm1", targetId: "f1", type: "parent-child" },

        { id: "eg2", sourceId: "gf2", targetId: "gm2", type: "couple" },
        { id: "eg2_c", sourceId: "gf2", targetId: "m1", type: "parent-child" },
        { id: "eg2_m", sourceId: "gm2", targetId: "m1", type: "parent-child" },

        { id: "e1", sourceId: "f1", targetId: "m1", type: "couple" },
        { id: "e2", sourceId: "f1", targetId: "c1", type: "parent-child" },
        { id: "e3", sourceId: "m1", targetId: "c1", type: "parent-child" },
      ];

      const result = recenterParents(nodes, edges, ["f1", "m1"], ["c1"]);
      const newF1 = result.find(n => n.id === "f1")!;
      const newM1 = result.find(n => n.id === "m1")!;

      // Both f1 and m1 should remain at their parent-anchored X positions
      expect(newF1.x).toBeCloseTo(148.4, 1);
      expect(newM1.x).toBeCloseTo(448.4, 1);
    });

    it("anchors the parent and aligns the spouse when only one has parents", () => {
      const nodes: PedigreeNode[] = [
        // Grandparents
        { id: "gf", x: 100, y: 100, type: "male", ...baseNode },
        { id: "gm", x: 196.8, y: 100, type: "female", ...baseNode },
        // Parents (f1 is child of gm, m1 is a spouse)
        { id: "f1", x: 148.4, y: 220, type: "male", ...baseNode },
        { id: "m1", x: 300.0, y: 220, type: "female", ...baseNode }, // spouse is misaligned
        // Child
        { id: "c1", x: 250, y: 340, type: "male", ...baseNode },
      ];
      const edges: PedigreeEdge[] = [
        { id: "eg", sourceId: "gf", targetId: "gm", type: "couple" },
        { id: "eg_c", sourceId: "gf", targetId: "f1", type: "parent-child" },
        { id: "eg_m", sourceId: "gm", targetId: "f1", type: "parent-child" },

        { id: "e1", sourceId: "f1", targetId: "m1", type: "couple" },
        { id: "e2", sourceId: "f1", targetId: "c1", type: "parent-child" },
        { id: "e3", sourceId: "m1", targetId: "c1", type: "parent-child" },
      ];

      const result = recenterParents(nodes, edges, ["f1", "m1"], ["c1"]);
      const newF1 = result.find(n => n.id === "f1")!;
      const newM1 = result.find(n => n.id === "m1")!;

      // f1 should be anchored at 148.4, and spouse m1 should be placed exactly NODE_GAP (96.8) away at 245.2
      expect(newF1.x).toBeCloseTo(148.4, 1);
      expect(newM1.x).toBeCloseTo(245.2, 1);
    });
  });
});

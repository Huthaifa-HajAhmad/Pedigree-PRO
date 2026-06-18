import { describe, it, expect } from "vitest";
import {
  computeSubtreeBBox,
  detectRowCollisions,
  resolveAllCollisions,
  recenterParents,
  recenterAllFamilies,
  evenOutSiblingSpacing,
  buildAdjacency,
  buildNodeMap,
  ROW_TOLERANCE,
} from "../lib/layout-engine";
import { computeAutoLayout } from "../lib/auto-layout";
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
      // from Family 1's right parent (target 250).
      // So newF2 should be at 250 + 96.8 = 346.8
      // And because f2 shifted by 46.8 (from 300 to 346.8), m2 and c2_1 must also shift by exactly 46.8.
      expect(newF2.x).toBeCloseTo(346.8, 1);
      expect(newM2.x).toBeCloseTo(446.8, 1);
      expect(newC2_1.x).toBeCloseTo(396.8, 1);
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

      // Both f1 and m1 should shift to center over child, keeping their original distance (300)
      expect(newF1.x).toBeCloseTo(200, 1);
      expect(newM1.x).toBeCloseTo(500, 1);
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

      // Both f1 and m1 should shift to center over child, keeping their original distance (151.6)
      expect(newF1.x).toBeCloseTo(174.2, 1);
      expect(newM1.x).toBeCloseTo(325.8, 1);
    });
  });

  describe("recenterAllFamilies", () => {
    it("shifts child subtree when parent row collision shifts parents", () => {
      const nodes: PedigreeNode[] = [
        // Couple 1
        { id: "f1", x: 150, y: 100, type: "male", ...baseNode },
        { id: "m1", x: 246.8, y: 100, type: "female", ...baseNode },
        { id: "c1", x: 198.4, y: 220, type: "male", ...baseNode },
        // Couple 2 colliding with Couple 1
        { id: "f2", x: 280, y: 100, type: "male", ...baseNode },
        { id: "m2", x: 376.8, y: 100, type: "female", ...baseNode },
        { id: "c2", x: 328.4, y: 220, type: "female", ...baseNode },
        // Gen III proband child from consanguineous union
        { id: "proband", x: 263.4, y: 340, type: "unknown", ...baseNode },
      ];
      const edges: PedigreeEdge[] = [
        { id: "e1", sourceId: "f1", targetId: "m1", type: "couple" },
        { id: "e2", sourceId: "f1", targetId: "c1", type: "parent-child" },
        { id: "e3", sourceId: "m1", targetId: "c1", type: "parent-child" },
        { id: "e4", sourceId: "f2", targetId: "m2", type: "couple" },
        { id: "e5", sourceId: "f2", targetId: "c2", type: "parent-child" },
        { id: "e6", sourceId: "m2", targetId: "c2", type: "parent-child" },
        { id: "e7", sourceId: "c1", targetId: "c2", type: "consanguinity" },
        { id: "e8", sourceId: "c1", targetId: "proband", type: "parent-child" },
        { id: "e9", sourceId: "c2", targetId: "proband", type: "parent-child" },
      ];

      const resolved = recenterAllFamilies(nodes, edges);
      const newF1 = resolved.find(n => n.id === "f1")!;
      const newM1 = resolved.find(n => n.id === "m1")!;
      const newC1 = resolved.find(n => n.id === "c1")!;
      const newF2 = resolved.find(n => n.id === "f2")!;
      const newM2 = resolved.find(n => n.id === "m2")!;
      const newC2 = resolved.find(n => n.id === "c2")!;
      const newProband = resolved.find(n => n.id === "proband")!;

      expect(newC1.x).toBeCloseTo((newF1.x + newM1.x) / 2, 1);
      expect(newC2.x).toBeCloseTo((newF2.x + newM2.x) / 2, 1);
      expect(newProband.x).toBeCloseTo((newC1.x + newC2.x) / 2, 1);
    });
  });

  describe("evenOutSiblingSpacing", () => {
    it("evenly spaces three siblings when the third one is shifted far to the right", () => {
      const nodes: PedigreeNode[] = [
        { id: "father", x: 150, y: 100, type: "male", ...baseNode },
        { id: "mother", x: 240, y: 100, type: "female", ...baseNode },
        // Siblings
        { id: "sib1", x: 100, y: 220, type: "male", ...baseNode },
        { id: "sib2", x: 210, y: 220, type: "female", ...baseNode },
        { id: "sib3", x: 500, y: 220, type: "male", ...baseNode },
      ];
      const edges: PedigreeEdge[] = [
        { id: "e1", sourceId: "father", targetId: "mother", type: "couple" },
        { id: "e2", sourceId: "father", targetId: "sib1", type: "parent-child" },
        { id: "e3", sourceId: "mother", targetId: "sib1", type: "parent-child" },
        { id: "e4", sourceId: "father", targetId: "sib2", type: "parent-child" },
        { id: "e5", sourceId: "mother", targetId: "sib2", type: "parent-child" },
        { id: "e6", sourceId: "father", targetId: "sib3", type: "parent-child" },
        { id: "e7", sourceId: "mother", targetId: "sib3", type: "parent-child" },
      ];

      const result = evenOutSiblingSpacing(nodes, edges);
      
      const newSib1 = result.find(n => n.id === "sib1")!;
      const newSib2 = result.find(n => n.id === "sib2")!;
      const newSib3 = result.find(n => n.id === "sib3")!;

      expect(newSib1.x).toBe(100);
      expect(newSib3.x).toBe(500);
      expect(newSib2.x).toBeCloseTo(300);
    });

    it("does not shift inner sibling if it has couples or children", () => {
      const nodes: PedigreeNode[] = [
        { id: "father", x: 150, y: 100, type: "male", ...baseNode },
        { id: "mother", x: 240, y: 100, type: "female", ...baseNode },
        // Siblings
        { id: "sib1", x: 100, y: 220, type: "male", ...baseNode },
        { id: "sib2", x: 210, y: 220, type: "female", ...baseNode },
        { id: "sib3", x: 500, y: 220, type: "male", ...baseNode },
        { id: "partner2", x: 300, y: 220, type: "male", ...baseNode },
      ];
      const edges: PedigreeEdge[] = [
        { id: "e1", sourceId: "father", targetId: "mother", type: "couple" },
        { id: "e2", sourceId: "father", targetId: "sib1", type: "parent-child" },
        { id: "e3", sourceId: "mother", targetId: "sib1", type: "parent-child" },
        { id: "e4", sourceId: "father", targetId: "sib2", type: "parent-child" },
        { id: "e5", sourceId: "mother", targetId: "sib2", type: "parent-child" },
        { id: "e6", sourceId: "father", targetId: "sib3", type: "parent-child" },
        { id: "e7", sourceId: "mother", targetId: "sib3", type: "parent-child" },
        { id: "e8", sourceId: "sib2", targetId: "partner2", type: "couple" },
      ];

      const result = evenOutSiblingSpacing(nodes, edges);
      
      const newSib2 = result.find(n => n.id === "sib2")!;
      expect(newSib2.x).toBe(210);
    });
  });

  describe("computeAutoLayout sibling ordering", () => {
    it("places siblings in correct order adjacent to couple partners", () => {
      const nodes: PedigreeNode[] = [
        { id: "father", x: 700, y: 120, type: "male", ...baseNode },
        { id: "mother", x: 796.8, y: 120, type: "female", ...baseNode },
        // Children (II:5, II:6, II:7, new1, new2, new3)
        { id: "II:5", x: 700, y: 240, type: "female", ...baseNode },
        { id: "II:6", x: 700, y: 240, type: "male", ...baseNode },
        { id: "II:7", x: 700, y: 240, type: "female", ...baseNode },
        { id: "new1", x: 700, y: 240, type: "female", ...baseNode },
        { id: "new2", x: 700, y: 240, type: "male", ...baseNode },
        { id: "new3", x: 700, y: 240, type: "female", ...baseNode },
      ];

      const edges: PedigreeEdge[] = [
        { id: "e_c", sourceId: "father", targetId: "mother", type: "couple" },
        // Rebuilt parent-child edges in the specified final order: II:5 -> II:6 -> II:7 -> new1 -> new2 -> new3
        { id: "e1", sourceId: "father", targetId: "II:5", type: "parent-child" },
        { id: "e2", sourceId: "father", targetId: "II:6", type: "parent-child" },
        { id: "e3", sourceId: "father", targetId: "II:7", type: "parent-child" },
        { id: "e4", sourceId: "father", targetId: "new1", type: "parent-child" },
        { id: "e5", sourceId: "father", targetId: "new2", type: "parent-child" },
        { id: "e6", sourceId: "father", targetId: "new3", type: "parent-child" },
        // Couple relationship for II:6 and II:7
        { id: "e_couple_ii", sourceId: "II:6", targetId: "II:7", type: "couple" },
      ];

      const result = computeAutoLayout(nodes as any, edges as any, false) as PedigreeNode[];

      const x5 = result.find(n => n.id === "II:5")!.x;
      const x6 = result.find(n => n.id === "II:6")!.x;
      const x7 = result.find(n => n.id === "II:7")!.x;
      const xNew1 = result.find(n => n.id === "new1")!.x;
      const xNew2 = result.find(n => n.id === "new2")!.x;
      const xNew3 = result.find(n => n.id === "new3")!.x;

      // Ensure they are strictly ordered from left to right:
      // II:5 < II:6 < II:7 < new1 < new2 < new3
      expect(x5).toBeLessThan(x6);
      expect(x6).toBeLessThan(x7);
      expect(x7).toBeLessThan(xNew1);
      expect(xNew1).toBeLessThan(xNew2);
      expect(xNew2).toBeLessThan(xNew3);
    });

    it("preserves correct order when current node is married with children and parents are auto-created", () => {
      const nodes: PedigreeNode[] = [
        // Parents (auto-created)
        { id: "father", x: 700, y: 120, type: "male", ...baseNode },
        { id: "mother", x: 796.8, y: 120, type: "female", ...baseNode },
        // Wife (source node)
        { id: "wife", x: 745.0, y: 240, type: "female", ...baseNode },
        // Husband
        { id: "husband", x: 648.2, y: 240, type: "male", ...baseNode },
        // Child of couple
        { id: "child", x: 696.6, y: 360, type: "male", ...baseNode },
        // New siblings added
        { id: "new1", x: 745.0, y: 240, type: "female", ...baseNode },
        { id: "new2", x: 745.0, y: 240, type: "male", ...baseNode },
        { id: "new3", x: 745.0, y: 240, type: "female", ...baseNode },
      ];

      const edges: PedigreeEdge[] = [
        // Parent couple
        { id: "e_c_parents", sourceId: "father", targetId: "mother", type: "couple" },
        // Couple relationship
        { id: "e_couple", sourceId: "husband", targetId: "wife", type: "couple" },
        // Child parent-child edges
        { id: "e_pc_child_h", sourceId: "husband", targetId: "child", type: "parent-child" },
        { id: "e_pc_child_w", sourceId: "wife", targetId: "child", type: "parent-child" },
        // Sibling parent-child edges (order: wife -> new1 -> new2 -> new3)
        { id: "e_pc_w", sourceId: "father", targetId: "wife", type: "parent-child" },
        { id: "e_pc_n1", sourceId: "father", targetId: "new1", type: "parent-child" },
        { id: "e_pc_n2", sourceId: "father", targetId: "new2", type: "parent-child" },
        { id: "e_pc_n3", sourceId: "father", targetId: "new3", type: "parent-child" },
      ];

      const result = computeAutoLayout(nodes as any, edges as any, false) as PedigreeNode[];

      const xWife = result.find(n => n.id === "wife")!.x;
      const xHusband = result.find(n => n.id === "husband")!.x;
      const xNew1 = result.find(n => n.id === "new1")!.x;
      const xNew2 = result.find(n => n.id === "new2")!.x;
      const xNew3 = result.find(n => n.id === "new3")!.x;

      console.log("TEST RESULT POSITIONS:", {
        husband: xHusband,
        wife: xWife,
        new1: xNew1,
        new2: xNew2,
        new3: xNew3,
      });

      // Wife should be placed immediately to the right of her husband (male-left, female-right couple)
      // Since order is wife -> new1 -> new2 -> new3:
      // The couple (husband, wife) should be on the left, followed by new1, new2, new3
      expect(xHusband).toBeLessThan(xWife);
      expect(xWife).toBeLessThan(xNew1);
      expect(xNew1).toBeLessThan(xNew2);
      expect(xNew2).toBeLessThan(xNew3);
    });

    it("reproduces user consanguineous couple and children layout with siblings", () => {
      const nodes: PedigreeNode[] = [
        // Gen I
        { id: "I:1", x: 200, y: 0, type: "male", ...baseNode },
        { id: "I:2", x: 296.8, y: 0, type: "female", ...baseNode },
        { id: "I:3", x: 700, y: 0, type: "male", ...baseNode },
        { id: "I:4", x: 796.8, y: 0, type: "female", ...baseNode },

        // Gen II
        { id: "II:1", x: 100, y: 120, type: "male", ...baseNode },
        { id: "II:2", x: 196.8, y: 120, type: "female", ...baseNode },
        { id: "II:3", x: 293.6, y: 120, type: "male", ...baseNode },
        { id: "II:4", x: 390.4, y: 120, type: "female", ...baseNode },
        { id: "II:6", x: 487.2, y: 120, type: "male", ...baseNode },

        { id: "II:7", x: 584, y: 120, type: "female", ...baseNode },
        { id: "II:5", x: 584, y: 120, type: "female", ...baseNode },
        { id: "II:8", x: 584, y: 120, type: "male", ...baseNode },
        { id: "II:9", x: 584, y: 120, type: "female", ...baseNode },

        // Gen III
        { id: "III:1", x: 100, y: 240, type: "male", ...baseNode },
        { id: "III:2", x: 196.8, y: 240, type: "male", ...baseNode },
        { id: "III:3", x: 293.6, y: 240, type: "male", ...baseNode },

        { id: "III:4", x: 390.4, y: 240, type: "male", ...baseNode },
        { id: "III:5", x: 487.2, y: 240, type: "female", ...baseNode },

        { id: "III:6", x: 584, y: 240, type: "male", ...baseNode },
        { id: "III:7", x: 680.8, y: 240, type: "female", ...baseNode },
        { id: "III:8", x: 777.6, y: 240, type: "female", ...baseNode },
        { id: "III:9", x: 874.4, y: 240, type: "male", ...baseNode },
      ];

      const edges: PedigreeEdge[] = [
        // Gen I couples
        { id: "e_c_i1_i2", sourceId: "I:1", targetId: "I:2", type: "couple" },
        { id: "e_c_i3_i4", sourceId: "I:3", targetId: "I:4", type: "couple" },

        // Gen II children of I:1/I:2
        { id: "e_pc_ii1_f", sourceId: "I:1", targetId: "II:1", type: "parent-child" },
        { id: "e_pc_ii1_m", sourceId: "I:2", targetId: "II:1", type: "parent-child" },
        { id: "e_pc_ii3_f", sourceId: "I:1", targetId: "II:3", type: "parent-child" },
        { id: "e_pc_ii3_m", sourceId: "I:2", targetId: "II:3", type: "parent-child" },
        { id: "e_pc_ii6_f", sourceId: "I:1", targetId: "II:6", type: "parent-child" },
        { id: "e_pc_ii6_m", sourceId: "I:2", targetId: "II:6", type: "parent-child" },

        // Gen II children of I:3/I:4 (order: II:7 (wife) -> II:5 (new1) -> II:8 (new2) -> II:9 (new3))
        { id: "e_pc_ii7_f", sourceId: "I:3", targetId: "II:7", type: "parent-child" },
        { id: "e_pc_ii7_m", sourceId: "I:4", targetId: "II:7", type: "parent-child" },
        { id: "e_pc_ii5_f", sourceId: "I:3", targetId: "II:5", type: "parent-child" },
        { id: "e_pc_ii5_m", sourceId: "I:4", targetId: "II:5", type: "parent-child" },
        { id: "e_pc_ii8_f", sourceId: "I:3", targetId: "II:8", type: "parent-child" },
        { id: "e_pc_ii8_m", sourceId: "I:4", targetId: "II:8", type: "parent-child" },
        { id: "e_pc_ii9_f", sourceId: "I:3", targetId: "II:9", type: "parent-child" },
        { id: "e_pc_ii9_m", sourceId: "I:4", targetId: "II:9", type: "parent-child" },

        // Gen II couples
        { id: "e_c_ii1_ii2", sourceId: "II:1", targetId: "II:2", type: "couple" },
        { id: "e_c_ii3_ii4", sourceId: "II:3", targetId: "II:4", type: "couple" },
        { id: "e_c_ii6_ii7", sourceId: "II:6", targetId: "II:7", type: "couple" },

        // Gen III children of II:1/II:2
        { id: "e_pc_iii1_f", sourceId: "II:1", targetId: "III:1", type: "parent-child" },
        { id: "e_pc_iii1_m", sourceId: "II:2", targetId: "III:1", type: "parent-child" },
        { id: "e_pc_iii2_f", sourceId: "II:1", targetId: "III:2", type: "parent-child" },
        { id: "e_pc_iii2_m", sourceId: "II:2", targetId: "III:2", type: "parent-child" },
        { id: "e_pc_iii3_f", sourceId: "II:1", targetId: "III:3", type: "parent-child" },
        { id: "e_pc_iii3_m", sourceId: "II:2", targetId: "III:3", type: "parent-child" },

        // Gen III children of II:3/II:4
        { id: "e_pc_iii4_f", sourceId: "II:3", targetId: "III:4", type: "parent-child" },
        { id: "e_pc_iii4_m", sourceId: "II:4", targetId: "III:4", type: "parent-child" },
        { id: "e_pc_iii5_f", sourceId: "II:3", targetId: "III:5", type: "parent-child" },
        { id: "e_pc_iii5_m", sourceId: "II:4", targetId: "III:5", type: "parent-child" },

        // Gen III children of II:6/II:7
        { id: "e_pc_iii6_f", sourceId: "II:6", targetId: "III:6", type: "parent-child" },
        { id: "e_pc_iii6_m", sourceId: "II:7", targetId: "III:6", type: "parent-child" },
        { id: "e_pc_iii7_f", sourceId: "II:6", targetId: "III:7", type: "parent-child" },
        { id: "e_pc_iii7_m", sourceId: "II:7", targetId: "III:7", type: "parent-child" },
        { id: "e_pc_iii8_f", sourceId: "II:6", targetId: "III:8", type: "parent-child" },
        { id: "e_pc_iii8_m", sourceId: "II:7", targetId: "III:8", type: "parent-child" },
        { id: "e_pc_iii9_f", sourceId: "II:6", targetId: "III:9", type: "parent-child" },
        { id: "e_pc_iii9_m", sourceId: "II:7", targetId: "III:9", type: "parent-child" },
      ];

      const result = computeAutoLayout(nodes as any, edges as any, false) as PedigreeNode[];

      const x5 = result.find(n => n.id === "II:5")!.x;
      const x6 = result.find(n => n.id === "II:6")!.x;
      const x7 = result.find(n => n.id === "II:7")!.x;
      const x8 = result.find(n => n.id === "II:8")!.x;
      const x9 = result.find(n => n.id === "II:9")!.x;

      console.log("CONSANGUINEOUS TEST RESULT POSITIONS:", {
        II5: x5,
        II6: x6,
        II7: x7,
        II8: x8,
        II9: x9,
      });

      // Sibling order of I:3/I:4 children is II:7 (wife) -> II:5 (sibling 1) -> II:8 -> II:9.
      // II:6 is the husband of II:7, and is a male-on-left couple partner.
      // So II:6 must be immediately to the left of II:7.
      // Thus the horizontal order should be: II:6 < II:7 < II:5 < II:8 < II:9.
      expect(x6).toBeLessThan(x7);
      expect(x7).toBeLessThan(x5);
      expect(x5).toBeLessThan(x8);
      expect(x8).toBeLessThan(x9);
    });

    it("reproduces user child add collision with maternal uncle/aunt", () => {
      const nodes: PedigreeNode[] = [
        // Gen I parents
        { id: "I:3", x: 700, y: 0, type: "male", ...baseNode },
        { id: "I:4", x: 796.8, y: 0, type: "female", ...baseNode },

        // Gen II siblings
        { id: "II:6", x: 400, y: 120, type: "female", ...baseNode },
        { id: "II:5", x: 300, y: 120, type: "male", ...baseNode }, // spouse of II:6
        { id: "II:7", x: 500, y: 120, type: "female", ...baseNode },
        { id: "II:8", x: 600, y: 120, type: "male", ...baseNode },
        { id: "II:10", x: 700, y: 120, type: "female", ...baseNode },
        { id: "II:9", x: 600, y: 120, type: "male", ...baseNode }, // spouse of II:10

        // Gen III children
        // Children of II:5/II:6
        { id: "III:6", x: 200, y: 240, type: "male", ...baseNode },
        { id: "III:7", x: 300, y: 240, type: "female", ...baseNode },
        { id: "III:8", x: 400, y: 240, type: "female", ...baseNode },
        { id: "III:9", x: 500, y: 240, type: "male", ...baseNode },
        // Child of II:9/II:10
        { id: "III:10", x: 600, y: 240, type: "unknown", ...baseNode },
      ];

      const edges: PedigreeEdge[] = [
        // Gen I couple
        { id: "e_c_i3_i4", sourceId: "I:3", targetId: "I:4", type: "couple" },

        // Gen II siblings parent-child edges (order: II:6 -> II:7 -> II:8 -> II:10)
        { id: "e_pc_ii6_f", sourceId: "I:3", targetId: "II:6", type: "parent-child" },
        { id: "e_pc_ii6_m", sourceId: "I:4", targetId: "II:6", type: "parent-child" },
        { id: "e_pc_ii7_f", sourceId: "I:3", targetId: "II:7", type: "parent-child" },
        { id: "e_pc_ii7_m", sourceId: "I:4", targetId: "II:7", type: "parent-child" },
        { id: "e_pc_ii8_f", sourceId: "I:3", targetId: "II:8", type: "parent-child" },
        { id: "e_pc_ii8_m", sourceId: "I:4", targetId: "II:8", type: "parent-child" },
        { id: "e_pc_ii10_f", sourceId: "I:3", targetId: "II:10", type: "parent-child" },
        { id: "e_pc_ii10_m", sourceId: "I:4", targetId: "II:10", type: "parent-child" },

        // Couples in Gen II
        { id: "e_c_ii5_ii6", sourceId: "II:5", targetId: "II:6", type: "couple" },
        { id: "e_c_ii9_ii10", sourceId: "II:9", targetId: "II:10", type: "couple" },

        // Gen III parent-child edges
        // Children of II:5/II:6
        { id: "e_pc_iii6_f", sourceId: "II:5", targetId: "III:6", type: "parent-child" },
        { id: "e_pc_iii6_m", sourceId: "II:6", targetId: "III:6", type: "parent-child" },
        { id: "e_pc_iii7_f", sourceId: "II:5", targetId: "III:7", type: "parent-child" },
        { id: "e_pc_iii7_m", sourceId: "II:6", targetId: "III:7", type: "parent-child" },
        { id: "e_pc_iii8_f", sourceId: "II:5", targetId: "III:8", type: "parent-child" },
        { id: "e_pc_iii8_m", sourceId: "II:6", targetId: "III:8", type: "parent-child" },
        { id: "e_pc_iii9_f", sourceId: "II:5", targetId: "III:9", type: "parent-child" },
        { id: "e_pc_iii9_m", sourceId: "II:6", targetId: "III:9", type: "parent-child" },
        // Child of II:9/II:10
        { id: "e_pc_iii10_f", sourceId: "II:9", targetId: "III:10", type: "parent-child" },
        { id: "e_pc_iii10_m", sourceId: "II:10", targetId: "III:10", type: "parent-child" },
      ];

      const result = computeAutoLayout(nodes as any, edges as any, false) as PedigreeNode[];
      const x5 = result.find(n => n.id === "II:5")!.x;
      const x6 = result.find(n => n.id === "II:6")!.x;
      const x7 = result.find(n => n.id === "II:7")!.x;
      const x8 = result.find(n => n.id === "II:8")!.x;
      const x9 = result.find(n => n.id === "II:9")!.x;
      const x10 = result.find(n => n.id === "II:10")!.x;
      
      console.log("COLLISION TEST RESULT POSITIONS:", {
        II5: x5,
        II6: x6,
        II7: x7,
        II8: x8,
        II9: x9,
        II10: x10,
      });

      expect(Math.abs(x8 - x9)).toBeGreaterThanOrEqual(96.8 - 0.05);
    });

    it("correctly aligns generations when adding siblings to ancestor (requires upward propagation)", () => {
      const baseNode = { x: 100, y: 100, type: "unknown" };
      const nodes: PedigreeNode[] = [
        // Auto-created grandparents of I:4 (roots)
        { id: "gp_father", ...baseNode, type: "male" },
        { id: "gp_mother", ...baseNode, type: "female" },

        // Ancestors of the original tree
        { id: "I:1", ...baseNode, type: "male" },
        { id: "I:2", ...baseNode, type: "female" },
        { id: "I:3", ...baseNode, type: "male" },
        { id: "I:4", ...baseNode, type: "female" },

        // Couple in Gen II connecting the two branches
        { id: "II:5", ...baseNode, type: "male" },
        { id: "II:6", ...baseNode, type: "female" },
      ];

      const edges: PedigreeEdge[] = [
        // gp_father/gp_mother couple and their child I:4
        { id: "e_c_gp", sourceId: "gp_father", targetId: "gp_mother", type: "couple" },
        { id: "e_pc_i4_f", sourceId: "gp_father", targetId: "I:4", type: "parent-child" },
        { id: "e_pc_i4_m", sourceId: "gp_mother", targetId: "I:4", type: "parent-child" },

        // Original couples and children
        { id: "e_c_i1_i2", sourceId: "I:1", targetId: "I:2", type: "couple" },
        { id: "e_c_i3_i4", sourceId: "I:3", targetId: "I:4", type: "couple" },

        { id: "e_pc_ii5_f", sourceId: "I:1", targetId: "II:5", type: "parent-child" },
        { id: "e_pc_ii5_m", sourceId: "I:2", targetId: "II:5", type: "parent-child" },
        { id: "e_pc_ii6_f", sourceId: "I:3", targetId: "II:6", type: "parent-child" },
        { id: "e_pc_ii6_m", sourceId: "I:4", targetId: "II:6", type: "parent-child" },

        { id: "e_c_ii5_ii6", sourceId: "II:5", targetId: "II:6", type: "couple" },
      ];

      const result = computeAutoLayout(nodes as any, edges as any, false) as PedigreeNode[];

      const yGp = result.find(n => n.id === "gp_father")!.y;
      const yI1 = result.find(n => n.id === "I:1")!.y;
      const yI2 = result.find(n => n.id === "I:2")!.y;
      const yI3 = result.find(n => n.id === "I:3")!.y;
      const yI4 = result.find(n => n.id === "I:4")!.y;
      const yII5 = result.find(n => n.id === "II:5")!.y;
      const yII6 = result.find(n => n.id === "II:6")!.y;

      // gp_father/gp_mother should be in Gen 0 (top row)
      // I:1, I:2, I:3, I:4 should be in Gen 1 (middle row)
      // II:5, II:6 should be in Gen 2 (bottom row)
      expect(yGp).toBeLessThan(yI4);
      expect(yI1).toEqual(yI2);
      expect(yI2).toEqual(yI3);
      expect(yI3).toEqual(yI4);
      expect(yI4).toBeLessThan(yII6);
      expect(yII5).toEqual(yII6);
    });
  });
});

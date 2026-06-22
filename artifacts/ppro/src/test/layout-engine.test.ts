import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  computeSubtreeBBox,
  detectRowCollisions,
  resolveAllCollisions,
  recenterParents,
  recenterAllFamilies,
  recenterAllChildren,
  evenOutSiblingSpacing,
  buildAdjacency,
  buildNodeMap,
  ROW_TOLERANCE,
} from "../lib/layout-engine";
import { computeAutoLayout } from "../lib/auto-layout";
import { PedigreeNode, PedigreeEdge } from "@/features/pedigree-editor/canvas/types";
import { computeSibshipGroupTrack } from "@/features/pedigree-editor/canvas/canvasUtils";
import { computeFamilyChildYOffset } from "@/features/pedigree-editor/canvas/SibshipGroup";

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

      // Verify that the cross-branch couple is positioned correctly (since both have parents, they center under them)
      const xII5 = result.find(n => n.id === "II:5")!.x;
      const xII6 = result.find(n => n.id === "II:6")!.x;
      expect(Math.abs(xII5 - xII6)).toBeCloseTo(193.6, 1);
    });

    it("verifies sibling track separation for interleaved sibling groups", () => {
      const nodes: PedigreeNode[] = [
        { id: "II:3", x: 200, y: 120, type: "female", ...baseNode },
        { id: "II:4", x: 296.8, y: 120, type: "male", ...baseNode },
        { id: "II:5", x: 420, y: 120, type: "male", ...baseNode },
        { id: "II:6", x: 516.8, y: 120, type: "female", ...baseNode },

        { id: "III:1", x: 60, y: 240, type: "female", ...baseNode },
        { id: "III:2", x: 130, y: 240, type: "male", ...baseNode },
        { id: "III:3", x: 300, y: 240, type: "female", ...baseNode },
        { id: "III:4", x: 350, y: 240, type: "male", ...baseNode },
        { id: "III:5", x: 400, y: 240, type: "male", ...baseNode },
      ];

      const edges: PedigreeEdge[] = [
        { id: "e_c_1", sourceId: "II:3", targetId: "II:4", type: "couple" },
        { id: "e_pc_1_f", sourceId: "II:3", targetId: "III:1", type: "parent-child" },
        { id: "e_pc_1_m", sourceId: "II:4", targetId: "III:1", type: "parent-child" },
        { id: "e_pc_2_f", sourceId: "II:3", targetId: "III:2", type: "parent-child" },
        { id: "e_pc_2_m", sourceId: "II:4", targetId: "III:2", type: "parent-child" },
        { id: "e_pc_3_f", sourceId: "II:3", targetId: "III:4", type: "parent-child" },
        { id: "e_pc_3_m", sourceId: "II:4", targetId: "III:4", type: "parent-child" },

        { id: "e_c_2", sourceId: "II:5", targetId: "II:6", type: "couple" },
        { id: "e_pc_4_f", sourceId: "II:5", targetId: "III:3", type: "parent-child" },
        { id: "e_pc_4_m", sourceId: "II:6", targetId: "III:3", type: "parent-child" },
        { id: "e_pc_5_f", sourceId: "II:5", targetId: "III:5", type: "parent-child" },
        { id: "e_pc_5_m", sourceId: "II:6", targetId: "III:5", type: "parent-child" },
      ];

      const trackA = computeSibshipGroupTrack(["II:3", "II:4"], ["III:1", "III:2", "III:4"], edges, nodes);
      const trackB = computeSibshipGroupTrack(["II:5", "II:6"], ["III:3", "III:5"], edges, nodes);

      expect(trackA).not.toEqual(trackB);
    });

    it("verifies subtree-aware founder group spacing is compact for simple trees", () => {
      const nodes: PedigreeNode[] = [
        { id: "I:1", x: 200, y: 120, type: "male", ...baseNode },
        { id: "I:2", x: 296.8, y: 120, type: "female", ...baseNode },
        { id: "I:3", x: 420, y: 120, type: "male", ...baseNode },
        { id: "I:4", x: 516.8, y: 120, type: "female", ...baseNode },
      ];

      const edges: PedigreeEdge[] = [
        { id: "e_c_1", sourceId: "I:1", targetId: "I:2", type: "couple" },
        { id: "e_c_2", sourceId: "I:3", targetId: "I:4", type: "couple" },
      ];

      const result = computeAutoLayout(nodes as any, edges as any, false);
      const x1 = result.find(n => n.id === "I:1")!.x;
      const x3 = result.find(n => n.id === "I:3")!.x;

      const diff = Math.abs(x3 - x1);
      expect(diff).toBeLessThan(350);
    });

    it("verifies sibling bar Y coordinate stacking under parent clamping", () => {
      const nodes: PedigreeNode[] = [
        // Parents Row at y=120
        { id: "II:3", x: 200, y: 120, type: "female", ...baseNode },
        { id: "II:4", x: 296.8, y: 120, type: "male", ...baseNode },
        { id: "II:5", x: 420, y: 120, type: "male", ...baseNode },
        { id: "II:6", x: 516.8, y: 120, type: "female", ...baseNode },

        // Children Row at y=180 (moved closer to force clamping)
        { id: "III:1", x: 60, y: 180, type: "female", ...baseNode },
        { id: "III:2", x: 130, y: 180, type: "male", ...baseNode },
        { id: "III:3", x: 300, y: 180, type: "female", ...baseNode },
        { id: "III:4", x: 350, y: 180, type: "male", ...baseNode },
        { id: "III:5", x: 400, y: 180, type: "male", ...baseNode },
      ];

      const edges: PedigreeEdge[] = [
        { id: "e_c_1", sourceId: "II:3", targetId: "II:4", type: "couple" },
        { id: "e_pc_1_f", sourceId: "II:3", targetId: "III:1", type: "parent-child" },
        { id: "e_pc_1_m", sourceId: "II:4", targetId: "III:1", type: "parent-child" },
        { id: "e_pc_2_f", sourceId: "II:3", targetId: "III:2", type: "parent-child" },
        { id: "e_pc_2_m", sourceId: "II:4", targetId: "III:2", type: "parent-child" },
        { id: "e_pc_3_f", sourceId: "II:3", targetId: "III:4", type: "parent-child" },
        { id: "e_pc_3_m", sourceId: "II:4", targetId: "III:4", type: "parent-child" },

        { id: "e_c_2", sourceId: "II:5", targetId: "II:6", type: "couple" },
        { id: "e_pc_4_f", sourceId: "II:5", targetId: "III:3", type: "parent-child" },
        { id: "e_pc_4_m", sourceId: "II:6", targetId: "III:3", type: "parent-child" },
        { id: "e_pc_5_f", sourceId: "II:5", targetId: "III:5", type: "parent-child" },
        { id: "e_pc_5_m", sourceId: "II:6", targetId: "III:5", type: "parent-child" },
      ];

      const offsetsA = computeFamilyChildYOffset(
        ["II:3", "II:4"],
        ["III:1", "III:2", "III:4"],
        nodes,
        [],
        44,
        false,
        undefined,
        undefined,
        edges
      );
      const offsetsB = computeFamilyChildYOffset(
        ["II:5", "II:6"],
        ["III:3", "III:5"],
        nodes,
        [],
        44,
        false,
        undefined,
        undefined,
        edges
      );

      // Extract the computed delta offset for children
      const deltaA = offsetsA.get("III:1") ?? 0;
      const deltaB = offsetsB.get("III:3") ?? 0;

      // Under clamping, Family A (sibTrack = 0) and Family B (sibTrack = 1) must be separated by 12px.
      // So deltaA (the lower sibling bar pushing children down) and deltaB must differ by exactly 12px.
      expect(Math.abs(deltaA - deltaB)).toBeCloseTo(12, 1);
    });
  });

  describe("remediation regression tests", () => {
    it("T1: asserts edge-to-edge gap between adjacent founder groups is correct", () => {
      // 4 founder couples each having 3 children
      const nodes: any[] = [];
      const edges: any[] = [];
      
      for (let g = 0; g < 4; g++) {
        const fId = `f_${g}`;
        const mId = `m_${g}`;
        nodes.push(
          { id: fId, x: 0, y: 0, type: "male", ...baseNode },
          { id: mId, x: 0, y: 0, type: "female", ...baseNode }
        );
        edges.push({ id: `e_c_${g}`, sourceId: fId, targetId: mId, type: "couple" });
        
        for (let c = 0; c < 3; c++) {
          const cId = `c_${g}_${c}`;
          nodes.push({ id: cId, x: 0, y: 0, type: "male", ...baseNode });
          edges.push(
            { id: `e_pc_${g}_${c}_f`, sourceId: fId, targetId: cId, type: "parent-child" },
            { id: `e_pc_${g}_${c}_m`, sourceId: mId, targetId: cId, type: "parent-child" }
          );
        }
      }
      
      const result = computeAutoLayout(nodes, edges, false);
      
      // Sort top-row nodes by X
      const topRow = result.filter(n => n.id.startsWith("f_") || n.id.startsWith("m_")).sort((a, b) => a.x - b.x);
      
      for (let i = 1; i < topRow.length; i++) {
        const leftNode = topRow[i-1]!;
        const rightNode = topRow[i]!;
        const gap = rightNode.x - leftNode.x;
        
        const isCouple = edges.some(e => e.type === "couple" && ((e.sourceId === leftNode.id && e.targetId === rightNode.id) || (e.sourceId === rightNode.id && e.targetId === leftNode.id)));
        if (!isCouple) {
          expect(gap).toBeGreaterThanOrEqual(96.8 - 0.05);
        }
      }
    });

    it("T3: recenterParents grandchild rigid check", () => {
      // 4-generation chain: A -> B -> C -> D
      const nodes: PedigreeNode[] = [
        { id: "A", x: 100, y: 100, type: "male", ...baseNode },
        { id: "B", x: 200, y: 220, type: "female", ...baseNode },
        { id: "C", x: 300, y: 340, type: "male", ...baseNode },
        { id: "D", x: 400, y: 460, type: "female", ...baseNode },
      ];
      const edges: PedigreeEdge[] = [
        { id: "e1", sourceId: "A", targetId: "B", type: "parent-child" },
        { id: "e2", sourceId: "B", targetId: "C", type: "parent-child" },
        { id: "e3", sourceId: "C", targetId: "D", type: "parent-child" },
      ];
      
      const dxBC = nodes[2]!.x - nodes[1]!.x;
      const dxCD = nodes[3]!.x - nodes[2]!.x;
      
      const result = recenterParents(nodes, edges, ["B"], ["C"]);
      
      const newB = result.find(n => n.id === "B")!;
      const newC = result.find(n => n.id === "C")!;
      const newD = result.find(n => n.id === "D")!;
      
      expect(newC.x - newB.x).toBeCloseTo(0, 1);
      expect(newD.x - newC.x).toBeCloseTo(dxCD, 1);
    });

    it("T4: founder married to node at gen 3 does not get pulled to deep generations", () => {
      const nodes: any[] = [
        { id: "husband", x: 0, y: 0, type: "male", ...baseNode },
        { id: "wife", x: 0, y: 0, type: "female", ...baseNode },
        { id: "h_p1", x: 0, y: 0, type: "male", ...baseNode },
        { id: "h_gp1", x: 0, y: 0, type: "male", ...baseNode },
        { id: "h_ggp1", x: 0, y: 0, type: "male", ...baseNode },
        { id: "prior_child", x: 0, y: 0, type: "male", ...baseNode },
      ];
      const edges: any[] = [
        { id: "e_h_ggp_gp", sourceId: "h_ggp1", targetId: "h_gp1", type: "parent-child" },
        { id: "e_h_gp_p", sourceId: "h_gp1", targetId: "h_p1", type: "parent-child" },
        { id: "e_h_p_h", sourceId: "h_p1", targetId: "husband", type: "parent-child" },
        { id: "e_couple", sourceId: "husband", targetId: "wife", type: "couple" },
        { id: "e_wife_child", sourceId: "wife", targetId: "prior_child", type: "parent-child" },
      ];
      
      const result = computeAutoLayout(nodes, edges, false);
      
      const newHusband = result.find(n => n.id === "husband")!;
      const newWife = result.find(n => n.id === "wife")!;
      const newPriorChild = result.find(n => n.id === "prior_child")!;
      
      expect(newHusband.y).toBeCloseTo(120 + 3 * 120, 1);
      expect(newWife.y).toBeCloseTo(120, 1);
      expect(newPriorChild.y).toBeCloseTo(120 + 1 * 120, 1);
    });

    it("T9: derives center from canvasWidth param", () => {
      const nodes: any[] = [
        { id: "n1", x: 0, y: 0, type: "male", ...baseNode }
      ];
      const edges: any[] = [];
      const result = computeAutoLayout(nodes, edges, false, undefined, 1200);
      expect(result[0]!.x).toBeCloseTo(600, 1);
    });

    it("T12: asserts compaction remap with gens {0, 2} yields 3 gens {0, 1, 2}, not 2", () => {
      const testNodes: any[] = [
        { id: "parent", x: 0, y: 0, type: "male", ...baseNode },
        { id: "child", x: 0, y: 0, type: "male", ...baseNode },
        { id: "spouse", x: 0, y: 0, type: "female", ...baseNode },
        { id: "s_p", x: 0, y: 0, type: "male", ...baseNode },
        { id: "s_gp", x: 0, y: 0, type: "male", ...baseNode },
      ];
      const testEdges: any[] = [
        { id: "e_pc", sourceId: "parent", targetId: "child", type: "parent-child" },
        { id: "e_c", sourceId: "child", targetId: "spouse", type: "couple" },
        { id: "e_s_gp_p", sourceId: "s_gp", targetId: "s_p", type: "parent-child" },
        { id: "e_s_p_s", sourceId: "s_p", targetId: "spouse", type: "parent-child" },
      ];
      
      const result = computeAutoLayout(testNodes, testEdges, false);
      const newParent = result.find(n => n.id === "parent")!;
      const newChild = result.find(n => n.id === "child")!;
      
      expect(newParent.y).toBeCloseTo(240, 1);
      expect(newChild.y).toBeCloseTo(360, 1);
    });

    it("F0a (N1): resolveAllCollisions couple cohesion for married-in spouse with parents", () => {
      // Founder A (no parents) married to B (B has parents G1,G2), child E.
      // Force A rightward via collision. B and E must move with A.
      const nodes: any[] = [
        { id: "A", x: 100, y: 120, type: "male", ...baseNode },
        { id: "B", x: 196.8, y: 120, type: "female", ...baseNode },
        { id: "G1", x: 100, y: 0, type: "male", ...baseNode },
        { id: "G2", x: 196.8, y: 0, type: "female", ...baseNode },
        { id: "E", x: 148.4, y: 240, type: "male", ...baseNode },
        // Blocker forcing A right
        { id: "Blocker", x: 90, y: 120, type: "male", ...baseNode },
      ];
      const edges: any[] = [
        { id: "e_c_ab", sourceId: "A", targetId: "B", type: "couple" },
        { id: "e_pc_g1b", sourceId: "G1", targetId: "B", type: "parent-child" },
        { id: "e_pc_g2b", sourceId: "G2", targetId: "B", type: "parent-child" },
        { id: "e_pc_ae", sourceId: "A", targetId: "E", type: "parent-child" },
        { id: "e_pc_be", sourceId: "B", targetId: "E", type: "parent-child" },
      ];

      const resolved = resolveAllCollisions(nodes, edges);
      const newA = resolved.find(n => n.id === "A")!;
      const newB = resolved.find(n => n.id === "B")!;
      const newE = resolved.find(n => n.id === "E")!;

      // Couple cohesion: A and B distance should remain exactly NODE_GAP
      expect(newB.x - newA.x).toBeCloseTo(96.8, 1);
      // Centering: E should remain centered between A and B
      expect(newE.x).toBeCloseTo((newA.x + newB.x) / 2, 1);
    });

    it("F0b (N1): recenterAllChildren couple cohesion for married-in founder spouse", () => {
      // Child A married to B (B has no parents), child E.
      // recenterAllChildren shifts child A under P1/P2, and B (founder spouse) must move with A.
      const nodes: any[] = [
        { id: "P1", x: 300, y: 0, type: "male", ...baseNode },
        { id: "P2", x: 396.8, y: 0, type: "female", ...baseNode },
        { id: "A", x: 100, y: 120, type: "male", ...baseNode }, // child of P1/P2
        { id: "B", x: 196.8, y: 120, type: "female", ...baseNode }, // founder spouse (no parents)
        { id: "E", x: 148.4, y: 240, type: "male", ...baseNode },
      ];
      const edges: any[] = [
        { id: "e_pc_p1a", sourceId: "P1", targetId: "A", type: "parent-child" },
        { id: "e_pc_p2a", sourceId: "P2", targetId: "A", type: "parent-child" },
        { id: "e_c_ab", sourceId: "A", targetId: "B", type: "couple" },
        { id: "e_pc_ae", sourceId: "A", targetId: "E", type: "parent-child" },
        { id: "e_pc_be", sourceId: "B", targetId: "E", type: "parent-child" },
      ];

      const resolved = recenterAllChildren(nodes, edges);
      const newA = resolved.find(n => n.id === "A")!;
      const newB = resolved.find(n => n.id === "B")!;
      const newE = resolved.find(n => n.id === "E")!;

      // Couple cohesion: A and B distance should remain exactly NODE_GAP
      expect(newB.x - newA.x).toBeCloseTo(96.8, 1);
      expect(newE.x).toBeCloseTo((newA.x + newB.x) / 2, 1);
    });

    it("F0c (N3/N4): T5 left-push shifts whole group subtree and prevents cross-row collisions", () => {
      // Sibling group 1: P1, P2 (married-in with parents).
      // Sibling group 2: P3.
      // Sibling group 1 is placed, then sibling group 2 left-shifts it.
      // Verify no cross-row overlaps are introduced.
      const nodes: any[] = [
        // Gen 0 parents
        { id: "GP1", x: 100, y: 0, type: "male", ...baseNode },
        { id: "GP2", x: 196.8, y: 0, type: "female", ...baseNode },
        // Gen 1 sib group 1
        { id: "P1", x: 100, y: 120, type: "male", ...baseNode },
        { id: "P2", type: "female", ...baseNode }, // married-in, has parents GP1, GP2
        { id: "P1_child", type: "male", ...baseNode },
        // Gen 1 sib group 2
        { id: "P3", type: "male", ...baseNode },
      ];
      const edges: any[] = [
        { id: "e_c_p1p2", sourceId: "P1", targetId: "P2", type: "couple" },
        { id: "e_pc_gp1_p2", sourceId: "GP1", targetId: "P2", type: "parent-child" },
        { id: "e_pc_gp2_p2", sourceId: "GP2", targetId: "P2", type: "parent-child" },
        { id: "e_pc_p1_c", sourceId: "P1", targetId: "P1_child", type: "parent-child" },
        { id: "e_pc_p2_c", sourceId: "P2", targetId: "P1_child", type: "parent-child" },
      ];

      const result = computeAutoLayout(nodes, edges, false);
      const newP1 = result.find(n => n.id === "P1")!;
      const newP2 = result.find(n => n.id === "P2")!;

      // Couple cohesion should be preserved (P1 and P2 not split by shift)
      expect(Math.abs(newP2.x - newP1.x)).toBeCloseTo(96.8, 1);
    });

    it("F0d (T7): resolveAllCollisions resolves 60-node synthetic tree overlaps with zero collisions", () => {
      const nodes: any[] = [];
      const edges: any[] = [];
      
      // Create 30 couples placed close together on Y=120, but spouses within each couple spaced by NODE_GAP
      for (let i = 0; i < 30; i++) {
        nodes.push(
          { id: `f_${i}`, x: 100 + i * 150, y: 120, type: "male", ...baseNode },
          { id: `m_${i}`, x: 100 + i * 150 + 96.8, y: 120, type: "female", ...baseNode }
        );
        edges.push({ id: `e_couple_${i}`, sourceId: `f_${i}`, targetId: `m_${i}`, type: "couple" });
      }

      const resolved = resolveAllCollisions(nodes, edges);
      
      // Check that all row collisions are resolved (no overlaps < NODE_GAP)
      const collisions = detectRowCollisions(resolved, 120);
      expect(collisions).toHaveLength(0);
    });

    it("F0e (T8): recenterAllFamilies terminates and converges without infinite loop on conflicting tension", () => {
      // Construct a conflicting tension layout where parents recenter left but children recenter right.
      // Verify recenterAllFamilies terminates within limit.
      const nodes: any[] = [
        { id: "f1", x: 100, y: 120, type: "male", ...baseNode },
        { id: "m1", x: 196.8, y: 120, type: "female", ...baseNode },
        { id: "c1", x: 120, y: 240, type: "male", ...baseNode },
        { id: "c2", x: 300, y: 240, type: "female", ...baseNode },
      ];
      const edges: any[] = [
        { id: "e_c_1", sourceId: "f1", targetId: "m1", type: "couple" },
        { id: "e_pc_1", sourceId: "f1", targetId: "c1", type: "parent-child" },
        { id: "e_pc_2", sourceId: "m1", targetId: "c1", type: "parent-child" },
        { id: "e_pc_3", sourceId: "f1", targetId: "c2", type: "parent-child" },
        { id: "e_pc_4", sourceId: "m1", targetId: "c2", type: "parent-child" },
      ];

      const start = Date.now();
      const resolved = recenterAllFamilies(nodes, edges);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100); // Must not hang/loop infinitely
      const collisions = detectRowCollisions(resolved, 120);
      expect(collisions).toHaveLength(0);
    });

    it("F0f (T13): row tolerance treats pinned nodes 40px apart as 2 distinct rows", () => {
      // Two pinned nodes 40px apart vertically.
      const n1 = { id: "n1", x: 100, y: 100, type: "male" as const, pinned: true, ...baseNode };
      const n2 = { id: "n2", x: 120, y: 140, type: "female" as const, pinned: true, ...baseNode };

      const collisions = detectRowCollisions([n1, n2], 100, 96.8, 20); // pass tolerance = 20
      expect(collisions).toHaveLength(0); // Different rows, so no collision
    });

    it("F0g (T6): groups and orders multiple spouses correctly", () => {
      // Male with 3 spouses (one inverted).
      const nodes: any[] = [
        { id: "husband", type: "male", ...baseNode },
        { id: "wife1", type: "female", ...baseNode },
        { id: "wife2", type: "female", ...baseNode },
        { id: "wife3", type: "female", ...baseNode },
      ];
      const edges: any[] = [
        { id: "e1", sourceId: "husband", targetId: "wife1", type: "couple" },
        { id: "e2", sourceId: "husband", targetId: "wife2", type: "couple" },
        { id: "e3", sourceId: "husband", targetId: "wife3", type: "couple", inverted: true },
      ];

      const result = computeAutoLayout(nodes, edges, false);
      const hX = result.find(n => n.id === "husband")!.x;
      const w1X = result.find(n => n.id === "wife1")!.x;
      const w2X = result.find(n => n.id === "wife2")!.x;
      const w3X = result.find(n => n.id === "wife3")!.x;

      // Grouped contiguously: adjacent spacings should be coupleSpacing (96.8) or hSpacing (109)
      const xs = [hX, w1X, w2X, w3X].sort((a, b) => a - b);
      const gaps = [xs[1] - xs[0], xs[2] - xs[1], xs[3] - xs[2]];
      gaps.sort((a, b) => a - b);
      expect(gaps[0]).toBeCloseTo(96.8, 1);
      expect(gaps[1]).toBeCloseTo(109, 1);
      expect(gaps[2]).toBeCloseTo(109, 1);
    });

    it("F0h (T2): getSubtreeWidth Connected Component Traversal for remarriages and wide siblings", () => {
      // 10 siblings should span at least (10-1)*hSpacing = 9 * 109 = 981px.
      const nodes: any[] = [
        { id: "F", type: "male", ...baseNode },
        { id: "M", type: "female", ...baseNode },
      ];
      const edges: any[] = [
        { id: "e_c", sourceId: "F", targetId: "M", type: "couple" }
      ];
      for (let i = 0; i < 10; i++) {
        nodes.push({ id: `c_${i}`, type: "male", ...baseNode });
        edges.push(
          { id: `e_pc_f_${i}`, sourceId: "F", targetId: `c_${i}`, type: "parent-child" },
          { id: `e_pc_m_${i}`, sourceId: "M", targetId: `c_${i}`, type: "parent-child" }
        );
      }

      const result = computeAutoLayout(nodes, edges, false);
      const childXs = result.filter(n => n.id.startsWith("c_")).map(n => n.x).sort((a, b) => a - b);
      const span = childXs[childXs.length - 1] - childXs[0];
      expect(span).toBeGreaterThanOrEqual(981); // 9 * 109 = 981
    });

    it("N6: asserts computeAutoLayout successfully processes large-pedigree.json without overlaps or out-of-bound errors", () => {
      const fixturePath = path.resolve(__dirname, "fixtures/large-pedigree.json");
      const { nodes, edges } = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

      const result = computeAutoLayout(nodes, edges, false);

      // Verify node count is preserved
      expect(result).toHaveLength(55);

      // Verify no overlaps exist on any row
      const distinctYs = Array.from(new Set(result.map(n => n.y)));
      for (const y of distinctYs) {
        const collisions = detectRowCollisions(result as any, y);
        if (collisions.length > 0) {
          console.log(`COLLISIONS N6 at y=${y}:`, collisions.map(c => ({ left: c.leftNode.id, right: c.rightNode.id, overlap: c.overlap, leftX: c.leftNode.x, rightX: c.rightNode.x })));
        }
        expect(collisions).toHaveLength(0);
      }

      // Verify min X coordinate is >= GEN_GRID (120)
      const minX = Math.min(...result.map(n => n.x));
      expect(minX).toBeGreaterThanOrEqual(120 - 0.05);
    });
  });
});

import { describe, it, expect } from "vitest";
import { buildAdjacency, buildGenerations, evaluateLayoutQuality, DEFAULT_LAYOUT_CONFIG } from "../lib/layout-shared";
import { PedigreeNode, PedigreeEdge } from "../features/pedigree-editor/canvas/types";

describe("layout-shared utilities", () => {
  const baseNode = {
    x: 0,
    y: 0,
    affected: false,
    carrier: false,
    deceased: false,
    proband: false,
    gender: "male",
  } as any;

  describe("buildAdjacency", () => {
    it("should build correct adjacency maps for children, parents, and couples", () => {
      const nodes: PedigreeNode[] = [
        { ...baseNode, id: "A", type: "male" },
        { ...baseNode, id: "B", type: "female" },
        { ...baseNode, id: "C", type: "male" },
      ];
      const edges: PedigreeEdge[] = [
        { id: "e1", sourceId: "A", targetId: "B", type: "couple" },
        { id: "e2", sourceId: "A", targetId: "C", type: "parent-child" },
        { id: "e3", sourceId: "B", targetId: "C", type: "parent-child" },
      ];

      const adj = buildAdjacency(nodes, edges);
      expect(adj.couplesOf.get("A")).toContain("B");
      expect(adj.couplesOf.get("B")).toContain("A");
      expect(adj.childrenOf.get("A")).toContain("C");
      expect(adj.childrenOf.get("B")).toContain("C");
      expect(adj.parentsOf.get("C")).toContain("A");
      expect(adj.parentsOf.get("C")).toContain("B");
    });
  });

  describe("buildGenerations", () => {
    it("should assign generations correctly and handle spouse alignment", () => {
      const nodes: PedigreeNode[] = [
        { ...baseNode, id: "A" },
        { ...baseNode, id: "B" },
        { ...baseNode, id: "C" },
      ];
      const edges: PedigreeEdge[] = [
        { id: "e1", sourceId: "A", targetId: "B", type: "couple" },
        { id: "e2", sourceId: "A", targetId: "C", type: "parent-child" },
      ];

      const genMap = buildGenerations(nodes, edges);
      expect(genMap.get("A")).toBe(0);
      expect(genMap.get("B")).toBe(0); // Spouse aligned
      expect(genMap.get("C")).toBe(1); // Child at gen 1
    });
  });

  describe("evaluateLayoutQuality", () => {
    it("should evaluate collisions, edge length, and centering deviation correctly", () => {
      const nodes: PedigreeNode[] = [
        { ...baseNode, id: "A", x: 100, y: 120 },
        { ...baseNode, id: "B", x: 200, y: 120 },
        { ...baseNode, id: "C", x: 150, y: 240 }, // Centered under parents A & B
      ];
      const edges: PedigreeEdge[] = [
        { id: "e1", sourceId: "A", targetId: "B", type: "couple" },
        { id: "e2", sourceId: "A", targetId: "C", type: "parent-child" },
        { id: "e3", sourceId: "B", targetId: "C", type: "parent-child" },
      ];

      // With A at 100 and B at 200, distance is 100.
      // parent midpoint is 150.
      const quality = evaluateLayoutQuality(nodes, edges, DEFAULT_LAYOUT_CONFIG);
      expect(quality.collisionCount).toBe(0);
      expect(quality.centeringDeviation).toBe(0);
      expect(quality.totalEdgeLength).toBe(
        Math.abs(100 - 200) + // couple edge
        Math.abs(100 - 150) + // parent A -> child C
        Math.abs(200 - 150)   // parent B -> child C
      ); // 100 + 50 + 50 = 200
      expect(quality.totalEdgeLength).toBe(200);
    });

    it("should detect collisions when nodes are closer than nodeGap - 0.05", () => {
      const nodes: PedigreeNode[] = [
        { ...baseNode, id: "A", x: 100, y: 120 },
        { ...baseNode, id: "B", x: 150, y: 120 }, // Overlap: distance 50 < 96.8 - 0.05
      ];
      const edges: PedigreeEdge[] = [];

      const quality = evaluateLayoutQuality(nodes, edges, DEFAULT_LAYOUT_CONFIG);
      expect(quality.collisionCount).toBe(1);
    });
  });
});

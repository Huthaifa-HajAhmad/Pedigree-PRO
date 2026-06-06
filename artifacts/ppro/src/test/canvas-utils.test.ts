import { describe, it, expect } from "vitest";
import { PedigreeNode, PedigreeEdge } from "@/features/pedigree-editor/canvas/types";
import {
  computeEdgeLoopTrack,
  computeMaxLoopTrackOnRow,
  getIntermediateNodes,
  computeRelationDropY,
  computeCrossingXCoordinates,
  computeVerticalCrossingYCoordinates,
} from "../features/pedigree-editor/canvas/canvasUtils";

const baseNode = {
  affected: false,
  carrier: false,
  deceased: false,
  proband: false,
  label: "",
  age: "",
};

describe("canvasUtils loop tracking", () => {
  it("detects intermediate nodes correctly", () => {
    const nodes: PedigreeNode[] = [
      { id: "n1", x: 100, y: 150, type: "male", ...baseNode },
      { id: "n2", x: 200, y: 150, type: "female", ...baseNode },
      { id: "n3", x: 300, y: 150, type: "male", ...baseNode },
    ];
    const intermediates = getIntermediateNodes(nodes[0]!, nodes[2]!, nodes);
    expect(intermediates).toHaveLength(1);
    expect(intermediates[0]!.id).toBe("n2");
  });

  it("assigns non-conflicting track indexes to overlapping cousin loops", () => {
    // Overlapping intervals:
    // Edge 1 (n1 - n3): [100, 300]
    // Edge 2 (n2 - n4): [200, 400]
    const nodes: PedigreeNode[] = [
      { id: "n1", x: 100, y: 150, type: "male", ...baseNode },
      { id: "n2", x: 200, y: 150, type: "female", ...baseNode },
      { id: "n3", x: 300, y: 150, type: "male", ...baseNode },
      { id: "n4", x: 400, y: 150, type: "female", ...baseNode },
    ];

    const edges: PedigreeEdge[] = [
      { id: "e1", sourceId: "n1", targetId: "n3", type: "couple" },
      { id: "e2", sourceId: "n2", targetId: "n4", type: "couple" },
    ];

    const track1 = computeEdgeLoopTrack("e1", edges, nodes);
    const track2 = computeEdgeLoopTrack("e2", edges, nodes);

    // One of them must be track 0, the other track 1
    expect(track1).toBe(1);
    expect(track2).toBe(0);

    const maxTrack = computeMaxLoopTrackOnRow(150, edges, nodes);
    expect(maxTrack).toBe(1);
  });

  it("assigns track 0 to non-overlapping loop edges", () => {
    // Non-overlapping intervals:
    // Edge 1 (n1 - n3): [100, 300]
    // Edge 2 (n4 - n6): [400, 600]
    const nodes: PedigreeNode[] = [
      { id: "n1", x: 100, y: 150, type: "male", ...baseNode },
      { id: "n2", x: 200, y: 150, type: "female", ...baseNode },
      { id: "n3", x: 300, y: 150, type: "male", ...baseNode },
      { id: "n4", x: 400, y: 150, type: "female", ...baseNode },
      { id: "n5", x: 500, y: 150, type: "male", ...baseNode },
      { id: "n6", x: 600, y: 150, type: "female", ...baseNode },
    ];

    const edges: PedigreeEdge[] = [
      { id: "e1", sourceId: "n1", targetId: "n3", type: "couple" },
      { id: "e2", sourceId: "n4", targetId: "n6", type: "couple" },
    ];

    const track1 = computeEdgeLoopTrack("e1", edges, nodes);
    const track2 = computeEdgeLoopTrack("e2", edges, nodes);

    expect(track1).toBe(0);
    expect(track2).toBe(0);

    const maxTrack = computeMaxLoopTrackOnRow(150, edges, nodes);
    expect(maxTrack).toBe(0);
  });

  it("computes relation drop Y correctly accounting for auto labels", () => {
    const nodes: PedigreeNode[] = [
      { id: "n1", x: 100, y: 150, type: "male", ...baseNode, label: "Alice" },
      { id: "n2", x: 200, y: 150, type: "female", ...baseNode },
      { id: "n3", x: 300, y: 150, type: "male", ...baseNode },
    ];
    const intermediates = getIntermediateNodes(nodes[0]!, nodes[2]!, nodes);

    const autoLabels = new Map<string, string>([["n1", "I-1"]]);

    const yWithoutAuto = computeRelationDropY(nodes[0]!, nodes[2]!, intermediates, nodes, [], 44, undefined, false, autoLabels);
    const yWithAuto = computeRelationDropY(nodes[0]!, nodes[2]!, intermediates, nodes, [], 44, undefined, true, autoLabels);

    // With autoLabels enabled, the label height for n1 should include the auto label and be taller (24px vs 14px), so yWithAuto should be larger
    expect(yWithAuto).toBeGreaterThan(yWithoutAuto);
  });

  it("detects crossover coordinates for overlapping loops", () => {
    // Nodes at generation row Y=150
    // Loop 1 connects n1 (100) to n3 (300).
    // Loop 2 connects n2 (200) to n4 (400).
    const nodes: PedigreeNode[] = [
      { id: "n1", x: 100, y: 150, type: "male", ...baseNode },
      { id: "n2", x: 200, y: 150, type: "female", ...baseNode },
      { id: "n3", x: 300, y: 150, type: "male", ...baseNode },
      { id: "n4", x: 400, y: 150, type: "female", ...baseNode },
    ];

    const edges: PedigreeEdge[] = [
      { id: "e1", sourceId: "n1", targetId: "n3", type: "couple" },
      { id: "e2", sourceId: "n2", targetId: "n4", type: "couple" },
    ];

    // Track 0 Y drop for e2 is approx 150 + 22 + 12 + 0*8 = 184
    // Track 1 Y drop for e1 is approx 150 + 22 + 12 + 1*8 = 192
    const yDrop2 = 184;
    const crossings2 = computeCrossingXCoordinates(edges[1]!, yDrop2, 200, 400, edges, nodes, undefined, 44);

    // Loop 2 (e2) spans [200, 400] at Y=184.
    // Loop 1 (e1) vertical drop from n3 (300) spans from 172 to 192.
    // Y=184 is inside [172, 192], and X=300 is inside [205, 395].
    // So there should be a crossing at X=300 for e2!
    expect(crossings2).toContain(300);
  });

  it("detects vertical crossing Y coordinates for family drop lines", () => {
    // Same overlapping cousin scenario:
    // IV:1 (100) -- IV:2 (200) -- IV:3 (300) -- IV:4 (400)
    // Loop 1: IV:1 ↔ IV:3 (e1) — spans X [100, 300], on track 1
    // Loop 2: IV:2 ↔ IV:4 (e2) — spans X [200, 400], on track 0
    const nodes: PedigreeNode[] = [
      { id: "n1", x: 100, y: 150, type: "male", ...baseNode },
      { id: "n2", x: 200, y: 150, type: "female", ...baseNode },
      { id: "n3", x: 300, y: 150, type: "male", ...baseNode },
      { id: "n4", x: 400, y: 150, type: "female", ...baseNode },
    ];

    const edges: PedigreeEdge[] = [
      { id: "e1", sourceId: "n1", targetId: "n3", type: "couple" },
      { id: "e2", sourceId: "n2", targetId: "n4", type: "couple" },
    ];

    // Family of IV:1 & IV:2: midX = (100 + 22 + 200 - 22) / 2 = 150
    // Their child drop line goes from coupleY (no loop, so ~150) to barY (far below).
    // Loop e2 spans [200, 400] — midX=150 is NOT inside, so no crossing for this family.
    //
    // Family of IV:3 & IV:4: midX = (300 + 22 + 400 - 22) / 2 = 350
    // Their child drop line goes from coupleY to barY.
    // Loop e1 spans [100, 300] — midX=350 is NOT inside e1.
    // Loop e2 spans [200, 400] — midX=350 IS inside e2, but e2 is their own edge.
    //
    // Let's create a scenario where crossing actually happens:
    // midX = 250 (between node n2 and n3) is inside loop e1 [100, 300] AND e2 [200, 400]
    // With topY=150 and bottomY=250, the loop yDrops (~184 and ~192) should be detected.
    const crossings = computeVerticalCrossingYCoordinates(
      250, // midX — inside both loops
      150, // topY — above both yDrops
      250, // bottomY — below both yDrops
      edges,
      nodes,
      undefined,
      44,
      false,
      undefined,
      undefined, // no own edge to exclude
    );

    // Both loops have their horizontal segments at approximately y=184 and y=192
    // We expect both Y values to be detected
    expect(crossings.length).toBe(2);
    expect(crossings[0]).toBeLessThan(crossings[1]!);
  });

  it("excludes own edge from vertical crossing detection", () => {
    const nodes: PedigreeNode[] = [
      { id: "n1", x: 100, y: 150, type: "male", ...baseNode },
      { id: "n2", x: 200, y: 150, type: "female", ...baseNode },
      { id: "n3", x: 300, y: 150, type: "male", ...baseNode },
      { id: "n4", x: 400, y: 150, type: "female", ...baseNode },
    ];

    const edges: PedigreeEdge[] = [
      { id: "e1", sourceId: "n1", targetId: "n3", type: "couple" },
      { id: "e2", sourceId: "n2", targetId: "n4", type: "couple" },
    ];

    // midX=250 is inside both loops. Excluding e1 should give only e2's crossing.
    const crossingsExcludeE1 = computeVerticalCrossingYCoordinates(
      250, 150, 250, edges, nodes, undefined, 44, false, undefined, "e1"
    );
    expect(crossingsExcludeE1.length).toBe(1);

    // Excluding e2 should give only e1's crossing.
    const crossingsExcludeE2 = computeVerticalCrossingYCoordinates(
      250, 150, 250, edges, nodes, undefined, 44, false, undefined, "e2"
    );
    expect(crossingsExcludeE2.length).toBe(1);
  });

  it("detects vertical crossing Y coordinates when midX is exactly at loop boundaries (coincident X)", () => {
    // Loop e1 spans [100, 300]
    // Loop e2 spans [200, 400]
    // midX = 200 (exactly at the left boundary of Loop e2)
    // If topY = 150, bottomY = 250.
    // Loop e1 spans [100, 300] — midX = 200 is strictly inside.
    // Loop e2 spans [200, 400] — midX = 200 is exactly at left boundary of e2.
    // Calling computeVerticalCrossingYCoordinates at midX=200 should detect e1,
    // and if we don't exclude e2, it should also check/detect e2 if within range.
    const nodes: PedigreeNode[] = [
      { id: "n1", x: 100, y: 150, type: "male", ...baseNode },
      { id: "n2", x: 200, y: 150, type: "female", ...baseNode },
      { id: "n3", x: 300, y: 150, type: "male", ...baseNode },
      { id: "n4", x: 400, y: 150, type: "female", ...baseNode },
    ];
    const edges: PedigreeEdge[] = [
      { id: "e1", sourceId: "n1", targetId: "n3", type: "couple" },
      { id: "e2", sourceId: "n2", targetId: "n4", type: "couple" },
    ];

    // e1 yDrop = 192 (track 1)
    // e2 yDrop = 184 (track 0)
    // At midX = 200, both e1 and e2 crossings should be detected if we check midX = 200.
    const crossings = computeVerticalCrossingYCoordinates(
      200, 150, 250, edges, nodes, undefined, 44, false, undefined, undefined
    );
    expect(crossings).toContain(184); // e2
    expect(crossings).toContain(192); // e1
  });
});

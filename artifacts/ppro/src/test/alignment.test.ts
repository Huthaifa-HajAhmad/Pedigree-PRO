import { describe, it, expect } from "vitest";
import { PedigreeNode, PedigreeEdge, PedigreeAnnotation } from "@/features/pedigree-editor/canvas/types";
import { buildAdjacency } from "@/lib/layout-shared";
import { collectSubtree } from "@/lib/layout-engine";

// Helper function that replicates the alignment logic from PedigreeEditorProvider for testing
function runAlignSelected(
  axis: "x" | "y",
  selectedIds: Set<string>,
  canvas: { nodes: PedigreeNode[]; edges: PedigreeEdge[]; annotations?: PedigreeAnnotation[] }
) {
  const selectedNodes = canvas.nodes.filter((n) => selectedIds.has(n.id));
  const avg = selectedNodes.reduce((sum, n) => sum + n[axis], 0) / selectedNodes.length;

  const adj = new Map<string, string[]>();
  for (const n of canvas.nodes) adj.set(n.id, []);
  for (const e of canvas.edges) {
    if (adj.has(e.sourceId) && adj.has(e.targetId)) {
      adj.get(e.sourceId)!.push(e.targetId);
      adj.get(e.targetId)!.push(e.sourceId);
    }
  }

  const visited = new Set<string>();
  const nodeToComponent = new Map<string, string[]>();
  for (const n of canvas.nodes) {
    if (!visited.has(n.id)) {
      const comp: string[] = [];
      const queue = [n.id];
      visited.add(n.id);
      let head = 0;
      while (head < queue.length) {
        const curr = queue[head]!;
        head++;
        comp.push(curr);
        for (const neighbor of adj.get(curr) || []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
      comp.forEach(id => nodeToComponent.set(id, comp));
    }
  }

  const componentToSelected = new Map<string[], PedigreeNode[]>();
  selectedNodes.forEach(node => {
    const comp = nodeToComponent.get(node.id) || [node.id];
    if (!componentToSelected.has(comp)) componentToSelected.set(comp, []);
    componentToSelected.get(comp)!.push(node);
  });

  if (componentToSelected.size > 1) {
    const newNodes = canvas.nodes.map(n => ({ ...n }));
    const newAnnotations = canvas.annotations?.map(a => ({ ...a })) || [];

    for (const [comp, selNodes] of componentToSelected.entries()) {
      const compAvg = selNodes.reduce((sum, n) => sum + n[axis], 0) / selNodes.length;
      const delta = avg - compAvg;

      const compSet = new Set(comp);
      newNodes.forEach(n => {
        if (compSet.has(n.id)) {
          n[axis] += delta;
        }
      });
      newAnnotations.forEach(a => {
        if (a.nodeId && compSet.has(a.nodeId)) {
          if (axis === "x" && a.x !== undefined) a.x += delta;
          if (axis === "y" && a.y !== undefined) a.y += delta;
        }
      });
    }
    return { ...canvas, nodes: newNodes, annotations: newAnnotations };
  } else {
    return {
      ...canvas,
      nodes: canvas.nodes.map((n) => selectedIds.has(n.id) ? { ...n, [axis]: avg } : n)
    };
  }
}

// Helper function that replicates the distribution logic from PedigreeEditorProvider for testing
function runDistributeSelected(
  axis: "x" | "y",
  selectedIds: Set<string>,
  canvas: { nodes: PedigreeNode[]; edges: PedigreeEdge[]; annotations?: PedigreeAnnotation[] }
) {
  const selectedNodes = canvas.nodes.filter((n) => selectedIds.has(n.id));

  const adj = new Map<string, string[]>();
  for (const n of canvas.nodes) adj.set(n.id, []);
  for (const e of canvas.edges) {
    if (adj.has(e.sourceId) && adj.has(e.targetId)) {
      adj.get(e.sourceId)!.push(e.targetId);
      adj.get(e.targetId)!.push(e.sourceId);
    }
  }

  const visited = new Set<string>();
  const nodeToComponent = new Map<string, string[]>();
  for (const n of canvas.nodes) {
    if (!visited.has(n.id)) {
      const comp: string[] = [];
      const queue = [n.id];
      visited.add(n.id);
      let head = 0;
      while (head < queue.length) {
        const curr = queue[head]!;
        head++;
        comp.push(curr);
        for (const neighbor of adj.get(curr) || []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
      comp.forEach(id => nodeToComponent.set(id, comp));
    }
  }

  const componentToSelected = new Map<string[], PedigreeNode[]>();
  selectedNodes.forEach(node => {
    const comp = nodeToComponent.get(node.id) || [node.id];
    if (!componentToSelected.has(comp)) componentToSelected.set(comp, []);
    componentToSelected.get(comp)!.push(node);
  });

  if (componentToSelected.size > 1) {
    const families = [...componentToSelected.entries()].map(([comp, selNodes]) => {
      const compAvg = selNodes.reduce((sum, n) => sum + n[axis], 0) / selNodes.length;
      return { comp, compAvg };
    });

    families.sort((a, b) => a.compAvg - b.compAvg);

    const m = families.length;
    if (m < 2) return canvas;

    const first = families[0]!;
    const last = families[m - 1]!;
    const totalSpan = last.compAvg - first.compAvg;
    if (Math.abs(totalSpan) < 1) return canvas;

    const interval = totalSpan / (m - 1);
    const newNodes = canvas.nodes.map(n => ({ ...n }));
    const newAnnotations = canvas.annotations?.map(a => ({ ...a })) || [];

    for (let i = 1; i < m - 1; i++) {
      const fam = families[i]!;
      const targetCoord = first.compAvg + i * interval;
      const delta = targetCoord - fam.compAvg;

      const compSet = new Set(fam.comp);
      newNodes.forEach(n => {
        if (compSet.has(n.id)) {
          n[axis] += delta;
        }
      });
      newAnnotations.forEach(a => {
        if (a.nodeId && compSet.has(a.nodeId)) {
          if (axis === "x" && a.x !== undefined) a.x += delta;
          if (axis === "y" && a.y !== undefined) a.y += delta;
        }
      });
    }
    return { ...canvas, nodes: newNodes, annotations: newAnnotations };
  } else {
    const structuralAdj = buildAdjacency(canvas.nodes, canvas.edges);
    const sortedNodes = [...selectedNodes].sort((a, b) => a[axis] - b[axis]);

    const tolerance = axis === "y" ? 60 : 50;
    const bands: PedigreeNode[][] = [];

    for (const n of sortedNodes) {
      let foundBand = false;
      for (const b of bands) {
        const representative = b[0]!;
        if (Math.abs(representative[axis] - n[axis]) < tolerance) {
          b.push(n);
          foundBand = true;
          break;
        }
      }
      if (!foundBand) {
        bands.push([n]);
      }
    }

    const m = bands.length;
    if (m < 3) return canvas;

    const firstBand = bands[0]!;
    const lastBand = bands[m - 1]!;

    const getBandCoord = (b: PedigreeNode[]) => b.reduce((sum, n) => sum + n[axis], 0) / b.length;

    const firstCoord = getBandCoord(firstBand);
    const lastCoord = getBandCoord(lastBand);
    const totalSpan = lastCoord - firstCoord;
    if (Math.abs(totalSpan) < 1) return canvas;

    const interval = totalSpan / (m - 1);
    const newNodes = canvas.nodes.map(n => ({ ...n }));
    const newAnnotations = canvas.annotations?.map(a => ({ ...a })) || [];

    for (let i = 0; i < m; i++) {
      const band = bands[i]!;
      const bandCoord = getBandCoord(band);
      const targetCoord = firstCoord + i * interval;
      const delta = targetCoord - bandCoord;

      const visited = new Set<string>();
      for (let j = 0; j < m; j++) {
        if (i !== j) {
          bands[j]!.forEach(node => visited.add(node.id));
        }
      }

      band.forEach(node => {
        const localVisited = new Set(visited);
        const subtree = collectSubtree(node.id, structuralAdj, localVisited, { anchorMarriedIn: true });

        for (const item of visited) {
          subtree.delete(item);
        }

        newNodes.forEach(n => {
          if (subtree.has(n.id)) {
            n[axis] += delta;
          }
        });
        newAnnotations.forEach(a => {
          if (a.nodeId && subtree.has(a.nodeId)) {
            if (axis === "x" && a.x !== undefined) a.x += delta;
            if (axis === "y" && a.y !== undefined) a.y += delta;
          }
        });
      });
    }

    return { ...canvas, nodes: newNodes, annotations: newAnnotations };
  }
}

describe("Align and Distribute Operations", () => {
  const baseNode = { affected: false, carrier: false, deceased: false, proband: false, label: "", age: "" };

  it("aligns individual nodes inside a single family", () => {
    const canvas = {
      nodes: [
        { id: "n1", type: "male", x: 100, y: 100, ...baseNode } as PedigreeNode,
        { id: "n2", type: "female", x: 200, y: 150, ...baseNode } as PedigreeNode,
        { id: "n3", type: "male", x: 300, y: 200, ...baseNode } as PedigreeNode,
      ],
      edges: [
        { id: "e1", sourceId: "n1", targetId: "n2", type: "couple" },
        { id: "e2", sourceId: "n2", targetId: "n3", type: "parent-child" },
      ] as PedigreeEdge[],
    };

    const selected = new Set(["n1", "n2", "n3"]);
    const result = runAlignSelected("y", selected, canvas);
    expect(result.nodes.find(n => n.id === "n1")?.y).toBe(150);
    expect(result.nodes.find(n => n.id === "n2")?.y).toBe(150);
    expect(result.nodes.find(n => n.id === "n3")?.y).toBe(150);
  });

  it("aligns whole family components horizontally preserving internal spacing", () => {
    const canvas = {
      nodes: [
        { id: "n1", type: "male", x: 100, y: 100, ...baseNode } as PedigreeNode,
        { id: "n2", type: "female", x: 200, y: 100, ...baseNode } as PedigreeNode,
        { id: "n3", type: "male", x: 400, y: 200, ...baseNode } as PedigreeNode,
        { id: "n4", type: "female", x: 500, y: 200, ...baseNode } as PedigreeNode,
      ],
      edges: [
        { id: "e1", sourceId: "n1", targetId: "n2", type: "couple" },
        { id: "e2", sourceId: "n3", targetId: "n4", type: "couple" },
      ] as PedigreeEdge[],
    };

    const selected = new Set(["n1", "n3"]);
    const result = runAlignSelected("y", selected, canvas);

    expect(result.nodes.find(n => n.id === "n1")?.y).toBe(150);
    expect(result.nodes.find(n => n.id === "n2")?.y).toBe(150);
    expect(result.nodes.find(n => n.id === "n3")?.y).toBe(150);
    expect(result.nodes.find(n => n.id === "n4")?.y).toBe(150);
  });

  it("distributes individual nodes and shifts their spouses and children rigidly", () => {
    const canvas = {
      nodes: [
        { id: "n1", type: "male", x: 100, y: 100, ...baseNode } as PedigreeNode,
        { id: "n2", type: "female", x: 300, y: 100, ...baseNode } as PedigreeNode,
        { id: "n4", type: "male", x: 350, y: 100, ...baseNode } as PedigreeNode, // spouse of n2
        { id: "n5", type: "female", x: 325, y: 200, ...baseNode } as PedigreeNode, // child of n2
        { id: "n3", type: "male", x: 400, y: 100, ...baseNode } as PedigreeNode,
      ],
      edges: [
        { id: "e1", sourceId: "n2", targetId: "n4", type: "couple" },
        { id: "e2", sourceId: "n2", targetId: "n5", type: "parent-child" },
        { id: "e3", sourceId: "n4", targetId: "n5", type: "parent-child" },
        { id: "e4", sourceId: "n1", targetId: "n2", type: "parent-child" },
        { id: "e5", sourceId: "n2", targetId: "n3", type: "parent-child" },
      ] as PedigreeEdge[],
    };

    const selected = new Set(["n1", "n2", "n3"]);
    const result = runDistributeSelected("x", selected, canvas);
    expect(result.nodes.find(n => n.id === "n1")?.x).toBe(100);
    expect(result.nodes.find(n => n.id === "n2")?.x).toBe(250);
    expect(result.nodes.find(n => n.id === "n4")?.x).toBe(300);
    expect(result.nodes.find(n => n.id === "n5")?.x).toBe(275);
    expect(result.nodes.find(n => n.id === "n3")?.x).toBe(400);
  });

  it("distributes vertically, grouping nodes in the same generation band together", () => {
    // n1 (Gen I, Y=100)
    // n2 and n3 (Gen II, Y=200, at different X columns)
    // n4 (Gen III, Y=300)
    const canvas = {
      nodes: [
        { id: "n1", type: "male", x: 100, y: 100, ...baseNode } as PedigreeNode,
        { id: "n2", type: "female", x: 100, y: 200, ...baseNode } as PedigreeNode,
        { id: "n3", type: "male", x: 250, y: 200, ...baseNode } as PedigreeNode,
        { id: "n4", type: "female", x: 100, y: 300, ...baseNode } as PedigreeNode,
      ],
      edges: [
        { id: "e1", sourceId: "n1", targetId: "n2", type: "parent-child" },
        { id: "e2", sourceId: "n1", targetId: "n3", type: "parent-child" },
        { id: "e3", sourceId: "n2", targetId: "n4", type: "parent-child" },
      ] as PedigreeEdge[],
    };

    const selected = new Set(["n1", "n2", "n3", "n4"]);
    // Original Ys: n1: 100, n2: 200, n3: 200, n4: 300.
    // Grouped into 3 bands:
    // Band 1: [n1] at Y=100
    // Band 2: [n2, n3] at Y=200
    // Band 3: [n4] at Y=300
    //
    // Changing the input coordinates to cause actual shifts:
    // n2 and n3 are set to Y=180.
    canvas.nodes.find(n => n.id === "n2")!.y = 180;
    canvas.nodes.find(n => n.id === "n3")!.y = 180;
    // Bands:
    // Band 1: [n1] at Y=100
    // Band 2: [n2, n3] at Y=180
    // Band 3: [n4] at Y=300
    // Representative Y for Band 2 is 180.
    // Total span: 300 - 100 = 200. Interval = 100.
    // Target Y coordinates:
    // Band 1: 100, Band 2: 200 (delta = +20), Band 3: 300
    // Expect both n2 and n3 to be moved together to Y=200!
    const result = runDistributeSelected("y", selected, canvas);

    expect(result.nodes.find(n => n.id === "n1")?.y).toBe(100);
    expect(result.nodes.find(n => n.id === "n2")?.y).toBe(200);
    expect(result.nodes.find(n => n.id === "n3")?.y).toBe(200);
    expect(result.nodes.find(n => n.id === "n4")?.y).toBe(300);
  });

  it("distributes whole family components based on equal spacing gaps", () => {
    const canvas = {
      nodes: [
        { id: "n1", type: "male", x: 100, y: 100, ...baseNode } as PedigreeNode,
        { id: "n2", type: "female", x: 200, y: 100, ...baseNode } as PedigreeNode,
        { id: "n3", type: "male", x: 350, y: 100, ...baseNode } as PedigreeNode,
        { id: "n4", type: "female", x: 450, y: 100, ...baseNode } as PedigreeNode,
        { id: "n5", type: "male", x: 700, y: 100, ...baseNode } as PedigreeNode,
        { id: "n6", type: "female", x: 800, y: 100, ...baseNode } as PedigreeNode,
      ],
      edges: [
        { id: "e1", sourceId: "n1", targetId: "n2", type: "couple" },
        { id: "e2", sourceId: "n3", targetId: "n4", type: "couple" },
        { id: "e3", sourceId: "n5", targetId: "n6", type: "couple" },
      ] as PedigreeEdge[],
    };

    const selected = new Set(["n1", "n3", "n5"]);
    const result = runDistributeSelected("x", selected, canvas);

    expect(result.nodes.find(n => n.id === "n3")?.x).toBe(400); // 350 + 50
    expect(result.nodes.find(n => n.id === "n4")?.x).toBe(500); // 450 + 50

    expect(result.nodes.find(n => n.id === "n1")?.x).toBe(100); // No change
    expect(result.nodes.find(n => n.id === "n5")?.x).toBe(700); // No change
  });
});

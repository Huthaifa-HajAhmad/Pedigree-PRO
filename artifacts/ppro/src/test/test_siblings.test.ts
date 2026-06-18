import { describe, it, expect } from "vitest";
import {
  resolveAllCollisions,
  swapCouplePartners,
  recenterAllFamilies,
  resolveAndRecenter
} from "../lib/layout-engine";
import { PedigreeNode, PedigreeEdge } from "@/features/pedigree-editor/canvas/types";

const baseNode = {
  affected: false,
  carrier: false,
  deceased: false,
  proband: false,
  label: "",
  age: "",
};

const NODE_GAP = 96.8;
const GEN_GRID = 120;

describe("siblings-recenter-test", () => {
  it("verifies local layout and resolveAndRecenter for addSiblings", () => {
    // 1. Two joined extended families:
    // Family A: I:1 & I:2 -> II:5
    // Family B: I:3 & I:4 -> II:6
    // II:5 & II:6 are couples.
    // Let's place Family A on the left, Family B on the right.
    const nodes: PedigreeNode[] = [
      // Family A
      { id: "I:1", x: 120, y: 120, type: "male", ...baseNode },
      { id: "I:2", x: 216.8, y: 120, type: "female", ...baseNode },
      { id: "II:5", x: 168.4, y: 240, type: "male", ...baseNode },

      // Family B
      { id: "I:3", x: 420, y: 120, type: "male", ...baseNode },
      { id: "I:4", x: 516.8, y: 120, type: "female", ...baseNode },
      { id: "II:6", x: 468.4, y: 240, type: "female", ...baseNode },
    ];

    const edges: PedigreeEdge[] = [
      // Family A couple
      { id: "e_c_a", type: "couple", sourceId: "I:1", targetId: "I:2" },
      { id: "e_pc_a1", type: "parent-child", sourceId: "I:1", targetId: "II:5" },
      { id: "e_pc_a2", type: "parent-child", sourceId: "I:2", targetId: "II:5" },

      // Family B couple
      { id: "e_c_b", type: "couple", sourceId: "I:3", targetId: "I:4" },
      { id: "e_pc_b1", type: "parent-child", sourceId: "I:3", targetId: "II:6" },
      { id: "e_pc_b2", type: "parent-child", sourceId: "I:4", targetId: "II:6" },

      // Joined couple II:5 & II:6
      { id: "e_joined", type: "couple", sourceId: "II:5", targetId: "II:6" },
    ];

    // Let's simulate adding sibling to I:4 (which has no parents in nodes).
    // This requires auto-creating parents above I:4.
    const s = nodes.find(n => n.id === "I:4")!;
    const now = Date.now();
    
    // Auto-create parents for I:4 (gp_father, gp_mother)
    const fid = "gp_father";
    const mid = "gp_mother";
    const parentY = s.y - GEN_GRID; // 0
    const fatherX = Math.max(GEN_GRID, s.x - NODE_GAP / 2 + 0.01);
    const motherX = Math.max(fatherX + NODE_GAP, s.x + NODE_GAP / 2 - 0.01);

    const createdParents: PedigreeNode[] = [
      { id: fid, type: "male", ...baseNode, x: fatherX, y: parentY },
      { id: mid, type: "female", ...baseNode, x: motherX, y: parentY },
    ];
    const coupleEdges = [
      { id: `e_couple_gp`, type: "couple" as const, sourceId: fid, targetId: mid }
    ];

    // We add new sibling 'new_sib'
    const newSibId = "new_sib";
    
    // finalChildIdsOrder contains the order: [I:4, new_sib]
    const finalChildIdsOrder = ["I:4", "new_sib"];
    const existingChildren = [s]; // just I:4

    // Apply our spacing logic:
    const currentX = new Map<string, number>();
    for (const child of existingChildren) {
      currentX.set(child.id, child.x);
    }

    const newNodes: PedigreeNode[] = [];
    const newSiblingEntries = [{ id: newSibId, type: "female" as const, dob: "" }];

    for (const sb of newSiblingEntries) {
      const idx = finalChildIdsOrder.indexOf(sb.id);
      let xVal = s.x;
      if (idx !== -1) {
        let leftIdx = -1;
        for (let i = idx - 1; i >= 0; i--) {
          if (currentX.has(finalChildIdsOrder[i]!)) {
            leftIdx = i;
            break;
          }
        }
        let rightIdx = -1;
        for (let i = idx + 1; i < finalChildIdsOrder.length; i++) {
          if (currentX.has(finalChildIdsOrder[i]!)) {
            rightIdx = i;
            break;
          }
        }

        if (leftIdx !== -1 && rightIdx !== -1) {
          const leftX = currentX.get(finalChildIdsOrder[leftIdx]!)!;
          const rightX = currentX.get(finalChildIdsOrder[rightIdx]!)!;
          xVal = leftX + ((idx - leftIdx) / (rightIdx - leftIdx)) * (rightX - leftX);
        } else if (leftIdx !== -1) {
          xVal = currentX.get(finalChildIdsOrder[leftIdx]!)! + (idx - leftIdx) * NODE_GAP;
        } else if (rightIdx !== -1) {
          xVal = currentX.get(finalChildIdsOrder[rightIdx]!)! - (rightIdx - idx) * NODE_GAP;
        }
      }

      newNodes.push({
        id: sb.id,
        type: sb.type,
        affected: false,
        carrier: false,
        deceased: false,
        proband: false,
        label: "",
        age: "",
        x: xVal,
        y: s.y,
      });
      currentX.set(sb.id, xVal);
    }

    // Rebuild parent-child edges
    const parentChildEdges: PedigreeEdge[] = [];
    const parentIds = [fid, mid];
    let edgeIndex = 0;
    for (const pid of parentIds) {
      for (const cid of finalChildIdsOrder) {
        parentChildEdges.push({
          id: `e_pc_gp_${pid}_${cid}_${edgeIndex++}`,
          type: "parent-child",
          sourceId: pid,
          targetId: cid,
        });
      }
    }

    // Filter out old parent-child edges for the siblings (none existed for I:4 since parentIds was empty)
    const allNodes = [...nodes, ...createdParents, ...newNodes];
    const allEdges = [...edges, ...coupleEdges, ...parentChildEdges];

    console.log("BEFORE RESOLVE AND RECENTER:");
    allNodes.forEach(n => console.log(`${n.id}: x=${n.x}, y=${n.y}`));

    const excludeIds = new Set([
      ...newNodes.map(n => n.id)
    ]);

    const resolved = resolveAllCollisions(allNodes, allEdges, excludeIds);
    console.log("\nAFTER resolveAllCollisions:");
    resolved.forEach(n => console.log(`${n.id}: x=${n.x}, y=${n.y}`));

    const swapped = swapCouplePartners(resolved, allEdges);
    console.log("\nAFTER swapCouplePartners:");
    swapped.forEach(n => console.log(`${n.id}: x=${n.x}, y=${n.y}`));

    const final = recenterAllFamilies(swapped, allEdges, excludeIds);
    console.log("\nAFTER recenterAllFamilies:");
    final.forEach(n => console.log(`${n.id}: x=${n.x}, y=${n.y}`));

    // Verify:
    // 1. Family A nodes (I:1, I:2, II:5) should remain stable at their x coordinates
    const i1 = final.find(n => n.id === "I:1")!;
    const i2 = final.find(n => n.id === "I:2")!;
    const ii5 = final.find(n => n.id === "II:5")!;

    expect(i1.x).toBe(120);
    expect(i2.x).toBe(216.8);
    expect(ii5.x).toBe(168.4);

    // 2.gp_father and gp_mother should be centered above I:4 and new_sib
    const gpf = final.find(n => n.id === "gp_father")!;
    const gpm = final.find(n => n.id === "gp_mother")!;
    const i4 = final.find(n => n.id === "I:4")!;
    const ns = final.find(n => n.id === "new_sib")!;

    console.log(`gp_father: x=${gpf.x}, gp_mother: x=${gpm.x}`);
    console.log(`I:4: x=${i4.x}, new_sib: x=${ns.x}`);

    expect(ns.x).toBeGreaterThan(i4.x); // new_sib is younger/placed to the right
  });

  it("verifies spouse swap manual override with inverted couple edge", () => {
    // A couple: male node III:9, female node III:10.
    // They are inverted (female on left, male on right).
    const nodes: PedigreeNode[] = [
      { id: "III:9", x: 250, y: 120, type: "male", ...baseNode },
      { id: "III:10", x: 150, y: 120, type: "female", ...baseNode },
    ];

    const edges: PedigreeEdge[] = [
      { id: "e_couple_9_10", type: "couple", sourceId: "III:9", targetId: "III:10", inverted: true },
    ];

    const final = resolveAndRecenter(nodes, edges);

    const m = final.find(n => n.id === "III:9")!;
    const f = final.find(n => n.id === "III:10")!;

    // Male should remain to the right of female because inverted: true
    expect(m.x).toBeGreaterThan(f.x);
  });

  it("verifies parent recentering respects inverted couple edge for parents", () => {
    // A couple with a child:
    // II:5 (female) is on the left (x: 150), II:6 (male) is on the right (x: 250).
    // They are inverted.
    // Child III:6 (male) is at x: 200.
    const nodes: PedigreeNode[] = [
      { id: "II:5", x: 150, y: 120, type: "female", ...baseNode },
      { id: "II:6", x: 250, y: 120, type: "male", ...baseNode },
      { id: "III:6", x: 200, y: 240, type: "male", ...baseNode },
    ];

    const edges: PedigreeEdge[] = [
      { id: "e_c_ii5_ii6", type: "couple", sourceId: "II:5", targetId: "II:6", inverted: true },
      { id: "e_pc_iii6_m", type: "parent-child", sourceId: "II:5", targetId: "III:6" },
      { id: "e_pc_iii6_f", type: "parent-child", sourceId: "II:6", targetId: "III:6" },
    ];

    const final = resolveAndRecenter(nodes, edges);

    const f = final.find(n => n.id === "II:5")!;
    const m = final.find(n => n.id === "II:6")!;

    // Male (II:6) should remain to the right of female (II:5) because inverted: true
    expect(m.x).toBeGreaterThan(f.x);
  });
});

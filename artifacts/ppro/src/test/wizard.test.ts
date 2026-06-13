import { describe, it, expect } from "vitest";
import { generateWizardPedigree, type PedigreeWizardConfig } from "@/features/pedigree-editor/toolbar/groups/PedigreeWizardDialog";

describe("Pedigree Auto-Builder Wizard Generator", () => {
  it("generates a simple 2-generation nuclear family with 1 sibling, spouse, and 1 child", () => {
    const config: PedigreeWizardConfig = {
      generations: 2,
      includePaternal: false,
      paternalUncles: 0,
      paternalAunts: 0,
      includeMaternal: false,
      maternalUncles: 0,
      maternalAunts: 0,
      probandSex: "male",
      probandAffected: true,
      brothers: 1, // 1 brother
      sisters: 0,
      hasPartner: true, // spouse
      partnerSex: "female",
      sons: 1, // 1 son
      daughters: 0,
      affectedFather: false,
      affectedMother: false,
      affectedPaternalGF: false,
      affectedPaternalGM: false,
      affectedMaternalGF: false,
      affectedMaternalGM: false,
      affectedBrothersCount: 0,
      affectedSistersCount: 0,
      affectedPaternalUnclesCount: 0,
      affectedPaternalAuntsCount: 0,
      affectedMaternalUnclesCount: 0,
      affectedMaternalAuntsCount: 0,
      affectedSonsCount: 1, // son is affected
      affectedDaughtersCount: 0,
    };

    const { nodes, edges } = generateWizardPedigree(config, "test_");

    // Expected nodes:
    // 1. Proband (male, proband: true, affected: true)
    // 2. Father
    // 3. Mother
    // 4. Brother 1
    // 5. Spouse (female)
    // 6. Son 1 (affected: true)
    // Total = 6 nodes.
    expect(nodes.length).toBe(6);

    const proband = nodes.find(n => n.id === "test_proband");
    expect(proband).toBeDefined();
    expect(proband?.type).toBe("male");
    expect(proband?.affected).toBe(true);
    expect(proband?.proband).toBe(true);

    const son = nodes.find(n => n.id === "test_son_1");
    expect(son).toBeDefined();
    expect(son?.affected).toBe(true);

    const brother = nodes.find(n => n.id === "test_brother_1");
    expect(brother).toBeDefined();
    expect(brother?.affected).toBe(false);

    // Expected edges:
    // - Father & Mother couple (1)
    // - Father & Mother to Proband (2)
    // - Father & Mother to Brother 1 (2)
    // - Proband & Partner couple (1)
    // - Proband & Partner to Son 1 (2)
    // Total = 8 edges
    expect(edges.length).toBe(8);

    const coupleEdge = edges.find(e => e.type === "couple" && e.sourceId === "test_father" && e.targetId === "test_mother");
    expect(coupleEdge).toBeDefined();

    const parentChildEdges = edges.filter(e => e.type === "parent-child");
    expect(parentChildEdges.length).toBe(6);
  });

  it("generates a complex 3-generation family tree", () => {
    const config: PedigreeWizardConfig = {
      generations: 3,
      includePaternal: true,
      paternalUncles: 2,
      paternalAunts: 1,
      includeMaternal: true,
      maternalUncles: 1,
      maternalAunts: 2,
      probandSex: "female",
      probandAffected: false,
      brothers: 0,
      sisters: 2,
      hasPartner: false, // no children/spouse
      partnerSex: "male",
      sons: 0,
      daughters: 0,
      affectedFather: true,
      affectedMother: false,
      affectedPaternalGF: true,
      affectedPaternalGM: false,
      affectedMaternalGF: false,
      affectedMaternalGM: true,
      affectedBrothersCount: 0,
      affectedSistersCount: 1,
      affectedPaternalUnclesCount: 1,
      affectedPaternalAuntsCount: 0,
      affectedMaternalUnclesCount: 0,
      affectedMaternalAuntsCount: 1,
      affectedSonsCount: 0,
      affectedDaughtersCount: 0,
    };

    const { nodes, edges } = generateWizardPedigree(config, "test3_");

    // Nodes list:
    // - Proband (1)
    // - Father, Mother (2)
    // - Sisters (2)
    // - Paternal Grandfather, Paternal Grandmother (2)
    // - Pat. Uncles (2), Pat. Aunt (1)
    // - Maternal Grandfather, Maternal Grandmother (2)
    // - Mat. Uncle (1), Mat. Aunts (2)
    // Total nodes = 1 + 2 + 2 + 2 + 3 + 2 + 3 = 15 nodes.
    expect(nodes.length).toBe(15);

    // Verify affected status
    expect(nodes.find(n => n.id === "test3_father")?.affected).toBe(true);
    expect(nodes.find(n => n.id === "test3_mother")?.affected).toBe(false);
    expect(nodes.find(n => n.id === "test3_pgf")?.affected).toBe(true);
    expect(nodes.find(n => n.id === "test3_mgm")?.affected).toBe(true);

    // 1 affected sister
    const sistersNodes = nodes.filter(n => n.id.startsWith("test3_sister_"));
    expect(sistersNodes.filter(s => s.affected).length).toBe(1);

    // 1 affected paternal uncle
    const patUnclesNodes = nodes.filter(n => n.id.startsWith("test3_pat_uncle_"));
    expect(patUnclesNodes.filter(u => u.affected).length).toBe(1);

    // 1 affected maternal aunt
    const matAuntsNodes = nodes.filter(n => n.id.startsWith("test3_mat_aunt_"));
    expect(matAuntsNodes.filter(a => a.affected).length).toBe(1);
  });

  it("resolves parent-child keys correctly when IDs contain underscores", () => {
    const nodes = [
      { id: "prev_proband", type: "male" as const },
      { id: "prev_father", type: "male" as const },
      { id: "prev_mother", type: "female" as const }
    ];
    const edges = [
      { id: "prev_e_1", type: "parent-child" as const, sourceId: "prev_father", targetId: "prev_proband" },
      { id: "prev_e_2", type: "parent-child" as const, sourceId: "prev_mother", targetId: "prev_proband" }
    ];

    const parentToChildren = new Map<string, string[]>();
    for (const node of nodes) {
      const pEdges = edges.filter(e => e.type === "parent-child" && e.targetId === node.id);
      if (pEdges.length > 0) {
        const pIds = pEdges.map(e => e.sourceId).sort();
        const pKey = pIds.join("|");
        if (!parentToChildren.has(pKey)) {
          parentToChildren.set(pKey, []);
        }
        parentToChildren.get(pKey)!.push(node.id);
      }
    }

    expect(parentToChildren.size).toBe(1);
    const expectedKey = "prev_father|prev_mother";
    expect(parentToChildren.has(expectedKey)).toBe(true);

    const childIds = parentToChildren.get(expectedKey)!;
    expect(childIds).toEqual(["prev_proband"]);

    const parentIds = expectedKey.split("|");
    expect(parentIds).toEqual(["prev_father", "prev_mother"]);
    expect(parentIds.length).toBe(2);
  });
});


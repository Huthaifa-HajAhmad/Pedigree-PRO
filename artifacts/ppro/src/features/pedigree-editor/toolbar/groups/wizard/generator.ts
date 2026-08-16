import type { PedigreeNode, PedigreeEdge } from "@/features/pedigree-editor/canvas/types";
import type { PedigreeWizardConfig } from "./types";

export function generateWizardPedigree(
  config: PedigreeWizardConfig,
  prefix: string
): { nodes: PedigreeNode[]; edges: PedigreeEdge[] } {
  const nodes: PedigreeNode[] = [];
  const edges: PedigreeEdge[] = [];

  const createNode = (
    id: string,
    type: PedigreeNode["type"],
    label: string,
    affected: boolean = false,
    extra: Partial<PedigreeNode> = {}
  ): PedigreeNode => ({
    id: prefix + id,
    type,
    affected,
    carrier: false,
    deceased: false,
    proband: id === "proband",
    label,
    age: "",
    x: 0,
    y: 0,
    ...extra,
  });

  const createEdge = (
    type: PedigreeEdge["type"],
    sourceId: string,
    targetId: string
  ): PedigreeEdge => ({
    id: `${prefix}e_${edges.length + 1}`,
    type,
    sourceId: prefix + sourceId,
    targetId: prefix + targetId,
  });

  // 1. Proband
  nodes.push(createNode("proband", config.probandSex, "Proband", config.probandAffected, { proband: true }));

  // 2. Parents
  nodes.push(createNode("father", "male", "Father", config.affectedFather));
  nodes.push(createNode("mother", "female", "Mother", config.affectedMother));
  edges.push(createEdge("couple", "father", "mother"));
  edges.push(createEdge("parent-child", "father", "proband"));
  edges.push(createEdge("parent-child", "mother", "proband"));

  // 3. Siblings of Proband
  for (let i = 1; i <= config.brothers; i++) {
    const isAff = i <= config.affectedBrothersCount;
    nodes.push(createNode(`brother_${i}`, "male", `Brother ${i}`, isAff));
    edges.push(createEdge("parent-child", "father", `brother_${i}`));
    edges.push(createEdge("parent-child", "mother", `brother_${i}`));
  }
  for (let i = 1; i <= config.sisters; i++) {
    const isAff = i <= config.affectedSistersCount;
    nodes.push(createNode(`sister_${i}`, "female", `Sister ${i}`, isAff));
    edges.push(createEdge("parent-child", "father", `sister_${i}`));
    edges.push(createEdge("parent-child", "mother", `sister_${i}`));
  }

  // 4. Paternal Lineage
  if (config.generations === 3 && config.includePaternal) {
    nodes.push(createNode("pgf", "male", "Pat. Grandfather", config.affectedPaternalGF));
    nodes.push(createNode("pgm", "female", "Pat. Grandmother", config.affectedPaternalGM));
    edges.push(createEdge("couple", "pgf", "pgm"));
    edges.push(createEdge("parent-child", "pgf", "father"));
    edges.push(createEdge("parent-child", "pgm", "father"));

    for (let i = 1; i <= config.paternalUncles; i++) {
      const isAff = i <= config.affectedPaternalUnclesCount;
      nodes.push(createNode(`pat_uncle_${i}`, "male", `Pat. Uncle ${i}`, isAff));
      edges.push(createEdge("parent-child", "pgf", `pat_uncle_${i}`));
      edges.push(createEdge("parent-child", "pgm", `pat_uncle_${i}`));
    }
    for (let i = 1; i <= config.paternalAunts; i++) {
      const isAff = i <= config.affectedPaternalAuntsCount;
      nodes.push(createNode(`pat_aunt_${i}`, "female", `Pat. Aunt ${i}`, isAff));
      edges.push(createEdge("parent-child", "pgf", `pat_aunt_${i}`));
      edges.push(createEdge("parent-child", "pgm", `pat_aunt_${i}`));
    }
  }

  // 5. Maternal Lineage
  if (config.generations === 3 && config.includeMaternal) {
    nodes.push(createNode("mgf", "male", "Mat. Grandfather", config.affectedMaternalGF));
    nodes.push(createNode("mgm", "female", "Mat. Grandmother", config.affectedMaternalGM));
    edges.push(createEdge("couple", "mgf", "mgm"));
    edges.push(createEdge("parent-child", "mgf", "mother"));
    edges.push(createEdge("parent-child", "mgm", "mother"));

    for (let i = 1; i <= config.maternalUncles; i++) {
      const isAff = i <= config.affectedMaternalUnclesCount;
      nodes.push(createNode(`mat_uncle_${i}`, "male", `Mat. Uncle ${i}`, isAff));
      edges.push(createEdge("parent-child", "mgf", `mat_uncle_${i}`));
      edges.push(createEdge("parent-child", "mgm", `mat_uncle_${i}`));
    }
    for (let i = 1; i <= config.maternalAunts; i++) {
      const isAff = i <= config.affectedMaternalAuntsCount;
      nodes.push(createNode(`mat_aunt_${i}`, "female", `Mat. Aunt ${i}`, isAff));
      edges.push(createEdge("parent-child", "mgf", `mat_aunt_${i}`));
      edges.push(createEdge("parent-child", "mgm", `mat_aunt_${i}`));
    }
  }

  // 6. Proband Offspring
  if (config.hasPartner) {
    nodes.push(createNode("partner", config.partnerSex, "Spouse"));
    edges.push(createEdge("couple", "proband", "partner"));

    for (let i = 1; i <= config.sons; i++) {
      const isAff = i <= config.affectedSonsCount;
      nodes.push(createNode(`son_${i}`, "male", `Son ${i}`, isAff));
      edges.push(createEdge("parent-child", "proband", `son_${i}`));
      edges.push(createEdge("parent-child", "partner", `son_${i}`));
    }
    for (let i = 1; i <= config.daughters; i++) {
      const isAff = i <= config.affectedDaughtersCount;
      nodes.push(createNode(`daughter_${i}`, "female", `Daughter ${i}`, isAff));
      edges.push(createEdge("parent-child", "proband", `daughter_${i}`));
      edges.push(createEdge("parent-child", "partner", `daughter_${i}`));
    }
  }

  return { nodes, edges };
}

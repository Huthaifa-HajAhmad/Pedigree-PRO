// ─── Minimal canvas shape types ───────────────────────────────────────────────

interface RCalcNode {
  id: string;
  type: "male" | "female" | "unknown" | "pregnancy" | "sab";
  affected: boolean;
  carrier: boolean;
  label?: string;
}

interface RCalcEdge {
  type: "couple" | "parent-child" | "consanguinity" | "divorced" | "separated";
  sourceId: string;
  targetId: string;
}

// ─── Public types ─────────────────────────────────────────────────────────────

export type InheritanceMode = "AD" | "AR" | "XLR" | "XLD";

export interface RiskEntry {
  label: string;
  value: number;        // 0–1
  percent: string;
  tier: "low" | "moderate" | "high";
}

export interface RiskResult {
  entries: RiskEntry[];
  basis: string[];
  confidence: "strong" | "inferred" | "assumed";
  mathSteps?: string[];
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function tier(v: number): "low" | "moderate" | "high" {
  if (v < 0.10) return "low";
  if (v < 0.40) return "moderate";
  return "high";
}

function pct(v: number): string {
  if (v === 0) return "0%";
  if (v >= 0.995) return "100%";
  if (v <= 0.004) return "<1%";
  const p = v * 100;
  if (p === Math.round(p)) return `${p.toFixed(0)}%`;
  return `${p.toFixed(1)}%`;
}

function entry(label: string, value: number): RiskEntry {
  return { label, value, percent: pct(value), tier: tier(value) };
}

// ─── Graph traversal ──────────────────────────────────────────────────────────

function getParents(nodeId: string, edges: RCalcEdge[]): string[] {
  return edges
    .filter((e) => e.type === "parent-child" && e.targetId === nodeId)
    .map((e) => e.sourceId);
}

function getChildren(nodeId: string, edges: RCalcEdge[]): string[] {
  return edges
    .filter((e) => e.type === "parent-child" && e.sourceId === nodeId)
    .map((e) => e.targetId);
}

function getSiblings(nodeId: string, edges: RCalcEdge[]): string[] {
  const parents = getParents(nodeId, edges);
  if (parents.length === 0) return [];
  const s = new Set<string>();
  for (const pid of parents) getChildren(pid, edges).forEach((c) => s.add(c));
  s.delete(nodeId);
  return [...s];
}

function getAncestralPaths(startId: string, edges: RCalcEdge[]): string[][] {
  const paths: string[][] = [];
  function recurse(currentId: string, currentPath: string[]) {
    const parents = getParents(currentId, edges);
    if (parents.length === 0) {
      paths.push(currentPath);
      return;
    }
    for (const p of parents) {
      if (!currentPath.includes(p)) {
        recurse(p, [...currentPath, p]);
      }
    }
  }
  recurse(startId, [startId]);
  return paths;
}

function calculateInbreedingCoefficient(p1Id: string, p2Id: string, edges: RCalcEdge[]): number {
  const paths1 = getAncestralPaths(p1Id, edges);
  const paths2 = getAncestralPaths(p2Id, edges);

  const ancestors1 = new Set<string>();
  for (const p of paths1) p.forEach(id => ancestors1.add(id));
  const ancestors2 = new Set<string>();
  for (const p of paths2) p.forEach(id => ancestors2.add(id));

  const commonAncestors = [...ancestors1].filter(id => ancestors2.has(id));

  let totalF = 0;
  const processedPaths = new Set<string>();

  for (const ancestor of commonAncestors) {
    const subpaths1: string[][] = [];
    const subpaths2: string[][] = [];

    for (const p of paths1) {
      const idx = p.indexOf(ancestor);
      if (idx !== -1) {
        const sub = p.slice(0, idx + 1);
        const key = sub.join(",");
        if (!subpaths1.some(s => s.join(",") === key)) {
          subpaths1.push(sub);
        }
      }
    }

    for (const p of paths2) {
      const idx = p.indexOf(ancestor);
      if (idx !== -1) {
        const sub = p.slice(0, idx + 1);
        const key = sub.join(",");
        if (!subpaths2.some(s => s.join(",") === key)) {
          subpaths2.push(sub);
        }
      }
    }

    for (const sub1 of subpaths1) {
      for (const sub2 of subpaths2) {
        const set1 = new Set(sub1);
        let independent = true;
        for (const node of sub2) {
          if (node !== ancestor && set1.has(node)) {
            independent = false;
            break;
          }
        }
        if (independent) {
          const loopKey = [...sub1].reverse().join(",") + " -> " + sub2.join(",");
          const alternateLoopKey = [...sub2].reverse().join(",") + " -> " + sub1.join(",");
          if (!processedPaths.has(loopKey) && !processedPaths.has(alternateLoopKey)) {
            processedPaths.add(loopKey);
            const L1 = sub1.length - 1;
            const L2 = sub2.length - 1;
            totalF += Math.pow(0.5, L1 + L2 + 1);
          }
        }
      }
    }
  }

  return totalF;
}

function getPartner(nodeId: string, edges: RCalcEdge[]): string | null {
  const coupleEdge = edges.find(
    (e) => (e.type === "couple" || e.type === "consanguinity") &&
           (e.sourceId === nodeId || e.targetId === nodeId)
  );
  if (!coupleEdge) return null;
  return coupleEdge.sourceId === nodeId ? coupleEdge.targetId : coupleEdge.sourceId;
}

// Helper to recursively infer parent carrier status in AR
function getARCarrierProbability(
  p: RCalcNode,
  edges: RCalcEdge[],
  byId: Map<string, RCalcNode>,
  basis: string[],
  mathSteps: string[],
  parentRole: string
): number {
  if (p.affected || p.carrier) {
    mathSteps.push(`P(${parentRole} carrier) = 1.0 (explicitly marked carrier/affected)`);
    return 1.0;
  }

  // Check if they have an affected child (obligate carrier)
  const children = getChildren(p.id, edges).map(id => byId.get(id)).filter(Boolean) as RCalcNode[];
  if (children.some(c => c.affected)) {
    basis.push(`${parentRole} has affected child — inferred as obligate carrier.`);
    mathSteps.push(`P(${parentRole} carrier) = 1.0 (inferred from affected child)`);
    return 1.0;
  }

  // Check grandparents
  const grandparentIds = getParents(p.id, edges);
  const grandparents = grandparentIds.map(id => byId.get(id)).filter(Boolean) as RCalcNode[];
  
  if (grandparents.some(g => g.affected)) {
    basis.push(`${parentRole}'s parent is affected — ${parentRole} is obligate carrier.`);
    mathSteps.push(`P(${parentRole} carrier) = 1.0 (obligate carrier from affected grandparent)`);
    return 1.0;
  }
  if (grandparents.some(g => g.carrier)) {
    basis.push(`${parentRole}'s parent is carrier — ${parentRole} has 50% carrier risk.`);
    mathSteps.push(`P(${parentRole} carrier) = 0.5 (inherited risk from carrier grandparent)`);
    return 0.5;
  }

  // Check siblings (uncles/aunts)
  const siblingIds = getSiblings(p.id, edges);
  const siblings = siblingIds.map(id => byId.get(id)).filter(Boolean) as RCalcNode[];
  if (siblings.some(s => s.affected)) {
    basis.push(`${parentRole}'s sibling is affected — ${parentRole} has 2/3 carrier risk.`);
    mathSteps.push(`P(${parentRole} carrier) = 2/3 (inferred from affected uncle/aunt)`);
    return 2 / 3;
  }

  return 0;
}

// ─── Mode calculators ─────────────────────────────────────────────────────────

function calcAD(
  node: RCalcNode,
  parents: RCalcNode[],
  affectedSiblings: number,
): RiskResult {
  const basis: string[] = [];
  const mathSteps: string[] = [];
  const affectedParents = parents.filter((p) => p.affected).length;

  if (node.affected) {
    basis.push("Individual is affected — likely heterozygous for dominant variant.");
    mathSteps.push("Individual genotype: Aa (affected)");
    mathSteps.push("P(child inherits variant) = 0.5 (Mendelian dominant transmission)");
    return {
      entries: [
        entry("Risk to each child", 0.5),
        entry("Risk to each sibling", affectedParents > 0 || affectedSiblings > 0 ? 0.5 : 0.05),
      ],
      basis, confidence: "strong", mathSteps,
    };
  }

  if (affectedParents >= 1) {
    basis.push(`${affectedParents} affected parent(s) identified.`);
    mathSteps.push("P(affected parent transmits allele) = 0.5");
    mathSteps.push("P(individual affected) = 0.5");
    return {
      entries: [
        entry("Risk individual is affected", 0.5),
        entry("Risk to each child (if individual affected)", 0.5),
      ],
      basis, confidence: "strong", mathSteps,
    };
  }

  if (affectedSiblings >= 1) {
    basis.push(`${affectedSiblings} affected sibling(s) — possible parent carrier with reduced penetrance.`);
    mathSteps.push("P(individual inherits allele | affected sibling, unaffected parents) = 0.25 (reduced penetrance / germline mosaicism estimate)");
    return {
      entries: [entry("Risk individual is affected", 0.25)],
      basis, confidence: "inferred", mathSteps,
    };
  }

  basis.push("No affected relatives identified — assuming low de novo or reduced-penetrance risk.");
  mathSteps.push("P(individual affected) = 0.01 (baseline population risk)");
  return {
    entries: [
      entry("Risk individual is affected", 0.01),
      entry("Risk to each child (if affected)", 0.5),
    ],
    basis, confidence: "assumed", mathSteps,
  };
}

function calcAR(
  node: RCalcNode,
  parents: RCalcNode[],
  siblings: RCalcNode[],
  safeEdges: RCalcEdge[],
  byId: Map<string, RCalcNode>,
  POP_CARRIER: number,
): RiskResult {
  const basis: string[] = [];
  const mathSteps: string[] = [`Hardy-Weinberg Population Carrier Frequency (Pc) = ${pct(POP_CARRIER)}`];

  if (node.affected) {
    basis.push("Individual is affected — homozygous or compound heterozygous.");
    mathSteps.push("Individual genotype: aa (affected)");
    mathSteps.push("P(child inherits variant from individual) = 1.0");
    mathSteps.push(`P(child affected) = 1.0 * Pc * 0.5 = 0.5 * Pc = ${pct(0.5 * POP_CARRIER)}`);
    return {
      entries: [
        entry("Individual is affected", 1),
        entry("Risk each child is a carrier", 0.5),
        entry("Risk each child is affected (partner pop. carrier rate)", 0.5 * POP_CARRIER),
      ],
      basis, confidence: "strong", mathSteps,
    };
  }

  // Check child consanguinity if index node is confirmed carrier
  let partnerF = 0;
  if (node.carrier) {
    const partnerId = getPartner(node.id, safeEdges);
    if (partnerId) {
      partnerF = calculateInbreedingCoefficient(node.id, partnerId, safeEdges);
    }
  }

  if (node.carrier) {
    basis.push("Individual is a confirmed carrier.");
    mathSteps.push("Individual genotype: Aa (carrier)");
    mathSteps.push("P(child inherits variant from individual) = 0.5");
    
    let affectedRisk = 0.25 * POP_CARRIER;
    if (partnerF > 0) {
      basis.push(`Partner is related (F_child = ${(partnerF * 100).toFixed(2)}%) — child affected risk is elevated.`);
      mathSteps.push(`Inbreeding Coefficient of child: F = ${(partnerF * 100).toFixed(2)}%`);
      affectedRisk = 0.25 * (POP_CARRIER + 2 * partnerF);
      mathSteps.push(`P(child affected) = 0.25 * (Pc + 2 * F) = ${pct(affectedRisk)}`);
    } else {
      mathSteps.push(`P(child affected) = 0.5 (individual transmits) * Pc (partner carrier) * 0.5 = 0.25 * Pc = ${pct(affectedRisk)}`);
    }

    return {
      entries: [
        entry("Individual is a carrier", 1),
        entry("Risk each child is a carrier (partner pop. rate)", 0.5),
        entry("Risk each child is affected (partner pop. rate)", affectedRisk),
      ],
      basis, confidence: "strong", mathSteps,
    };
  }

  // Traverse grandparents and siblings to infer parent probabilities
  let p0 = parents[0];
  let p1 = parents[1];
  let p0Prob = 0;
  let p1Prob = 0;

  if (p0) p0Prob = getARCarrierProbability(p0, safeEdges, byId, basis, mathSteps, p0.label || "Parent 1");
  if (p1) p1Prob = getARCarrierProbability(p1, safeEdges, byId, basis, mathSteps, p1.label || "Parent 2");

  // If siblings are affected, both parents are carriers
  for (const sib of siblings) {
    if (sib.affected) {
      const sibParents = getParents(sib.id, safeEdges);
      const sharedParents = sibParents.filter((id) => p0 && p1 && (id === p0.id || id === p1.id));
      if (sharedParents.length === 2 && p0 && p1) {
        p0Prob = 1.0;
        p1Prob = 1.0;
        if (!basis.some((b) => b.includes("inferred as obligate"))) {
          basis.push(`Sibling (${sib.label || sib.id}) is affected — both parents inferred as obligate carriers.`);
        }
      } else if (sharedParents.length === 1 && p0 && p1) {
        const sharedId = sharedParents[0];
        if (sharedId === p0.id) p0Prob = 1.0;
        if (sharedId === p1.id) p1Prob = 1.0;
        const sharedNode = sharedId === p0.id ? p0 : p1;
        if (!basis.some((b) => b.includes("half-sibling"))) {
          basis.push(`Half-sibling (${sib.label || sib.id}) is affected — ${sharedNode.label || "shared parent"} inferred as obligate carrier.`);
        }
      }
    }
  }

  let F = 0;
  if (p0 && p1) {
    F = calculateInbreedingCoefficient(p0.id, p1.id, safeEdges);
  }


  const bothCarriers = p0Prob === 1.0 && p1Prob === 1.0;
  const oneCarrier = !bothCarriers && (p0Prob === 1.0 || p1Prob === 1.0);

  let affectedRisk = 0;
  if (p0Prob > 0 && p1Prob > 0) {
    affectedRisk = p0Prob * p1Prob * 0.25;
    mathSteps.push(`P(individual affected) = P(parent 1 carrier) * P(parent 2 carrier) * 0.25 = ${p0Prob} * ${p1Prob} * 0.25 = ${pct(affectedRisk)}`);
  } else if (p0Prob > 0 || p1Prob > 0) {
    const knownProb = p0Prob > 0 ? p0Prob : p1Prob;
    if (F > 0) {
      basis.push(`Parents are related (F = ${(F * 100).toFixed(2)}%) — child affected risk is elevated.`);
      mathSteps.push(`Inbreeding Coefficient of individual: F = ${(F * 100).toFixed(2)}%`);
      affectedRisk = knownProb * (POP_CARRIER + 2 * F) * 0.25;
      mathSteps.push(`P(individual affected) = P(carrier parent) * (Pc + 2 * F) * 0.25 = ${pct(affectedRisk)}`);
    } else {
      affectedRisk = knownProb * POP_CARRIER * 0.25;
      mathSteps.push(`P(individual affected) = P(carrier parent) * Pc * 0.25 = ${knownProb} * ${POP_CARRIER} * 0.25 = ${pct(affectedRisk)}`);
    }
  } else {
    if (F > 0) {
      basis.push(`Parents are related (F = ${(F * 100).toFixed(2)}%) — child affected risk is elevated.`);
      mathSteps.push(`Inbreeding Coefficient of individual: F = ${(F * 100).toFixed(2)}%`);
      affectedRisk = POP_CARRIER * POP_CARRIER * 0.25 + F * (POP_CARRIER / 2);
      mathSteps.push(`P(individual affected) = Pc^2 * 0.25 + F * Pc/2 = ${pct(affectedRisk)}`);
    } else {
      affectedRisk = POP_CARRIER * POP_CARRIER * 0.25;
      mathSteps.push(`P(individual affected) = Pc^2 * 0.25 = ${pct(affectedRisk)}`);
    }
  }

  if (bothCarriers) {
    if (!basis.some((b) => b.includes("carrier") || b.includes("obligate"))) {
      basis.push("Both parents are known/obligate carriers.");
    }
    return {
      entries: [
        entry("Risk individual is affected", 0.25),
        entry("Risk individual is a carrier (given unaffected)", 2 / 3),
        entry("Risk each child is affected (partner pop. rate)", (2 / 3) * 0.25 * POP_CARRIER),
      ],
      basis, confidence: "strong", mathSteps,
    };
  }

  if (oneCarrier) {
    if (!basis.some((b) => b.includes("carrier"))) {
      basis.push("One parent identified as carrier.");
    }
    return {
      entries: [
        entry("Risk individual is a carrier", 0.5),
        entry("Risk individual is affected", 0),
        entry("Risk each child is affected (partner pop. rate)", 0.5 * 0.25 * POP_CARRIER),
      ],
      basis, confidence: "strong", mathSteps,
    };
  }

  if (F > 0) {
    if (!basis.some((b) => b.includes("related") || b.includes("consanguineous"))) {
      basis.push(`Parents are related (F = ${(F * 100).toFixed(2)}%) — individual has elevated risk of being affected.`);
    }
    return {
      entries: [
        entry("Risk individual is affected", affectedRisk),
        entry("Risk individual is a carrier", POP_CARRIER + 2 * F),
      ],
      basis, confidence: "inferred", mathSteps,
    };
  }

  basis.push("No family history data — using population carrier rate.");
  return {
    entries: [
      entry("Population carrier risk", POP_CARRIER),
      entry("Risk each child is affected (both parents at pop. rate)", POP_CARRIER * POP_CARRIER * 0.25),
    ],
    basis, confidence: "assumed", mathSteps,
  };
}

function calcXLR(
  node: RCalcNode,
  parents: RCalcNode[],
  siblings: RCalcNode[],
  safeEdges: RCalcEdge[],
  byId: Map<string, RCalcNode>,
): RiskResult {
  const basis: string[] = [];
  const mathSteps: string[] = [];
  const isMale   = node.type === "male";
  const isFemale = node.type === "female";

  const mother = parents.find((p) => p.type === "female");
  const father = parents.find((p) => p.type === "male");

  // Identify affected maternal brothers
  const affectedMaternalBrothers: RCalcNode[] = [];
  if (mother) {
    for (const sib of siblings) {
      if (sib.type === "male" && sib.affected) {
        const sibParents = getParents(sib.id, safeEdges);
        if (sibParents.includes(mother.id)) {
          affectedMaternalBrothers.push(sib);
        }
      }
    }
  }

  // Traverse mother up to grandparents
  let grandparentMotherCarrier = false;
  let grandfatherMotherAffected = false;
  if (mother) {
    const motherParents = getParents(mother.id, safeEdges).map(id => byId.get(id)).filter(Boolean) as RCalcNode[];
    grandfatherMotherAffected = motherParents.some(gp => gp.type === "male" && gp.affected);
    grandparentMotherCarrier = motherParents.some(gp => gp.type === "female" && (gp.carrier || gp.affected));

    // Check maternal uncles
    const motherSiblings = getSiblings(mother.id, safeEdges).map(id => byId.get(id)).filter(Boolean) as RCalcNode[];
    const affectedUncles = motherSiblings.filter(s => s.type === "male" && s.affected);

    if (grandfatherMotherAffected) {
      basis.push("Maternal grandfather is affected — mother is obligate carrier.");
      mathSteps.push("Mother carrier probability = 1.0 (obligate carrier from affected father)");
    } else if (affectedMaternalBrothers.length > 0) {
      basis.push(`${affectedMaternalBrothers.length} affected brother(s) — mother inferred as obligate carrier.`);
      mathSteps.push("Mother carrier probability = 1.0 (inferred obligate carrier from affected sons)");
    } else if (grandparentMotherCarrier) {
      basis.push("Maternal grandmother is a carrier — mother has 50% carrier risk.");
      mathSteps.push("Mother carrier probability = 0.5 (inherited risk from carrier mother)");
    } else if (affectedUncles.length > 0) {
      const uncle = affectedUncles[0];
      if (uncle) {
        basis.push(`Maternal uncle (${uncle.label || uncle.id}) is affected — mother has 50% carrier risk.`);
        mathSteps.push("Mother carrier probability = 0.5 (inherited risk from carrier grandmother)");
      }
    }
  }

  const motherSibs = mother ? getSiblings(mother.id, safeEdges).map(id => byId.get(id)).filter((s): s is RCalcNode => !!s) : [];
  const motherCarrierProb = mother
    ? (mother.carrier || mother.affected || affectedMaternalBrothers.length > 0 || grandfatherMotherAffected ? 1.0 : (grandparentMotherCarrier || motherSibs.some(s => s.type === "male" && s.affected) ? 0.5 : 0.02))
    : 0.02;

  if (mother && !mother.carrier && !mother.affected && motherCarrierProb === 0.02) {
    mathSteps.push("Mother carrier probability = 0.02 (baseline population rate)");
  }

  const fatherIsAffected = father ? father.affected : false;

  if (node.affected && isMale) {
    basis.push("Affected male — hemizygous for X-linked variant.");
    mathSteps.push("Genotype: XaY (affected)");
    mathSteps.push("All daughters inherit Xa (obligate carriers)");
    mathSteps.push("All sons inherit Y (not at risk)");
    return {
      entries: [
        entry("Individual is affected", 1),
        entry("All daughters will be obligate carriers", 1),
        entry("Sons: not at risk (inherit Y)", 0),
      ],
      basis, confidence: "strong", mathSteps,
    };
  }

  if (node.carrier && isFemale) {
    basis.push("Confirmed female carrier.");
    mathSteps.push("Genotype: XAXa (carrier)");
    mathSteps.push("P(son affected) = 0.5");
    mathSteps.push("P(daughter carrier) = 0.5");
    return {
      entries: [
        entry("Individual is a carrier", 1),
        entry("Risk each son is affected", 0.5),
        entry("Risk each daughter is a carrier", 0.5),
      ],
      basis, confidence: "strong", mathSteps,
    };
  }

  if (isMale) {
    if (motherCarrierProb === 1.0) {
      if (!basis.some((b) => b.includes("mother"))) {
        basis.push("Mother is a known/obligate carrier.");
      }
      mathSteps.push("P(individual affected) = P(mother carrier) * 0.5 = 1.0 * 0.5 = 0.5");
      return { entries: [entry("Risk individual is affected", 0.5)], basis, confidence: "strong", mathSteps };
    }
    if (motherCarrierProb === 0.5) {
      mathSteps.push("P(individual affected) = P(mother carrier) * 0.5 = 0.5 * 0.5 = 0.25");
      return { entries: [entry("Risk individual is affected", 0.25)], basis, confidence: "strong", mathSteps };
    }
    basis.push("No carrier mother identified — low risk unless de novo.");
    mathSteps.push("P(individual affected) = 0.001 (baseline de novo risk)");
    return { entries: [entry("Risk individual is affected", 0.001)], basis, confidence: "assumed", mathSteps };
  }

  if (isFemale) {
    if (fatherIsAffected) {
      if (motherCarrierProb === 1.0) {
        basis.push("Affected father and carrier mother — daughter is at risk of being affected.");
        mathSteps.push("Father transmits Xa (1.0). Mother transmits Xa (0.5).");
        mathSteps.push("P(daughter affected) = 0.5");
        mathSteps.push("P(daughter carrier) = 0.5");
        return {
          entries: [
            entry("Risk individual is affected", 0.5),
            entry("Risk individual is a carrier", 0.5),
            entry("Risk each son is affected", 0.5),
            entry("Risk each daughter is a carrier", 0.5),
          ],
          basis, confidence: "strong", mathSteps,
        };
      }
      basis.push("Affected father — daughter is an obligate carrier (X-linked recessive).");
      mathSteps.push("Father transmits Xa (1.0). Unaffected mother transmits XA (1.0).");
      mathSteps.push("P(daughter carrier) = 1.0 (obligate)");
      return {
        entries: [
          entry("Individual is an obligate carrier", 1),
          entry("Risk each son is affected", 0.5),
          entry("Risk each daughter is a carrier", 0.5),
        ],
        basis, confidence: "strong", mathSteps,
      };
    }
    if (motherCarrierProb > 0.02) {
      if (!basis.some((b) => b.includes("mother"))) {
        basis.push("Mother is a known/obligate carrier.");
      }
      const carrierRisk = motherCarrierProb * 0.5;
      const sonRisk = carrierRisk * 0.5;
      mathSteps.push(`P(individual carrier) = P(mother carrier) * 0.5 = ${motherCarrierProb} * 0.5 = ${pct(carrierRisk)}`);
      mathSteps.push(`P(son affected) = P(individual carrier) * 0.5 = ${pct(sonRisk)}`);
      return {
        entries: [
          entry("Risk individual is a carrier", carrierRisk),
          entry("Risk each son is affected", sonRisk),
        ],
        basis, confidence: "strong", mathSteps,
      };
    }
    basis.push("No affected father or carrier mother identified.");
    mathSteps.push("P(individual carrier) = 0.01 (baseline population risk)");
    return { entries: [entry("Risk individual is a carrier", 0.01)], basis, confidence: "assumed", mathSteps };
  }

  // Unknown sex / pregnancy / sab
  basis.push("Sex of individual is unknown — result mathematically weighted (50% male, 50% female).");
  if (motherCarrierProb === 1.0 && fatherIsAffected) {
    mathSteps.push("P(child affected) = 0.5 (if male, affected) * 0.5 + 0.5 (if female, affected) * 0.5 = 0.25");
    return {
      entries: [
        entry("Risk child is affected", 0.25),
        entry("Risk child is a carrier", 0.25),
      ],
      basis, confidence: "strong", mathSteps,
    };
  }
  if (motherCarrierProb === 1.0) {
    mathSteps.push("P(child carrier or affected) = 0.5 (if male, affected) * 0.5 + 0.5 (if female, carrier) * 0.5 = 0.5");
    return {
      entries: [
        entry("Risk child is carrier or affected", 0.5),
      ],
      basis, confidence: "strong", mathSteps,
    };
  }
  if (fatherIsAffected) {
    mathSteps.push("P(child carrier) = 0.5 (if female, carrier) * 0.5 = 0.5");
    return {
      entries: [
        entry("Risk child is a carrier (if female)", 0.5),
      ],
      basis, confidence: "strong", mathSteps,
    };
  }

  mathSteps.push("P(affected or carrier) = 0.005 (baseline population risk)");
  return { entries: [entry("Risk affected or carrier (combined)", 0.005)], basis, confidence: "assumed", mathSteps };
}

function calcXLD(
  node: RCalcNode,
  parents: RCalcNode[],
): RiskResult {
  const basis: string[] = [];
  const mathSteps: string[] = [];
  const isMale   = node.type === "male";
  const isFemale = node.type === "female";
  const affectedParents = parents.filter((p) => p.affected).length;

  if (node.affected) {
    if (isMale) {
      basis.push("Affected male — hemizygous (X-linked dominant).");
      mathSteps.push("Genotype: XDY (affected male)");
      mathSteps.push("All daughters inherit XD (100% affected)");
      mathSteps.push("All sons inherit Y (not at risk)");
      return {
        entries: [
          entry("All daughters affected (obligate)", 1),
          entry("Sons: not at risk (inherit Y)", 0),
        ],
        basis, confidence: "strong", mathSteps,
      };
    }
    basis.push("Affected female — likely heterozygous (X-linked dominant).");
    mathSteps.push("Genotype: XDX (affected female)");
    mathSteps.push("P(child inherits XD) = 0.5");
    return {
      entries: [
        entry("Risk each son is affected", 0.5),
        entry("Risk each daughter is affected", 0.5),
      ],
      basis, confidence: "strong", mathSteps,
    };
  }

  const affectedFather = parents.find((p) => p.type === "male" && p.affected);
  const affectedMother = parents.find((p) => p.type === "female" && p.affected);

  if (isFemale) {
    if (affectedFather) {
      basis.push("Affected father — daughter has 100% risk (X-linked dominant).");
      mathSteps.push("Father passes affected XD to all daughters.");
      mathSteps.push("P(daughter affected) = 1.0");
      return { entries: [entry("Risk individual is affected", 1)], basis, confidence: "strong", mathSteps };
    }
    if (affectedMother) {
      basis.push("Affected mother — each child has 50% risk (X-linked dominant).");
      mathSteps.push("Mother passes affected XD to child with 50% probability.");
      mathSteps.push("P(daughter affected) = 0.5");
      return { entries: [entry("Risk individual is affected", 0.5)], basis, confidence: "strong", mathSteps };
    }
  }

  if (isMale) {
    if (affectedMother) {
      basis.push("Affected mother — each child has 50% risk (X-linked dominant).");
      mathSteps.push("Mother passes affected XD to child with 50% probability.");
      mathSteps.push("P(son affected) = 0.5");
      return { entries: [entry("Risk individual is affected", 0.5)], basis, confidence: "strong", mathSteps };
    }
    basis.push("Sons: not at risk (inherit Y from father)");
    mathSteps.push("Father passes Y chromosome. Mother passes normal X.");
    mathSteps.push("P(son affected) = 0");
    return { entries: [entry("Risk individual is affected", 0)], basis, confidence: "strong", mathSteps };
  }

  // Unknown sex / pregnancy / sab
  basis.push("Sex of individual is unknown — result mathematically weighted (50% male, 50% female).");
  if (affectedFather && affectedMother) {
    mathSteps.push("P(child affected) = 0.5 (if female, affected) * 1.0 + 0.5 (if male, affected) * 0.5 = 0.75");
    return { entries: [entry("Risk individual is affected", 0.75)], basis, confidence: "strong", mathSteps };
  }
  if (affectedFather) {
    mathSteps.push("P(child affected) = 0.5 (if female, affected) * 1.0 + 0.5 (if male, affected) * 0 = 0.5");
    return { entries: [entry("Risk individual is affected", 0.5)], basis, confidence: "strong", mathSteps };
  }
  if (affectedMother) {
    mathSteps.push("P(child affected) = 0.5 (if female, affected) * 0.5 + 0.5 (if male, affected) * 0.5 = 0.5");
    return { entries: [entry("Risk individual is affected", 0.5)], basis, confidence: "strong", mathSteps };
  }

  if (affectedParents === 0) {
    basis.push("No affected parents identified — low risk unless de novo.");
    mathSteps.push("P(individual affected) = 0.01 (baseline population risk)");
    return { entries: [entry("Risk individual is affected", 0.01)], basis, confidence: "assumed", mathSteps };
  }

  basis.push(`${affectedParents} affected parent(s) identified.`);
  mathSteps.push("P(individual affected) = 0.5");
  return { entries: [entry("Risk individual is affected", 0.5)], basis, confidence: "strong", mathSteps };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function computeRisk(
  nodes: { id: string; type: string; affected: boolean; carrier: boolean; label?: string }[],
  edges: { type: string; sourceId: string; targetId: string }[],
  nodeId: string,
  mode: InheritanceMode,
  popCarrier?: number,
): RiskResult {
  const KNOWN_NODE_TYPES = new Set(["male", "female", "unknown", "pregnancy", "sab"]);
  const safeNodes = nodes
    .filter((n): n is RCalcNode => KNOWN_NODE_TYPES.has(n.type))
    .map((n) => n as RCalcNode);
  const safeEdges = edges as RCalcEdge[];

  const byId = new Map(safeNodes.map((n) => [n.id, n]));
  const node = byId.get(nodeId);
  if (!node) return { entries: [], basis: ["Node not found."], confidence: "assumed" };

  const parentIds  = getParents(nodeId, safeEdges);
  const parents    = parentIds.map((id) => byId.get(id)).filter(Boolean) as RCalcNode[];
  const siblingIds = getSiblings(nodeId, safeEdges);
  const siblings   = siblingIds.map((id) => byId.get(id)).filter(Boolean) as RCalcNode[];
  const affectedSiblings = siblings.filter((s) => s.affected).length;

  const POP_CARRIER = popCarrier !== undefined ? popCarrier : 1 / 50;

  switch (mode) {
    case "AD":  return calcAD(node, parents, affectedSiblings);
    case "AR":  return calcAR(node, parents, siblings, safeEdges, byId, POP_CARRIER);
    case "XLR": return calcXLR(node, parents, siblings, safeEdges, byId);
    case "XLD": return calcXLD(node, parents);
  }
}

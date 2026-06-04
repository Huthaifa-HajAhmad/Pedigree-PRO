// ─── Minimal canvas shape types ───────────────────────────────────────────────

interface RCalcNode {
  id: string;
  type: "male" | "female" | "unknown" | "pregnancy" | "sab";
  affected: boolean;
  carrier: boolean;
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
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function tier(v: number): "low" | "moderate" | "high" {
  if (v < 0.10) return "low";
  if (v < 0.40) return "moderate";
  return "high";
}

function pct(v: number): string {
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

// ─── Mode calculators ─────────────────────────────────────────────────────────

function calcAD(
  node: RCalcNode,
  parents: RCalcNode[],
  affectedSiblings: number,
): RiskResult {
  const basis: string[] = [];
  const affectedParents = parents.filter((p) => p.affected).length;

  if (node.affected) {
    basis.push("Individual is affected — likely heterozygous for dominant variant.");
    return {
      entries: [
        entry("Risk to each child", 0.5),
        entry("Risk to each sibling (if parent affected)", affectedParents > 0 ? 0.5 : 0.05),
      ],
      basis, confidence: "strong",
    };
  }

  if (affectedParents >= 1) {
    basis.push(`${affectedParents} affected parent(s) identified.`);
    return {
      entries: [
        entry("Risk individual is affected", 0.5),
        entry("Risk to each child (if individual affected)", 0.5),
      ],
      basis, confidence: "strong",
    };
  }

  if (affectedSiblings >= 1) {
    basis.push(`${affectedSiblings} affected sibling(s) — possible parent carrier with reduced penetrance.`);
    return {
      entries: [entry("Risk individual is affected", 0.25)],
      basis, confidence: "inferred",
    };
  }

  basis.push("No affected relatives identified — assuming low de novo or reduced-penetrance risk.");
  return {
    entries: [
      entry("Risk individual is affected", 0.01),
      entry("Risk to each child (if affected)", 0.5),
    ],
    basis, confidence: "assumed",
  };
}

function calcAR(
  node: RCalcNode,
  parents: RCalcNode[],
  affectedSiblings: number,
): RiskResult {
  const basis: string[] = [];
  const POP_CARRIER = 1 / 50; // ~2% generic population carrier rate

  if (node.affected) {
    basis.push("Individual is affected — homozygous or compound heterozygous.");
    return {
      entries: [
        entry("Individual is affected", 1),
        entry("Risk each child is a carrier", 0.5),
        entry("Risk each child is affected (partner pop. carrier rate)", 0.5 * POP_CARRIER),
      ],
      basis, confidence: "strong",
    };
  }

  if (node.carrier) {
    basis.push("Individual is a confirmed carrier.");
    return {
      entries: [
        entry("Individual is a carrier", 1),
        entry("Risk each child is a carrier (partner pop. rate)", 0.5 + POP_CARRIER * 0.5),
        entry("Risk each child is affected (partner pop. rate)", 0.5 * POP_CARRIER),
      ],
      basis, confidence: "strong",
    };
  }

  // Determine parental carrier status
  let bothCarriers = false;
  let oneCarrier = false;
  if (parents.length >= 2) {
    const p0 = parents[0];
    const p1 = parents[1];
    const c0 = p0 && (p0.carrier || p0.affected);
    const c1 = p1 && (p1.carrier || p1.affected);
    if (c0 && c1) bothCarriers = true;
    else if (c0 || c1) oneCarrier = true;
  } else if (parents.length === 1) {
    const p0 = parents[0];
    if (p0 && (p0.carrier || p0.affected)) oneCarrier = true;
  }

  // Infer from affected siblings
  if (!bothCarriers && affectedSiblings >= 1) {
    bothCarriers = true;
    basis.push(`${affectedSiblings} affected sibling(s) — both parents inferred as obligate carriers.`);
  }

  if (bothCarriers) {
    if (!basis.some((b) => b.includes("sibling"))) {
      basis.push("Both parents are known/obligate carriers.");
    }
    return {
      entries: [
        entry("Risk individual is affected", 0.25),
        entry("Risk individual is a carrier (given unaffected)", 2 / 3),
        entry("Risk each child is affected (if individual carrier, partner pop. rate)", (2 / 3) * 0.5 * POP_CARRIER),
      ],
      basis, confidence: "strong",
    };
  }

  if (oneCarrier) {
    basis.push("One parent identified as carrier.");
    return {
      entries: [
        entry("Risk individual is a carrier", 0.5),
        entry("Risk individual is affected", 0),
        entry("Risk each child is affected (if carrier, partner pop. rate)", 0.5 * 0.5 * POP_CARRIER),
      ],
      basis, confidence: "strong",
    };
  }

  basis.push("No family history data — using population carrier rate (1/50).");
  return {
    entries: [
      entry("Population carrier risk", POP_CARRIER),
      entry("Risk each child is affected (both parents at pop. rate)", POP_CARRIER * POP_CARRIER * 0.25),
    ],
    basis, confidence: "assumed",
  };
}

function calcXLR(
  node: RCalcNode,
  parents: RCalcNode[],
  affectedSiblings: number,
): RiskResult {
  const basis: string[] = [];
  const isMale   = node.type === "male";
  const isFemale = node.type === "female";

  const mother = parents.find((p) => p.type === "female");
  const father = parents.find((p) => p.type === "male");
  const motherIsCarrier = mother ? (mother.carrier || mother.affected) : false;
  const fatherIsAffected = father ? father.affected : false;

  if (node.affected && isMale) {
    basis.push("Affected male — hemizygous for X-linked variant.");
    return {
      entries: [
        entry("Individual is affected", 1),
        entry("All daughters will be obligate carriers", 1),
        entry("Sons: not at risk (inherit Y)", 0),
      ],
      basis, confidence: "strong",
    };
  }

  if (node.carrier && isFemale) {
    basis.push("Confirmed female carrier.");
    return {
      entries: [
        entry("Individual is a carrier", 1),
        entry("Risk each son is affected", 0.5),
        entry("Risk each daughter is a carrier", 0.5),
      ],
      basis, confidence: "strong",
    };
  }

  if (isMale) {
    if (motherIsCarrier) {
      basis.push("Mother is a known/obligate carrier.");
      return { entries: [entry("Risk individual is affected", 0.5)], basis, confidence: "strong" };
    }
    if (affectedSiblings > 0 && !motherIsCarrier) {
      basis.push(`${affectedSiblings} affected male sibling(s) — mother likely a carrier.`);
      return { entries: [entry("Risk individual is affected", 0.5)], basis, confidence: "inferred" };
    }
    basis.push("No carrier mother identified — low risk unless de novo.");
    return { entries: [entry("Risk individual is affected", 0.001)], basis, confidence: "assumed" };
  }

  if (isFemale) {
    if (fatherIsAffected) {
      basis.push("Affected father — daughter is an obligate carrier (X-linked recessive).");
      return {
        entries: [
          entry("Individual is an obligate carrier", 1),
          entry("Risk each son is affected", 0.5),
          entry("Risk each daughter is a carrier", 0.5),
        ],
        basis, confidence: "strong",
      };
    }
    if (motherIsCarrier) {
      basis.push("Mother is a known/obligate carrier.");
      return {
        entries: [
          entry("Risk individual is a carrier", 0.5),
          entry("Risk each son is affected (if individual is carrier)", 0.5 * 0.5),
        ],
        basis, confidence: "strong",
      };
    }
    basis.push("No affected father or carrier mother identified.");
    return { entries: [entry("Risk individual is a carrier", 0.01)], basis, confidence: "assumed" };
  }

  basis.push("Sex of individual is unknown — result approximated.");
  return { entries: [entry("Risk affected or carrier (combined)", 0.1)], basis, confidence: "assumed" };
}

function calcXLD(
  node: RCalcNode,
  parents: RCalcNode[],
): RiskResult {
  const basis: string[] = [];
  const isMale   = node.type === "male";
  const isFemale = node.type === "female";
  const affectedParents = parents.filter((p) => p.affected).length;

  if (node.affected) {
    if (isMale) {
      basis.push("Affected male — hemizygous (X-linked dominant).");
      return {
        entries: [
          entry("All daughters affected (obligate)", 1),
          entry("Sons: not at risk (inherit Y)", 0),
        ],
        basis, confidence: "strong",
      };
    }
    basis.push("Affected female — likely heterozygous (X-linked dominant).");
    return {
      entries: [
        entry("Risk each son is affected", 0.5),
        entry("Risk each daughter is affected", 0.5),
      ],
      basis, confidence: "strong",
    };
  }

  const affectedFather = parents.find((p) => p.type === "male" && p.affected);
  const affectedMother = parents.find((p) => p.type === "female" && p.affected);

  if (affectedFather && isFemale) {
    basis.push("Affected father — daughter has 100% risk (X-linked dominant).");
    return { entries: [entry("Risk individual is affected", 1)], basis, confidence: "strong" };
  }
  if (affectedMother) {
    basis.push("Affected mother — each child has 50% risk (X-linked dominant).");
    return { entries: [entry("Risk individual is affected", 0.5)], basis, confidence: "strong" };
  }
  if (affectedParents === 0) {
    basis.push("No affected parents identified — low risk unless de novo.");
    return { entries: [entry("Risk individual is affected", 0.01)], basis, confidence: "assumed" };
  }

  basis.push(`${affectedParents} affected parent(s) identified.`);
  return { entries: [entry("Risk individual is affected", 0.5)], basis, confidence: "strong" };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function computeRisk(
  nodes: { id: string; type: string; affected: boolean; carrier: boolean }[],
  edges: { type: string; sourceId: string; targetId: string }[],
  nodeId: string,
  mode: InheritanceMode,
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

  switch (mode) {
    case "AD":  return calcAD(node, parents, affectedSiblings);
    case "AR":  return calcAR(node, parents, affectedSiblings);
    case "XLR": return calcXLR(node, parents, affectedSiblings);
    case "XLD": return calcXLD(node, parents);
  }
}

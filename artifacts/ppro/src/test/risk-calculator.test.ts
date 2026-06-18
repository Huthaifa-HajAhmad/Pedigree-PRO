import { describe, it, expect } from "vitest";
import { computeRisk } from "@/lib/risk-calculator";

function makeNode(id: string, type: "male" | "female" | "unknown", affected = false, carrier = false, label?: string) {
  return { id, type, affected, carrier, label };
}

function makeEdge(sourceId: string, targetId: string, type: "couple" | "parent-child" | "consanguinity" = "parent-child") {
  return { type, sourceId, targetId };
}

describe("Risk Calculator - Autosomal Dominant (AD)", () => {
  it("computes risk when the index node is affected", () => {
    const nodes = [
      makeNode("index", "male", true),
      makeNode("father", "male", true),
      makeNode("mother", "female", false),
    ];
    const edges = [
      makeEdge("father", "index"),
      makeEdge("mother", "index"),
    ];

    const result = computeRisk(nodes, edges, "index", "AD");
    expect(result.confidence).toBe("strong");
    
    const childRisk = result.entries.find((e) => e.label.includes("child"));
    const siblingRisk = result.entries.find((e) => e.label.includes("sibling"));

    expect(childRisk?.value).toBe(0.5);
    expect(siblingRisk?.value).toBe(0.5); // parent is affected
  });

  it("computes risk when index node is unaffected but parent is affected", () => {
    const nodes = [
      makeNode("index", "female", false),
      makeNode("father", "male", true),
      makeNode("mother", "female", false),
    ];
    const edges = [
      makeEdge("father", "index"),
      makeEdge("mother", "index"),
    ];

    const result = computeRisk(nodes, edges, "index", "AD");
    expect(result.confidence).toBe("strong");

    const affectedRisk = result.entries.find((e) => e.label.includes("affected"));
    const childRisk = result.entries.find((e) => e.label.includes("child"));

    expect(affectedRisk?.value).toBe(0.5);
    expect(childRisk?.value).toBe(0.5);
  });

  it("computes risk when index node has affected siblings but parents are unaffected", () => {
    const nodes = [
      makeNode("index", "male", false),
      makeNode("father", "male", false),
      makeNode("mother", "female", false),
      makeNode("sibling", "female", true),
    ];
    const edges = [
      makeEdge("father", "index"),
      makeEdge("mother", "index"),
      makeEdge("father", "sibling"),
      makeEdge("mother", "sibling"),
    ];

    const result = computeRisk(nodes, edges, "index", "AD");
    expect(result.confidence).toBe("inferred");

    const affectedRisk = result.entries.find((e) => e.label.includes("affected"));
    expect(affectedRisk?.value).toBe(0.25);
  });

  it("computes elevated sibling risk when index is affected and siblings are affected", () => {
    const nodes = [
      makeNode("index", "male", true),
      makeNode("father", "male", false),
      makeNode("mother", "female", false),
      makeNode("sibling", "female", true),
    ];
    const edges = [
      makeEdge("father", "index"),
      makeEdge("mother", "index"),
      makeEdge("father", "sibling"),
      makeEdge("mother", "sibling"),
    ];

    const result = computeRisk(nodes, edges, "index", "AD");
    const siblingRisk = result.entries.find((e) => e.label.includes("sibling"));
    expect(siblingRisk?.value).toBe(0.5); // parent carries variant with reduced penetrance
  });

  it("computes risk with no relatives affected", () => {
    const nodes = [makeNode("index", "male", false)];
    const result = computeRisk(nodes, [], "index", "AD");
    expect(result.confidence).toBe("assumed");

    const affectedRisk = result.entries.find((e) => e.label.includes("affected"));
    expect(affectedRisk?.value).toBe(0.01);
  });
});

describe("Risk Calculator - Autosomal Recessive (AR)", () => {
  const POP_CARRIER = 1 / 50;

  it("computes risk when index node is affected", () => {
    const nodes = [makeNode("index", "female", true)];
    const result = computeRisk(nodes, [], "index", "AR");
    expect(result.confidence).toBe("strong");

    const affectedRisk = result.entries.find((e) => e.label === "Individual is affected");
    const childCarrierRisk = result.entries.find((e) => e.label.includes("child") && e.label.includes("carrier"));
    const childAffectedRisk = result.entries.find((e) => e.label.includes("child") && e.label.includes("affected"));

    expect(affectedRisk?.value).toBe(1);
    expect(childCarrierRisk?.value).toBe(0.5);
    expect(childAffectedRisk?.value).toBe(0.5 * POP_CARRIER);
  });

  it("computes risk when index node is a confirmed carrier", () => {
    const nodes = [makeNode("index", "male", false, true)];
    const result = computeRisk(nodes, [], "index", "AR");
    expect(result.confidence).toBe("strong");

    const carrierRisk = result.entries.find((e) => e.label === "Individual is a carrier");
    const childCarrierRisk = result.entries.find((e) => e.label.includes("child") && e.label.includes("carrier"));
    const childAffectedRisk = result.entries.find((e) => e.label.includes("child") && e.label.includes("affected"));

    expect(carrierRisk?.value).toBe(1);
    expect(childCarrierRisk?.value).toBe(0.5);
    expect(childAffectedRisk?.value).toBe(0.25 * POP_CARRIER);
  });

  it("computes risk when both parents are confirmed carriers", () => {
    const nodes = [
      makeNode("index", "male", false),
      makeNode("father", "male", false, true),
      makeNode("mother", "female", false, true),
    ];
    const edges = [
      makeEdge("father", "index"),
      makeEdge("mother", "index"),
    ];

    const result = computeRisk(nodes, edges, "index", "AR");
    expect(result.confidence).toBe("strong");

    const affectedRisk = result.entries.find((e) => e.label.includes("affected"));
    const carrierRisk = result.entries.find((e) => e.label.includes("carrier"));
    const childAffectedRisk = result.entries.find((e) => e.label.includes("child") && e.label.includes("affected"));

    expect(affectedRisk?.value).toBe(0.25);
    expect(carrierRisk?.value).toBe(2 / 3);
    expect(childAffectedRisk?.value).toBe((2 / 3) * 0.25 * POP_CARRIER);
  });

  it("computes risk when parents are obligate carriers due to affected siblings", () => {
    const nodes = [
      makeNode("index", "male", false),
      makeNode("father", "male", false),
      makeNode("mother", "female", false),
      makeNode("sibling", "female", true),
    ];
    const edges = [
      makeEdge("father", "index"),
      makeEdge("mother", "index"),
      makeEdge("father", "sibling"),
      makeEdge("mother", "sibling"),
    ];

    const result = computeRisk(nodes, edges, "index", "AR");
    expect(result.confidence).toBe("strong");

    const affectedRisk = result.entries.find((e) => e.label.includes("affected"));
    expect(affectedRisk?.value).toBe(0.25);
  });

  it("correctly distinguishes half-siblings from full siblings for carrier inference", () => {
    // Affected half-sibling sharing only the mother
    const nodes = [
      makeNode("index", "male", false),
      makeNode("father", "male", false),
      makeNode("mother", "female", false),
      makeNode("halfSibling", "female", true),
      makeNode("otherFather", "male", false),
    ];
    const edges = [
      makeEdge("father", "index"),
      makeEdge("mother", "index"),
      makeEdge("otherFather", "halfSibling"),
      makeEdge("mother", "halfSibling"),
    ];

    const result = computeRisk(nodes, edges, "index", "AR");
    expect(result.confidence).toBe("strong");

    const carrierRisk = result.entries.find((e) => e.label.includes("individual is a carrier"));
    const affectedRisk = result.entries.find((e) => e.label.includes("individual is affected"));
    const childAffectedRisk = result.entries.find((e) => e.label.includes("child") && e.label.includes("affected"));

    expect(carrierRisk?.value).toBe(0.5); // 50% chance of being carrier from mother
    expect(affectedRisk?.value).toBe(0); // cannot be affected as father is population default
    expect(childAffectedRisk?.value).toBe(0.5 * 0.25 * POP_CARRIER);
  });

  it("computes elevated risk for child of consanguineous first-cousin parents", () => {
    // Pedigree where parents of index are first cousins (sharing grandparents)
    const nodes = [
      makeNode("index", "male", false),
      makeNode("father", "male", false),
      makeNode("mother", "female", false),
      makeNode("grandfather", "male", false),
      makeNode("grandmother", "female", false),
      makeNode("uncle1", "male", false),
      makeNode("uncle2", "male", false),
    ];
    const edges = [
      // Grandparents to uncles (parents of the cousin parents)
      makeEdge("grandfather", "uncle1"),
      makeEdge("grandmother", "uncle1"),
      makeEdge("grandfather", "uncle2"),
      makeEdge("grandmother", "uncle2"),
      // Uncles to parents
      makeEdge("uncle1", "father"),
      makeEdge("uncle2", "mother"),
      // Parents to index
      makeEdge("father", "index"),
      makeEdge("mother", "index"),
    ];

    const result = computeRisk(nodes, edges, "index", "AR");
    const affectedRisk = result.entries.find((e) => e.label.includes("individual is affected"));

    // F = 1/16 = 0.0625 for first cousins
    // Risk = Pc^2 * 0.25 + F * Pc/2 = 0.02^2 * 0.25 + 0.0625 * 0.01 = 0.0001 + 0.000625 = 0.000725
    expect(affectedRisk?.value).toBeCloseTo(0.000725, 6);
  });

  it("supports custom carrier rates", () => {
    const nodes = [makeNode("index", "male", false)];
    const customRate = 1 / 100;
    const result = computeRisk(nodes, [], "index", "AR", customRate);
    const affectedRisk = result.entries.find((e) => e.label.includes("child") && e.label.includes("affected"));
    expect(affectedRisk?.value).toBeCloseTo(customRate * customRate * 0.25, 7);
  });
});

describe("Risk Calculator - X-Linked Recessive (XLR)", () => {
  it("computes risk for affected male", () => {
    const nodes = [makeNode("index", "male", true)];
    const result = computeRisk(nodes, [], "index", "XLR");
    expect(result.confidence).toBe("strong");

    const affectedRisk = result.entries.find((e) => e.label === "Individual is affected");
    const daughterRisk = result.entries.find((e) => e.label.includes("daughters"));
    const sonRisk = result.entries.find((e) => e.label.includes("Sons"));

    expect(affectedRisk?.value).toBe(1);
    expect(daughterRisk?.value).toBe(1);
    expect(sonRisk?.value).toBe(0);
    expect(sonRisk?.percent).toBe("0%");
  });

  it("computes risk for confirmed female carrier", () => {
    const nodes = [makeNode("index", "female", false, true)];
    const result = computeRisk(nodes, [], "index", "XLR");
    expect(result.confidence).toBe("strong");

    const carrierRisk = result.entries.find((e) => e.label === "Individual is a carrier");
    const sonRisk = result.entries.find((e) => e.label.includes("son"));
    const daughterRisk = result.entries.find((e) => e.label.includes("daughter"));

    expect(carrierRisk?.value).toBe(1);
    expect(sonRisk?.value).toBe(0.5);
    expect(daughterRisk?.value).toBe(0.5);
  });

  it("computes risk for male with carrier mother", () => {
    const nodes = [
      makeNode("index", "male", false),
      makeNode("father", "male", false),
      makeNode("mother", "female", false, true),
    ];
    const edges = [
      makeEdge("father", "index"),
      makeEdge("mother", "index"),
    ];

    const result = computeRisk(nodes, edges, "index", "XLR");
    expect(result.confidence).toBe("strong");

    const affectedRisk = result.entries.find((e) => e.label.includes("affected"));
    expect(affectedRisk?.value).toBe(0.5);
  });

  it("infers mother is carrier from maternal half-brothers but NOT from paternal half-brothers", () => {
    // Maternal half-brother is affected
    const nodesMaternal = [
      makeNode("index", "male", false),
      makeNode("mother", "female", false),
      makeNode("father", "male", false),
      makeNode("maternalHalfBrother", "male", true),
      makeNode("otherFather", "male", false),
    ];
    const edgesMaternal = [
      makeEdge("mother", "index"),
      makeEdge("father", "index"),
      makeEdge("mother", "maternalHalfBrother"),
      makeEdge("otherFather", "maternalHalfBrother"),
    ];

    const resultMaternal = computeRisk(nodesMaternal, edgesMaternal, "index", "XLR");
    const affectedRiskMaternal = resultMaternal.entries.find((e) => e.label.includes("affected"));
    expect(affectedRiskMaternal?.value).toBe(0.5);

    // Paternal half-brother is affected
    const nodesPaternal = [
      makeNode("index", "male", false),
      makeNode("mother", "female", false),
      makeNode("father", "male", false),
      makeNode("paternalHalfBrother", "male", true),
      makeNode("otherMother", "female", false),
    ];
    const edgesPaternal = [
      makeEdge("mother", "index"),
      makeEdge("father", "index"),
      makeEdge("otherMother", "paternalHalfBrother"),
      makeEdge("father", "paternalHalfBrother"),
    ];

    const resultPaternal = computeRisk(nodesPaternal, edgesPaternal, "index", "XLR");
    const affectedRiskPaternal = resultPaternal.entries.find((e) => e.label.includes("affected"));
    expect(affectedRiskPaternal?.value).toBe(0.001);
  });

  it("infers XLR carrier status from affected maternal grandfather", () => {
    const nodes = [
      makeNode("index", "male", false),
      makeNode("mother", "female", false),
      makeNode("father", "male", false),
      makeNode("grandfather", "male", true),
      makeNode("grandmother", "female", false),
    ];
    const edges = [
      makeEdge("mother", "index"),
      makeEdge("father", "index"),
      makeEdge("grandfather", "mother"),
      makeEdge("grandmother", "mother"),
    ];

    const result = computeRisk(nodes, edges, "index", "XLR");
    const affectedRisk = result.entries.find((e) => e.label.includes("affected"));
    expect(affectedRisk?.value).toBe(0.5); // mother obligate carrier from grandfather
  });

  it("computes XLR dual parents risk for female index", () => {
    const nodes = [
      makeNode("index", "female", false),
      makeNode("father", "male", true),
      makeNode("mother", "female", false, true),
    ];
    const edges = [
      makeEdge("father", "index"),
      makeEdge("mother", "index"),
    ];

    const result = computeRisk(nodes, edges, "index", "XLR");
    expect(result.confidence).toBe("strong");

    const affectedRisk = result.entries.find((e) => e.label === "Risk individual is affected");
    const carrierRisk = result.entries.find((e) => e.label === "Risk individual is a carrier");

    expect(affectedRisk?.value).toBe(0.5);
    expect(carrierRisk?.value).toBe(0.5);
  });

  it("computes XLR mathematically weighted unknown sex risks", () => {
    const nodes = [
      makeNode("index", "unknown", false),
      makeNode("father", "male", false),
      makeNode("mother", "female", false, true),
    ];
    const edges = [
      makeEdge("father", "index"),
      makeEdge("mother", "index"),
    ];

    const result = computeRisk(nodes, edges, "index", "XLR");
    const combinedRisk = result.entries.find((e) => e.label === "Risk child is carrier or affected");
    expect(combinedRisk?.value).toBe(0.5);
  });
});

describe("Risk Calculator - X-Linked Dominant (XLD)", () => {
  it("computes risk for affected male", () => {
    const nodes = [makeNode("index", "male", true)];
    const result = computeRisk(nodes, [], "index", "XLD");
    expect(result.confidence).toBe("strong");

    const daughterRisk = result.entries.find((e) => e.label.includes("daughters"));
    const sonRisk = result.entries.find((e) => e.label.includes("Sons"));

    expect(daughterRisk?.value).toBe(1);
    expect(sonRisk?.value).toBe(0);
    expect(sonRisk?.percent).toBe("0%");
  });

  it("computes risk for affected female", () => {
    const nodes = [makeNode("index", "female", true)];
    const result = computeRisk(nodes, [], "index", "XLD");
    expect(result.confidence).toBe("strong");

    const daughterRisk = result.entries.find((e) => e.label.includes("daughter"));
    const sonRisk = result.entries.find((e) => e.label.includes("son"));

    expect(daughterRisk?.value).toBe(0.5);
    expect(sonRisk?.value).toBe(0.5);
  });

  it("computes XLD mathematically weighted unknown sex risks for double affected parents", () => {
    const nodes = [
      makeNode("index", "unknown", false),
      makeNode("father", "male", true),
      makeNode("mother", "female", true),
    ];
    const edges = [
      makeEdge("father", "index"),
      makeEdge("mother", "index"),
    ];

    const result = computeRisk(nodes, edges, "index", "XLD");
    const affectedRisk = result.entries.find((e) => e.label === "Risk individual is affected");
    expect(affectedRisk?.value).toBe(0.75);
  });
});

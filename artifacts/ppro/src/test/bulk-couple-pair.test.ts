import { describe, it, expect } from "vitest";
import { resolveCouplePair } from "@/features/pedigree-editor/panels/properties/BulkSelectionSection";

describe("resolveCouplePair (bulk 'Add Relationship')", () => {
  it("never returns the same id twice for unknown + male", () => {
    const { maleId, femaleId } = resolveCouplePair(
      { id: "a", type: "unknown" },
      { id: "b", type: "male" },
    );
    expect(maleId).not.toBe(femaleId);
    expect(maleId).toBe("b");
    expect(femaleId).toBe("a");
  });

  it("never returns the same id twice for female + unknown", () => {
    const { maleId, femaleId } = resolveCouplePair(
      { id: "a", type: "female" },
      { id: "b", type: "unknown" },
    );
    expect(maleId).not.toBe(femaleId);
    expect(maleId).toBe("b");
    expect(femaleId).toBe("a");
  });

  it("keeps selection order when both sides are unknown", () => {
    expect(resolveCouplePair({ id: "a", type: "unknown" }, { id: "b", type: "unknown" })).toEqual({
      maleId: "a",
      femaleId: "b",
    });
  });

  it("assigns distinct ids when both sides are female", () => {
    const { maleId, femaleId } = resolveCouplePair(
      { id: "a", type: "female" },
      { id: "b", type: "female" },
    );
    expect(maleId).not.toBe(femaleId);
  });

  it("maps male + female to their own ids regardless of order", () => {
    expect(resolveCouplePair({ id: "a", type: "female" }, { id: "b", type: "male" })).toEqual({
      maleId: "b",
      femaleId: "a",
    });
    expect(resolveCouplePair({ id: "a", type: "male" }, { id: "b", type: "female" })).toEqual({
      maleId: "a",
      femaleId: "b",
    });
  });
});

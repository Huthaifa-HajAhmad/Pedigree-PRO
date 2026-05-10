import { describe, it, expect } from "vitest";
import { computeHash } from "@workspace/crypto";

describe("computeHash (SHA-256)", () => {
  it("produces a 64-character hex digest", () => {
    const hash = computeHash("hello world");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic", () => {
    const a = computeHash("pedigree-canvas-data");
    const b = computeHash("pedigree-canvas-data");
    expect(a).toBe(b);
  });

  it("produces different hashes for different inputs", () => {
    const a = computeHash("canvas-v1");
    const b = computeHash("canvas-v2");
    expect(a).not.toBe(b);
  });

  it("handles empty string", () => {
    const hash = computeHash("");
    expect(hash).toHaveLength(64);
    expect(hash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
});
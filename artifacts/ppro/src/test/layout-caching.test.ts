import { describe, it, expect, beforeEach } from "vitest";
import { globalLayoutCache, clearLayoutCache, setCacheEntry, getCacheEntry } from "../lib/layout-cache";
import { computeAutoLayout } from "../lib/auto-layout";
import { PedigreeNode, PedigreeEdge } from "../features/pedigree-editor/canvas/types";

describe("layout-caching utilities and config integration", () => {
  const baseNode = {
    x: 0,
    y: 0,
    affected: false,
    carrier: false,
    deceased: false,
    proband: false,
    gender: "male",
  } as any;

  beforeEach(() => {
    clearLayoutCache();
  });

  describe("globalLayoutCache API", () => {
    it("should clear the cache on clearLayoutCache", () => {
      setCacheEntry("node-1", { x: 100, y: 200, hash: "abc" });
      expect(globalLayoutCache.size).toBe(1);
      clearLayoutCache();
      expect(globalLayoutCache.size).toBe(0);
    });

    it("should evict only the oldest entry when size limit of 1000 is reached (LRU)", () => {
      for (let i = 0; i < 1000; i++) {
        setCacheEntry(`node-${i}`, { x: i, y: i, hash: `hash-${i}` });
      }
      expect(globalLayoutCache.size).toBe(1000);
      
      // Access node-0 to update its recency
      getCacheEntry("node-0");

      setCacheEntry("node-overflow", { x: 9999, y: 9999, hash: "overflow" });
      
      // Size should remain at 1000
      expect(globalLayoutCache.size).toBe(1000);
      
      // node-1 (oldest non-accessed) should be evicted
      expect(globalLayoutCache.has("node-1")).toBe(false);
      
      // node-0 (accessed) should still be in the cache
      expect(globalLayoutCache.has("node-0")).toBe(true);
      expect(globalLayoutCache.get("node-overflow")?.x).toBe(9999);
    });
  });

  describe("computeAutoLayout cache integration", () => {
    it("should seed positions from cache when enableCache is true", () => {
      const nodes: PedigreeNode[] = [
        { ...baseNode, id: "A", type: "male" },
      ];
      const edges: PedigreeEdge[] = [];

      // Run auto-layout, which populates cache
      const firstRun = computeAutoLayout(nodes, edges, false, { enableCache: true });
      const cached = globalLayoutCache.get("A");
      expect(cached).toBeDefined();

      // Manually change cached coordinate
      setCacheEntry("A", { x: 555, y: cached!.y, hash: cached!.hash });

      // Run layout again with cache enabled
      const secondRun = computeAutoLayout(nodes, edges, false, { enableCache: true });
      expect(secondRun[0]!.x).toBe(555);
    });

    it("should NOT seed or update cache when enableCache is false", () => {
      const nodes: PedigreeNode[] = [
        { ...baseNode, id: "A", type: "male" },
      ];
      const edges: PedigreeEdge[] = [];

      // Run layout with cache disabled
      const run = computeAutoLayout(nodes, edges, false, { enableCache: false });
      expect(globalLayoutCache.size).toBe(0);
    });
  });
});

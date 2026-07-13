import { AdjacencyMaps } from "./layout-shared";

export interface CacheEntry {
  x: number;
  y: number;
  hash: string;
}

export type LayoutCacheMap = Map<string, CacheEntry>;

/**
 * Computes a structural neighborhood hash for a single node.
 */
export function computeNodeStructuralHash(nodeId: string, adj: AdjacencyMaps): string {
  const parents = (adj.parentsOf.get(nodeId) ?? []).slice().sort().join(",");
  const children = (adj.childrenOf.get(nodeId) ?? []).slice().sort().join(",");
  const couples = (adj.couplesOf.get(nodeId) ?? []).slice().sort().join(",");
  const twinGroup = adj.twinGroupOf.get(nodeId) ?? "";
  const twinType = adj.twinTypeOf.get(nodeId) ?? "";
  return `${parents}|${children}|${couples}|${twinGroup}|${twinType}`;
}

/**
 * Global/singleton cache container for the layout engine.
 */
export const globalLayoutCache: LayoutCacheMap = new Map();

let lastNodeGap: number | undefined;
let lastGenGrid: number | undefined;

/**
 * Checks if the layout spacing configuration has changed, and clears the cache if so.
 */
export function checkAndClearCache(nodeGap: number, genGrid: number): void {
  if (nodeGap !== lastNodeGap || genGrid !== lastGenGrid) {
    globalLayoutCache.clear();
    lastNodeGap = nodeGap;
    lastGenGrid = genGrid;
  }
}

/**
 * Safely clears the layout coordinates cache.
 */
export function clearLayoutCache(): void {
  globalLayoutCache.clear();
  lastNodeGap = undefined;
  lastGenGrid = undefined;
}

/**
 * Adds or updates an entry in the cache, enforcing a maximum size of 1000 to prevent memory leaks.
 */
export function setCacheEntry(nodeId: string, entry: CacheEntry): void {
  if (globalLayoutCache.size >= 1000) {
    globalLayoutCache.clear();
  }
  globalLayoutCache.set(nodeId, entry);
}

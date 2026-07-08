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

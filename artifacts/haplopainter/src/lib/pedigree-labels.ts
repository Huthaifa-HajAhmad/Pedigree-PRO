// ─── Pedigree auto-labeling ───────────────────────────────────────────────────
//
// Assigns standard clinical pedigree identifiers: generation (Roman numeral)
// and individual position within that generation (left-to-right integer).
// e.g.  I-1, I-2, II-1, II-2, II-3 …
//
// Algorithm
//   1. Build parent→children and child→parents maps from parent-child edges.
//   2. BFS from root nodes (no known parents), taking the DEEPEST generation
//      when a node is reachable via multiple paths (consanguinity-safe).
//   3. Disconnected nodes (no edges) or nodes in disconnected sub-graphs are
//      grouped by y-coordinate band (±40 px) and appended as further generations.
//   4. Normalise generation indices to 0, 1, 2 … (contiguous).
//   5. Within each generation sort nodes left-to-right by x, then assign 1, 2, 3 …
//
// The function never mutates the input; it returns a new Map<nodeId, label>.

// Minimal node/edge shape — keeps this module free of canvas-page imports.
interface LabelNode { id: string; x: number; y: number; }
interface LabelEdge { type: string; sourceId: string; targetId: string; }

// ── Roman-numeral converter ───────────────────────────────────────────────────
export function toRoman(n: number): string {
  if (n <= 0 || !Number.isFinite(n)) return String(n);
  const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
  const syms = ["M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"];
  let result = "";
  let rem = n;
  for (let i = 0; i < vals.length; i++) {
    while (rem >= vals[i]) { result += syms[i]; rem -= vals[i]; }
  }
  return result;
}

// ── Main export ───────────────────────────────────────────────────────────────
export function computeAutoLabels(
  nodes: LabelNode[],
  edges: LabelEdge[],
): Map<string, string> {
  if (nodes.length === 0) return new Map();

  const allIds = new Set(nodes.map((n) => n.id));

  // 1. Build adjacency maps from parent-child edges only.
  //    Convention: sourceId = parent, targetId = child.
  const childrenOf = new Map<string, string[]>();   // parentId → childIds
  const parentsOf  = new Map<string, string[]>();   // childId  → parentIds

  for (const edge of edges) {
    if (edge.type !== "parent-child") continue;
    const { sourceId: p, targetId: c } = edge;
    if (!allIds.has(p) || !allIds.has(c)) continue; // guard against stale refs
    (childrenOf.get(p) ?? (childrenOf.set(p, []), childrenOf.get(p)!)).push(c);
    (parentsOf.get(c)  ?? (parentsOf.set(c, []),  parentsOf.get(c)!)).push(p);
  }

  const hasParentChildEdges = childrenOf.size > 0;

  // 2. Topology-based BFS — assigns the DEEPEST (maximum) generation to each node.
  const genOf = new Map<string, number>(); // nodeId → generation index

  if (hasParentChildEdges) {
    // Roots: nodes that have no known parent in this canvas
    const queue: Array<{ id: string; gen: number }> = [];
    for (const node of nodes) {
      const parents = parentsOf.get(node.id) ?? [];
      if (!parents.some((p) => allIds.has(p))) {
        queue.push({ id: node.id, gen: 0 });
      }
    }

    // BFS — keep re-queuing a node when a deeper generation is found (DAG-safe).
    const MAX_DEPTH = 200; // sanity cap for malformed graphs
    while (queue.length > 0) {
      const { id, gen } = queue.shift()!;
      if (gen > MAX_DEPTH) continue;
      const current = genOf.get(id) ?? -1;
      if (gen <= current) continue; // already at this or deeper generation
      genOf.set(id, gen);
      for (const childId of (childrenOf.get(id) ?? [])) {
        queue.push({ id: childId, gen: gen + 1 });
      }
    }
  }

  // 3. Y-coordinate fallback for disconnected / edge-free nodes.
  const ungrouped = nodes.filter((n) => !genOf.has(n.id));
  if (ungrouped.length > 0) {
    const yBands: number[] = [];
    for (const node of ungrouped) {
      if (!yBands.some((y) => Math.abs(y - node.y) < 40)) yBands.push(node.y);
    }
    yBands.sort((a, b) => a - b);

    const maxExisting = genOf.size > 0 ? Math.max(...genOf.values()) : -1;
    for (const node of ungrouped) {
      const bandIdx = yBands.findIndex((y) => Math.abs(y - node.y) < 40);
      genOf.set(node.id, maxExisting + 1 + (bandIdx < 0 ? 0 : bandIdx));
    }
  }

  // 4. Normalise generation indices to 0, 1, 2 … (some BFS paths may skip numbers).
  const sortedGenValues = [...new Set(genOf.values())].sort((a, b) => a - b);
  const normOf = new Map<number, number>();
  sortedGenValues.forEach((g, i) => normOf.set(g, i));

  // 5. Group nodes by normalised generation, sort each group left-to-right by x.
  const groups = new Map<number, LabelNode[]>();
  for (const node of nodes) {
    const normGen = normOf.get(genOf.get(node.id) ?? 0) ?? 0;
    (groups.get(normGen) ?? (groups.set(normGen, []), groups.get(normGen)!)).push(node);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => a.x - b.x);
  }

  // 6. Emit labels  "II:3", "III:1" etc.
  const labels = new Map<string, string>();
  for (const [normGen, group] of groups) {
    const roman = toRoman(normGen + 1);
    group.forEach((node, idx) => labels.set(node.id, `${roman}:${idx + 1}`));
  }
  return labels;
}

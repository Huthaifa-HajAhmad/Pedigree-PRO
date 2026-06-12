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
    const v = vals[i];
    const s = syms[i];
    if (v === undefined || s === undefined) break;
    while (rem >= v) { result += s; rem -= v; }
  }
  return result;
}

export function romanToInt(s: string): number {
  const map: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const curr = map[s[i]!] ?? 0;
    const next = map[s[i + 1]!] ?? 0;
    if (curr < next) total -= curr;
    else total += curr;
  }
  return total;
}

// ── Main export ───────────────────────────────────────────────────────────────
export function computeAutoLabels(
  nodes: LabelNode[],
  edges: LabelEdge[],
): Map<string, string> {
  if (nodes.length === 0) return new Map();

  // 1. Group nodes into y-coordinate bands (using a tolerance of ROW_TOLERANCE = 60px)
  const TOLERANCE = 60;
  const bands: number[] = [];
  
  // Sort nodes by y first to build bands top-to-bottom
  const sortedByY = [...nodes].sort((a, b) => a.y - b.y);
  
  for (const n of sortedByY) {
    if (!bands.some(y => Math.abs(y - n.y) < TOLERANCE)) {
      bands.push(n.y);
    }
  }
  
  // Sort bands ascending (top to bottom)
  bands.sort((a, b) => a - b);

  // 2. Group nodes by normalised generation (band index), sort each group left-to-right by x
  const groups = new Map<number, LabelNode[]>();
  for (const node of nodes) {
    const normGen = bands.findIndex(y => Math.abs(y - node.y) < TOLERANCE);
    const genKey = normGen < 0 ? 0 : normGen;
    (groups.get(genKey) ?? (groups.set(genKey, []), groups.get(genKey)!)).push(node);
  }

  for (const group of groups.values()) {
    group.sort((a, b) => a.x - b.x);
  }

  // 3. Emit labels "I:1", "II:3", "III:1" etc.
  const labels = new Map<string, string>();
  for (const [normGen, group] of groups) {
    const roman = toRoman(normGen + 1);
    group.forEach((node, idx) => labels.set(node.id, `${roman}:${idx + 1}`));
  }
  return labels;
}

import type { PedigreeNode, PedigreeEdge } from "@/features/pedigree-editor/canvas/types";

export interface CanvasData {
  nodes: PedigreeNode[];
  edges: PedigreeEdge[];
}

export interface ParseResult {
  canvasData: CanvasData;
  suggestedTitle: string;
  familyIds: string[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Internal intermediate representation
// ---------------------------------------------------------------------------
interface Individual {
  rawId: string;
  familyId: string;
  fatherId: string | null;
  motherId: string | null;
  sex: "male" | "female" | "unknown";
  affected: boolean;
  affectedLevel: number;
  name: string;
  age: string;
}

interface ExtendedIndividual extends Individual {
  type?: "male" | "female" | "unknown" | "pregnancy" | "sab";
  deceased: boolean;
  proband: boolean;
  adopted: boolean;
  notes: string;
  twinGroup: string | null;
  twinType: "m" | "d" | null;
  consanguinityGroup: string | null;
}

// ---------------------------------------------------------------------------
// Encoding sanitization (G6)
// ---------------------------------------------------------------------------
function sanitizeContent(raw: string): string {
  let content = raw;
  // Strip UTF-8 BOM
  if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
  // Strip UTF-16LE/BE BOM markers that may appear as strings
  if (content.startsWith("\uFFFE")) content = content.slice(1);
  // Strip null bytes
  content = content.replace(/\0/g, "");
  // Normalize line endings
  content = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // Strip C1 control characters (U+0080-U+009F) except NBSP (U+00A0)
  content = content.replace(/[\u0080-\u009F]/g, (ch) => {
    const cp = ch.charCodeAt(0);
    return cp === 0x00A0 ? ch : "";
  });
  return content;
}

// ---------------------------------------------------------------------------
// Parse affection level from phenotype code
// Returns affectedLevel: 0 = unaffected, 1-9 = affected with level
// ---------------------------------------------------------------------------
function parseAffectionLevel(code: string): { affected: boolean; level: number } {
  const n = parseInt(code, 10);
  if (isNaN(n) || n === 0) return { affected: false, level: 0 };
  return { affected: true, level: n };
}

// ---------------------------------------------------------------------------
// Layout engine
// ---------------------------------------------------------------------------
function layoutNodes(individuals: Individual[]): Map<string, { x: number; y: number }> {
  const byId = new Map(individuals.map((i) => [i.rawId, i]));

  const generation = new Map<string, number>();
  const founders = individuals.filter(
    (i) => (!i.fatherId || !byId.has(i.fatherId)) && (!i.motherId || !byId.has(i.motherId))
  );
  founders.forEach((f) => generation.set(f.rawId, 0));

  const queue = [...founders];
  let head = 0;
  let safety = 0;
  while (head < queue.length && safety++ < 10000) {
    const ind = queue[head];
    if (!ind) break;
    head++;
    for (const child of individuals) {
      if (child.fatherId === ind.rawId || child.motherId === ind.rawId) {
        const parentGen = Math.max(
          generation.get(child.fatherId ?? "") ?? 0,
          generation.get(child.motherId ?? "") ?? 0
        );
        if (!generation.has(child.rawId)) {
          generation.set(child.rawId, parentGen + 1);
          queue.push(child);
        }
      }
    }
  }

  individuals.forEach((i) => {
    if (!generation.has(i.rawId)) generation.set(i.rawId, 0);
  });

  // Spouse alignment: align partners to same generation
  const couplePartnerIds = new Map<string, Set<string>>();
  for (const ind of individuals) {
    if (ind.fatherId && ind.motherId && byId.has(ind.fatherId) && byId.has(ind.motherId)) {
      const key = ind.fatherId < ind.motherId ? `${ind.fatherId}_${ind.motherId}` : `${ind.motherId}_${ind.fatherId}`;
      if (!couplePartnerIds.has(key)) couplePartnerIds.set(key, new Set());
      couplePartnerIds.get(key)!.add(ind.fatherId);
      couplePartnerIds.get(key)!.add(ind.motherId);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const [, partnerIds] of couplePartnerIds) {
      const maxGen = Math.max(...[...partnerIds].map(id => generation.get(id) ?? 0));
      for (const id of partnerIds) {
        if ((generation.get(id) ?? 0) < maxGen) {
          generation.set(id, maxGen);
          changed = true;
        }
      }
    }
  }

  // Re-propagate children after spouse alignment
  const sortedByGen = [...generation.entries()].sort((a, b) => a[1] - b[1]);
  for (const [id] of sortedByGen) {
    const ind = byId.get(id);
    if (!ind) continue;
    for (const child of individuals) {
      if (child.fatherId === id || child.motherId === id) {
        const parentGen = Math.max(
          generation.get(child.fatherId ?? "") ?? 0,
          generation.get(child.motherId ?? "") ?? 0
        );
        const childGen = generation.get(child.rawId) ?? 0;
        if (childGen <= parentGen) {
          generation.set(child.rawId, parentGen + 1);
        }
      }
    }
  }

  const byGen = new Map<number, string[]>();
  for (const [id, gen] of generation.entries()) {
    if (!byGen.has(gen)) byGen.set(gen, []);
    byGen.get(gen)!.push(id);
  }

  // Build couple map: who is paired with whom
  const partnerOf = new Map<string, string>();
  for (const ind of individuals) {
    if (ind.fatherId && ind.motherId && byId.has(ind.fatherId) && byId.has(ind.motherId)) {
      if (!partnerOf.has(ind.fatherId)) partnerOf.set(ind.fatherId, ind.motherId);
      if (!partnerOf.has(ind.motherId)) partnerOf.set(ind.motherId, ind.fatherId);
    }
  }

  // For each generation, build placement units: couple pairs (male,female) and singles
  interface PlacementUnit {
    ids: string[];
    isCouple: boolean;
    sortKey: string;
  }

  const genUnits = new Map<number, PlacementUnit[]>();

  for (const [gen, ids] of byGen.entries()) {
    const units: PlacementUnit[] = [];
    const assigned = new Set<string>();

    // Identify couples in this generation
    const coupleKeysSeen = new Set<string>();
    for (const id of ids) {
      if (assigned.has(id)) continue;
      const partnerId = partnerOf.get(id);
      if (partnerId && generation.get(partnerId) === gen && !assigned.has(partnerId)) {
        const coupleKey = id < partnerId ? `${id}_${partnerId}` : `${partnerId}_${id}`;
        if (!coupleKeysSeen.has(coupleKey)) {
          coupleKeysSeen.add(coupleKey);
          const ind = byId.get(id)!;
          const maleId = ind.sex === "male" ? id : partnerId;
          const femaleId = ind.sex === "male" ? partnerId : id;
          const maleInd = byId.get(maleId)!;
          units.push({
            ids: [maleId, femaleId],
            isCouple: true,
            sortKey: `${maleInd.fatherId ?? "0"}_${maleInd.motherId ?? "0"}`,
          });
          assigned.add(maleId);
          assigned.add(femaleId);
        }
      }
    }

    // Add remaining singles
    for (const id of ids) {
      if (!assigned.has(id)) {
        const ind = byId.get(id)!;
        units.push({
          ids: [id],
          isCouple: false,
          sortKey: `${ind.fatherId ?? "0"}_${ind.motherId ?? "0"}`,
        });
      }
    }

    // Sort units by sortKey
    units.sort((a, b) => a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0);
    genUnits.set(gen, units);
  }

  // Layout constants
  const STEP_X = 120;
  const STEP_Y = 120;
  const START_Y = 120;
  const START_X = 120;
  const COUPLE_INTERNAL_GAP = STEP_X * 0.5;
  const FAMILY_GAP = STEP_X * 0.75;

  const positions = new Map<string, { x: number; y: number }>();

  // Pass 1: Place gen 0
  const gen0Units = genUnits.get(0) ?? [];
  const gen0Widths: number[] = gen0Units.map(u =>
    u.isCouple ? STEP_X + COUPLE_INTERNAL_GAP + STEP_X : STEP_X
  );
  const gen0TotalWidth = gen0Widths.reduce((s, w) => s + w, 0) + Math.max(0, gen0Units.length - 1) * FAMILY_GAP;
  let xCursor = START_X;
  for (let u = 0; u < gen0Units.length; u++) {
    if (u > 0) xCursor += FAMILY_GAP;
    const unit = gen0Units[u]!;
    if (unit.isCouple) {
      positions.set(unit.ids[0]!, { x: xCursor, y: START_Y });
      positions.set(unit.ids[1]!, { x: xCursor + STEP_X + COUPLE_INTERNAL_GAP, y: START_Y });
      xCursor += STEP_X + COUPLE_INTERNAL_GAP + STEP_X;
    } else {
      positions.set(unit.ids[0]!, { x: xCursor, y: START_Y });
      xCursor += STEP_X;
    }
  }
  // Center gen 0
  const gen0RightEdge = xCursor;
  const gen0CenterOffset = (gen0TotalWidth - (gen0RightEdge - START_X)) / 2;
  const gen0Ids = byGen.get(0) ?? [];
  for (const id of gen0Ids) {
    const pos = positions.get(id)!;
    positions.set(id, { x: pos.x + gen0CenterOffset, y: pos.y });
  }

  // Pass 2: Place each subsequent generation
  // For each sibship group, compute ideal center from parent couple midpoint
  const maxGen = Math.max(...Array.from(byGen.keys()), 0);

  interface SibshipGroup {
    ids: string[];
    fatherId: string | null;
    motherId: string | null;
    idealCenterX: number;
  }

  for (let gen = 1; gen <= maxGen; gen++) {
    const ids = byGen.get(gen) ?? [];
    if (ids.length === 0) continue;

    // Group by parent couple
    const sibGroups: SibshipGroup[] = [];
    let currentIds: string[] = [];
    let lastFatherId: string | null = null;
    let lastMotherId: string | null = null;
    let lastParentKey = "";

    // Sort ids by parent key first for grouping
    const sortedIds = [...ids].sort((a, b) => {
      const ia = byId.get(a)!;
      const ib = byId.get(b)!;
      const ka = `${ia.fatherId ?? "0"}_${ia.motherId ?? "0"}`;
      const kb = `${ib.fatherId ?? "0"}_${ib.motherId ?? "0"}`;
      if (ka < kb) return -1;
      if (ka > kb) return 1;
      if (ia.sex === "male" && ib.sex !== "male") return -1;
      if (ia.sex !== "male" && ib.sex === "male") return 1;
      return a.localeCompare(b);
    });

    for (const id of sortedIds) {
      const ind = byId.get(id)!;
      const parentKey = `${ind.fatherId ?? "0"}_${ind.motherId ?? "0"}`;
      if (parentKey !== lastParentKey && currentIds.length > 0) {
        sibGroups.push({ ids: currentIds, fatherId: lastFatherId, motherId: lastMotherId, idealCenterX: 0 });
        currentIds = [];
      }
      currentIds.push(id);
      lastParentKey = parentKey;
      lastFatherId = ind.fatherId;
      lastMotherId = ind.motherId;
    }
    if (currentIds.length > 0) sibGroups.push({ ids: currentIds, fatherId: lastFatherId, motherId: lastMotherId, idealCenterX: 0 });

    // Compute ideal center for each group from parent positions
    for (const group of sibGroups) {
      const fatherPos = group.fatherId ? positions.get(group.fatherId) : null;
      const motherPos = group.motherId ? positions.get(group.motherId) : null;
      if (fatherPos && motherPos) {
        group.idealCenterX = (fatherPos.x + motherPos.x) / 2;
      } else if (fatherPos) {
        group.idealCenterX = fatherPos.x;
      } else if (motherPos) {
        group.idealCenterX = motherPos.x;
      } else {
        group.idealCenterX = START_X;
      }
    }

    // Sort groups by ideal center for left-to-right placement
    sibGroups.sort((a, b) => a.idealCenterX - b.idealCenterX);

    // Place groups: each group centered around its idealCenterX, with collision avoidance
    const groupWidths = sibGroups.map(g => (g.ids.length - 1) * STEP_X);
    let nextAvailableX = -Infinity;

    for (let gi = 0; gi < sibGroups.length; gi++) {
      const group = sibGroups[gi]!;
      const gw = groupWidths[gi]!;
      const groupStartX = group.idealCenterX - gw / 2;
      const actualStartX = Math.max(groupStartX, nextAvailableX);

      const baseY = START_Y + gen * STEP_Y;
      for (let j = 0; j < group.ids.length; j++) {
        positions.set(group.ids[j]!, {
          x: actualStartX + j * STEP_X,
          y: baseY,
        });
      }
      nextAvailableX = actualStartX + gw + FAMILY_GAP;
    }

    // Pass 3: Detect overlapping sibship groups and push down
    if (sibGroups.length > 1) {
      interface GroupBounds { xMin: number; xMax: number; y: number; ids: string[] }
      const bounds: GroupBounds[] = sibGroups.map(group => {
        const xs = group.ids.map(id => positions.get(id)!.x);
        const y = positions.get(group.ids[0]!)!.y;
        return { xMin: Math.min(...xs) - STEP_X * 0.45, xMax: Math.max(...xs) + STEP_X * 0.45, y, ids: group.ids };
      });

      bounds.sort((a, b) => a.xMin - b.xMin);

      for (let i = 1; i < bounds.length; i++) {
        const prev = bounds[i - 1]!;
        const curr = bounds[i]!;
        if (curr.xMin < prev.xMax) {
          const yOffset = STEP_Y;
          for (const id of curr.ids) {
            const pos = positions.get(id)!;
            positions.set(id, { x: pos.x, y: pos.y + yOffset });
          }
          curr.y += yOffset;
          curr.xMax += 0; // x doesn't change but track y shift for subsequent checks
        }
      }
    }
  }

  return positions;
}

// ---------------------------------------------------------------------------
// Convert intermediate → CanvasData (G2: SAB/adoption, G3: consanguinity groups, G5: couple-bar edges)
// ---------------------------------------------------------------------------
function toCanvasData(individuals: Individual[]): CanvasData {
  const positions = layoutNodes(individuals);

  const nodes: PedigreeNode[] = individuals.map((ind, idx) => {
    const ext = ind as ExtendedIndividual;
    const nodeType: PedigreeNode["type"] = ext.type === "sab" ? "sab" : ind.sex;
    return {
      id: `n_${ind.rawId}_${idx}`,
      type: nodeType,
      affected: ind.affected,
      ...(ind.affected && ind.affectedLevel > 0 ? { affectedLevel: ind.affectedLevel } : {}),
      carrier: false,
      deceased: ext.deceased ?? false,
      proband: ext.proband ?? false,
      adopted: ext.adopted ?? false,
      label: ind.name || ind.rawId,
      age: ind.age,
      notes: ext.notes || undefined,
      x: positions.get(ind.rawId)?.x ?? 100 + idx * 120,
      y: positions.get(ind.rawId)?.y ?? 100,
    };
  });

  const rawToNode = new Map(individuals.map((ind, idx) => [ind.rawId, `n_${ind.rawId}_${idx}`]));
  const byRawId = new Map(individuals.map((i) => [i.rawId, i as ExtendedIndividual]));

  const edges: PedigreeEdge[] = [];
  let edgeIdx = 0;

  // G3: Consanguinity — collect couple keys with group strings
  const coupleKeys = new Map<string, { fatherId: string; motherId: string; fatherGroup: string | null; motherGroup: string | null }>();

  for (const ind of individuals) {
    if (ind.fatherId && ind.motherId && rawToNode.has(ind.fatherId) && rawToNode.has(ind.motherId)) {
      const key = ind.fatherId < ind.motherId ? `${ind.fatherId}_${ind.motherId}` : `${ind.motherId}_${ind.fatherId}`;
      if (!coupleKeys.has(key)) {
        const fatherExt = byRawId.get(ind.fatherId);
        const motherExt = byRawId.get(ind.motherId);
        coupleKeys.set(key, {
          fatherId: ind.fatherId,
          motherId: ind.motherId,
          fatherGroup: fatherExt?.consanguinityGroup ?? null,
          motherGroup: motherExt?.consanguinityGroup ?? null,
        });
      }
    }
  }

  // Create couple + consanguinity edges
  for (const [, couple] of coupleKeys) {
    const isConsang = !!(couple.fatherGroup && couple.motherGroup && couple.fatherGroup === couple.motherGroup);
    edges.push({
      id: `e_couple_${edgeIdx++}`,
      type: isConsang ? "consanguinity" : "couple",
      sourceId: rawToNode.get(couple.fatherId)!,
      targetId: rawToNode.get(couple.motherId)!,
    });
  }

  // G5: Parent-child edges — two edges per child (father→child + mother→child)
  // The renderer should detect same-targetId edges and route through the couple bar midpoint
  for (const ind of individuals) {
    const ext = ind as ExtendedIndividual;
    const twinProps = {
      ...(ext.twinGroup ? { twinGroup: ext.twinGroup } : {}),
      ...(ext.twinType ? { twinType: ext.twinType } : {}),
    };
    if (ind.fatherId && rawToNode.has(ind.fatherId)) {
      edges.push({
        id: `e_pc_${edgeIdx++}`,
        type: "parent-child",
        sourceId: rawToNode.get(ind.fatherId)!,
        targetId: rawToNode.get(ind.rawId)!,
        ...twinProps,
      });
    }
    if (ind.motherId && rawToNode.has(ind.motherId)) {
      edges.push({
        id: `e_pc_${edgeIdx++}`,
        type: "parent-child",
        sourceId: rawToNode.get(ind.motherId)!,
        targetId: rawToNode.get(ind.rawId)!,
        ...twinProps,
      });
    }
  }

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// PLINK PED format parser
// ---------------------------------------------------------------------------
export function parsePed(content: string, filename: string): ParseResult {
  const warnings: string[] = [];
  const individuals: Individual[] = [];
  const familyIds = new Set<string>();
  const seenIds = new Set<string>();

  const lines = sanitizeContent(content).split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const raw = line.trim();
    if (!raw || raw.startsWith("#")) continue;

    const cols = raw.split(/\s+/);
    if (cols.length < 6) {
      warnings.push(`Line ${i + 1}: expected ≥6 columns, got ${cols.length} — skipped`);
      continue;
    }

    const famId = cols[0] ?? "";
    const indId = cols[1] ?? "";
    const fatId = cols[2] ?? "";
    const matId = cols[3] ?? "";
    const sexCode = cols[4] ?? "";
    const phenoCode = cols[5] ?? "";
    if (seenIds.has(indId)) {
      warnings.push(`Duplicate individual ID "${indId}" at line ${i + 1}: skipped`);
      continue;
    }
    seenIds.add(indId);
    familyIds.add(famId);

    const sex: Individual["sex"] =
      sexCode === "1" ? "male" : sexCode === "2" ? "female" : "unknown";
    // PLINK convention: 0=unknown, 1=unaffected, 2=affected
    const affected = phenoCode === "2";
    const affectedLevel = affected ? 2 : 0;
    const fatherId = fatId === "0" || fatId === "." ? null : fatId;
    const motherId = matId === "0" || matId === "." ? null : matId;

    individuals.push({
      rawId: indId, familyId: famId, fatherId, motherId, sex, affected, affectedLevel,
      name: indId, age: "",
    });
  }

  if (individuals.length === 0) {
    warnings.push("No valid individuals found in file.");
  }

  const familyIdList = Array.from(familyIds);
  const suggestedTitle = familyIdList.length > 0
    ? `${familyIdList.slice(0, 2).join(", ")} — imported from ${filename}`
    : `Pedigree imported from ${filename}`;

  return {
    canvasData: toCanvasData(individuals),
    suggestedTitle,
    familyIds: familyIdList,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// CSV (UTF-8) parser — flexible column detection
// ---------------------------------------------------------------------------
function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[\s_-]/g, "");
}

function resolveColumn(headers: string[], candidates: string[]): number {
  const normalized = headers.map(normalizeHeader);
  for (const c of candidates) {
    const idx = normalized.indexOf(normalizeHeader(c));
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "", inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === delimiter && !inQuotes) { result.push(current.trim()); current = ""; continue; }
    current += ch;
  }
  result.push(current.trim());
  return result;
}

export function parseCsv(content: string, filename: string): ParseResult {
  const warnings: string[] = [];
  const individuals: Individual[] = [];

  const lines = sanitizeContent(content).split("\n").filter((l) => l.trim() && !l.trim().startsWith("#"));
  if (lines.length < 2) {
    return { canvasData: { nodes: [], edges: [] }, suggestedTitle: filename, familyIds: [], warnings: ["File is empty or has only a header row."] };
  }

  const firstLine = lines[0] ?? "";
  const delimiter = firstLine.includes("\t") ? "\t" : ",";

  const headers = parseCSVLine(firstLine, delimiter).map((h) => h.replace(/^["']|["']$/g, ""));

  const colId       = resolveColumn(headers, ["id", "individual_id", "individualid", "person_id", "personid", "ind_id"]);
  const colFamilyId = resolveColumn(headers, ["family_id", "familyid", "fam_id", "famid", "family"]);
  const colFather   = resolveColumn(headers, ["father_id", "fatherid", "father", "paternal_id", "dad_id", "patid"]);
  const colMother   = resolveColumn(headers, ["mother_id", "motherid", "mother", "maternal_id", "mom_id", "matid"]);
  const colSex      = resolveColumn(headers, ["sex", "gender", "sex_code"]);
  const colAffected = resolveColumn(headers, ["affected", "phenotype", "affection", "status", "disease"]);
  const colName     = resolveColumn(headers, ["name", "label", "full_name", "fullname", "individual_name"]);
  const colAge      = resolveColumn(headers, ["age", "age_at_exam", "current_age"]);

  if (colId === -1) {
    warnings.push('No "id" column found — using row numbers as IDs.');
  }

  const familyIds = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const row = parseCSVLine(line, delimiter);

    const rawId  = colId !== -1 ? (row[colId] ?? `row_${i}`) : `row_${i}`;
    const famId  = colFamilyId !== -1 ? (row[colFamilyId] ?? "FAM001") : "FAM001";
    const father = colFather !== -1 ? (row[colFather] ?? "") : "";
    const mother = colMother !== -1 ? (row[colMother] ?? "") : "";
    const sexRaw = colSex !== -1 ? (row[colSex] ?? "").toLowerCase() : "";
    const affRaw = colAffected !== -1 ? (row[colAffected] ?? "").toLowerCase() : "";
    const name   = colName !== -1 ? (row[colName] ?? rawId) : rawId;
    const age    = colAge !== -1 ? (row[colAge] ?? "") : "";

    if (!rawId) continue;

    familyIds.add(famId);

    const sex: Individual["sex"] =
      sexRaw === "1" || sexRaw === "m" || sexRaw === "male" ? "male"
      : sexRaw === "2" || sexRaw === "f" || sexRaw === "female" ? "female"
      : "unknown";

    const { affected, level: affectedLevel } = parseAffectionLevel(affRaw);
    const fatherId = !father || father === "0" || father === "." || father.toLowerCase() === "na" ? null : father;
    const motherId = !mother || mother === "0" || mother === "." || mother.toLowerCase() === "na" ? null : mother;

    individuals.push({ rawId, familyId: famId, fatherId, motherId, sex, affected, affectedLevel, name, age });
  }

  if (individuals.length === 0) {
    warnings.push("No valid rows found in CSV.");
  }

  const familyIdList = Array.from(familyIds);
  const suggestedTitle =
    familyIdList.length > 0
      ? `${familyIdList.slice(0, 2).join(", ")} — imported from ${filename}`
      : `Pedigree imported from ${filename}`;

  return {
    canvasData: toCanvasData(individuals),
    suggestedTitle,
    familyIds: familyIdList,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// HaploPainter text format parser
// ---------------------------------------------------------------------------
function parseHaploPainterLine(line: string): Record<string, string> | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) return null;

  if (trimmed.startsWith("Individual:")) {
    const pairs = trimmed.slice("Individual:".length).split(",");
    const record: Record<string, string> = {};
    for (const pair of pairs) {
      const [k, v] = pair.split("=");
      if (k && v) record[k.trim().toLowerCase()] = v.trim();
    }
    return record;
  }

  if (trimmed.startsWith("[") || trimmed.toLowerCase().startsWith("begin") || trimmed.toLowerCase().startsWith("end")) return null;

  return null;
}

function parseHaploPainter(content: string, filename: string): ParseResult {
  const warnings: string[] = [];
  const individuals: Individual[] = [];
  const familyIds = new Set<string>();
  const seenIds = new Set<string>();

  const lines = sanitizeContent(content).split("\n");
  let explicitMode = false;
  let headerLineIdx = -1;
  const headerCandidates = ["id", "individ", "name", "sex", "gender", "father", "mother", "affected", "phenotype", "status"];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    if (t.startsWith("Individual:")) { explicitMode = true; break; }
    const cols = t.split(/[\t,;|]/);
    const loweredHeaders = cols.map(c => c.trim().toLowerCase().replace(/[\s_-]/g, ""));
    const matchCount = headerCandidates.filter(h => loweredHeaders.some(lh => lh.includes(h))).length;
    if (matchCount >= 3) { headerLineIdx = i; break; }
  }

  if (explicitMode) {
    for (const line of lines) {
      const record = parseHaploPainterLine(line);
      if (!record) continue;
      const rawId = record.id ?? record.individ ?? record.individualid ?? record.indiv ?? record.pid ?? record.pedid ?? "";
      const name = record.name ?? record.label ?? record.fullname ?? record.prename ?? rawId;
      const sexRaw = (record.sex ?? record.gender ?? "").toLowerCase();
      const father = record.father ?? record.fatherid ?? record.paternalid ?? record.dad ?? record.fa ?? record.fid ?? record.pat ?? "0";
      const mother = record.mother ?? record.motherid ?? record.maternalid ?? record.mom ?? record.mo ?? record.mid ?? record.mat ?? "0";
      const affRaw = (record.affected ?? record.phenotype ?? record.status ?? "").toLowerCase();

      if (!rawId || seenIds.has(rawId)) {
        if (seenIds.has(rawId)) warnings.push(`Duplicate individual ID "${rawId}" — skipped`);
        continue;
      }
      seenIds.add(rawId);
      familyIds.add("FAM001");

      const sex: Individual["sex"] =
        sexRaw === "1" || sexRaw === "m" || sexRaw === "male" ? "male"
        : sexRaw === "2" || sexRaw === "f" || sexRaw === "female" ? "female"
        : "unknown";
      const { affected, level: affectedLevel } = parseAffectionLevel(affRaw);
      const fatherId = father === "0" || father === "." || father.toLowerCase() === "na" ? null : father;
      const motherId = mother === "0" || mother === "." || mother.toLowerCase() === "na" ? null : mother;

      individuals.push({ rawId, familyId: "FAM001", fatherId, motherId, sex, affected, affectedLevel, name, age: "" });
    }
  } else if (headerLineIdx >= 0) {
    const headers = lines[headerLineIdx]!.split(/[\t,;|]/).map(h => h.trim().toLowerCase().replace(/[\s_-]/g, ""));
    const colId       = resolveColumn(headers, ["id", "individual_id", "individualid", "person_id", "personid", "person", "ind_id", "individ", "indiv", "pid", "pedid", "pedno", "proband", "code", "sample", "sampid"]);
    const colFamilyId = resolveColumn(headers, ["family_id", "familyid", "fam_id", "famid", "family"]);
    const colFather   = resolveColumn(headers, ["father_id", "fatherid", "father", "paternal_id", "dad_id", "patid", "dad", "fa", "fid", "faid", "pat", "patid"]);
    const colMother   = resolveColumn(headers, ["mother_id", "motherid", "mother", "maternal_id", "mom_id", "matid", "mom", "mo", "moid", "mid", "mat", "matid"]);
    const colSex      = resolveColumn(headers, ["sex", "gender", "sex_code"]);
    const colAffected = resolveColumn(headers, ["affected", "affection", "phenotype", "status", "disease"]);
    const colName     = resolveColumn(headers, ["name", "label", "full_name", "fullname", "individual_name", "prename", "surname"]);
    const colAge      = resolveColumn(headers, ["age", "age_at_exam", "current_age"]);

    let useRow1AsId = false;
    if (colId === -1) {
      useRow1AsId = true;
      warnings.push('No "id" column found in HaploPainter header — using second column as IDs (assuming FAMILY, PERSON order).');
    }

    for (let i = headerLineIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const row = line.split(/[\t,;|]/);
      const rawId  = colId !== -1 ? (row[colId]?.trim() ?? (useRow1AsId ? (row[1]?.trim() ?? row[0]?.trim()) : (row[0]?.trim())) ?? `row_${i}`) : (useRow1AsId ? (row[1]?.trim() ?? row[0]?.trim()) : (row[0]?.trim())) ?? `row_${i}`;
      const famId  = colFamilyId !== -1 ? (row[colFamilyId]?.trim() ?? "FAM001") : "FAM001";
      const father = colFather !== -1 ? (row[colFather]?.trim() ?? "") : "";
      const mother = colMother !== -1 ? (row[colMother]?.trim() ?? "") : "";
      const sexRaw = colSex !== -1 ? (row[colSex]?.trim() ?? "").toLowerCase() : "";
      const affRaw = colAffected !== -1 ? (row[colAffected]?.trim() ?? "").toLowerCase() : "";
      const name   = colName !== -1 ? (row[colName]?.trim() ?? rawId) : rawId;
      const age    = colAge !== -1 ? (row[colAge]?.trim() ?? "") : "";

      if (!rawId || seenIds.has(rawId)) {
        if (seenIds.has(rawId)) warnings.push(`Duplicate individual ID "${rawId}" at line ${i + 1}: skipped`);
        continue;
      }
      seenIds.add(rawId);
      familyIds.add(famId);

      const sex: Individual["sex"] =
        sexRaw === "1" || sexRaw === "m" || sexRaw === "male" ? "male"
        : sexRaw === "2" || sexRaw === "f" || sexRaw === "female" ? "female"
        : "unknown";
      const { affected, level: affectedLevel } = parseAffectionLevel(affRaw);
      const fatherId = !father || father === "0" || father === "." || father.toLowerCase() === "na" ? null : father;
      const motherId = !mother || mother === "0" || mother === "." || mother.toLowerCase() === "na" ? null : mother;

      individuals.push({ rawId, familyId: famId, fatherId, motherId, sex, affected, affectedLevel, name, age });
    }
  } else {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
      const raw = line.trim();
      if (!raw || raw.startsWith("#")) continue;
      const cols = raw.split(/\s+/);
      if (cols.length < 6) {
        warnings.push(`Line ${i + 1}: expected ≥6 columns in HaploPainter whitespace format, got ${cols.length} — skipped`);
        continue;
      }
      const col4 = cols[4];
      const col5 = cols[5];
      const looksLikePed = (col4 === "1" || col4 === "2" || col4 === "0") && (col5 === "1" || col5 === "2" || col5 === "0" || col5 === "-9");
      if (!looksLikePed) {
        warnings.push(`Line ${i + 1}: does not match HaploPainter whitespace format — skipped`);
        continue;
      }
      const rawId = cols[0] ?? "";
      const name  = cols[1] ?? rawId;
      const sexCode = cols[2] ?? "";
      const fatId = cols[3] ?? "";
      const matId = cols[4] ?? "";
      const phenoCode = cols[5] ?? "";

      if (!rawId || seenIds.has(rawId)) {
        if (seenIds.has(rawId)) warnings.push(`Duplicate individual ID "${rawId}" at line ${i + 1}: skipped`);
        continue;
      }
      seenIds.add(rawId);
      familyIds.add("FAM001");

      const sex: Individual["sex"] =
        sexCode === "1" ? "male" : sexCode === "2" ? "female" : "unknown";
      // PED-like whitespace format uses PLINK convention
      const affected = phenoCode === "2";
      const affectedLevel = affected ? 2 : 0;
      const fatherId = fatId === "0" || fatId === "." ? null : fatId;
      const motherId = matId === "0" || matId === "." ? null : matId;

      individuals.push({ rawId, familyId: "FAM001", fatherId, motherId, sex, affected, affectedLevel, name, age: "" });
    }
  }

  if (individuals.length === 0) {
    warnings.push("No valid individuals found in HaploPainter file.");
  }

  const familyIdList = Array.from(familyIds);
  const suggestedTitle = familyIdList.length > 0
    ? `${familyIdList.slice(0, 2).join(", ")} — imported from ${filename}`
    : `Pedigree imported from ${filename}`;

  return {
    canvasData: toCanvasData(individuals),
    suggestedTitle,
    familyIds: familyIdList,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// HaploPainter CSV / UTF-8 parser (G1, G2, G3 fixes)
// ---------------------------------------------------------------------------
export function parseHaploPainterCSV(content: string, filename: string): ParseResult {
  const warnings: string[] = [];
  const individuals: ExtendedIndividual[] = [];
  const familyIds = new Set<string>();
  const seenIds = new Set<string>();
  const rawLines = sanitizeContent(content).split("\n");
  const headerKeywords = ["family", "person", "gender", "father", "mother", "affection"];
  let headerLineIdx = -1;
  const preFiltered: string[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    const t = rawLines[i]?.trim() ?? "";
    if (!t) continue;
    if (t.startsWith("#") || t.startsWith("!") || t.startsWith("/")) continue;
    if (t.startsWith("*")) {
      const withoutStar = t.slice(1).split(/[\t,;|]/).map(c => c.trim().toLowerCase().replace(/[\s_-]/g, ""));
      const matchCount = headerKeywords.filter(h => withoutStar.some(lh => lh.includes(h))).length;
      if (matchCount >= 3 && headerLineIdx === -1) {
        headerLineIdx = preFiltered.length;
        preFiltered.push(t.slice(1));
      }
      continue;
    }
    preFiltered.push(t);
  }
  const lines = preFiltered;

  let errorCount = 0;
  const MAX_ERRORS = 20;

  interface RawRecord {
    famId: string;
    rawId: string;
    father: string;
    mother: string;
    sexCode: string;
    phenoCode: string;
    deceasedRaw: string;
    sabRaw: string;
    probandRaw: string;
    adoptedRaw: string;
    twinRaw: string;
    consangRaw: string;
    innerText: string;
    sideText: string;
    belowTexts: string[];
    lineNum: number;
  }
  const rawRecords: RawRecord[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    if (i === headerLineIdx) continue;

    let cols = line.split("\t");
    if (cols.length < 6) cols = line.split(",");
    if (cols.length < 6) {
      if (errorCount < MAX_ERRORS) {
        warnings.push(`Line ${i + 1}: expected ≥6 columns, got ${cols.length} — skipped`);
        errorCount++;
      }
      continue;
    }

    const rawId = (cols[1] ?? "").trim();
    const sexCode = (cols[4] ?? "").trim();
    const phenoCode = (cols[5] ?? "").trim();

    if (!/^.{1,}$/.test(rawId)) {
      if (errorCount < MAX_ERRORS) { warnings.push(`Line ${i + 1}: invalid PERSON id — skipped`); errorCount++; }
      continue;
    }
    if (!/^[012xmfXMF]{1}$/.test(sexCode)) {
      if (errorCount < MAX_ERRORS) { warnings.push(`Line ${i + 1}: invalid GENDER "${sexCode}" — skipped`); errorCount++; }
      continue;
    }
    if (!/^[0123456789xX]{1}$/.test(phenoCode)) {
      if (errorCount < MAX_ERRORS) { warnings.push(`Line ${i + 1}: invalid AFFECTION "${phenoCode}" — skipped`); errorCount++; }
      continue;
    }

    if (seenIds.has(rawId)) {
      if (errorCount < MAX_ERRORS) { warnings.push(`Duplicate individual ID "${rawId}" at line ${i + 1}: skipped`); errorCount++; }
      continue;
    }
    seenIds.add(rawId);

    rawRecords.push({
      famId: (cols[0] ?? "").trim(),
      rawId,
      father: (cols[2] ?? "").trim(),
      mother: (cols[3] ?? "").trim(),
      sexCode,
      phenoCode,
      deceasedRaw: (cols[6] ?? "").trim(),
      sabRaw: (cols[7] ?? "").trim(),
      probandRaw: (cols[8] ?? "").trim(),
      adoptedRaw: (cols[9] ?? "").trim(),
      twinRaw: (cols[10] ?? "").trim(),
      consangRaw: (cols[11] ?? "").trim(),
      innerText: (cols[12] ?? "").trim(),
      sideText: (cols[13] ?? "").trim(),
      belowTexts: cols.slice(14, 19).map((c) => (c ?? "").trim()).filter(Boolean),
      lineNum: i + 1,
    });
  }

  const affectionCodes = new Set(rawRecords.map(r => r.phenoCode));
  const usesHaploConvention = [...affectionCodes].some(c => {
    const n = parseInt(c, 10);
    return !isNaN(n) && n >= 3;
  });

  for (const record of rawRecords) {
    familyIds.add(record.famId || "FAM001");

    const sex: Individual["sex"] =
      record.sexCode === "1" || record.sexCode === "m" || record.sexCode === "M" ? "male"
      : record.sexCode === "2" || record.sexCode === "f" || record.sexCode === "F" ? "female"
      : "unknown";

    let affected: boolean;
    let affectedLevel: number;
    if (usesHaploConvention) {
      const n = parseInt(record.phenoCode, 10);
      affected = !isNaN(n) && n > 0;
      affectedLevel = affected ? n : 0;
    } else {
      affected = record.phenoCode === "2";
      affectedLevel = affected ? 2 : 0;
    }

    const fatherId = record.father === "0" || record.father === "." || record.father.toLowerCase() === "na" ? null : record.father;
    const motherId = record.mother === "0" || record.mother === "." || record.mother.toLowerCase() === "na" ? null : record.mother;

    const isDeceased = /^[1yY]$/.test(record.deceasedRaw);
    const isProband = /^[1yY]$/.test(record.probandRaw);
    const isSab = /^[1yY]$/.test(record.sabRaw);
    const isAdopted = /^[1yY]$/.test(record.adoptedRaw);
    const consanguinityGroup = (record.consangRaw && record.consangRaw !== "0" && record.consangRaw !== "." && record.consangRaw.toLowerCase() !== "na") ? record.consangRaw : null;

    let twinGroup: string | null = null;
    let twinType: "m" | "d" | null = null;
    if (record.twinRaw && record.twinRaw !== "0" && record.twinRaw !== ".") {
      const m = record.twinRaw.match(/^([mdMD])_(.+)$/);
      if (m) {
        twinType = m[1]!.toLowerCase() as "m" | "d";
        twinGroup = m[2]!;
      }
    }

    const notesParts: string[] = [];
    if (record.innerText) notesParts.push(`Inner: ${record.innerText.slice(0, 3)}`);
    if (record.sideText) notesParts.push(`Side: ${record.sideText}`);
    if (record.belowTexts.length) notesParts.push(...record.belowTexts);
    if (isAdopted) notesParts.push("(adopted)");
    if (isSab) notesParts.push("(SAB)");

    individuals.push({
      rawId: record.rawId,
      familyId: record.famId || "FAM001",
      fatherId,
      motherId,
      sex,
      affected,
      affectedLevel,
      type: isSab ? "sab" : sex,
      name: record.rawId,
      age: "",
      deceased: isDeceased,
      proband: isProband,
      adopted: isAdopted,
      notes: notesParts.join("\n"),
      twinGroup,
      twinType,
      consanguinityGroup,
    });
  }

  if (individuals.length === 0) {
    warnings.push("No valid individuals found in HaploPainter CSV file.");
  }

  const familyIdList = Array.from(familyIds);
  const suggestedTitle = familyIdList.length > 0
    ? `${familyIdList.slice(0, 2).join(", ")} — imported from ${filename}`
    : `Pedigree imported from ${filename}`;

  return {
    canvasData: toCanvasData(individuals),
    suggestedTitle,
    familyIds: familyIdList,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// G7: Post-import clinical validation
// ---------------------------------------------------------------------------
export interface ImportValidationIssue {
  severity: "error" | "warning" | "info";
  message: string;
  detail?: string;
}

export function validateImport(canvas: CanvasData): ImportValidationIssue[] {
  const issues: ImportValidationIssue[] = [];
  const { nodes, edges } = canvas;
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Gender consistency: father must be male, mother must be female
  for (const edge of edges) {
    if (edge.type === "parent-child") {
      const source = nodeMap.get(edge.sourceId);
      if (source) {
        // sourceId is the parent (in couple-bar model, it's the father)
      }
    }
    if (edge.type === "couple" || edge.type === "consanguinity" || edge.type === "divorced" || edge.type === "separated") {
      const src = nodeMap.get(edge.sourceId);
      const tgt = nodeMap.get(edge.targetId);
      if (src && tgt) {
        // Check that couple edges connect a male and a female (or unknown)
        if (src.type !== "male" && src.type !== "unknown" && tgt.type !== "male" && tgt.type !== "unknown") {
          issues.push({
            severity: "warning",
            message: "Same-sex couple detected",
            detail: `Both "${src.label}" and "${tgt.label}" are not male — verify this is correct.`,
          });
        }
      }
    }
  }

  // Orphan references: parent IDs in edges that don't exist in nodes
  for (const edge of edges) {
    if (!nodeMap.has(edge.sourceId)) {
      issues.push({
        severity: "warning",
        message: "Edge references missing node",
        detail: `Edge "${edge.id}" source "${edge.sourceId}" does not exist.`,
      });
    }
    if (!nodeMap.has(edge.targetId)) {
      issues.push({
        severity: "warning",
        message: "Edge references missing node",
        detail: `Edge "${edge.id}" target "${edge.targetId}" does not exist.`,
      });
    }
  }

  // Singleton nodes (no edges)
  if (nodes.length > 1) {
    const connectedIds = new Set<string>();
    for (const edge of edges) {
      connectedIds.add(edge.sourceId);
      connectedIds.add(edge.targetId);
    }
    for (const node of nodes) {
      if (!connectedIds.has(node.id)) {
        issues.push({
          severity: "info",
          message: "Unconnected individual",
          detail: `"${node.label}" has no connections in the pedigree.`,
        });
      }
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Auto-detect and dispatch
// ---------------------------------------------------------------------------
export function parseFile(content: string, filename: string): ParseResult {
  const sanitized = sanitizeContent(content);
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  if (ext === "ped" || ext === "hap" || ext === "tfam") {
    return parsePed(sanitized, filename);
  }

  if (ext === "csv" || ext === "tsv" || ext === "txt" || ext === "hp" || ext === "utf8") {
    const allNonCommentLines = sanitized.split("\n").filter((l) => {
      const t = l.trim();
      return t && !t.startsWith("#") && !t.startsWith("!");
    });
    const firstDataLine = allNonCommentLines.find((l) => {
      const t = l.trim();
      if (t.startsWith("*")) return false;
      return true;
    }) ?? allNonCommentLines[0] ?? "";

    let csvPeekLine = firstDataLine;
    if (allNonCommentLines.length >= 2) {
      const tabColsFirst = firstDataLine.split("\t");
      const genderColFirst = tabColsFirst[4];
      const firstLineIsHeader = /^[012xmfXMF]{1}$/.test(genderColFirst?.trim() ?? "") === false &&
        tabColsFirst.length >= 6 &&
        tabColsFirst.some((c) => c && /^[a-zA-Z]{2,}/.test(c.trim()));
      if (firstLineIsHeader) {
        const nextDataLine = allNonCommentLines.find((l) => {
          const idx = allNonCommentLines.indexOf(l);
          return idx > 0 && !l.trim().startsWith("*");
        });
        csvPeekLine = nextDataLine ?? allNonCommentLines[1] ?? "";
      }
    }
    const tabCols = csvPeekLine.split("\t");
    const genderCol = tabCols[4];
    const looksLikeHaploCSV =
      tabCols.length >= 6 &&
      genderCol !== undefined && /^[012xmfXMF]{1}$/.test(genderCol.trim());
    if (looksLikeHaploCSV) return parseHaploPainterCSV(sanitized, filename);

    const cols = firstDataLine.trim().split(/\s+/);
    const col4 = cols[4];
    const col5 = cols[5];
    const looksLikePed =
      ext !== "csv" &&
      cols.length >= 6 &&
      col4 !== undefined && (col4 === "1" || col4 === "2" || col4 === "0") &&
      col5 !== undefined && (col5 === "1" || col5 === "2" || col5 === "0" || col5 === "-9");

    if (looksLikePed) return parsePed(sanitized, filename);

    const firstNonComment = sanitized.split("\n").find((l) => {
      const t = l.trim();
      return t && !t.startsWith("#") && !t.startsWith("*") && !t.startsWith("!");
    }) ?? "";
    if (firstNonComment.startsWith("Individual:")) return parseHaploPainter(sanitized, filename);
    const rawFirstNonComment = sanitized.split("\n").find((l) => {
      const t = l.trim();
      return t && !t.startsWith("#") && !t.startsWith("!");
    }) ?? "";
    const headerCols = (rawFirstNonComment.startsWith("*") ? rawFirstNonComment.slice(1) : rawFirstNonComment).split(/[\t,;|]/);
    const lowered = headerCols.map(c => c.trim().toLowerCase().replace(/[\s_-]/g, ""));
    const haploHeaderCandidates = ["id", "individ", "name", "sex", "father", "mother", "affected"];
    const headerMatchCount = haploHeaderCandidates.filter(h => lowered.some(lh => lh.includes(h))).length;
    if (headerMatchCount >= 3) return parseHaploPainter(sanitized, filename);

    return parseCsv(sanitized, filename);
  }

  return parseCsv(sanitized, filename);
}
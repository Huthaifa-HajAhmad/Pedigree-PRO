export interface PedigreeNode {
  id: string;
  type: "male" | "female" | "unknown";
  affected: boolean;
  deceased: boolean;
  proband: boolean;
  label: string;
  age: string;
  x: number;
  y: number;
}

export interface PedigreeEdge {
  id: string;
  type: "couple" | "parent-child";
  sourceId: string;
  targetId: string;
}

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
  rawId: string;        // original ID from the file
  familyId: string;
  fatherId: string | null;
  motherId: string | null;
  sex: "male" | "female" | "unknown";
  affected: boolean;
  name: string;
  age: string;
}

// ---------------------------------------------------------------------------
// Layout engine
// ---------------------------------------------------------------------------
function layoutNodes(individuals: Individual[]): Map<string, { x: number; y: number }> {
  const byId = new Map(individuals.map((i) => [i.rawId, i]));

  // Compute generation depth via BFS
  const generation = new Map<string, number>();
  const founders = individuals.filter(
    (i) => (!i.fatherId || !byId.has(i.fatherId)) && (!i.motherId || !byId.has(i.motherId))
  );
  founders.forEach((f) => generation.set(f.rawId, 0));

  const queue = [...founders];
  let head = 0;
  let safety = 0;
  while (head < queue.length && safety++ < 10000) {
    const ind = queue[head++];
    const gen = generation.get(ind.rawId) ?? 0;
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

  // Fallback: anyone not placed gets gen 0
  individuals.forEach((i) => {
    if (!generation.has(i.rawId)) generation.set(i.rawId, 0);
  });

  // Group by generation
  const byGen = new Map<number, string[]>();
  for (const [id, gen] of generation.entries()) {
    if (!byGen.has(gen)) byGen.set(gen, []);
    byGen.get(gen)!.push(id);
  }

  // Sort individuals within each generation: try to place couples adjacent to each other
  for (const [, ids] of byGen.entries()) {
    ids.sort((a, b) => {
      const ia = byId.get(a)!;
      const ib = byId.get(b)!;
      // Group siblings together (same parents → adjacent)
      const keyA = `${ia.fatherId ?? "0"}_${ia.motherId ?? "0"}`;
      const keyB = `${ib.fatherId ?? "0"}_${ib.motherId ?? "0"}`;
      if (keyA < keyB) return -1;
      if (keyA > keyB) return 1;
      // Within sibling group, male first
      if (ia.sex === "male" && ib.sex !== "male") return -1;
      if (ia.sex !== "male" && ib.sex === "male") return 1;
      return a.localeCompare(b);
    });
  }

  const positions = new Map<string, { x: number; y: number }>();
  const STEP_X = 120;
  const STEP_Y = 160;
  const START_Y = 80;
  const START_X = 80;

  const maxInGen = Math.max(...Array.from(byGen.values()).map((v) => v.length));

  for (const [gen, ids] of byGen.entries()) {
    const totalWidth = (maxInGen - 1) * STEP_X;
    const offsetX = (totalWidth - (ids.length - 1) * STEP_X) / 2;
    ids.forEach((id, idx) => {
      positions.set(id, {
        x: START_X + offsetX + idx * STEP_X,
        y: START_Y + gen * STEP_Y,
      });
    });
  }

  return positions;
}

// ---------------------------------------------------------------------------
// Convert intermediate → CanvasData
// ---------------------------------------------------------------------------
function toCanvasData(individuals: Individual[]): CanvasData {
  const positions = layoutNodes(individuals);

  const nodes: PedigreeNode[] = individuals.map((ind, idx) => ({
    id: `n_${ind.rawId}_${idx}`,
    type: ind.sex,
    affected: ind.affected,
    deceased: false,
    proband: false,
    label: ind.name || ind.rawId,
    age: ind.age,
    x: positions.get(ind.rawId)?.x ?? 100 + idx * 120,
    y: positions.get(ind.rawId)?.y ?? 100,
  }));

  // Map rawId → node id
  const rawToNode = new Map(individuals.map((ind, idx) => [ind.rawId, `n_${ind.rawId}_${idx}`]));

  const edges: PedigreeEdge[] = [];
  let edgeIdx = 0;

  // Couple edges: find pairs that share at least one child
  const couples = new Set<string>();
  for (const ind of individuals) {
    if (ind.fatherId && ind.motherId) {
      const key = [ind.fatherId, ind.motherId].sort().join("_");
      if (!couples.has(key)) {
        couples.add(key);
        const srcId = rawToNode.get(ind.fatherId);
        const tgtId = rawToNode.get(ind.motherId);
        if (srcId && tgtId) {
          edges.push({ id: `e_couple_${edgeIdx++}`, type: "couple", sourceId: srcId, targetId: tgtId });
        }
      }
    }
    // Parent→child edges
    if (ind.fatherId) {
      const parentNodeId = rawToNode.get(ind.fatherId);
      const childNodeId = rawToNode.get(ind.rawId);
      if (parentNodeId && childNodeId) {
        edges.push({ id: `e_pc_${edgeIdx++}`, type: "parent-child", sourceId: parentNodeId, targetId: childNodeId });
      }
    } else if (ind.motherId) {
      // Only mother known
      const parentNodeId = rawToNode.get(ind.motherId);
      const childNodeId = rawToNode.get(ind.rawId);
      if (parentNodeId && childNodeId) {
        edges.push({ id: `e_pc_${edgeIdx++}`, type: "parent-child", sourceId: parentNodeId, targetId: childNodeId });
      }
    }
  }

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// PLINK PED format parser
// Format: FamilyID  IndividualID  FatherID  MotherID  Sex  Phenotype [extra...]
// Sep: whitespace (tab or space), Sex: 1=male 2=female else=unknown
// Phenotype: 2=affected, else=unaffected (0/-9=missing treated as unaffected)
// ---------------------------------------------------------------------------
export function parsePed(content: string, filename: string): ParseResult {
  const warnings: string[] = [];
  const individuals: Individual[] = [];
  const familyIds = new Set<string>();
  const seenIds = new Set<string>();

  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw || raw.startsWith("#")) continue;

    const cols = raw.split(/\s+/);
    if (cols.length < 6) {
      warnings.push(`Line ${i + 1}: expected ≥6 columns, got ${cols.length} — skipped`);
      continue;
    }

    const [famId, indId, fatId, matId, sexCode, phenoCode] = cols;
    if (seenIds.has(indId)) {
      warnings.push(`Duplicate individual ID "${indId}" at line ${i + 1}: skipped`);
      continue;
    }
    seenIds.add(indId);
    familyIds.add(famId);

    const sex: Individual["sex"] =
      sexCode === "1" ? "male" : sexCode === "2" ? "female" : "unknown";
    const affected = phenoCode === "2";
    const fatherId = fatId === "0" || fatId === "." ? null : fatId;
    const motherId = matId === "0" || matId === "." ? null : matId;

    individuals.push({
      rawId: indId,
      familyId: famId,
      fatherId,
      motherId,
      sex,
      affected,
      name: indId,
      age: "",
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

  const lines = content.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#"));
  if (lines.length < 2) {
    return { canvasData: { nodes: [], edges: [] }, suggestedTitle: filename, familyIds: [], warnings: ["File is empty or has only a header row."] };
  }

  // Detect delimiter
  const firstLine = lines[0];
  const delimiter = firstLine.includes("\t") ? "\t" : ",";

  const headers = parseCSVLine(firstLine, delimiter).map((h) => h.replace(/^["']|["']$/g, ""));

  // Column index resolution
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
    const row = parseCSVLine(lines[i], delimiter);

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

    const affected =
      affRaw === "2" || affRaw === "yes" || affRaw === "true" || affRaw === "1" || affRaw === "affected";

    const fatherId = !father || father === "0" || father === "." || father.toLowerCase() === "na" ? null : father;
    const motherId = !mother || mother === "0" || mother === "." || mother.toLowerCase() === "na" ? null : mother;

    individuals.push({ rawId, familyId: famId, fatherId, motherId, sex, affected, name, age });
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
// Auto-detect and dispatch
// ---------------------------------------------------------------------------
export function parseFile(content: string, filename: string): ParseResult {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  if (ext === "ped" || ext === "hap" || ext === "tfam") {
    return parsePed(content, filename);
  }

  if (ext === "csv" || ext === "tsv" || ext === "txt") {
    // Peek: if first non-comment line looks like PED (6+ whitespace-separated tokens, col 5 is 1/2)
    const firstDataLine = content.split(/\r?\n/).find((l) => l.trim() && !l.trim().startsWith("#")) ?? "";
    const cols = firstDataLine.trim().split(/\s+/);
    const looksLikePed =
      ext !== "csv" &&
      cols.length >= 6 &&
      (cols[4] === "1" || cols[4] === "2" || cols[4] === "0") &&
      (cols[5] === "1" || cols[5] === "2" || cols[5] === "0" || cols[5] === "-9");

    return looksLikePed ? parsePed(content, filename) : parseCsv(content, filename);
  }

  // Default: try CSV then PED
  return parseCsv(content, filename);
}

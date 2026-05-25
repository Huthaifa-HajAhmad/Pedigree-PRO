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
  rawId: string;        // original ID from the file
  familyId: string;
  fatherId: string | null;
  motherId: string | null;
  sex: "male" | "female" | "unknown";
  affected: boolean;
  name: string;
  age: string;
}

interface ExtendedIndividual extends Individual {
  deceased: boolean;
  proband: boolean;
  notes: string;
  twinGroup: string | null;
  twinType: "m" | "d" | null;
  consanguineous: boolean;
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

  const nodes: PedigreeNode[] = individuals.map((ind, idx) => {
    const ext = ind as ExtendedIndividual;
    return {
      id: `n_${ind.rawId}_${idx}`,
      type: ind.sex,
      affected: ind.affected,
      carrier: false,
      deceased: ext.deceased ?? false,
      proband: ext.proband ?? false,
      label: ind.name || ind.rawId,
      age: ind.age,
      notes: ext.notes || undefined,
      x: positions.get(ind.rawId)?.x ?? 100 + idx * 120,
      y: positions.get(ind.rawId)?.y ?? 100,
    };
  });

  // Map rawId → node id
  const rawToNode = new Map(individuals.map((ind, idx) => [ind.rawId, `n_${ind.rawId}_${idx}`]));

  const edges: PedigreeEdge[] = [];
  let edgeIdx = 0;

  // Couple edges: find pairs that share at least one child
  const couples = new Set<string>();
  const consangSet = new Set<string>();
  for (const ind of individuals) {
    const ext = ind as ExtendedIndividual;
    if (ext.consanguineous) {
      consangSet.add(ind.rawId);
    }
    if (ind.fatherId && ind.motherId) {
      const key = [ind.fatherId, ind.motherId].sort().join("_");
      if (!couples.has(key)) {
        couples.add(key);
        const srcId = rawToNode.get(ind.fatherId);
        const tgtId = rawToNode.get(ind.motherId);
        if (srcId && tgtId) {
          const isConsang = consangSet.has(ind.fatherId) || consangSet.has(ind.motherId);
          edges.push({
            id: `e_couple_${edgeIdx++}`,
            type: isConsang ? "consanguinity" : "couple",
            sourceId: srcId,
            targetId: tgtId,
          });
        }
      }
    }
    // Parent→child edges
    if (ind.fatherId) {
      const parentNodeId = rawToNode.get(ind.fatherId);
      const childNodeId = rawToNode.get(ind.rawId);
      if (parentNodeId && childNodeId) {
        edges.push({
          id: `e_pc_${edgeIdx++}`,
          type: "parent-child",
          sourceId: parentNodeId,
          targetId: childNodeId,
          twinGroup: ext.twinGroup || undefined,
          twinType: ext.twinType || undefined,
        });
      }
    }
    if (ind.motherId) {
      const parentNodeId = rawToNode.get(ind.motherId);
      const childNodeId = rawToNode.get(ind.rawId);
      if (parentNodeId && childNodeId) {
        edges.push({
          id: `e_pc_${edgeIdx++}`,
          type: "parent-child",
          sourceId: parentNodeId,
          targetId: childNodeId,
          twinGroup: ext.twinGroup || undefined,
          twinType: ext.twinType || undefined,
        });
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
  const firstLine = lines[0] ?? "";
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
// HaploPainter text format parser
// Auto-detects: explicit (Individual:), header-delimited, and whitespace-delimited
// ---------------------------------------------------------------------------
function parseHaploPainterLine(line: string): Record<string, string> | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) return null;

  // Explicit format: Individual: ID=1, Name=John, Sex=Male, Father=0, Mother=0, Affected=Yes
  if (trimmed.startsWith("Individual:")) {
    const pairs = trimmed.slice("Individual:".length).split(",");
    const record: Record<string, string> = {};
    for (const pair of pairs) {
      const [k, v] = pair.split("=");
      if (k && v) record[k.trim().toLowerCase()] = v.trim();
    }
    return record;
  }

  // Section markers
  if (trimmed.startsWith("[") || trimmed.toLowerCase().startsWith("begin") || trimmed.toLowerCase().startsWith("end")) return null;

  return null;
}

function parseHaploPainter(content: string, filename: string): ParseResult {
  const warnings: string[] = [];
  const individuals: Individual[] = [];
  const familyIds = new Set<string>();
  const seenIds = new Set<string>();

  const lines = content.split(/\r?\n/);
  let explicitMode = false;
  let headerLineIdx = -1;
  const headerCandidates = ["id", "individ", "name", "sex", "gender", "father", "mother", "affected", "phenotype", "status"];

  // Detect mode
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
      const affected = affRaw === "2" || affRaw === "yes" || affRaw === "true" || affRaw === "1" || affRaw === "affected";
      const fatherId = father === "0" || father === "." || father.toLowerCase() === "na" ? null : father;
      const motherId = mother === "0" || mother === "." || mother.toLowerCase() === "na" ? null : mother;

      individuals.push({ rawId, familyId: "FAM001", fatherId, motherId, sex, affected, name, age: "" });
    }
  } else if (headerLineIdx >= 0) {
    // Header-delimited format
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
      const affected =
        affRaw === "2" || affRaw === "yes" || affRaw === "true" || affRaw === "1" || affRaw === "affected";
      const fatherId = !father || father === "0" || father === "." || father.toLowerCase() === "na" ? null : father;
      const motherId = !mother || mother === "0" || mother === "." || mother.toLowerCase() === "na" ? null : mother;

      individuals.push({ rawId, familyId: famId, fatherId, motherId, sex, affected, name, age });
    }
  } else {
    // Try whitespace-delimited fallback (similar to PED but without family column)
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
      // Heuristic: if col 4 is 1/2/0 and col 5 is 1/2/0/-9, treat as PED-like
      const col4 = cols[4];
      const col5 = cols[5];
      const looksLikePed = (col4 === "1" || col4 === "2" || col4 === "0") && (col5 === "1" || col5 === "2" || col5 === "0" || col5 === "-9");
      if (!looksLikePed) {
        warnings.push(`Line ${i + 1}: does not match HaploPainter whitespace format — skipped`);
        continue;
      }
      // Assume: ID, Name, Sex, Father, Mother, Affected  (no family column)
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
      const affected = phenoCode === "2";
      const fatherId = fatId === "0" || fatId === "." ? null : fatId;
      const motherId = matId === "0" || matId === "." ? null : matId;

      individuals.push({ rawId, familyId: "FAM001", fatherId, motherId, sex, affected, name, age: "" });
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
// HaploPainter CSV / UTF-8 parser
// Column order (tab-delimited, 19 columns):
// 1:FAMILY 2:PERSON 3:FATHER 4:MOTHER 5:GENDER 6:AFFECTION
// 7:IS_DECEASED 8:IS_SAB_OR_TOP 9:IS_PROBAND 10:IS_ADOPTED
// 11:ARE_TWINS 12:ARE_CONSANGUINEOUS 13:TEXT_INSIDE 14:TEXT_BESIDE
// 15-19:TEXT1..TEXT5_BELOW
// ---------------------------------------------------------------------------
function stripBOM(content: string): string {
  if (content.charCodeAt(0) === 0xFEFF) return content.slice(1);
  if (content.startsWith("\uFFFE")) return content.slice(1); // UTF-16LE BOM as string
  return content;
}

export function parseHaploPainterCSV(content: string, filename: string): ParseResult {
  const warnings: string[] = [];
  const individuals: ExtendedIndividual[] = [];
  const familyIds = new Set<string>();
  const seenIds = new Set<string>();
  const rawLines = stripBOM(content).split(/\r?\n/);
  const lines = rawLines.filter((l) => {
    const t = l.trim();
    return t && !t.startsWith("#") && !t.startsWith("*") && !t.startsWith("!") && !t.startsWith("/");
  });

  let errorCount = 0;
  const MAX_ERRORS = 20;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Try tab first, then comma
    let cols = line.split("\t");
    if (cols.length < 6) cols = line.split(",");
    if (cols.length < 6) {
      if (errorCount < MAX_ERRORS) {
        warnings.push(`Line ${i + 1}: expected ≥6 columns, got ${cols.length} — skipped`);
        errorCount++;
      }
      continue;
    }

    const famId      = (cols[0] ?? "").trim();
    const rawId      = (cols[1] ?? "").trim();
    const father     = (cols[2] ?? "").trim();
    const mother     = (cols[3] ?? "").trim();
    const sexCode    = (cols[4] ?? "").trim();
    const phenoCode  = (cols[5] ?? "").trim();

    const deceasedRaw    = (cols[6] ?? "").trim();
    const sabRaw         = (cols[7] ?? "").trim();
    const probandRaw     = (cols[8] ?? "").trim();
    const adoptedRaw     = (cols[9] ?? "").trim();
    const twinRaw        = (cols[10] ?? "").trim();
    const consangRaw     = (cols[11] ?? "").trim();
    const innerText      = (cols[12] ?? "").trim();
    const sideText       = (cols[13] ?? "").trim();
    const belowTexts = cols.slice(14, 19).map((c) => (c ?? "").trim()).filter(Boolean);

    // Validation regexes matching HaploPainter
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
    familyIds.add(famId || "FAM001");

    const sex: Individual["sex"] =
      sexCode === "1" || sexCode === "m" || sexCode === "M" ? "male"
      : sexCode === "2" || sexCode === "f" || sexCode === "F" ? "female"
      : "unknown";

    const affected = phenoCode === "2";
    const fatherId = father === "0" || father === "." || father.toLowerCase() === "na" ? null : father;
    const motherId = mother === "0" || mother === "." || mother.toLowerCase() === "na" ? null : mother;

    const isDeceased = /^[1yY]$/.test(deceasedRaw);
    const isProband = /^[1yY]$/.test(probandRaw);
    const isSab = /^[1yY]$/.test(sabRaw);
    const isAdopted = /^[1yY]$/.test(adoptedRaw);
    const isConsanguineous = !!(consangRaw && consangRaw !== "0" && consangRaw !== "." && consangRaw.toLowerCase() !== "na");

    let twinGroup: string | null = null;
    let twinType: "m" | "d" | null = null;
    if (twinRaw && twinRaw !== "0" && twinRaw !== ".") {
      const m = twinRaw.match(/^([mdMD])_(.+)$/);
      if (m) {
        twinType = m[1]!.toLowerCase() as "m" | "d";
        twinGroup = m[2]!;
      }
    }

    const notesParts: string[] = [];
    if (innerText) notesParts.push(`Inner: ${innerText}`);
    if (sideText) notesParts.push(`Side: ${sideText}`);
    if (belowTexts.length) notesParts.push(...belowTexts);
    if (isAdopted) notesParts.push("(adopted)");
    if (isSab) notesParts.push("(SAB)");

    individuals.push({
      rawId,
      familyId: famId || "FAM001",
      fatherId,
      motherId,
      sex,
      affected,
      name: rawId,
      age: "",
      deceased: isDeceased,
      proband: isProband,
      notes: notesParts.join("\n"),
      twinGroup,
      twinType,
      consanguineous: isConsanguineous,
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
// Auto-detect and dispatch
// ---------------------------------------------------------------------------
export function parseFile(content: string, filename: string): ParseResult {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  if (ext === "ped" || ext === "hap" || ext === "tfam") {
    return parsePed(content, filename);
  }

  if (ext === "csv" || ext === "tsv" || ext === "txt" || ext === "hp" || ext === "utf8") {
    const allNonCommentLines = content.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#"));
    const firstDataLine = allNonCommentLines[0] ?? "";

    // Peek for HaploPainter CSV: tab-delimited with ≥6 columns and col 5 is gender code.
    // If the first non-comment line looks like a header (contains letters like FAMILY, PERSON),
    // peek the second line instead so we validate against actual data, not header text.
    let csvPeekLine = firstDataLine;
    if (allNonCommentLines.length >= 2) {
      const tabColsFirst = firstDataLine.split("\t");
      const genderColFirst = tabColsFirst[4];
      const firstLineIsHeader = /^[012xmfXMF]{1}$/.test(genderColFirst?.trim() ?? "") === false &&
        tabColsFirst.length >= 6 &&
        tabColsFirst.some((c) => c && /^[a-zA-Z]{2,}/.test(c.trim()));
      if (firstLineIsHeader) {
        csvPeekLine = allNonCommentLines[1]!;
      }
    }
    const tabCols = csvPeekLine.split("\t");
    const genderCol = tabCols[4];
    const looksLikeHaploCSV =
      tabCols.length >= 6 &&
      genderCol !== undefined && /^[012xmfXMF]{1}$/.test(genderCol.trim());
    if (looksLikeHaploCSV) return parseHaploPainterCSV(content, filename);

    // Peek: if first non-comment line looks like PED (6+ whitespace-separated tokens, col 5 is 1/2)
    const cols = firstDataLine.trim().split(/\s+/);
    const col4 = cols[4];
    const col5 = cols[5];
    const looksLikePed =
      ext !== "csv" &&
      cols.length >= 6 &&
      col4 !== undefined && (col4 === "1" || col4 === "2" || col4 === "0") &&
      col5 !== undefined && (col5 === "1" || col5 === "2" || col5 === "0" || col5 === "-9");

    if (looksLikePed) return parsePed(content, filename);

    // Try HaploPainter explicit/header detection
    const firstNonComment = content.split(/\r?\n/).find((l) => l.trim() && !l.trim().startsWith("#")) ?? "";
    if (firstNonComment.startsWith("Individual:")) return parseHaploPainter(content, filename);
    const headerCols = firstNonComment.split(/[\t,;|]/);
    const lowered = headerCols.map(c => c.trim().toLowerCase().replace(/[\s_-]/g, ""));
    const haploHeaderCandidates = ["id", "individ", "name", "sex", "father", "mother", "affected"];
    const headerMatchCount = haploHeaderCandidates.filter(h => lowered.some(lh => lh.includes(h))).length;
    if (headerMatchCount >= 3) return parseHaploPainter(content, filename);

    return parseCsv(content, filename);
  }

  // Default: try CSV then HaploPainter then PED
  return parseCsv(content, filename);
}

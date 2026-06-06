import type { PedigreeNode, PedigreeEdge } from "@/features/pedigree-editor/canvas/types";
import { computeAutoLayout } from "./auto-layout";


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
// Convert intermediate → CanvasData (G2: SAB/adoption, G3: consanguinity groups, G5: couple-bar edges)
// ---------------------------------------------------------------------------
function toCanvasData(individuals: Individual[]): CanvasData {
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
      x: 100 + idx * 120,
      y: 100,
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

  const positionedNodes = computeAutoLayout(nodes, edges, false) as PedigreeNode[];

  return { nodes: positionedNodes, edges };
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
    const cleanedLine = t.startsWith("*") ? t.slice(1) : t;
    const parts = cleanedLine.split(/[\t,;|]/).map(c => c.trim().toLowerCase().replace(/[\s_-]/g, ""));
    const matchCount = headerKeywords.filter(h => parts.some(lh => lh.includes(h))).length;
    if (matchCount >= 3 && headerLineIdx === -1 && (t.startsWith("*") || preFiltered.length === 0)) {
      headerLineIdx = preFiltered.length;
      preFiltered.push(cleanedLine);
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

    let cols = parseCSVLine(line, "\t");
    if (cols.length < 6) {
      cols = parseCSVLine(line, ";");
      if (cols.length < 6) {
        cols = parseCSVLine(line, ",");
      }
    }

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
    if (!/^(?:[012xmfXMF]|male|female|unknown)$/i.test(sexCode)) {
      if (errorCount < MAX_ERRORS) { warnings.push(`Line ${i + 1}: invalid GENDER "${sexCode}" — skipped`); errorCount++; }
      continue;
    }
    if (!/^(?:-?[0-9]+|[xX]|affected|unaffected|unknown)$/i.test(phenoCode)) {
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

    const sexCodeLower = record.sexCode.toLowerCase();
    const sex: Individual["sex"] =
      sexCodeLower === "1" || sexCodeLower === "m" || sexCodeLower === "male" ? "male"
      : sexCodeLower === "2" || sexCodeLower === "f" || sexCodeLower === "female" ? "female"
      : "unknown";

    let affected: boolean;
    let affectedLevel: number;
    const phenoLower = record.phenoCode.toLowerCase();
    if (usesHaploConvention) {
      const n = parseInt(record.phenoCode, 10);
      affected = !isNaN(n) && n > 0;
      affectedLevel = affected ? n : 0;
    } else {
      affected = record.phenoCode === "2" || phenoLower === "affected";
      affectedLevel = affected ? 2 : 0;
    }

    const fatherId = record.father === "0" || record.father === "." || record.father.toLowerCase() === "na" ? null : record.father;
    const motherId = record.mother === "0" || record.mother === "." || record.mother.toLowerCase() === "na" ? null : record.mother;

    const isTrueValue = (val: string) => /^(?:1|[yY](?:es)?|true)$/i.test(val);
    const isDeceased = isTrueValue(record.deceasedRaw) || record.deceasedRaw.toLowerCase() === "deceased";
    const isProband = isTrueValue(record.probandRaw) || record.probandRaw.toLowerCase() === "proband";
    const isSab = isTrueValue(record.sabRaw) || record.sabRaw.toLowerCase() === "sab";
    const isAdopted = isTrueValue(record.adoptedRaw) || record.adoptedRaw.toLowerCase() === "adopted";
    const consanguinityGroup = (record.consangRaw && record.consangRaw !== "0" && record.consangRaw !== "." && record.consangRaw.toLowerCase() !== "na") ? record.consangRaw : null;

    let twinGroup: string | null = null;
    let twinType: "m" | "d" | null = null;
    if (record.twinRaw && record.twinRaw !== "0" && record.twinRaw !== ".") {
      const m = record.twinRaw.match(/^([mdMD])[-_]?(.+)$/);
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

  // Warning for missing referenced parents
  for (const record of rawRecords) {
    if (record.father && record.father !== "0" && record.father !== "." && record.father.toLowerCase() !== "na") {
      if (!seenIds.has(record.father)) {
        warnings.push(`Individual "${record.rawId}" references father "${record.father}" but this father is not defined in the file.`);
      }
    }
    if (record.mother && record.mother !== "0" && record.mother !== "." && record.mother.toLowerCase() !== "na") {
      if (!seenIds.has(record.mother)) {
        warnings.push(`Individual "${record.rawId}" references mother "${record.mother}" but this mother is not defined in the file.`);
      }
    }
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
    let delimiter = "\t";
    if (allNonCommentLines.length >= 2) {
      if (firstDataLine.includes("\t")) delimiter = "\t";
      else if (firstDataLine.includes(";")) delimiter = ";";
      else if (firstDataLine.includes(",")) delimiter = ",";

      const colsFirst = firstDataLine.split(delimiter);
      const genderColFirst = colsFirst[4];
      const firstLineIsHeader = /^[012xmfXMF]{1}$/.test(genderColFirst?.trim() ?? "") === false &&
        colsFirst.length >= 6 &&
        colsFirst.some((c) => c && /^[a-zA-Z]{2,}/.test(c.trim()));
      if (firstLineIsHeader) {
        const nextDataLine = allNonCommentLines.find((l) => {
          const idx = allNonCommentLines.indexOf(l);
          return idx > 0 && !l.trim().startsWith("*");
        });
        csvPeekLine = nextDataLine ?? allNonCommentLines[1] ?? "";
      }
    }
    if (csvPeekLine.includes("\t")) delimiter = "\t";
    else if (csvPeekLine.includes(";")) delimiter = ";";
    else if (csvPeekLine.includes(",")) delimiter = ",";

    const peekCols = csvPeekLine.split(delimiter);
    const genderCol = peekCols[4];
    const looksLikeHaploCSV =
      peekCols.length >= 6 &&
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
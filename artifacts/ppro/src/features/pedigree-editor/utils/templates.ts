import type { CanvasData, PedigreeNode } from "../canvas/types";

export interface TemplateOption {
  key: string;
  name: string;
  desc: string;
  category: "basic" | "consanguinity" | "inheritance" | "special";
}

const PEDIGREE_TEMPLATES: readonly TemplateOption[] = [
  { key: "nuclear",           name: "Nuclear Family",      desc: "2 parents + proband child", category: "basic" },
  { key: "three-gen",         name: "Three-Generation",    desc: "4 grandparents, 2 parents, proband", category: "basic" },
  { key: "affected-siblings", name: "Affected Siblings",   desc: "Parents + proband + 2 siblings", category: "basic" },
  { key: "consanguineous",    name: "Consanguineous",      desc: "Related parents + proband child", category: "consanguinity" },
  { key: "cousin-marriage",   name: "First-Cousin Marriage", desc: "3-generation tree showing cousin union", category: "consanguinity" },
  { key: "dominant-transmission", name: "Autosomal Dominant", desc: "3-generation dominant disease transmission", category: "inheritance" },
  { key: "recessive-transmission", name: "Autosomal Recessive", desc: "3-generation recessive disease transmission", category: "inheritance" },
  { key: "x-linked-carrier",  name: "X-Linked Recessive",  desc: "Carrier females and affected males transmission", category: "inheritance" },
  { key: "x-linked-dominant", name: "X-Linked Dominant",   desc: "3-generation X-linked dominant transmission", category: "inheritance" },
  { key: "mitochondrial-transmission", name: "Mitochondrial", desc: "3-generation maternal mitochondrial transmission", category: "inheritance" },
  { key: "y-linked-transmission", name: "Y-Linked",          desc: "3-generation Y-chromosomal transmission", category: "inheritance" },
  { key: "incomplete-penetrance", name: "AD Incomplete Penetrance", desc: "Autosomal dominant with incomplete penetrance", category: "inheritance" },
  { key: "imprinting-paternal", name: "Paternal Imprinting", desc: "Genomic imprinting with paternal allele silencing", category: "inheritance" },
  { key: "imprinting-maternal", name: "Maternal Imprinting", desc: "Genomic imprinting with maternal allele silencing", category: "inheritance" },
  { key: "pseudodominance",   name: "Pseudodominance",     desc: "Recessive trait appearing dominant in family", category: "inheritance" },
  { key: "germline-mosaicism", name: "Germline Mosaicism",  desc: "Unaffected parents with multiple affected children", category: "inheritance" },
  { key: "de-novo",           name: "De Novo Mutation",    desc: "Affected proband with unaffected parents and ancestors", category: "inheritance" },
  { key: "twins-template",    name: "Twins Starter",       desc: "Parents with monozygotic & dizygotic twins", category: "special" },
];

export function getTemplateOptions(): readonly TemplateOption[] {
  return PEDIGREE_TEMPLATES;
}

export function buildTemplate(key: string): CanvasData {
  const ts = Date.now();
  const n = (s: string) => `t${ts}_${s}`;
  const e = (s: string) => `te${ts}_${s}`;
  const node = (id: string, type: PedigreeNode["type"], label: string, x: number, y: number, extra: Partial<PedigreeNode> = {}): PedigreeNode =>
    ({ id: n(id), type, affected: false, carrier: false, deceased: false, proband: false, label, age: "", x, y, ...extra });

  if (key === "nuclear") {
    const fId = n("f"), mId = n("m"), cId = n("c");
    return {
      nodes: [node("f", "male", "Father", 650, 130), node("m", "female", "Mother", 740, 130), node("c", "unknown", "Proband", 695, 270, { proband: true })],
      edges: [{ id: e("1"), type: "couple", sourceId: fId, targetId: mId }, { id: e("2"), type: "parent-child", sourceId: fId, targetId: cId }, { id: e("3"), type: "parent-child", sourceId: mId, targetId: cId }],
      annotations: [],
    };
  }
  if (key === "three-gen") {
    const pgf = n("pgf"), pgm = n("pgm"), mgf = n("mgf"), mgm = n("mgm"), f = n("f"), m = n("m"), c = n("c");
    return {
      nodes: [
        node("pgf", "male", "Pat. GF", 530, 130), node("pgm", "female", "Pat. GM", 620, 130),
        node("mgf", "male", "Mat. GF", 780, 130), node("mgm", "female", "Mat. GM", 870, 130),
        node("f", "male", "Father", 575, 270), node("m", "female", "Mother", 825, 270),
        node("c", "unknown", "Proband", 700, 410, { proband: true }),
      ],
      edges: [
        { id: e("1"), type: "couple", sourceId: pgf, targetId: pgm }, { id: e("2"), type: "couple", sourceId: mgf, targetId: mgm },
        { id: e("3"), type: "parent-child", sourceId: pgf, targetId: f }, { id: e("4"), type: "parent-child", sourceId: pgm, targetId: f },
        { id: e("5"), type: "parent-child", sourceId: mgf, targetId: m }, { id: e("6"), type: "parent-child", sourceId: mgm, targetId: m },
        { id: e("7"), type: "couple", sourceId: f, targetId: m },
        { id: e("8"), type: "parent-child", sourceId: f, targetId: c }, { id: e("9"), type: "parent-child", sourceId: m, targetId: c },
      ],
      annotations: [],
    };
  }
  if (key === "affected-siblings") {
    const f = n("f"), m = n("m"), s1 = n("s1"), s2 = n("s2"), s3 = n("s3");
    return {
      nodes: [
        node("f", "male", "Father", 645, 130), node("m", "female", "Mother", 755, 130),
        node("s1", "male", "Brother", 555, 270), node("s2", "unknown", "Proband", 700, 270, { proband: true, affected: true }),
        node("s3", "female", "Sister", 845, 270, { affected: true }),
      ],
      edges: [
        { id: e("1"), type: "couple", sourceId: f, targetId: m },
        { id: e("2"), type: "parent-child", sourceId: f, targetId: s1 }, { id: e("3"), type: "parent-child", sourceId: m, targetId: s1 },
        { id: e("4"), type: "parent-child", sourceId: f, targetId: s2 }, { id: e("5"), type: "parent-child", sourceId: m, targetId: s2 },
        { id: e("6"), type: "parent-child", sourceId: f, targetId: s3 }, { id: e("7"), type: "parent-child", sourceId: m, targetId: s3 },
      ],
      annotations: [],
    };
  }
  if (key === "consanguineous") {
    const f = n("f"), m = n("m"), c = n("c");
    return {
      nodes: [node("f", "male", "Father", 645, 130), node("m", "female", "Mother", 755, 130), node("c", "unknown", "Proband", 700, 270, { proband: true })],
      edges: [{ id: e("1"), type: "consanguinity", sourceId: f, targetId: m }, { id: e("2"), type: "parent-child", sourceId: f, targetId: c }, { id: e("3"), type: "parent-child", sourceId: m, targetId: c }],
      annotations: [],
    };
  }
  if (key === "cousin-marriage") {
    // Genetically accurate first-cousin marriage tree with symmetric alignment and one set of shared grandparents
    const pgf = n("pgf"), pgm = n("pgm"),
          fsib = n("fsib"), sp1 = n("sp1"), msib = n("msib"), sp2 = n("sp2"),
          c1 = n("c1"), c2 = n("c2"), proband = n("proband");
    return {
      nodes: [
        // Generation 1: Shared Grandparents
        node("pgf", "male", "Pat. Grandfather", 550, 130),
        node("pgm", "female", "Pat. Grandmother", 650, 130),
        // Generation 2: Siblings & Spouses
        node("sp1", "female", "Spouse 1", 400, 270),
        node("fsib", "male", "Father's Sibling", 500, 270),
        node("msib", "female", "Mother's Sibling", 700, 270),
        node("sp2", "male", "Spouse 2", 800, 270),
        // Generation 3: First Cousins (couple)
        node("c1", "male", "First Cousin 1", 450, 410),
        node("c2", "female", "First Cousin 2", 750, 410),
        // Generation 4: Proband Child
        node("proband", "unknown", "Proband", 600, 550, { proband: true }),
      ],
      edges: [
        // Grandparents couple
        { id: e("1"), type: "couple", sourceId: pgf, targetId: pgm },
        // Grandparents children
        { id: e("2"), type: "parent-child", sourceId: pgf, targetId: fsib },
        { id: e("3"), type: "parent-child", sourceId: pgm, targetId: fsib },
        { id: e("4"), type: "parent-child", sourceId: pgf, targetId: msib },
        { id: e("5"), type: "parent-child", sourceId: pgm, targetId: msib },
        // Sibling couples
        { id: e("6"), type: "couple", sourceId: fsib, targetId: sp1 },
        { id: e("7"), type: "couple", sourceId: msib, targetId: sp2 },
        // Cousins (parents midpoints: 450 and 750)
        { id: e("8"), type: "parent-child", sourceId: fsib, targetId: c1 },
        { id: e("9"), type: "parent-child", sourceId: sp1, targetId: c1 },
        { id: e("10"), type: "parent-child", sourceId: msib, targetId: c2 },
        { id: e("11"), type: "parent-child", sourceId: sp2, targetId: c2 },
        // Cousin marriage (consanguinity)
        { id: e("12"), type: "consanguinity", sourceId: c1, targetId: c2 },
        // Proband child under cousins couple midpoint 600
        { id: e("13"), type: "parent-child", sourceId: c1, targetId: proband },
        { id: e("14"), type: "parent-child", sourceId: c2, targetId: proband },
      ],
      annotations: [],
    };
  }
  if (key === "dominant-transmission") {
    const gf = n("gf"), gm = n("gm"), f = n("f"), m = n("m"), uncle = n("uncle"),
          proband = n("proband"), sib = n("sib");
    return {
      nodes: [
        node("gf", "male", "GF (Affected)", 600, 130, { affected: true }),
        node("gm", "female", "Grandmother", 700, 130),
        node("f", "male", "Father", 450, 270),
        node("m", "female", "Mother (Affected)", 550, 270, { affected: true }),
        node("uncle", "male", "Uncle", 750, 270),
        node("proband", "unknown", "Proband (Affected)", 500, 410, { proband: true, affected: true }),
        node("sib", "female", "Sister", 600, 410),
      ],
      edges: [
        { id: e("1"), type: "couple", sourceId: gf, targetId: gm },
        { id: e("2"), type: "parent-child", sourceId: gf, targetId: m },
        { id: e("3"), type: "parent-child", sourceId: gm, targetId: m },
        { id: e("4"), type: "parent-child", sourceId: gf, targetId: uncle },
        { id: e("5"), type: "parent-child", sourceId: gm, targetId: uncle },
        { id: e("6"), type: "couple", sourceId: f, targetId: m },
        { id: e("7"), type: "parent-child", sourceId: f, targetId: proband },
        { id: e("8"), type: "parent-child", sourceId: m, targetId: proband },
        { id: e("9"), type: "parent-child", sourceId: f, targetId: sib },
        { id: e("10"), type: "parent-child", sourceId: m, targetId: sib },
      ],
      annotations: [],
    };
  }
  if (key === "recessive-transmission") {
    const gf = n("gf"), gm = n("gm"), f = n("f"), m = n("m"), uncle = n("uncle"),
          proband = n("proband"), sib = n("sib");
    return {
      nodes: [
        node("gf", "male", "GF", 600, 130),
        node("gm", "female", "GM", 700, 130),
        node("f", "male", "Father (Carrier)", 450, 270, { carrier: true }),
        node("m", "female", "Mother (Carrier)", 550, 270, { carrier: true }),
        node("uncle", "male", "Uncle", 750, 270),
        node("proband", "unknown", "Proband (Affected)", 500, 410, { proband: true, affected: true }),
        node("sib", "female", "Sister (Carrier)", 600, 410, { carrier: true }),
      ],
      edges: [
        { id: e("1"), type: "couple", sourceId: gf, targetId: gm },
        { id: e("2"), type: "parent-child", sourceId: gf, targetId: m },
        { id: e("3"), type: "parent-child", sourceId: gm, targetId: m },
        { id: e("4"), type: "parent-child", sourceId: gf, targetId: uncle },
        { id: e("5"), type: "parent-child", sourceId: gm, targetId: uncle },
        { id: e("6"), type: "couple", sourceId: f, targetId: m },
        { id: e("7"), type: "parent-child", sourceId: f, targetId: proband },
        { id: e("8"), type: "parent-child", sourceId: m, targetId: proband },
        { id: e("9"), type: "parent-child", sourceId: f, targetId: sib },
        { id: e("10"), type: "parent-child", sourceId: m, targetId: sib },
      ],
      annotations: [],
    };
  }
  if (key === "x-linked-carrier") {
    const gf = n("gf"), gm = n("gm"), f = n("f"), m = n("m"), uncle = n("uncle"),
          proband = n("proband"), sib = n("sib");
    return {
      nodes: [
        node("gf", "male", "GF (Affected)", 600, 130, { affected: true }),
        node("gm", "female", "Grandmother", 700, 130),
        node("f", "male", "Father", 450, 270),
        node("m", "female", "Mother (Carrier)", 550, 270, { carrier: true }),
        node("uncle", "male", "Uncle", 750, 270),
        node("proband", "male", "Proband (Affected)", 500, 410, { proband: true, affected: true }),
        node("sib", "female", "Sister (Carrier)", 600, 410, { carrier: true }),
      ],
      edges: [
        { id: e("1"), type: "couple", sourceId: gf, targetId: gm },
        { id: e("2"), type: "parent-child", sourceId: gf, targetId: m },
        { id: e("3"), type: "parent-child", sourceId: gm, targetId: m },
        { id: e("4"), type: "parent-child", sourceId: gf, targetId: uncle },
        { id: e("5"), type: "parent-child", sourceId: gm, targetId: uncle },
        { id: e("6"), type: "couple", sourceId: f, targetId: m },
        { id: e("7"), type: "parent-child", sourceId: f, targetId: proband },
        { id: e("8"), type: "parent-child", sourceId: m, targetId: proband },
        { id: e("9"), type: "parent-child", sourceId: f, targetId: sib },
        { id: e("10"), type: "parent-child", sourceId: m, targetId: sib },
      ],
      annotations: [],
    };
  }
  if (key === "x-linked-dominant") {
    const gf = n("gf"), gm = n("gm"), f = n("f"), m = n("m"), uncle = n("uncle"),
          proband = n("proband"), sib = n("sib");
    return {
      nodes: [
        node("gf", "male", "GF (Affected)", 600, 130, { affected: true }),
        node("gm", "female", "Grandmother", 700, 130),
        node("f", "male", "Father", 450, 270),
        node("m", "female", "Mother (Affected)", 550, 270, { affected: true }),
        node("uncle", "male", "Uncle", 750, 270),
        node("proband", "unknown", "Proband (Affected)", 500, 410, { proband: true, affected: true }),
        node("sib", "female", "Sister (Affected)", 600, 410, { affected: true }),
      ],
      edges: [
        { id: e("1"), type: "couple", sourceId: gf, targetId: gm },
        { id: e("2"), type: "parent-child", sourceId: gf, targetId: m },
        { id: e("3"), type: "parent-child", sourceId: gm, targetId: m },
        { id: e("4"), type: "parent-child", sourceId: gf, targetId: uncle },
        { id: e("5"), type: "parent-child", sourceId: gm, targetId: uncle },
        { id: e("6"), type: "couple", sourceId: f, targetId: m },
        { id: e("7"), type: "parent-child", sourceId: f, targetId: proband },
        { id: e("8"), type: "parent-child", sourceId: m, targetId: proband },
        { id: e("9"), type: "parent-child", sourceId: f, targetId: sib },
        { id: e("10"), type: "parent-child", sourceId: m, targetId: sib },
      ],
      annotations: [],
    };
  }
  if (key === "mitochondrial-transmission") {
    const gf = n("gf"), gm = n("gm"), f = n("f"), m = n("m"), uncle = n("uncle"), un_sp = n("unsp"),
          proband = n("proband"), sib = n("sib"), un_c = n("unc");
    return {
      nodes: [
        node("gf", "male", "GF", 600, 130),
        node("gm", "female", "GM (Affected)", 700, 130, { affected: true }),
        node("f", "male", "Father", 450, 270),
        node("m", "female", "Mother (Affected)", 550, 270, { affected: true }),
        node("uncle", "male", "Uncle (Affected)", 750, 270, { affected: true }),
        node("unsp", "female", "Uncle Spouse", 850, 270),
        node("proband", "unknown", "Proband (Affected)", 500, 410, { proband: true, affected: true }),
        node("sib", "female", "Sister (Affected)", 600, 410, { affected: true }),
        node("unc", "unknown", "Uncle Child", 800, 410),
      ],
      edges: [
        { id: e("1"), type: "couple", sourceId: gf, targetId: gm },
        { id: e("2"), type: "parent-child", sourceId: gf, targetId: m },
        { id: e("3"), type: "parent-child", sourceId: gm, targetId: m },
        { id: e("4"), type: "parent-child", sourceId: gf, targetId: uncle },
        { id: e("5"), type: "parent-child", sourceId: gm, targetId: uncle },
        { id: e("6"), type: "couple", sourceId: f, targetId: m },
        { id: e("7"), type: "parent-child", sourceId: f, targetId: proband },
        { id: e("8"), type: "parent-child", sourceId: m, targetId: proband },
        { id: e("9"), type: "parent-child", sourceId: f, targetId: sib },
        { id: e("10"), type: "parent-child", sourceId: m, targetId: sib },
        { id: e("11"), type: "couple", sourceId: uncle, targetId: un_sp },
        { id: e("12"), type: "parent-child", sourceId: uncle, targetId: un_c },
        { id: e("13"), type: "parent-child", sourceId: un_sp, targetId: un_c },
      ],
      annotations: [],
    };
  }
  if (key === "y-linked-transmission") {
    const gf = n("gf"), gm = n("gm"), f = n("f"), m = n("m"), uncle = n("uncle"), un_sp = n("unsp"),
          proband = n("proband"), sib = n("sib"), un_c = n("unc");
    return {
      nodes: [
        node("gf", "male", "GF (Affected)", 600, 130, { affected: true }),
        node("gm", "female", "Grandmother", 700, 130),
        node("f", "male", "Father (Affected)", 450, 270, { affected: true }),
        node("m", "female", "Mother", 550, 270),
        node("uncle", "male", "Uncle (Affected)", 750, 270, { affected: true }),
        node("unsp", "female", "Uncle Spouse", 850, 270),
        node("proband", "male", "Proband (Affected)", 500, 410, { proband: true, affected: true }),
        node("sib", "female", "Sister", 600, 410),
        node("unc", "male", "Uncle Son (Affected)", 800, 410, { affected: true }),
      ],
      edges: [
        { id: e("1"), type: "couple", sourceId: gf, targetId: gm },
        { id: e("2"), type: "parent-child", sourceId: gf, targetId: m },
        { id: e("3"), type: "parent-child", sourceId: gm, targetId: m },
        { id: e("4"), type: "parent-child", sourceId: gf, targetId: uncle },
        { id: e("5"), type: "parent-child", sourceId: gm, targetId: uncle },
        { id: e("6"), type: "couple", sourceId: f, targetId: m },
        { id: e("7"), type: "parent-child", sourceId: f, targetId: proband },
        { id: e("8"), type: "parent-child", sourceId: m, targetId: proband },
        { id: e("9"), type: "parent-child", sourceId: f, targetId: sib },
        { id: e("10"), type: "parent-child", sourceId: m, targetId: sib },
        { id: e("11"), type: "couple", sourceId: uncle, targetId: un_sp },
        { id: e("12"), type: "parent-child", sourceId: uncle, targetId: un_c },
        { id: e("13"), type: "parent-child", sourceId: un_sp, targetId: un_c },
      ],
      annotations: [],
    };
  }
  if (key === "incomplete-penetrance") {
    const gf = n("gf"), gm = n("gm"), f = n("f"), m = n("m"), uncle = n("uncle"),
          proband = n("proband"), sib = n("sib");
    return {
      nodes: [
        node("gf", "male", "GF (Affected)", 600, 130, { affected: true }),
        node("gm", "female", "Grandmother", 700, 130),
        node("f", "male", "Father", 450, 270),
        node("m", "female", "Mother (Carrier)", 550, 270),
        node("uncle", "male", "Uncle (Affected)", 750, 270, { affected: true }),
        node("proband", "unknown", "Proband (Affected)", 500, 410, { proband: true, affected: true }),
        node("sib", "female", "Sister", 600, 410),
      ],
      edges: [
        { id: e("1"), type: "couple", sourceId: gf, targetId: gm },
        { id: e("2"), type: "parent-child", sourceId: gf, targetId: m },
        { id: e("3"), type: "parent-child", sourceId: gm, targetId: m },
        { id: e("4"), type: "parent-child", sourceId: gf, targetId: uncle },
        { id: e("5"), type: "parent-child", sourceId: gm, targetId: uncle },
        { id: e("6"), type: "couple", sourceId: f, targetId: m },
        { id: e("7"), type: "parent-child", sourceId: f, targetId: proband },
        { id: e("8"), type: "parent-child", sourceId: m, targetId: proband },
        { id: e("9"), type: "parent-child", sourceId: f, targetId: sib },
        { id: e("10"), type: "parent-child", sourceId: m, targetId: sib },
      ],
      annotations: [],
    };
  }
  if (key === "imprinting-paternal") {
    const gf = n("gf"), gm = n("gm"), f = n("f"), m = n("m"), uncle = n("uncle"), un_sp = n("unsp"),
          proband = n("proband"), un_c = n("unc");
    return {
      nodes: [
        node("gf", "male", "GF (Affected)", 600, 130, { affected: true }),
        node("gm", "female", "Grandmother", 700, 130),
        node("f", "male", "Father (Carrier)", 750, 270),
        node("m", "female", "Mother", 850, 270),
        node("uncle", "female", "Aunt (Carrier)", 550, 270),
        node("unsp", "male", "Aunt Spouse", 450, 270),
        node("proband", "unknown", "Proband (Affected)", 500, 410, { proband: true, affected: true }),
        node("unc", "unknown", "Cousin (Unaffected)", 800, 410),
      ],
      edges: [
        { id: e("1"), type: "couple", sourceId: gf, targetId: gm },
        { id: e("2"), type: "parent-child", sourceId: gf, targetId: uncle },
        { id: e("3"), type: "parent-child", sourceId: gm, targetId: uncle },
        { id: e("4"), type: "parent-child", sourceId: gf, targetId: f },
        { id: e("5"), type: "parent-child", sourceId: gm, targetId: f },
        { id: e("6"), type: "couple", sourceId: un_sp, targetId: uncle },
        { id: e("7"), type: "parent-child", sourceId: un_sp, targetId: proband },
        { id: e("8"), type: "parent-child", sourceId: uncle, targetId: proband },
        { id: e("9"), type: "couple", sourceId: f, targetId: m },
        { id: e("10"), type: "parent-child", sourceId: f, targetId: un_c },
        { id: e("11"), type: "parent-child", sourceId: m, targetId: un_c },
      ],
      annotations: [],
    };
  }
  if (key === "imprinting-maternal") {
    const gf = n("gf"), gm = n("gm"), f = n("f"), m = n("m"), uncle = n("uncle"), un_sp = n("unsp"),
          proband = n("proband"), un_c = n("unc");
    return {
      nodes: [
        node("gf", "male", "GF (Affected)", 600, 130, { affected: true }),
        node("gm", "female", "Grandmother", 700, 130),
        node("f", "male", "Father (Affected)", 750, 270, { affected: true }),
        node("m", "female", "Mother", 850, 270),
        node("uncle", "female", "Aunt (Affected)", 550, 270, { affected: true }),
        node("unsp", "male", "Aunt Spouse", 450, 270),
        node("proband", "unknown", "Proband", 500, 410, { proband: true }),
        node("unc", "unknown", "Cousin (Affected)", 800, 410, { affected: true }),
      ],
      edges: [
        { id: e("1"), type: "couple", sourceId: gf, targetId: gm },
        { id: e("2"), type: "parent-child", sourceId: gf, targetId: uncle },
        { id: e("3"), type: "parent-child", sourceId: gm, targetId: uncle },
        { id: e("4"), type: "parent-child", sourceId: gf, targetId: f },
        { id: e("5"), type: "parent-child", sourceId: gm, targetId: f },
        { id: e("6"), type: "couple", sourceId: un_sp, targetId: uncle },
        { id: e("7"), type: "parent-child", sourceId: un_sp, targetId: proband },
        { id: e("8"), type: "parent-child", sourceId: uncle, targetId: proband },
        { id: e("9"), type: "couple", sourceId: f, targetId: m },
        { id: e("10"), type: "parent-child", sourceId: f, targetId: un_c },
        { id: e("11"), type: "parent-child", sourceId: m, targetId: un_c },
      ],
      annotations: [],
    };
  }
  if (key === "pseudodominance") {
    const gf = n("gf"), gm = n("gm"), f = n("f"), m = n("m"),
          proband = n("proband"), sib1 = n("sib1"), sib2 = n("sib2");
    return {
      nodes: [
        node("gf", "male", "GF (Carrier)", 600, 130, { carrier: true }),
        node("gm", "female", "GM (Carrier)", 700, 130, { carrier: true }),
        node("f", "male", "Father (Affected)", 550, 270, { affected: true }),
        node("m", "female", "Mother (Carrier)", 650, 270, { carrier: true }),
        node("proband", "unknown", "Proband (Affected)", 500, 410, { proband: true, affected: true }),
        node("sib1", "male", "Brother (Affected)", 600, 410, { affected: true }),
        node("sib2", "female", "Sister (Carrier)", 700, 410, { carrier: true }),
      ],
      edges: [
        { id: e("1"), type: "couple", sourceId: gf, targetId: gm },
        { id: e("2"), type: "parent-child", sourceId: gf, targetId: f },
        { id: e("3"), type: "parent-child", sourceId: gm, targetId: f },
        { id: e("4"), type: "couple", sourceId: f, targetId: m },
        { id: e("5"), type: "parent-child", sourceId: f, targetId: proband },
        { id: e("6"), type: "parent-child", sourceId: m, targetId: proband },
        { id: e("7"), type: "parent-child", sourceId: f, targetId: sib1 },
        { id: e("8"), type: "parent-child", sourceId: m, targetId: sib1 },
        { id: e("9"), type: "parent-child", sourceId: f, targetId: sib2 },
        { id: e("10"), type: "parent-child", sourceId: m, targetId: sib2 },
      ],
      annotations: [],
    };
  }
  if (key === "germline-mosaicism") {
    const f = n("f"), m = n("m"), b = n("b"), proband = n("proband"), s = n("s");
    return {
      nodes: [
        node("f", "male", "Father", 650, 130),
        node("m", "female", "Mother", 740, 130),
        node("b", "male", "Brother (Affected)", 595, 270, { affected: true }),
        node("proband", "unknown", "Proband (Affected)", 695, 270, { proband: true, affected: true }),
        node("s", "female", "Sister", 795, 270),
      ],
      edges: [
        { id: e("1"), type: "couple", sourceId: f, targetId: m },
        { id: e("2"), type: "parent-child", sourceId: f, targetId: b },
        { id: e("3"), type: "parent-child", sourceId: m, targetId: b },
        { id: e("4"), type: "parent-child", sourceId: f, targetId: proband },
        { id: e("5"), type: "parent-child", sourceId: m, targetId: proband },
        { id: e("6"), type: "parent-child", sourceId: f, targetId: s },
        { id: e("7"), type: "parent-child", sourceId: m, targetId: s },
      ],
      annotations: [],
    };
  }
  if (key === "de-novo") {
    const gf = n("gf"), gm = n("gm"), f = n("f"), m = n("m"),
          proband = n("proband"), sib = n("sib");
    return {
      nodes: [
        node("gf", "male", "GF", 600, 130),
        node("gm", "female", "GM", 700, 130),
        node("f", "male", "Father", 500, 270),
        node("m", "female", "Mother", 600, 270),
        node("proband", "unknown", "Proband (Affected)", 500, 410, { proband: true, affected: true }),
        node("sib", "female", "Sister", 600, 410),
      ],
      edges: [
        { id: e("1"), type: "couple", sourceId: gf, targetId: gm },
        { id: e("2"), type: "parent-child", sourceId: gf, targetId: m },
        { id: e("3"), type: "parent-child", sourceId: gm, targetId: m },
        { id: e("4"), type: "couple", sourceId: f, targetId: m },
        { id: e("5"), type: "parent-child", sourceId: f, targetId: proband },
        { id: e("6"), type: "parent-child", sourceId: m, targetId: proband },
        { id: e("7"), type: "parent-child", sourceId: f, targetId: sib },
        { id: e("8"), type: "parent-child", sourceId: m, targetId: sib },
      ],
      annotations: [],
    };
  }
  if (key === "twins-template") {
    const f = n("f"), m = n("m"), t1 = n("t1"), t2 = n("t2"), t3 = n("t3"), t4 = n("t4");
    return {
      nodes: [
        node("f", "male", "Father", 630, 130), node("m", "female", "Mother", 770, 130),
        node("t1", "male", "Twin 1 (MZ)", 500, 270), node("t2", "male", "Twin 2 (MZ)", 600, 270),
        node("t3", "female", "Twin 3 (DZ)", 800, 270), node("t4", "female", "Twin 4 (DZ)", 900, 270),
      ],
      edges: [
        { id: e("1"), type: "couple", sourceId: f, targetId: m },
        // Monozygotic twins tg1
        { id: e("2"), type: "parent-child", sourceId: f, targetId: t1, twinGroup: "tg1", twinType: "m" },
        { id: e("3"), type: "parent-child", sourceId: m, targetId: t1, twinGroup: "tg1", twinType: "m" },
        { id: e("4"), type: "parent-child", sourceId: f, targetId: t2, twinGroup: "tg1", twinType: "m" },
        { id: e("5"), type: "parent-child", sourceId: m, targetId: t2, twinGroup: "tg1", twinType: "m" },
        // Dizygotic twins tg2
        { id: e("6"), type: "parent-child", sourceId: f, targetId: t3, twinGroup: "tg2", twinType: "d" },
        { id: e("7"), type: "parent-child", sourceId: m, targetId: t3, twinGroup: "tg2", twinType: "d" },
        { id: e("8"), type: "parent-child", sourceId: f, targetId: t4, twinGroup: "tg2", twinType: "d" },
        { id: e("9"), type: "parent-child", sourceId: m, targetId: t4, twinGroup: "tg2", twinType: "d" },
      ],
      annotations: [],
    };
  }
  return { nodes: [], edges: [], annotations: [] };
}
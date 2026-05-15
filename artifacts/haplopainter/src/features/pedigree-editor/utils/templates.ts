import type { CanvasData, PedigreeNode } from "../canvas/types";

const PEDIGREE_TEMPLATES = [
  { key: "nuclear",           name: "Nuclear Family",      desc: "2 parents + proband child" },
  { key: "three-gen",         name: "Three-Generation",    desc: "4 grandparents, 2 parents, proband" },
  { key: "affected-siblings", name: "Affected Siblings",   desc: "Parents + proband + 2 siblings" },
  { key: "consanguineous",    name: "Consanguineous",      desc: "Related parents + proband" },
] as const;

export function getTemplateOptions() {
  return PEDIGREE_TEMPLATES;
}

export function buildTemplate(key: string): CanvasData {
  const ts = Date.now();
  const n = (s: string) => `t${ts}_${s}`;
  const e = (s: string) => `te${ts}_${s}`;
  const node = (id: string, type: PedigreeNode["type"], label: string, x: number, y: number, extra: Partial<PedigreeNode> = {}): PedigreeNode =>
    ({ id: n(id), type, affected: false, carrier: false, deceased: false, proband: false, label, age: "", x, y, pinned: true, ...extra });

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
  return { nodes: [], edges: [], annotations: [] };
}
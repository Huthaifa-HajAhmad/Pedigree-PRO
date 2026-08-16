import { exec, query, queryOne } from "../db";
import { computeHash } from "@workspace/crypto";
import { get_pedigree, create_pedigree } from "./pedigreeCommands";
import type { LegacyImportSummary, PproVersionEntry, PproExport, Pedigree } from "./types";

export function export_pedigree_ppro(args: {
  pedigree_id: number;
  exporter_key: string;
}): string {
  const ped = get_pedigree({ id: args.pedigree_id });

  const canvas_data = ped.canvas_data ? JSON.parse(ped.canvas_data) : null;

  const versions = query<PproVersionEntry>(
    "SELECT version_number, label, canvas_data, canvas_hash, saver_key, saver_signature, created_at FROM pedigree_versions WHERE pedigree_id = ? ORDER BY version_number ASC",
    [args.pedigree_id]
  );

  const nodeAnnotations = query<Record<string, unknown>>(
    "SELECT node_id, hpo_terms, omim_ids, variant_hgvs, test_results, clinical_notes, affected_status, carrier_status FROM pedigree_node_annotations WHERE pedigree_id = ?",
    [args.pedigree_id]
  );

  const phenotypes = query<Record<string, unknown>>(
    "SELECT condition_name, omim_id, hpo_terms, inheritance_mode, notes FROM pedigree_phenotypes WHERE pedigree_id = ?",
    [args.pedigree_id]
  );

  const exportDoc: PproExport = {
    format_version: "1.0",
    export_type: "pedigree",
    pedigree: {
      title: ped.title,
      canvas_data,
      canvas_hash: ped.canvas_hash,
      notes: ped.notes,
      node_annotations: nodeAnnotations,
      phenotypes,
      version_history: versions,
    },
    provenance: {
      creator_key: ped.creator_key ?? "",
      creator_signature: ped.creator_signature ?? null,
      exported_at: new Date().toISOString(),
      exported_by_key: args.exporter_key,
      export_signature: null,
    },
  };

  return JSON.stringify(exportDoc, null, 2);
}

export function sanitizeCanvasData(canvas: any): any {
  if (!canvas || typeof canvas !== "object") {
    return { nodes: [], edges: [], annotations: [] };
  }
  const nodes = Array.isArray(canvas.nodes) ? canvas.nodes.map((n: any) => {
    if (!n || typeof n !== "object") return null;
    return {
      id: String(n.id ?? ""),
      type: String(n.type ?? "unknown"),
      affected: Boolean(n.affected ?? false),
      affectedLevel: typeof n.affectedLevel === "number" ? n.affectedLevel : undefined,
      carrier: Boolean(n.carrier ?? false),
      deceased: Boolean(n.deceased ?? false),
      proband: Boolean(n.proband ?? false),
      adopted: n.adopted !== undefined ? Boolean(n.adopted) : undefined,
      label: String(n.label ?? ""),
      age: String(n.age ?? ""),
      dob: n.dob !== undefined ? String(n.dob) : undefined,
      condition: n.condition !== undefined ? String(n.condition) : undefined,
      notes: n.notes !== undefined ? String(n.notes) : undefined,
      insideText: n.insideText !== undefined ? String(n.insideText) : undefined,
      x: Number(n.x ?? 0),
      y: Number(n.y ?? 0),
      pinned: Boolean(n.pinned ?? false),
      color: n.color !== undefined ? String(n.color) : undefined,
      genotype: n.genotype !== undefined ? String(n.genotype) : undefined,
      shading: n.shading !== undefined ? String(n.shading) : undefined,
      genotype2: n.genotype2 !== undefined ? String(n.genotype2) : undefined,
      additionalGenotypes: Array.isArray(n.additionalGenotypes) ? n.additionalGenotypes.map(String) : undefined,
    };
  }).filter(Boolean) : [];

  const edges = Array.isArray(canvas.edges) ? canvas.edges.map((e: any) => {
    if (!e || typeof e !== "object") return null;
    return {
      id: String(e.id ?? ""),
      type: String(e.type ?? "couple"),
      sourceId: String(e.sourceId ?? ""),
      targetId: String(e.targetId ?? ""),
      twinGroup: e.twinGroup !== undefined ? String(e.twinGroup) : undefined,
      twinType: e.twinType !== undefined ? String(e.twinType) : undefined,
      inverted: e.inverted !== undefined ? Boolean(e.inverted) : undefined,
    };
  }).filter(Boolean) : [];

  const annotations = Array.isArray(canvas.annotations) ? canvas.annotations.map((a: any) => {
    if (!a || typeof a !== "object") return null;
    return {
      id: String(a.id ?? ""),
      nodeId: String(a.nodeId ?? ""),
      text: String(a.text ?? ""),
      color: String(a.color ?? ""),
      fontSize: Number(a.fontSize ?? 12),
      position: String(a.position ?? "below"),
      offsetX: typeof a.offsetX === "number" ? a.offsetX : undefined,
      offsetY: typeof a.offsetY === "number" ? a.offsetY : undefined,
      hidden: a.hidden !== undefined ? Boolean(a.hidden) : undefined,
      bold: a.bold !== undefined ? Boolean(a.bold) : undefined,
      italic: a.italic !== undefined ? Boolean(a.italic) : undefined,
      uppercase: a.uppercase !== undefined ? Boolean(a.uppercase) : undefined,
      x: typeof a.x === "number" ? a.x : undefined,
      y: typeof a.y === "number" ? a.y : undefined,
    };
  }).filter(Boolean) : [];

  const settings = canvas.settings && typeof canvas.settings === "object" ? {
    themeId: canvas.settings.themeId !== undefined ? String(canvas.settings.themeId) : undefined,
    config: canvas.settings.config && typeof canvas.settings.config === "object" ? {
      nodeSize: typeof canvas.settings.config.nodeSize === "number" ? canvas.settings.config.nodeSize : undefined,
      nodeStrokeColor: typeof canvas.settings.config.nodeStrokeColor === "string" ? canvas.settings.config.nodeStrokeColor : undefined,
      edgeColor: typeof canvas.settings.config.edgeColor === "string" ? canvas.settings.config.edgeColor : undefined,
      edgeWidthNormal: typeof canvas.settings.config.edgeWidthNormal === "number" ? canvas.settings.config.edgeWidthNormal : undefined,
      annFontSize: typeof canvas.settings.config.annFontSize === "number" ? canvas.settings.config.annFontSize : undefined,
      annFontFamily: typeof canvas.settings.config.annFontFamily === "string" ? canvas.settings.config.annFontFamily : undefined,
      annBold: typeof canvas.settings.config.annBold === "boolean" ? canvas.settings.config.annBold : undefined,
      annUppercase: typeof canvas.settings.config.annUppercase === "boolean" ? canvas.settings.config.annUppercase : undefined,
      annDefaultPos: typeof canvas.settings.config.annDefaultPos === "string" ? canvas.settings.config.annDefaultPos : undefined,
      toolbarHeight: typeof canvas.settings.config.toolbarHeight === "number" ? canvas.settings.config.toolbarHeight : undefined,
    } : undefined,
  } : undefined;

  return { nodes, edges, annotations, settings };
}

export function validatePproExport(raw: unknown): PproExport {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid import data: not an object");
  }
  const data = raw as any;

  if (typeof data.format_version !== "string" || data.format_version !== "1.0") {
    throw new Error(`Unsupported format version: ${data.format_version}`);
  }
  if (data.export_type !== "pedigree") {
    throw new Error(`Invalid export type: ${data.export_type}`);
  }
  if (!data.pedigree || typeof data.pedigree !== "object") {
    throw new Error("Invalid import data: missing pedigree details");
  }

  const ped = data.pedigree as any;

  const canvasData = sanitizeCanvasData(ped.canvas_data);
  if (canvasData.nodes.length > 10000 || canvasData.edges.length > 10000) {
    throw new Error("Import rejected: node or edge count exceeds limit (10,000)");
  }

  const nodeAnnotations = Array.isArray(ped.node_annotations)
    ? ped.node_annotations.map((ann: any) => {
        if (!ann || typeof ann !== "object") return null;
        return {
          node_id: String(ann.node_id ?? ""),
          hpo_terms: ann.hpo_terms !== undefined ? String(ann.hpo_terms) : null,
          omim_ids: ann.omim_ids !== undefined ? String(ann.omim_ids) : null,
          variant_hgvs: ann.variant_hgvs !== undefined ? String(ann.variant_hgvs) : null,
          test_results: ann.test_results !== undefined ? String(ann.test_results) : null,
          clinical_notes: ann.clinical_notes !== undefined ? String(ann.clinical_notes) : null,
          affected_status: String(ann.affected_status ?? "unknown"),
          carrier_status: String(ann.carrier_status ?? "unknown"),
        };
      }).filter(Boolean) as any[]
    : [];

  const phenotypes = Array.isArray(ped.phenotypes)
    ? ped.phenotypes.map((ph: any) => {
        if (!ph || typeof ph !== "object") return null;
        return {
          condition_name: String(ph.condition_name ?? ""),
          omim_id: ph.omim_id !== undefined ? String(ph.omim_id) : null,
          hpo_terms: ph.hpo_terms !== undefined ? String(ph.hpo_terms) : null,
          inheritance_mode: ph.inheritance_mode !== undefined ? String(ph.inheritance_mode) : null,
          notes: ph.notes !== undefined ? String(ph.notes) : null,
        };
      }).filter(Boolean) as any[]
    : [];

  const versionHistory = Array.isArray(ped.version_history)
    ? ped.version_history.map((v: any) => {
        if (!v || typeof v !== "object") return null;
        let sanitizedVerCanvas = "";
        try {
          if (v.canvas_data) {
            const parsedVer = JSON.parse(v.canvas_data);
            const sanitized = sanitizeCanvasData(parsedVer);
            if (sanitized.nodes.length > 10000) {
              throw new Error("Import rejected: version node count exceeds limit");
            }
            sanitizedVerCanvas = JSON.stringify(sanitized);
          }
        } catch (e) {
          throw new Error(`Invalid version history canvas data: ${e instanceof Error ? e.message : String(e)}`);
        }

        return {
          version_number: Number(v.version_number ?? 1),
          label: v.label !== undefined ? String(v.label) : null,
          canvas_data: sanitizedVerCanvas,
          canvas_hash: v.canvas_hash !== undefined ? String(v.canvas_hash) : null,
          saver_key: v.saver_key !== undefined ? String(v.saver_key) : null,
          saver_signature: v.saver_signature !== undefined ? String(v.saver_signature) : null,
          created_at: String(v.created_at ?? new Date().toISOString()),
        };
      }).filter(Boolean) as any[]
    : [];

  if (versionHistory.length > 100) {
    throw new Error("Import rejected: version history count exceeds limit (100)");
  }

  const prov = data.provenance || {};
  const provenance = {
    creator_key: String(prov.creator_key ?? ""),
    creator_signature: prov.creator_signature !== undefined ? String(prov.creator_signature) : null,
    exported_at: String(prov.exported_at ?? new Date().toISOString()),
    exported_by_key: String(prov.exported_by_key ?? ""),
    export_signature: prov.export_signature !== undefined ? String(prov.export_signature) : null,
  };

  return {
    format_version: String(data.format_version),
    export_type: String(data.export_type),
    pedigree: {
      title: String(ped.title ?? ""),
      canvas_data: canvasData,
      canvas_hash: ped.canvas_hash !== undefined ? String(ped.canvas_hash) : null,
      notes: ped.notes !== undefined ? String(ped.notes) : null,
      node_annotations: nodeAnnotations,
      phenotypes,
      version_history: versionHistory,
    },
    provenance,
  };
}

export function import_pedigree_native(args: {
  path: string;
  importer_key: string;
}): Pedigree {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(args.path);
  } catch {
    throw new Error("Invalid .ppro import data: not valid JSON");
  }

  const data = validatePproExport(parsedJson);
  const ped = data.pedigree!;
  const canvasStr = ped.canvas_data ? JSON.stringify(ped.canvas_data) : null;

  if (canvasStr) {
    const hash = computeHash(canvasStr);
    const existing = queryOne<{ id: number }>(
      "SELECT id FROM pedigrees WHERE canvas_hash = ? LIMIT 1",
      [hash]
    );
    if (existing) {
      return get_pedigree({ id: existing.id });
    }
  }

  const created = create_pedigree({
    title: ped.title,
    patient_id: null,
    canvas_data: canvasStr,
    notes: ped.notes ?? null,
    creator_key: args.importer_key ?? data.provenance?.creator_key ?? "imported",
    creator_signature: data.provenance?.creator_signature ?? null,
  });

  if (ped.node_annotations && ped.node_annotations.length > 0) {
    for (const ann of ped.node_annotations) {
      exec(
        "INSERT INTO pedigree_node_annotations (pedigree_id, node_id, hpo_terms, omim_ids, variant_hgvs, test_results, clinical_notes, affected_status, carrier_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
        [
          created.id,
          ann.node_id ?? "",
          ann.hpo_terms ?? null,
          ann.omim_ids ?? null,
          ann.variant_hgvs ?? null,
          ann.test_results ?? null,
          ann.clinical_notes ?? null,
          ann.affected_status ?? "unknown",
          ann.carrier_status ?? "unknown",
        ]
      );
    }
  }

  if (ped.phenotypes && ped.phenotypes.length > 0) {
    for (const ph of ped.phenotypes) {
      exec(
        "INSERT INTO pedigree_phenotypes (pedigree_id, condition_name, omim_id, hpo_terms, inheritance_mode, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))",
        [
          created.id,
          ph.condition_name ?? "",
          ph.omim_id ?? null,
          ph.hpo_terms ?? null,
          ph.inheritance_mode ?? null,
          ph.notes ?? null,
        ]
      );
    }
  }

  if (ped.version_history && ped.version_history.length > 0) {
    for (const v of ped.version_history) {
      exec(
        "INSERT INTO pedigree_versions (pedigree_id, version_number, label, canvas_data, canvas_hash, saver_key, saver_signature, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          created.id,
          v.version_number,
          v.label ?? null,
          v.canvas_data,
          v.canvas_hash ?? null,
          v.saver_key ?? null,
          v.saver_signature ?? null,
          v.created_at ?? new Date().toISOString(),
        ]
      );
    }
  }

  return created;
}

export function import_pedigree_legacy(args: { path: string }): LegacyImportSummary {
  throw new Error("Legacy database import is only available in desktop mode");
}

export async function backup_database(): Promise<string> {
  const { exportDb } = await import("../db");
  const data = await exportDb();
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < data.length; i += chunkSize) {
    binary += String.fromCharCode(...data.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export async function restore_database(args: { backup_data: string }): Promise<void> {
  const raw = atob(args.backup_data);
  if (raw.length < 16 || !raw.startsWith("SQLite format 3\0")) {
    throw new Error("Invalid backup file: not a valid SQLite database");
  }
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  const { importDb } = await import("../db");
  await importDb(bytes);
}

export async function rotate_key(): Promise<void> {
  throw new Error("Key rotation is not yet fully implemented in browser mode. Use desktop mode for this feature.");
}

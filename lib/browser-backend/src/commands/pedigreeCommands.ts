import { exec, query, queryOne, lastInsertRowId } from "../db";
import { computeHash } from "@workspace/crypto";
import { withTransaction, type PedigreeSummary, type Pedigree, type CreatePedigreeInput } from "./types";

export function list_pedigrees(args?: {
  patient_id?: number;
  search?: string;
}): PedigreeSummary[] {
  let sql = `
    SELECT p.id, p.title, p.patient_id,
           CASE
             WHEN p.canvas_data IS NULL THEN 0
             ELSE COALESCE(json_array_length(json_extract(p.canvas_data, '$.nodes')), 0)
           END as node_count,
           (SELECT COUNT(*) FROM pedigree_versions pv WHERE pv.pedigree_id = p.id) as version_count,
           p.creator_key, p.created_at, p.updated_at
    FROM pedigrees p
    WHERE 1=1
  `;
  const params: unknown[] = [];
  if (args?.patient_id !== undefined) {
    sql += " AND p.patient_id = ?";
    params.push(args.patient_id);
  }
  if (args?.search) {
    sql += " AND p.title LIKE ?";
    params.push(`%${args.search}%`);
  }
  sql += " ORDER BY p.updated_at DESC";

  return query<PedigreeSummary>(sql, params);
}

export function get_pedigree(args: { id: number }): Pedigree {
  const pedigree = queryOne<Pedigree>(
    "SELECT id, title, patient_id, canvas_data, canvas_hash, notes, creator_key, creator_signature, created_at, updated_at FROM pedigrees WHERE id = ?",
    [args.id]
  );
  if (!pedigree) throw new Error("Pedigree not found");
  return pedigree;
}

export function create_pedigree(
  args: CreatePedigreeInput | { input: CreatePedigreeInput }
): Pedigree {
  const input = "input" in args ? args.input : args;
  return withTransaction(() => {
    const canvas_hash = input.canvas_data
      ? computeHash(input.canvas_data)
      : null;
    exec(
      "INSERT INTO pedigrees (title, patient_id, canvas_data, canvas_hash, notes, creator_key, creator_signature, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
      [
        input.title,
        input.patient_id ?? null,
        input.canvas_data ?? null,
        canvas_hash,
        input.notes ?? null,
        input.creator_key,
        input.creator_signature ?? null,
      ]
    );

    const id = lastInsertRowId();

    exec(
      "INSERT INTO activity_log (action, subject, actor_key, timestamp) VALUES ('created', ?, ?, datetime('now'))",
      [`pedigree_${id}`, input.creator_key]
    );

    return get_pedigree({ id });
  });
}

export function update_pedigree(args: {
  id: number;
  input: Partial<CreatePedigreeInput>;
}): Pedigree {
  return withTransaction(() => {
    const existing = get_pedigree({ id: args.id });
    const cleanInput = Object.fromEntries(
      Object.entries(args.input).filter(([_, v]) => v !== undefined)
    );
    const merged = { ...existing, ...cleanInput };
    const canvas_hash = merged.canvas_data ? computeHash(merged.canvas_data) : null;
    exec(
      "UPDATE pedigrees SET title = ?, patient_id = ?, canvas_data = ?, canvas_hash = ?, notes = ?, updated_at = datetime('now') WHERE id = ?",
      [
        merged.title,
        merged.patient_id ?? null,
        merged.canvas_data ?? null,
        canvas_hash,
        merged.notes ?? null,
        args.id,
      ]
    );

    exec(
      "INSERT INTO activity_log (action, subject, actor_key, timestamp) VALUES ('updated', ?, ?, datetime('now'))",
      [`pedigree_${args.id}`, merged.creator_key ?? ""]
    );

    return get_pedigree({ id: args.id });
  });
}

export function delete_pedigree(args: { id: number }): void {
  withTransaction(() => {
    const pedigree = queryOne<{ id: number }>(
      "SELECT id FROM pedigrees WHERE id = ?",
      [args.id]
    );
    if (!pedigree) throw new Error("Pedigree not found");

    exec("DELETE FROM pedigree_versions WHERE pedigree_id = ?", [args.id]);
    exec("DELETE FROM pedigree_node_annotations WHERE pedigree_id = ?", [args.id]);
    exec("DELETE FROM pedigree_phenotypes WHERE pedigree_id = ?", [args.id]);

    exec("DELETE FROM pedigrees WHERE id = ?", [args.id]);

    exec(
      "INSERT INTO activity_log (action, subject, timestamp) VALUES ('deleted', ?, datetime('now'))",
      [`pedigree_${args.id}`]
    );
  });
}

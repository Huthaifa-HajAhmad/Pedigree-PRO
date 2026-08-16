import { exec, query, queryOne, lastInsertRowId } from "../db";
import { computeHash } from "@workspace/crypto";
import { get_pedigree } from "./pedigreeCommands";
import type { PedigreeVersion, SaveVersionInput, Pedigree } from "./types";

export function list_versions(args: { pedigree_id: number }): PedigreeVersion[] {
  return query<PedigreeVersion>(
    "SELECT id, pedigree_id, version_number, label, canvas_data, canvas_hash, thumbnail, saver_key, saver_signature, created_at FROM pedigree_versions WHERE pedigree_id = ? ORDER BY version_number DESC",
    [args.pedigree_id]
  );
}

export function save_version(args: {
  pedigree_id: number;
  input: SaveVersionInput;
}): PedigreeVersion {
  const lastVersion = queryOne<{ max_version: number }>(
    "SELECT MAX(version_number) as max_version FROM pedigree_versions WHERE pedigree_id = ?",
    [args.pedigree_id]
  );
  const nextVersion = (lastVersion?.max_version ?? 0) + 1;
  const canvas_hash = computeHash(args.input.canvas_data);

  exec(
    "INSERT INTO pedigree_versions (pedigree_id, version_number, label, canvas_data, canvas_hash, thumbnail, saver_key, saver_signature, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))",
    [
      args.pedigree_id,
      nextVersion,
      args.input.label ?? null,
      args.input.canvas_data,
      canvas_hash,
      args.input.thumbnail ?? null,
      args.input.saver_key,
      args.input.saver_signature ?? null,
    ]
  );

  const id = lastInsertRowId();
  const version = queryOne<PedigreeVersion>(
    "SELECT id, pedigree_id, version_number, label, canvas_data, canvas_hash, thumbnail, saver_key, saver_signature, created_at FROM pedigree_versions WHERE id = ?",
    [id]
  );
  if (!version) throw new Error("Failed to retrieve saved version");
  return version;
}

export function restore_version(args: {
  pedigree_id: number;
  version_id: number;
}): Pedigree {
  const version = queryOne<{ canvas_data: string }>(
    "SELECT canvas_data FROM pedigree_versions WHERE id = ? AND pedigree_id = ?",
    [args.version_id, args.pedigree_id]
  );
  if (!version) throw new Error("Version not found");

  const canvas_hash = computeHash(version.canvas_data);
  exec(
    "UPDATE pedigrees SET canvas_data = ?, canvas_hash = ?, updated_at = datetime('now') WHERE id = ?",
    [version.canvas_data, canvas_hash, args.pedigree_id]
  );

  return get_pedigree({ id: args.pedigree_id });
}

export function delete_version(args: {
  pedigree_id: number;
  version_id: number;
}): { deleted: boolean } {
  exec(
    "DELETE FROM pedigree_versions WHERE id = ? AND pedigree_id = ?",
    [args.version_id, args.pedigree_id]
  );
  return { deleted: true };
}

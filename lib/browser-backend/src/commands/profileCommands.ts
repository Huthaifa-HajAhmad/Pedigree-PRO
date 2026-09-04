import { exec, query, queryOne } from "../db";
import type { LocalProfile, CreateProfileInput, UpdateProfileInput } from "./types";

export function list_profiles(): LocalProfile[] {
  return query<LocalProfile>(
    "SELECT id, display_name, role_label, public_key, created_at, last_used_at FROM local_profiles ORDER BY last_used_at DESC"
  );
}

export function create_profile(
  args: CreateProfileInput | { input: CreateProfileInput }
): LocalProfile {
  const input = "input" in args ? args.input : args;
  const id = crypto.randomUUID();
  const publicKey = input.public_key && input.public_key.trim().length > 0 ? input.public_key : crypto.randomUUID();
  exec(
    "INSERT INTO local_profiles (id, display_name, role_label, public_key, created_at, last_used_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
    [id, input.display_name, input.role_label, publicKey]
  );

  exec(
    "INSERT INTO activity_log (action, subject, actor_key, timestamp) VALUES ('profile_created', ?, ?, datetime('now'))",
    [`profile_${id}`, publicKey]
  );

  return {
    id,
    display_name: input.display_name,
    role_label: input.role_label,
    public_key: publicKey,
    created_at: new Date().toISOString(),
    last_used_at: new Date().toISOString(),
  };
}

export function switch_profile(args: { profile_id: string }): LocalProfile {
  const profile = queryOne<LocalProfile>(
    "SELECT id, display_name, role_label, public_key, created_at, last_used_at FROM local_profiles WHERE id = ?",
    [args.profile_id]
  );
  if (!profile) throw new Error("Profile not found");

  exec(
    "UPDATE local_profiles SET last_used_at = datetime('now') WHERE id = ?",
    [args.profile_id]
  );

  exec(
    "INSERT INTO activity_log (action, subject, timestamp) VALUES ('profile_switched', ?, datetime('now'))",
    [args.profile_id]
  );

  return profile;
}

export function delete_profile(args: { profile_id: string }): void {
  const profile = queryOne<{ display_name: string }>(
    "SELECT display_name FROM local_profiles WHERE id = ?",
    [args.profile_id]
  );
  if (!profile) throw new Error("Profile not found");

  exec("DELETE FROM local_profiles WHERE id = ?", [args.profile_id]);

  exec(
    "INSERT INTO activity_log (action, subject, timestamp) VALUES ('profile_deleted', ?, datetime('now'))",
    [`profile_${args.profile_id}`]
  );
}

export function update_profile(args: UpdateProfileInput): LocalProfile {
  const profile = queryOne<LocalProfile>(
    "SELECT id, display_name, role_label, public_key, created_at, last_used_at FROM local_profiles WHERE id = ?",
    [args.id]
  );
  if (!profile) throw new Error("Profile not found");

  exec(
    "UPDATE local_profiles SET display_name = ?, role_label = ?, last_used_at = datetime('now') WHERE id = ?",
    [args.display_name, args.role_label, args.id]
  );

  exec(
    "INSERT INTO activity_log (action, subject, timestamp) VALUES ('profile_updated', ?, datetime('now'))",
    [args.id]
  );

  return {
    ...profile,
    display_name: args.display_name,
    role_label: args.role_label,
    last_used_at: new Date().toISOString(),
  };
}

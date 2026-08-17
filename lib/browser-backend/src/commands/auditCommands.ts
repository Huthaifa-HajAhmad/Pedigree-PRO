import { exec, query, queryOne, getCachedDeviceId } from "../db";
import type { DashboardStats, ActivityItem, Preferences } from "./types";

export function get_dashboard_stats(): DashboardStats {
  const total_patients =
    queryOne<{ count: number }>("SELECT COUNT(*) as count FROM patients")?.count ??
    0;
  const total_pedigrees =
    queryOne<{ count: number }>("SELECT COUNT(*) as count FROM pedigrees")?.count ??
    0;
  const total_profiles =
    queryOne<{ count: number }>("SELECT COUNT(*) as count FROM local_profiles")
      ?.count ?? 0;
  const pedigrees_this_week =
    queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM pedigrees WHERE created_at >= datetime('now', '-7 days')"
    )?.count ?? 0;
  const pedigrees_this_month =
    queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM pedigrees WHERE created_at >= datetime('now', '-30 days')"
    )?.count ?? 0;

  return {
    total_patients,
    total_pedigrees,
    total_profiles,
    pedigrees_this_week,
    pedigrees_this_month,
  };
}

export function get_recent_activity(args?: { limit?: number }): ActivityItem[] {
  const limit = Math.max(1, Math.min(args?.limit ?? 20, 100));
  return query<ActivityItem>(
    "SELECT id, action, subject, actor_key, timestamp FROM activity_log ORDER BY timestamp DESC LIMIT ?",
    [limit]
  );
}

export async function clear_activity_log(): Promise<void> {
  exec("DELETE FROM activity_log");
  const { saveDb } = await import("../db");
  await saveDb();
}

export function get_preferences(): Preferences {
  const device_id = getCachedDeviceId();
  const pref = queryOne<Preferences>(
    "SELECT device_id, theme, updated_at FROM app_preferences WHERE device_id = ?",
    [device_id]
  );
  if (pref) return pref;

  exec(
    "INSERT OR IGNORE INTO app_preferences (device_id, theme, updated_at) VALUES (?, 'clinical', datetime('now'))",
    [device_id]
  );
  return {
    device_id,
    theme: "clinical",
    updated_at: new Date().toISOString(),
  };
}

export function save_preferences(args: { theme: string }): Preferences {
  const device_id = getCachedDeviceId();
  exec(
    "INSERT INTO app_preferences (device_id, theme, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(device_id) DO UPDATE SET theme = ?, updated_at = datetime('now')",
    [device_id, args.theme, args.theme]
  );
  return get_preferences();
}

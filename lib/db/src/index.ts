// Conditional database loader: Postgres (default) or SQLite (when DATABASE_URL starts with sqlite:)
//
// Table exports are typed as `any` because the Drizzle ORM generates incompatible
// types (PgTableWithColumns vs SQLiteTableWithColumns) that cannot be unified.
// The `db` instance is typed as the SQLite variant since browser mode is the
// primary deployment target. Desktop mode uses the Tauri Rust backend instead.
//
// SAFETY: Only one code path executes at runtime (SQLite or Postgres), and the
// schema shapes are intentionally identical between both backends.

import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

export let db: BetterSQLite3Database<Record<string, never>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let pool: any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let patientsTable: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let pedigreesTable: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let pedigreeVersionsTable: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let activityLogTable: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let appPreferencesTable: any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let localProfilesTable: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let pedigreeNodeAnnotationsTable: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let pedigreePhenotypesTable: any;

// Initialize synchronously using top-level await so module evaluation waits for DB setup
if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith("sqlite:")) {
  // SQLite mode
  const sqliteAdapter = await import("./sqlite-adapter");
  db = sqliteAdapter.db;

  const sqliteSchema = await import("./schema_sqlite_index");
  patientsTable = sqliteSchema.patientsTable;
  pedigreesTable = sqliteSchema.pedigreesTable;
  pedigreeVersionsTable = sqliteSchema.pedigreeVersionsTable;
  activityLogTable = sqliteSchema.activityLogTable;
  appPreferencesTable = sqliteSchema.appPreferencesTable;
  localProfilesTable = sqliteSchema.localProfilesTable;
  pedigreeNodeAnnotationsTable = sqliteSchema.pedigreeNodeAnnotationsTable;
  pedigreePhenotypesTable = sqliteSchema.pedigreePhenotypesTable;
} else {
  // Postgres mode
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }

  const pg = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const schema = await import("./schema/index");

  const { Pool } = pg;
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle(pool, { schema }) as unknown as BetterSQLite3Database<Record<string, never>>;

  patientsTable = schema.patientsTable;
  pedigreesTable = schema.pedigreesTable;
  pedigreeVersionsTable = schema.pedigreeVersionsTable;
  activityLogTable = schema.activityLogTable;
  appPreferencesTable = schema.appPreferencesTable;
  localProfilesTable = schema.localProfilesTable;
  pedigreeNodeAnnotationsTable = schema.pedigreeNodeAnnotationsTable;
  pedigreePhenotypesTable = schema.pedigreePhenotypesTable;
}
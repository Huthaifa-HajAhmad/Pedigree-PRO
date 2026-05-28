// SQLite database loader for Pedigree PRO.
//
// The Postgres code path has been removed — the project is local-first
// and uses SQLite exclusively (via sql.js in browser mode or
// SQLCipher in Tauri desktop mode).
//
// Table exports are typed generically to avoid coupling consumers
// to the Drizzle SQLite column types.

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let shareLinksTable: any;

// Initialize using top-level await so module evaluation waits for DB setup
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
shareLinksTable = sqliteSchema.shareLinksTable;
/* eslint-disable @typescript-eslint/no-var-requires */
// Conditional database loader: Postgres (default) or SQLite (when DATABASE_URL starts with sqlite:)

export let db: any;
export let pool: any;

// DEPRECATED tables (Phase 0-D removal)
export let usersTable: any;

// Core tables
export let patientsTable: any;
export let pedigreesTable: any;
export let pedigreeVersionsTable: any;
export let activityLogTable: any;
export let appPreferencesTable: any;

// New tables (Phase 0-B)
export let localProfilesTable: any;
export let pedigreeNodeAnnotationsTable: any;
export let pedigreePhenotypesTable: any;

// Initialize synchronously using top-level await so module evaluation waits for DB setup
if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith("sqlite:")) {
  // SQLite mode
  const sqliteAdapter = await import("./sqlite-adapter");
  db = sqliteAdapter.db;

  const sqliteSchema = await import("./schema_sqlite_index");
  usersTable = sqliteSchema.usersTable;
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
  db = drizzle(pool, { schema });

  usersTable = schema.usersTable;
  patientsTable = schema.patientsTable;
  pedigreesTable = schema.pedigreesTable;
  pedigreeVersionsTable = schema.pedigreeVersionsTable;
  activityLogTable = schema.activityLogTable;
  appPreferencesTable = schema.appPreferencesTable;
  localProfilesTable = schema.localProfilesTable;
  pedigreeNodeAnnotationsTable = schema.pedigreeNodeAnnotationsTable;
  pedigreePhenotypesTable = schema.pedigreePhenotypesTable;
}


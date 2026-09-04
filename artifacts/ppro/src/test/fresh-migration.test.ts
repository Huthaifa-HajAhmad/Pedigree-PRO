import { describe, it, expect } from "vitest";
import initSqlJs from "sql.js";
import { MIGRATIONS } from "../../../../lib/browser-backend/src/db";

describe("Browser Database Migrations (Fresh Install)", () => {
  it("executes migrations 001 through 006 sequentially without duplicate column errors", async () => {
    const SQL = await initSqlJs();
    const db = new SQL.Database();

    // Setup _migrations table
    db.run(`
      CREATE TABLE IF NOT EXISTS _migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Execute real migrations imported from db.ts
    for (const [version, name, sql] of MIGRATIONS) {
      expect(() => {
        db.run(sql);
        db.run("INSERT INTO _migrations (version, name) VALUES (?, ?)", [version, name]);
      }).not.toThrow();
    }

    // Verify all 6 migrations are marked as applied
    const appliedRes = db.exec("SELECT version, name FROM _migrations ORDER BY version ASC");
    expect(appliedRes[0]?.values).toHaveLength(6);

    // Verify columns exist on pedigree_versions
    const tableInfoRes = db.exec("PRAGMA table_info(pedigree_versions)");
    const columnNames = tableInfoRes[0]?.values.map((row) => row[1]);

    expect(columnNames).toContain("nodes_count");
    expect(columnNames).toContain("couple_count");
    expect(columnNames).toContain("canvas_data");
    expect(columnNames).toContain("version_number");

    db.close();
  });
});

// Create a SQLite-backed Drizzle DB for Node.js/desktop environments.
// Requires better-sqlite3 (native driver, used by Tauri backend).
// For browser mode, sql.js is used via @workspace/browser-backend instead.

import type BetterSqlite3 from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

declare function require(id: string): unknown;

let Database: typeof BetterSqlite3;
let driverName = 'none';

function isCommonJS(): boolean {
  return typeof require === 'function';
}

// Try native driver first (better-sqlite3)
try {
  const mod = isCommonJS()
    ? require('better-sqlite3')
    : await import('better-sqlite3');
  Database = (mod as { default?: typeof BetterSqlite3 }).default ?? (mod as typeof BetterSqlite3);
  driverName = 'better-sqlite3';
} catch (_e1) {
  throw new Error(
    "No SQLite driver available. Install 'better-sqlite3' (native, recommended for Tauri) or '@sqlite.org/sqlcipher-wasm' (WASM).\n" +
    "Run: pnpm --filter @workspace/db add better-sqlite3\n" +
    "Or: pnpm --filter @workspace/db add @sqlite.org/sqlcipher-wasm"
  );
}

// Load drizzle-orm at runtime
let drizzleFn: (sqlite: BetterSqlite3) => BetterSQLite3Database<Record<string, never>>;
try {
  const mod = isCommonJS()
    ? require('drizzle-orm/better-sqlite3')
    : await import('drizzle-orm/better-sqlite3');
  drizzleFn = (mod as { drizzle?: typeof drizzleFn }).drizzle ?? (mod as typeof drizzleFn);
} catch (err) {
  throw new Error("Unable to load 'drizzle-orm/better-sqlite3'. Ensure it's installed in the workspace (pnpm install).\nOriginal error: " + String(err));
}

const filename = (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('sqlite:'))
  ? process.env.DATABASE_URL.replace(/^sqlite:/, '')
  : (process.env.SQLITE_FILE || './data/db.sqlite');

// Instantiate database. Both @vercel/sqlite.Database and better-sqlite3 accept a filename in their constructors.
const sqlite = new Database(filename);

// Log driver selection for easier debugging
if (typeof console !== 'undefined') {
  console.info(`[db] using sqlite driver: ${driverName}`);
}

// Create a Drizzle DB instance backed by the selected SQLite driver
export const db = drizzleFn(sqlite);
export default db;

// Create a SQLite-backed Drizzle DB.
// Preference order: better-sqlite3 (native, primary) -> @sqlite.org/sqlcipher-wasm (WASM)

let Database: any;
let driverName = 'none';

function isCommonJS(): boolean {
  return typeof (globalThis as any).require === 'function';
}

// Try native driver first (better-sqlite3)
try {
  const mod = isCommonJS()
    ? (globalThis as any).require('better-sqlite3')
    : await import('better-sqlite3');
  Database = mod.default ?? mod;
  driverName = 'better-sqlite3';
} catch (_e1) {
  throw new Error(
    "No SQLite driver available. Install 'better-sqlite3' (native, recommended for Tauri) or '@sqlite.org/sqlcipher-wasm' (WASM).\n" +
    "Run: pnpm --filter @workspace/db add better-sqlite3\n" +
    "Or: pnpm --filter @workspace/db add @sqlite.org/sqlcipher-wasm"
  );
}

// Load drizzle-orm at runtime
let drizzleFn: any;
try {
  const mod = isCommonJS()
    ? (globalThis as any).require('drizzle-orm/better-sqlite3')
    : await import('drizzle-orm/better-sqlite3');
  drizzleFn = mod.drizzle ?? mod;
} catch (err) {
  throw new Error("Unable to load 'drizzle-orm/better-sqlite3'. Ensure it's installed in the workspace (pnpm install).\nOriginal error: " + String(err));
}

const filename = (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('sqlite:'))
  ? process.env.DATABASE_URL.replace('sqlite:', '')
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

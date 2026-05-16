// Create a SQLite-backed Drizzle DB for Node.js/desktop environments.
// Requires better-sqlite3 (native driver, used by Tauri backend).
// For browser mode, sql.js is used via @workspace/browser-backend instead.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Database: any;
let driverName = 'none';

// Load better-sqlite3 (ESM dynamic import only)
try {
  const mod = await import('better-sqlite3');
  Database = (mod as { default?: unknown }).default ?? mod;
  driverName = 'better-sqlite3';
} catch (_e1) {
  throw new Error(
    "No SQLite driver available. Install 'better-sqlite3' (native, recommended for Tauri).\n" +
    "Run: pnpm --filter @workspace/db add better-sqlite3"
  );
}

// Load drizzle-orm at runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let drizzleFn: (sqlite: any) => any;
try {
  const mod = await import('drizzle-orm/better-sqlite3');
  drizzleFn = ((mod as unknown as Record<string, unknown>).drizzle ?? mod) as typeof drizzleFn;
} catch (err) {
  throw new Error("Unable to load 'drizzle-orm/better-sqlite3'. Ensure it's installed in the workspace (pnpm install).\nOriginal error: " + String(err));
}

const filename = (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('sqlite:'))
  ? process.env.DATABASE_URL.replace(/^sqlite:/, '')
  : (process.env.SQLITE_FILE || './data/db.sqlite');

// Instantiate database
const sqlite = new Database(filename);

// Log driver selection for easier debugging
if (typeof console !== 'undefined') {
  console.info(`[db] using sqlite driver: ${driverName}`);
}

// Create a Drizzle DB instance backed by the selected SQLite driver
export const db = drizzleFn(sqlite);
export default db;
import { defineConfig } from "drizzle-kit";
import path from "path";
import { fileURLToPath } from "url";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

const isSqlite = process.env.DATABASE_URL?.startsWith("sqlite:");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  schema: isSqlite
    ? path.join(__dirname, "./src/schema_sqlite_index.ts")
    : path.join(__dirname, "./src/schema/index.ts"),
  dialect: isSqlite ? "sqlite" : "postgresql",
  dbCredentials: isSqlite
    ? { url: process.env.DATABASE_URL! }
    : { url: process.env.DATABASE_URL! },
});

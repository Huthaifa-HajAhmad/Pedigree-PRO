import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

const isSqlite = process.env.DATABASE_URL?.startsWith("sqlite:");

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: isSqlite ? "sqlite" : "postgresql",
  dbCredentials: isSqlite
    ? { url: process.env.DATABASE_URL! }
    : { url: process.env.DATABASE_URL! },
});

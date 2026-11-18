import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { strict as assert } from "node:assert";
import { test } from "node:test";

test("unchanged native inputs reuse the prepared archive", () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const script = fileURLToPath(new URL("build-native-database.mjs", import.meta.url));
  const archive = fileURLToPath(
    new URL(
      `../artifacts/ppro/src-tauri/database/native/${process.platform === "win32" ? "sqlite3.lib" : "libsqlite3.a"}`,
      import.meta.url,
    ),
  );
  execFileSync(process.execPath, [script, "--force"], { cwd: root, stdio: "pipe" });
  const before = statSync(archive, { bigint: true }).mtimeNs;
  execFileSync(process.execPath, [script], { cwd: root, stdio: "pipe" });
  assert.equal(statSync(archive, { bigint: true }).mtimeNs, before);
});

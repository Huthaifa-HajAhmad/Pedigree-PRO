import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = join(root, "artifacts/ppro/src-tauri/Cargo.toml");
const output = join(dirname(manifest), "database/native");

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const rustc = spawnSync("rustc", ["-vV"], { encoding: "utf8" });
if (rustc.error) throw rustc.error;
if (rustc.status !== 0) throw new Error(rustc.stderr);
const host = rustc.stdout.match(/^host: (.+)$/m)?.[1].trim();
if (!host) throw new Error("Could not determine the Rust host target");
mkdirSync(output, { recursive: true });

const targets = process.platform === "darwin" ? ["aarch64-apple-darwin", "x86_64-apple-darwin"] : [host];
const archive = process.platform === "win32" ? "sqlite3.lib" : "libsqlite3.a";
const archives = [
  join(output, archive),
  ...(targets.length > 1 ? targets.map((target) => join(output, target, archive)) : []),
];
const inputs = [
  fileURLToPath(import.meta.url),
  manifest,
  join(dirname(manifest), "Cargo.lock"),
  ...["Cargo.toml", "src/main.rs"].map((name) => join(dirname(manifest), "database/native-builder", name)),
  ...["sqlite3mc_amalgamation.c", "sqlite3mc_amalgamation.h", "sqlite3.h", "sqlite3ext.h"].map((name) =>
    join(dirname(manifest), "database/vendor/sqlite3mc", name),
  ),
];
const environment = Object.entries(process.env)
  .filter(([name]) => /^(CC|CFLAGS|AR|SDKROOT|MACOSX_DEPLOYMENT_TARGET|PATH)(_|$)/.test(name))
  .sort(([left], [right]) => left.localeCompare(right));
const sourceHash = createHash("sha256").update(rustc.stdout).update(JSON.stringify({ targets, environment }));
for (const input of inputs) sourceHash.update(readFileSync(input));
const fingerprint = sourceHash.digest("hex");
const stampPath = join(output, "build.sha256");
function buildStamp() {
  const hash = createHash("sha256").update(fingerprint);
  for (const library of archives) hash.update(readFileSync(library));
  return hash.digest("hex");
}
if (
  !process.argv.includes("--force") &&
  existsSync(stampPath) &&
  archives.every(existsSync) &&
  readFileSync(stampPath, "utf8") === buildStamp()
) {
  console.log("SQLite3 Multiple Ciphers native library is up to date");
  process.exit(0);
}
for (const target of targets) {
  const destination = targets.length > 1 ? join(output, target) : output;
  run("cargo", [
    "run",
    "--quiet",
    "--locked",
    "--manifest-path",
    manifest,
    "-p",
    "ppro-database-builder",
    "--",
    host,
    target,
    destination,
  ]);
}
if (targets.length > 1) {
  run("lipo", [
    "-create",
    ...targets.map((target) => join(output, target, "libsqlite3.a")),
    "-output",
    join(output, "libsqlite3.a"),
  ]);
  run("lipo", [join(output, "libsqlite3.a"), "-verify_arch", "arm64", "x86_64"]);
}
// Rust copies static libraries into its dependency archives. Rebuild that copy
// after preparing the C library, including both macOS architectures.
const clean = ["clean", "--manifest-path", manifest, "-p", "libsqlite3-sys"];
run("cargo", clean);
for (const target of targets) run("cargo", [...clean, "--target", target]);
writeFileSync(stampPath, buildStamp());
console.log(`Prepared SQLite3 Multiple Ciphers 2.7.1 for ${targets.join(", ")}`);

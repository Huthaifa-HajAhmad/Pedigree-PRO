#!/usr/bin/env node

/**
 * CI Guard Script: Enforces rename_all = "snake_case" on every Tauri command
 * 
 * Pedigree PRO uses snake_case IPC conventions across both Browser and Tauri modes.
 * Omitting rename_all = "snake_case" defaults Tauri to camelCase and silently
 * breaks desktop IPC.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcTauriDir = path.resolve(__dirname, "../artifacts/ppro/src-tauri/src");

if (!fs.existsSync(srcTauriDir)) {
  console.error(`❌ src-tauri directory not found at: ${srcTauriDir}`);
  process.exit(1);
}

const files = fs.readdirSync(srcTauriDir).filter((f) => f.endsWith(".rs"));

if (files.length === 0) {
  console.error(`❌ No Rust source files found in: ${srcTauriDir}`);
  process.exit(1);
}

let commandCount = 0;
const violations = [];

for (const file of files) {
  const filePath = path.join(srcTauriDir, file);
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("#[tauri::command")) {
      commandCount++;
      if (!line.includes('rename_all = "snake_case"')) {
        violations.push({
          file,
          line: i + 1,
          content: line,
        });
      }
    }
  }
}

console.log(`🔍 Scanned ${files.length} Rust files, verified ${commandCount} Tauri commands.`);

if (violations.length > 0) {
  console.error(`\n❌ Found ${violations.length} Tauri command(s) missing rename_all = "snake_case":\n`);
  for (const v of violations) {
    console.error(`  - ${v.file}:${v.line} -> ${v.content}`);
  }
  console.error('\nFix: Add (rename_all = "snake_case") to all #[tauri::command] attributes.\n');
  process.exit(1);
}

console.log(`✅ All ${commandCount} Tauri commands strictly conform to rename_all = "snake_case".`);
process.exit(0);

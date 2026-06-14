# Pedigree PRO — Agent Guide

## Architecture

Pedigree PRO is a zero-server clinical pedigree editor. It runs in two modes:

1. **Tauri desktop** (`tauri`): Rust backend + SQLCipher SQLite (local filesystem)
2. **Browser standalone** (`browser`): sql.js WASM SQLite + IndexedDB persistence + Web Crypto API

The frontend uses a unified adapter (`lib/api-client-react/src/adapter.ts`) that detects the runtime mode and routes all data operations to the appropriate backend. No REST API, no Postgres, no internet required.

### Key Packages

| Package | Role |
|---|---|
| `artifacts/ppro` | React + Vite frontend (pedigree canvas, dashboard, patients, profiles) |
| `lib/api-client-react` | Unified adapter + React Query hooks + direct API functions |
| `lib/browser-backend` | sql.js WASM SQLite, IndexedDB persistence, Web Crypto key management, TypeScript port of Rust commands |
| `lib/crypto` | Shared Ed25519, SHA-256, AES-GCM, libsodium sealed-box primitives |
| `lib/db` | Drizzle schemas + migrations (Postgres OR SQLite depending on `DATABASE_URL`) |

### Mode Detection

`detectApiMode()` checks `window.__TAURI__`. If present, it uses Tauri IPC (`invoke`). Otherwise, it lazy-loads `@workspace/browser-backend` and routes to sql.js commands.

## Build Instructions

### Prerequisites
- Node.js + pnpm
- Rust toolchain (for Tauri desktop builds only)

### Install
```bash
pnpm install
```

### Typecheck
```bash
pnpm run typecheck
```

### Build Libraries
```bash
pnpm -r --if-present run build
```

### Build Frontend (Browser Mode)
```bash
pnpm --filter @workspace/ppro run build
```

### Build Tauri Desktop
```bash
cd artifacts/ppro
pnpm tauri build
```

**Local build requires Perl** for `bundled-sqlcipher-vendored-openssl` (the `openssl-sys` crate compiles OpenSSL from source). Install via:
```bash
choco install strawberryperl -y
```
On GitHub Windows runners, `choco install strawberryperl -y --no-progress` is used in CI (see `.github/workflows/build.yml`).

## Security Model

### Encryption at Rest (Browser Mode)
- Database blob is encrypted with AES-256-GCM before writing to IndexedDB.
- The DB encryption key is itself wrapped with a second AES key before storage in IndexedDB (no-passphrase case).
- Users may optionally set a passphrase; the key is then derived via PBKDF2-HMAC-SHA512 (256k iterations).

### Profile Keys (Browser Mode)
- Ed25519 keypairs are generated in the browser via `@workspace/crypto` (`@noble/ed25519`).
- Private keys are stored in IndexedDB via `idb-keyval`, NOT in `localStorage`.
- Never store private key material in `localStorage` — it is plaintext and XSS-vulnerable.

### Sharing Encryption
- Browser-mode sharing uses hybrid encryption (`encryptForRecipient` from `@workspace/crypto`):
  - Ephemeral Ed25519 keypair + AES-GCM envelope.
  - Recipient decrypts with their stored private key via `decryptFromSender`.
- Unencrypted base64 JSON fallback is supported for backward compatibility but will be removed.

### Data Privacy
- No server. No cloud sync. All data stays on the local device (filesystem or browser IndexedDB).
- WebRTC LAN sharing is direct peer-to-peer; no signaling server, no data leaves the local network.

## Testing

```bash
# Unit tests (browser backend + canvas logic)
pnpm --filter @workspace/ppro run test
```

## Important Rules

- **Never reintroduce server-side code** in `artifacts/api-server/` or `services/relay/`. These were permanently removed.
- **Never use `localStorage` for key material.** Always use `storeProfilePrivateKey` / `getProfilePrivateKey` from `lib/browser-backend/src/crypto-store.ts`.
- **Do not add `/api` proxies to Vite config.** The project is serverless.
- Keep `lib/db/src/index.ts` top-level await pattern for conditional Postgres/SQLite loading, but verify bundler compatibility before changing.

### Destructive git operations require explicit approval

The agent MUST pause and request explicit confirmation from the user before performing ANY history-rewriting operation, including:

- `git rebase -i` (reword, edit, squash, fixup, drop, reorder)
- `git rebase --onto` (any form)
- `git commit --amend` on any commit that has been pushed or is not the local HEAD
- `git reset --hard` to an older commit
- `git filter-branch` / `git filter-repo`
- `git push --force` or `git push --force-with-lease` to any branch
- Renaming, editing, or deleting any commit, tag, or branch
- `git reflog expire --expire=now` (would destroy the only recovery path)

The warning the agent provides MUST include:

1. Which specific SHAs will change (the commit and every descendant).
2. Which external references will break — PRs, branch protection rules, CI pipelines pinned to a SHA, issue links, mirrors (`gitsafe-backup` included), third-party forks.
3. That the operation is **irreversible** without a reflog or reflog backup.
4. Whether the working terminal is UTF-8-clean (`chcp 65001` on Windows) to avoid character-encoding corruption like the `???` substitution that occurred on the `Initial commit` reword of 6d4e1e6.

**Wait for an explicit "yes" before executing.** "Sure" or "go ahead" without a clear yes is not consent. If the user says "do whatever you think is best" or is ambiguous, ask for clarification rather than proceeding.

**Exception:** trivial local-only operations where nothing is pushed yet (e.g., rewriting a commit that has never left the local clone and no other branch contains it) may proceed with a single line of disclosure in the response, but should still flag the cascade risk.

### Dual-Build Parity Rule (HARD)

Every feature, bug fix, or code change in `artifacts/ppro/src/` or `lib/` MUST be implemented and verified for **both Browser standalone mode** and **Tauri desktop mode**. Agents must never assume `window.__TAURI__` presence or absence.

- **If a feature relies on a browser-only API** (e.g., WebRTC, `CompressionStream`, DOM `getBBox`, `<a target="_blank">`), it MUST have a Tauri-compatible fallback (e.g., Rust command, `@tauri-apps/plugin-shell`, native dialog, inline modal rendering).
- **If a feature relies on a Tauri-only API** (e.g., filesystem, OS keychain, `tauri::api::dialog`), it MUST have a browser-compatible fallback (e.g., IndexedDB, Web Crypto, `<input type="file">`).
- **When modifying `lib/api-client-react/src/adapter.ts` or adding a new `apiCall()` command:** you MUST update BOTH backends:
  - Browser: `lib/browser-backend/src/commands.ts`
  - Tauri: `artifacts/ppro/src-tauri/src/commands.rs`
  - AND add the command name to `BrowserCommandName` / `CommandMap` in `adapter.ts`.
- **When modifying export, share, or any file-I/O logic:** you MUST handle both the browser Blob/download path AND the Tauri native file-save path (via `tauri-apps/plugin-fs` or `tauri-apps/plugin-dialog`).
- **Never add a command to one backend without adding it (or a meaningful fallback/error) to the other.**
- **Test assumption:** if you cannot test Tauri locally, you MUST at minimum audit the Rust command surface in `commands.rs` for the equivalent command and document the fallback in a code comment.

## Development Server

```bash
# Start frontend (browser mode)
pnpm --filter @workspace/ppro run dev
# → http://localhost:4173

# Start frontend in background (Windows PowerShell)
cmd /c "start /b pnpm --filter @workspace/ppro run dev"
```

**Port conflicts:** Kill existing process on 4173 before starting:
```powershell
Get-NetTCPConnection -LocalPort 4173 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

**esbuild issues:** Missing `@esbuild/win32-x64` binary requires explicit install:
```bash
pnpm add -D @esbuild/win32-x64@0.27.3 --filter @workspace/ppro --ignore-scripts
```
This is needed because `pnpm install --ignore-scripts` skips optional binary installation.

## Browser Testing with Integrated Browser MCP

The `integrated-browser-mcp` extension (by thimo) exposes VS Code's embedded browser via HTTP API on `localhost:3788` and MCP stdio. It shares your session cookies, localhost access, and DevTools.

### Key endpoints
```bash
# Check status
Invoke-WebRequest -Uri "http://127.0.0.1:3788/status" -UseBasicParsing

# Navigate
Invoke-WebRequest -Uri "http://127.0.0.1:3788/navigate" -Method POST -Body '{"url":"http://localhost:4173"}' -ContentType "application/json" -UseBasicParsing

# Screenshot (returns base64 PNG in data field)
Invoke-WebRequest -Uri "http://127.0.0.1:3788/screenshot?fullPage=true&waitMs=2000" -UseBasicParsing

# Evaluate JS
Invoke-WebRequest -Uri "http://127.0.0.1:3788/eval" -Method POST -Body '{"expression":"document.title"}' -ContentType "application/json" -UseBasicParsing

# Console output
Invoke-WebRequest -Uri "http://127.0.0.1:3788/console?limit=20" -UseBasicParsing
```

### Testing workflow
1. Start dev server: `pnpm --filter @workspace/ppro run dev`
2. Navigate browser: `POST /navigate {"url":"http://localhost:4173"}`
3. Take screenshot: `GET /screenshot?waitMs=2000`
4. Check console: `GET /console`
5. Evaluate interactively: `POST /eval {"expression":"..."}`

## CI / Release (GitHub Actions)

### Workflow: `.github/workflows/build.yml`

The `Build & Release` workflow triggers on pushes to `main` (typecheck + test + deploy-web) and on `v*` tags (full build + release).

**Tag-triggered builds** produce artifacts for all three platforms:
- **Windows**: `windows-latest` runner, installs Strawberry Perl via Chocolatey for vendored-openssl build, produces `.exe` (NSIS) + `.msi`
- **macOS**: `macos-latest` runner, builds universal (`aarch64-apple-darwin` + `x86_64-apple-darwin`), produces `.dmg`
- **Linux**: `ubuntu-latest` runner, installs `libwebkit2gtk-4.1-dev` etc., produces `.AppImage` + `.deb` + `.rpm`

**Release workflow:**
1. Push a `v*` tag → triggers CI
2. `tauri-apps/tauri-action@v0` builds + creates/updates a GitHub Release
3. Caution: re-pushing the same tag creates a **new draft release** each time. Clean up duplicate drafts with `gh api` (see below).

**Cleaning up duplicate draft releases:**
```powershell
gh api "repos/Huthaifa-HajAhmad/Pedigree-PRO/releases" | ConvertFrom-Json |
  Where-Object { $_.tag_name -eq 'v1.2.2' -and $_.draft -eq $true } |
  ForEach-Object { gh api -X DELETE "repos/Huthaifa-HajAhmad/Pedigree-PRO/releases/$($_.id)" }
```

**Retriggering a tag build:**
```powershell
git push origin --delete v1.2.2
git tag -d v1.2.2
git tag v1.2.2
git push origin v1.2.2
```

**Key learnings from v1.2.2 CI debugging:**
- `choco install openssl` on GitHub Windows runners installs to inconsistent paths (`C:\Program Files\OpenSSL-Win64` vs `C:\OpenSSL-Win64`), and the lib structure (`lib/VC/x64/MD/`) doesn't match what `openssl-sys` expects by default. **Do not use this approach.**
- `bundled-sqlcipher-vendored-openssl` is the correct rusqlite feature: it compiles OpenSSL from source and links statically, eliminating DLL distribution entirely.
- Strawberry Perl is required on Windows for the vendored OpenSSL build (used by `openssl-sys`'s `Makefile`-based build process).
- Tauri v2 auto-merges `tauri.{platform}.conf.json` files (e.g., `tauri.windows.conf.json`). If you create one, it will be deep-merged into `tauri.conf.json` at build time. With vendored openssl, no platform-specific config is needed.
- PowerShell heredocs (`<<'EOF'`) don't work with `gh release edit --notes-file`. Write to a temp file and use `--notes-file path/to/file.md` instead.
- `gh release edit --notes` (inline) truncates multi-line content in PowerShell. Always use `--notes-file`.
- Unsigned Windows builds will trigger SmartScreen warnings; unsigned macOS builds trigger Gatekeeper. Users bypass via "Run anyway" or right-click → Open.

## Future Work

### Completed (May 2026)

**L23 — Enable `noUnusedLocals` in tsconfig.base.json:** ✅ Complete. All 17 unused imports across 9 files were removed. Flag enabled permanently in `tsconfig.base.json:11`.

**L8 — Thumbnail virtualization for 50+ versions:** ✅ Complete. `VersionTimeline.tsx` now uses `@tanstack/react-virtual` `useVirtualizer` with horizontal layout, 120px estimate size, `useRef` scroll container.

**Accessibility testing infrastructure:** ✅ Complete. `vitest` + `axe-core` with 45 a11y tests across 3 test files covering all 6 themes, buttons, forms, search inputs, and dialogs. `eslint-plugin-jsx-a11y` with 18 active rules in `eslint.config.mjs`. 10 unlabeled inputs fixed with `aria-label` and `<label htmlFor>`.

**`noImplicitOverride: true`:** ✅ Complete. Enabled in `tsconfig.base.json:9`. `override` keyword added to `componentDidCatch` and `render` in `ErrorBoundary.tsx` and `PedigreeCanvasErrorBoundary.tsx`.

**Self-hosted fonts (HIPAA privacy):** ✅ Complete. Google Fonts CDN links removed from `index.html`. Replaced with bundled `@fontsource/inter` (300/400/500/600/700+italic) and `@fontsource/jetbrains-mono` (400/500) via CSS imports in `index.css`.

**6 easy `any` types replaced:** ✅ Complete. `lib/browser-backend/src/db.ts` — `sql.js Database` type. `lib/db/src/sqlite-adapter.ts` — `BetterSQLite3`, `BetterSQLite3Database`, `declare require()` helper.

**Playwright smoke tests:** ✅ Complete. `playwright.config.ts` targeting `localhost:4173`. 3 smoke tests in `test/e2e/smoke.spec.ts`.

**Crypto test fixes:** ✅ Complete. Fixed Ed25519 typo (`kp.secretKey` → `kp.privateKey`). Fixed PBKDF2 determinism test (now passes salt to second call).

### Code Review Fixes (May 2026)

All 20 items from the `.kilo/plans/1778972218810-hidden-rocket.md` code review plan have been implemented:

**Critical ✅:** backup_database stack overflow (chunked), WebRTC stale closure, silent data loss on decryption<br>
**High ✅:** saveDb mutex, initDb coalescing, localStorage draft debounce, auto-save timestamp comparison<br>
**Medium ✅:** relay_receive GET→POST, share_token validation, error sanitization, CommandMap type, ShareModal encryption messaging, LanShare plaintext confirmation, PII in console.error, initialSyncDoneRef reset<br>
**Low ✅:** type="button" (10 buttons), aria-label accessibility, React.StrictMode, refetchOnWindowFocus disabled, edges.length dependency, draft path consolidation, HKDF recommendation

### Remaining Deferred Items

**UX5 extended — ContextMenu keyboard navigation polish:**
Arrow key handlers were added but these items remain:
- Tab-to-focus on the menu container itself
- Focus trap (tab/shift+tab cycles within menu)
- Home/End keys to jump to first/last menu item

**TS2 — Enable additional strict TS flags:**
- `noUncheckedIndexedAccess` — requires audit pass (array/record access returns `T | undefined`)
- `exactOptionalPropertyTypes` — complex, breaks optional prop patterns
- `noPropertyAccessFromIndexSignature` — may break Drizzle ORM usage patterns

**T4 — Expand Playwright E2E coverage:**
Minimal smoke tests in place. Consider: canvas interaction tests, import/export flow, sharing flow, version history interaction.

**P5 — web-vitals monitoring:** Not yet installed. Blocked on CI/CD monitoring infrastructure.

**RB23 — Directory/package rename:**
`artifacts/ppro/` and `@workspace/ppro` remain as internal names. Cascading changes across monorepo (tsconfig references, workspace filter commands, import paths). Defer to dedicated rename pass.

### Development Workflow

**Testing cycle:**
1. Make changes → run `pnpm --filter @workspace/ppro run dev` → test in browser at `http://localhost:5173`
2. Iterate until user approves the fix/feature
3. Only then: typecheck → commit → push

**Tauri builds:**
- Do NOT build Tauri after every change
- Build Tauri (`pnpm tauri build`) only after **significant changes** and **explicit user approval**
- The user must test and approve before any release

**Releases:**
- Do NOT auto-create or update GitHub releases
- Wait for explicit user request to release

### Known Workarounds

**preinstall.js failure:** `pnpm install` fails because `scripts/preinstall.js` checks `npm_config_user_agent` and exits with code 1 for non-pnpm managers. Workaround:
```bash
pnpm install --ignore-scripts
```
Then build libs before typechecking:
```bash
pnpm --filter @workspace/api-client-react exec tsc --build
```

**TS6305 warnings:** "Output file has not been built from source" — pre-existing. Resolve by building lib packages first via `tsc --build`.

### Known Issues (Open)

**T1 — Pinch zoom on trackpad (Tauri desktop, Windows):** ✅ Fixed.

Root cause: `SetIsPinchZoomEnabled(false)` told WebView2 to consume pinch gestures entirely, preventing them from reaching web content as Ctrl+wheel events. Fix: removed `SetIsPinchZoomEnabled(false)`, kept `SetIsZoomControlEnabled(false)` (disables Ctrl+scroll page zoom only). The existing document-level `{ passive: false }` wheel listener with `e.preventDefault()` blocks browser page zoom while the `handleWheel` Ctrl+wheel path handles canvas zoom. Removed `windows-core` direct dependency (remains as transitive dep of `webview2-com`).

Prior approaches attempted (all failed):
- `SetIsPinchZoomEnabled(false)` + `SetIsZoomControlEnabled(false)` via `ICoreWebView2Settings5` — **this was the problem**
- `SetGestureConfig(hwnd, GID_ZOOM, dwBlock: GC_ZOOM)` Win32 API — blocked gesture events entirely
- `ZoomFactorChangedEventHandler` reactive reset — event consumption issues
- CSS `touch-action: none` and inline JS gesture prevention — no effect on Windows
- `--disable-pinch-to-zoom` Chromium flag — invalid/unsupported
- Document-level `wheel` handler + increased zoom sensitivity — handler never received events
- Rewrote `use-canvas-touch.ts` from Touch Events to Pointer Events — only handles touchscreen

## Migration Notes

- `lib/api-spec/` and `lib/api-zod/` were deleted. No OpenAPI or Zod generation remains.
- `pnpm-workspace.yaml` no longer includes `services/*`.
- The `mockup-sandbox` artifact was deleted.
- `canvas-theme.ts` was deleted (May 2026) — use `"hsl(var(--primary))"` directly instead of importing `CANVAS_PRIMARY`.
- `useVersionManagement.ts` was deleted (dead code, never referenced).
- All `.hpcl` references rebranded to `.ppro` across source files (Rust, TypeScript, docs). Internal draft key prefixes (`haplopainter_draft_*`) retained as they are localStorage keys, not user-facing.
- `tauri.windows.conf.json` was deleted (June 2026) — no longer needed because `bundled-sqlcipher-vendored-openssl` links OpenSSL statically instead of bundling DLLs.
- `bundled-sqlcipher` was replaced with `bundled-sqlcipher-vendored-openssl` in `artifacts/ppro/src-tauri/Cargo.toml`. This compiles OpenSSL from source during `cargo build`, requiring Perl on Windows. The benefit: no external DLLs to distribute, no fragile PATH detection on CI.

# Pedigree PRO — Agent Guide

## Architecture

Pedigree PRO is a zero-server clinical pedigree editor. It runs in two modes:

1. **Tauri desktop** (`tauri`): Rust backend + SQLCipher SQLite (local filesystem)
2. **Browser standalone** (`browser`): sql.js WASM SQLite + IndexedDB persistence + Web Crypto API

The frontend uses a unified adapter (`lib/api-client-react/src/adapter.ts`) that detects the runtime mode and routes all data operations to the appropriate backend. No REST API, no Postgres, no internet required.

### Key Packages

| Package | Role |
|---|---|
| `artifacts/haplopainter` | React + Vite frontend (pedigree canvas, dashboard, patients, profiles) |
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
pnpm --filter @workspace/haplopainter run build
```

### Build Tauri Desktop
```bash
cd artifacts/haplopainter
pnpm tauri build
```

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
pnpm --filter @workspace/haplopainter run test
```

## Important Rules

- **Never reintroduce server-side code** in `artifacts/api-server/` or `services/relay/`. These were permanently removed.
- **Never use `localStorage` for key material.** Always use `storeProfilePrivateKey` / `getProfilePrivateKey` from `lib/browser-backend/src/crypto-store.ts`.
- **Do not add `/api` proxies to Vite config.** The project is serverless.
- Keep `lib/db/src/index.ts` top-level await pattern for conditional Postgres/SQLite loading, but verify bundler compatibility before changing.

## Development Server

```bash
# Start frontend (browser mode)
pnpm --filter @workspace/haplopainter run dev
# → http://localhost:4173

# Start frontend in background (Windows PowerShell)
cmd /c "start /b pnpm --filter @workspace/haplopainter run dev"
```

**Port conflicts:** Kill existing process on 4173 before starting:
```powershell
Get-NetTCPConnection -LocalPort 4173 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

**esbuild issues:** Missing `@esbuild/win32-x64` binary requires explicit install:
```bash
pnpm add -D @esbuild/win32-x64@0.27.3 --filter @workspace/haplopainter --ignore-scripts
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
1. Start dev server: `pnpm --filter @workspace/haplopainter run dev`
2. Navigate browser: `POST /navigate {"url":"http://localhost:4173"}`
3. Take screenshot: `GET /screenshot?waitMs=2000`
4. Check console: `GET /console`
5. Evaluate interactively: `POST /eval {"expression":"..."}`

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

### Remaining Deferred Items

**UX5 extended — ContextMenu keyboard navigation polish:**
Arrow key handlers were added but these items remain:
- Tab-to-focus on the menu container itself
- Focus trap (tab/shift+tab cycles within menu)
- Home/End keys to jump to first/last menu item

**UX8 — LAN sharing ICE timeout UX:**
`LanShare.tsx` has a 30s ICE timeout but no visible progress spinner during the connecting phase. Add `Loader2` icon animation when `status === "connecting"`.

**L3 extended — Dynamic import loading indicator:**
Spinners added for export/import in `profiles.tsx`. Consider extracting a reusable `<DynamicImportSpinner>` component for `export-pedigree.ts` PDF/PPTX exports and `ShareModal.tsx`.

**P2 — Version timeline virtualization:** ✅ Complete.

**TS2 — Replace remaining `any` types (11 of 17 done):**
11 conditional `any` types remain in `lib/db/src/index.ts` — table exports and `db`/`pool` vary between SQLite and Postgres backends. Needs union type design.

**TS2 — Enable additional strict TS flags:**
- `noUncheckedIndexedAccess` — requires audit pass (array/record access returns `T | undefined`)
- `exactOptionalPropertyTypes` — complex, breaks optional prop patterns
- `noPropertyAccessFromIndexSignature` — may break Drizzle ORM usage patterns

**T4 — Expand Playwright E2E coverage:**
Minimal smoke tests in place. Consider: canvas interaction tests, import/export flow, sharing flow, version history interaction.

**P5 — web-vitals monitoring:** Not yet installed. Blocked on CI/CD monitoring infrastructure.

**RB23 — Directory/package rename:**
`artifacts/haplopainter/` and `@workspace/haplopainter` remain as internal names. Cascading changes across monorepo (tsconfig references, workspace filter commands, import paths). Defer to dedicated rename pass.

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

## Migration Notes

- `lib/api-spec/` and `lib/api-zod/` were deleted. No OpenAPI or Zod generation remains.
- `pnpm-workspace.yaml` no longer includes `services/*`.
- The `mockup-sandbox` artifact was deleted.
- `canvas-theme.ts` was deleted (May 2026) — use `"hsl(var(--primary))"` directly instead of importing `CANVAS_PRIMARY`.
- `useVersionManagement.ts` was deleted (dead code, never referenced).
- All `.hpcl` references rebranded to `.ppro` across source files (Rust, TypeScript, docs). Internal draft key prefixes (`haplopainter_draft_*`) retained as they are localStorage keys, not user-facing.

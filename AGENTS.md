# HaploClinical — Agent Guide

## Architecture

HaploClinical is a zero-server clinical pedigree editor. It runs in two modes:

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

## Migration Notes

- `lib/api-spec/` and `lib/api-zod/` were deleted. No OpenAPI or Zod generation remains.
- `pnpm-workspace.yaml` no longer includes `services/*`.
- The `mockup-sandbox` artifact was deleted.

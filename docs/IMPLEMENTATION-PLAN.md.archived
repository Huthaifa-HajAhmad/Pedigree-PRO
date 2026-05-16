# HaploClinical — Phase 0-E: Implementation Sequencing & Execution Plan

**Status:** Final  
**Date:** 2026-05-03  
**Depends on:** ADR-001, ADR-002, ADR-003, ADR-004, INFRASTRUCTURE.md  
**Purpose:** Bridge architectural decisions to actionable development milestones

---

## 1. Implementation Tracks Overview

The implementation is organized into four parallel tracks with clear dependencies:

```
                    ┌──────────────────────────────┐
                    │  TRACK A: Schema & Migration  │
                    │  (Weeks 1-2)                  │
                    │  - SQLite schema redesign     │
                    │  - Dual-column migration      │
                    │  - Drizzle definitions        │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
┌──────────────────────┐  ┌──────────────────────────────┐
│  TRACK B: Crypto     │  │  TRACK C: Tauri Backend       │
│  Core (Weeks 1-3)    │  │  (Weeks 2-4)                 │
│                      │  │                              │
│  - Ed25519 keygen    │  │  - Tauri project scaffolding  │
│  - Signing/verify    │  │  - Rust DB commands           │
│  - Content hashing   │  │  - SQLCipher integration      │
│  - libsodium seals   │  │  - OS keychain plugin         │
│  - Keychain API      │  │  - Migrations runner          │
└──────────┬───────────┘  └──────────────┬───────────────┘
           │                              │
           └──────────────┬───────────────┘
                          │
                          ▼
               ┌──────────────────────────────┐
               │  TRACK D: Frontend Unification│
               │  (Weeks 3-5)                  │
               │  - Tauri invoke() adapter     │
               │  - Local Profile UI           │
               │  - Encrypted Sharing UI       │
               │  - Profile management UX      │
               │  - Legacy code deprecation    │
               └──────────────┬───────────────┘
                              │
                              ▼
               ┌──────────────────────────────┐
               │  TRACK E: Relay & Packaging   │
               │  (Weeks 5-6)                  │
               │  - Cloudflare Worker relay    │
               │  - Tauri build config         │
               │  - Auto-update setup          │
               │  - Installer generation       │
               │  - Compliance documentation   │
               └──────────────────────────────┘
```

---

## 2. Track A: Schema & Migration (Weeks 1-2)

### A.1 — Update Drizzle SQLite Schema Definitions

**Files to modify:**
- `lib/db/src/schema_sqlite_patients.ts`
- `lib/db/src/schema_sqlite_pedigrees.ts`
- `lib/db/src/schema_sqlite_pedigree_versions.ts`
- `lib/db/src/schema_sqlite_activity_log.ts`
- `lib/db/src/schema_sqlite_app_preferences.ts` (unchanged)
- `lib/db/src/schema_sqlite_users.ts` (deprecation marker)

**New files:**
- `lib/db/src/schema_sqlite_local_profiles.ts`
- `lib/db/src/schema_sqlite_node_annotations.ts`
- `lib/db/src/schema_sqlite_pedigree_phenotypes.ts`
- `lib/db/src/schema_sqlite_index.ts` (updated exports)

**Changes per ADR-002:**
- Add `clinician_key TEXT` to patients (alongside `clinician_id` — dual-column)
- Add `creator_key TEXT`, `creator_signature TEXT`, `canvas_hash TEXT` to pedigrees
- Add `saver_key TEXT`, `saver_signature TEXT`, `canvas_hash TEXT` to pedigree_versions
- Add `actor_key TEXT`, `actor_signature TEXT` to activity_log
- New table: `local_profiles` (id, display_name, role_label, public_key, created_at, last_used_at)
- New table: `pedigree_node_annotations` (pedigree_id, node_id, hpo_terms, omim_ids, variant_hgvs, test_results, clinical_notes, affected_status, carrier_status)
- New table: `pedigree_phenotypes` (pedigree_id, condition_name, omim_id, hpo_terms, inheritance_mode, notes)

**Note:** During Phase 0-C execution, the Drizzle schemas serve as the **type source of truth**. The actual table creation is handled by Rust-side SQL migrations (`src-tauri/migrations/`). The Drizzle schemas remain for:
1. TypeScript type generation for frontend
2. `drizzle-kit` operations in browser/Server modes
3. Schema documentation

### A.2 — Update Postgres Schema Definitions (Server Mode)

**Files to modify (mirror SQLite changes):**
- `lib/db/src/schema/patients.ts`
- `lib/db/src/schema/pedigrees.ts`
- `lib/db/src/schema/pedigree_versions.ts`
- `lib/db/src/schema/activity_log.ts`
- `lib/db/src/schema/users.ts` (deprecation marker)

**New files:**
- `lib/db/src/schema/local_profiles.ts`
- `lib/db/src/schema/pedigree_node_annotations.ts`
- `lib/db/src/schema/pedigree_phenotypes.ts`
- `lib/db/src/schema/index.ts` (updated exports)

### A.3 — Create Rust Migration SQL Files

**Files to create in `artifacts/haplopainter/src-tauri/migrations/`:**

**001_initial.sql** — Core tables with dual columns:
```sql
-- patients
CREATE TABLE patients (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  mrn              TEXT NOT NULL UNIQUE,
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  date_of_birth    TEXT,
  sex              TEXT DEFAULT 'unknown',
  ethnicity        TEXT,
  referral_reason  TEXT,
  clinician_id     INTEGER,        -- DEPRECATED
  clinician_key    TEXT,           -- NEW
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
-- (plus indexes)

-- pedigrees
CREATE TABLE pedigrees (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  title              TEXT NOT NULL,
  patient_id         INTEGER REFERENCES patients(id),
  canvas_data        TEXT,
  canvas_hash        TEXT,         -- NEW
  notes              TEXT,
  created_by_id      INTEGER,      -- DEPRECATED
  creator_key        TEXT,         -- NEW
  creator_signature  TEXT,         -- NEW
  share_token        TEXT,         -- DEPRECATED
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
-- (plus indexes)

-- pedigree_versions
CREATE TABLE pedigree_versions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  pedigree_id      INTEGER NOT NULL REFERENCES pedigrees(id),
  version_number   INTEGER NOT NULL DEFAULT 1,
  label            TEXT,
  canvas_data      TEXT NOT NULL,
  canvas_hash      TEXT,           -- NEW
  thumbnail        TEXT,
  saved_by_id      INTEGER,        -- DEPRECATED
  saver_key        TEXT,           -- NEW
  saver_signature  TEXT,           -- NEW
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
-- (plus indexes)

-- activity_log
CREATE TABLE activity_log (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  action           TEXT NOT NULL,
  subject          TEXT NOT NULL,
  user_id          INTEGER,        -- DEPRECATED
  actor_key        TEXT,           -- NEW
  actor_signature  TEXT,           -- NEW
  timestamp        TEXT NOT NULL DEFAULT (datetime('now'))
);
-- (plus indexes)

-- app_preferences (unchanged)
CREATE TABLE app_preferences (
  device_id  TEXT PRIMARY KEY,
  theme      TEXT NOT NULL DEFAULT 'terminal',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- local_profiles (NEW — device-only)
CREATE TABLE local_profiles (
  id            TEXT PRIMARY KEY,
  display_name  TEXT NOT NULL,
  role_label    TEXT NOT NULL DEFAULT '',
  public_key    TEXT NOT NULL UNIQUE,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**002_clinical_annotations.sql** — Optional annotation tables:
```sql
CREATE TABLE pedigree_node_annotations (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  pedigree_id    INTEGER NOT NULL REFERENCES pedigrees(id) ON DELETE CASCADE,
  node_id        TEXT NOT NULL,
  hpo_terms      TEXT,
  omim_ids        TEXT,
  variant_hgvs    TEXT,
  test_results    TEXT,
  clinical_notes  TEXT,
  affected_status TEXT DEFAULT 'unknown',
  carrier_status  TEXT DEFAULT 'unknown',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_node_annotations_pedigree ON pedigree_node_annotations(pedigree_id, node_id);

CREATE TABLE pedigree_phenotypes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  pedigree_id     INTEGER NOT NULL REFERENCES pedigrees(id) ON DELETE CASCADE,
  condition_name  TEXT NOT NULL,
  omim_id         TEXT,
  hpo_terms       TEXT,
  inheritance_mode TEXT,
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_pedigree_phenotypes_pedigree ON pedigree_phenotypes(pedigree_id);
```

---

## 3. Track B: Crypto Core (Weeks 1-3)

### B.1 — TypeScript Crypto Library

**New file: `lib/crypto/src/index.ts`**

A shared crypto utility module consumed by both Tauri frontend and browser mode.

```typescript
// Key generation
function generateEd25519Keypair(): { publicKey: string; privateKey: string }
function keypairFromPrivateKey(privateKeyBase64: string): { publicKey: string; privateKey: string }

// Signing & verification
function signData(data: string, privateKeyBase64: string): string   // base64 signature
function verifySignature(data: string, signatureBase64: string, publicKeyBase64: string): boolean

// Content hashing
function computeHash(data: string): string   // hex SHA-256

// Symmetric encryption (for relay sharing)
function generateSymmetricKey(): Uint8Array
function sealData(data: string, symmetricKey: Uint8Array): { ciphertext: string; nonce: string }
function unsealData(ciphertext: string, nonce: string, symmetricKey: Uint8Array): string

// Asymmetric encryption (for sealed boxes)
function sealForRecipient(data: string, recipientPublicKeyBase64: string): string
function unsealFromSender(sealedBase64: string, recipientPrivateKeyBase64: string, senderPublicKeyBase64: string): string
```

**Dependencies:**
- `libsodium-wrappers` (or `@noble/ed25519` + `@noble/hashes` for smaller WASM footprint)
- Recommendation: `@noble/*` packages (pure JS, tree-shakeable, ~15KB min+gzip total)

### B.2 — Rust Crypto Module

**New file: `artifacts/haplopainter/src-tauri/src/signatures.rs`**

```rust
use ed25519_dalek::{SigningKey, VerifyingKey, Signature, Signer, Verifier};
use sha2::{Sha256, Digest};
use rand::rngs::OsRng;

pub fn generate_keypair() -> (String, String) { /* base64url public + private */ }
pub fn sign(data: &[u8], private_key_b64: &str) -> Result<String, String> { /* base64 signature */ }
pub fn verify(data: &[u8], signature_b64: &str, public_key_b64: &str) -> Result<bool, String> { /* bool */ }
pub fn hash_sha256(data: &[u8]) -> String { /* hex digest */ }
```

### B.3 — OS Keychain Integration

**Tauri plugin:** `tauri-plugin-keystore` (v2)

```toml
# Cargo.toml
[dependencies]
tauri-plugin-keystore = "2"
```

```rust
// In commands.rs — key management commands
#[tauri::command]
fn store_profile_key(profile_id: String, private_key: String) -> Result<(), String> {
    // Store in OS keychain: key = "profile:{profile_id}", value = private_key
}

#[tauri::command]
fn get_profile_key(profile_id: String) -> Result<String, String> {
    // Retrieve from OS keychain
}
```

---

## 4. Track C: Tauri Backend (Weeks 2-4)

### C.1 — Tauri Project Scaffolding

```bash
cd artifacts/haplopainter

# Add Tauri CLI
pnpm add -D @tauri-apps/cli@latest

# Initialize Tauri in the existing Vite project
pnpm tauri init
# → App name: HaploClinical
# → Window title: HaploClinical
# → Dev server URL: http://localhost:5173
# → Dev command: pnpm dev
# → Build command: pnpm build

# Add Tauri API package to frontend
pnpm add @tauri-apps/api@latest
pnpm add -D @tauri-apps/plugin-keystore
```

### C.2 — Rust Backend Implementation

**File: `src-tauri/src/main.rs`**
```rust
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_keystore::init())
        .setup(|app| {
            // Initialize SQLCipher database
            let db = db::init_db(&app)?;
            app.manage(AppState { db: Mutex::new(db) });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Profiles
            commands::create_profile,
            commands::list_profiles,
            commands::switch_profile,
            commands::delete_profile,
            commands::export_profile,
            commands::import_profile,
            // Patients
            commands::list_patients,
            commands::get_patient,
            commands::create_patient,
            commands::update_patient,
            commands::delete_patient,
            // Pedigrees
            commands::list_pedigrees,
            commands::get_pedigree,
            commands::create_pedigree,
            commands::update_pedigree,
            commands::delete_pedigree,
            // Versions
            commands::list_versions,
            commands::save_version,
            commands::restore_version,
            // Sharing
            commands::share_pedigree,
            commands::import_shared,
            // Dashboard
            commands::get_dashboard_stats,
            commands::get_recent_activity,
            // Preferences
            commands::get_preferences,
            commands::save_preferences,
        ])
        .run(tauri::generate_context!())
        .expect("error while running HaploClinical");
}
```

### C.3 — Database Initialization (SQLCipher)

**File: `src-tauri/src/db.rs`**
- Implementation per ADR-003 §3.2 (key derivation from OS keychain master secret)
- Migration runner: load `.sql` files from `migrations/` directory, execute in order
- Error handling: if SQLCipher key is wrong (database exists but can't open), prompt user for recovery

### C.4 — Command Handlers

**File: `src-tauri/src/commands.rs`**
- Each command mirrors the existing Express API route logic
- Key differences:
  - No `LEFT JOIN users` — creator/saver names resolved by looking up `local_profiles` by public key
  - Signatures are computed in Rust (call `signatures::sign()`)
  - Content hashes computed on every `canvas_data` write
  - Activity log entries are double-written (old `user_id` + new `actor_key`)

### C.5 — Export/Import Logic

**File: `src-tauri/src/export.rs`**
- `.ppro` JSON format per ADR-004 §4.3
- File dialog via Tauri dialog plugin
- Export: serialize pedigree + annotations + versions → sign → write to file
- Import: read file → verify signatures → insert into local DB
- Encrypted export for sharing: wrap in libsodium sealed box

### C.6 — Relay Client

**File: `src-tauri/src/relay.rs`**
- HTTP client (using `reqwest`)
- `share_pedigree`: encrypt export → POST to relay → return share token
- `import_shared`: GET from relay → decrypt → verify → import

---

## 5. Track D: Frontend Unification (Weeks 3-5)

### D.1 — API Client Adapter Pattern

**Modify: `lib/api-client-react/src/`**

Create an adapter that routes queries through Tauri `invoke()` in desktop mode, or `fetch()` in web mode:

```typescript
// lib/api-client-react/src/adapter.ts
export type ApiMode = 'tauri' | 'fetch';

function detectMode(): ApiMode {
  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    return 'tauri';
  }
  return 'fetch';
}

export async function apiCall<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (detectMode() === 'tauri') {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<T>(command, args);
  }
  // Map Tauri command names to REST endpoints
  const endpoint = commandToEndpoint(command);
  const response = await fetch(endpoint, {
    method: args ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: args ? JSON.stringify(args) : undefined,
  });
  return response.json();
}
```

### D.2 — React Query Hooks Update

Update existing hooks in `lib/api-client-react/src/` to use the adapter. Example:

```typescript
// Before (auto-generated from OpenAPI):
export const useListPedigrees = (params?: ListPedigreesParams) => {
  return useQuery({
    queryKey: ['pedigrees', params],
    queryFn: () => fetch(`/api/pedigrees?...`).then(r => r.json()),
  });
};

// After (adapter-based):
export const useListPedigrees = (params?: ListPedigreesParams) => {
  return useQuery({
    queryKey: ['pedigrees', params],
    queryFn: () => apiCall('list_pedigrees', params),
  });
};
```

### D.3 — Local Profile Manager UI

**New components in `artifacts/haplopainter/src/components/`:**

| Component | Purpose |
|---|---|
| `ProfileSwitcher.tsx` | Dropdown in Layout sidebar to select active profile |
| `CreateProfileDialog.tsx` | Modal: enter display name + role → generate keypair → store private key in OS keychain |
| `ProfileSettings.tsx` | View/edit profile details, export/import profile |
| `ExportProfileDialog.tsx` | Passphrase-protected profile export for device migration |

**UX Flow:**
1. First launch → no profiles → "Create your profile" prompt
2. User enters: display name (e.g., "Dr. Sarah Chen"), role label (e.g., "Clinical Geneticist")
3. App generates Ed25519 keypair → stores private key in OS keychain → stores public key + display name in local_profiles table
4. Active profile displayed in sidebar
5. All subsequent mutations signed with this profile's keypair

### D.4 — Encrypted Sharing UI

**Modify: `artifacts/haplopainter/src/components/ShareModal.tsx`**

Changes from current implementation:
- Recipient selector: user enters colleague's public key (or selects from a local address book of previously shared-with colleagues)
- Encryption happens client-side (via Tauri command or libsodium.js)
- Share token generation: POST ciphertext to relay → get share_token URL
- Share token display: URL + copy button + QR code (for in-person sharing)
- Preview removed (preview was server-side — now the relay can't decrypt, so preview is impossible)

### D.5 — Deprecation Handling

| UI Element | Current State | Phase 0-E Action |
|---|---|---|
| Users page (`/users`) | Lists users table | **Hide/mark deprecated** — still functional during migration, but navigation entry hidden |
| Creator/saver display names | From `users.name` via API JOIN | Fall back to `local_profiles` lookup by public key; if not found, display truncated public key |
| Share modal | Server-generated plaintext token | Replace with client-side encrypted share flow |
| Dashboard "Total Users" stat | `SELECT COUNT(*) FROM users` | Replace with "Active Profiles" (local) or "Distinct Creators" (global) |

---

## 6. Track E: Relay & Packaging (Weeks 5-6)

### E.1 — Cloudflare Worker Relay

**New directory: `services/relay/`**

```
services/relay/
├── wrangler.toml
├── package.json
├── tsconfig.json
└── src/
    └── index.ts
```

**`wrangler.toml`:**
```toml
name = "haploclinical-relay"
main = "src/index.ts"
compatibility_date = "2025-01-01"

[[kv_namespaces]]
binding = "SHARES"
id = "<generated-on-deploy>"
```

**`src/index.ts`:**
```typescript
interface SharePayload {
  ciphertext: string;
  encrypted_key: string;
  ttl_hours: number;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // POST /api/relay/share
    if (request.method === 'POST' && url.pathname === '/api/relay/share') {
      const body: SharePayload = await request.json();
      const token = generateToken();
      const ttl = Math.min(body.ttl_hours || 168, 720); // max 30 days
      await env.SHARES.put(token, JSON.stringify({
        ciphertext: body.ciphertext,
        encrypted_key: body.encrypted_key,
      }), { expirationTtl: ttl * 3600 });
      return Response.json({ share_token: token, expires_at: new Date(Date.now() + ttl * 3600000).toISOString() }, { status: 201 });
    }
    
    // GET /api/relay/receive/:token
    if (request.method === 'GET' && url.pathname.startsWith('/api/relay/receive/')) {
      const token = url.pathname.split('/').pop()!;
      const payload = await env.SHARES.get(token);
      if (!payload) return Response.json({ error: 'Token expired or not found' }, { status: 404 });
      // Optional: delete on first access (single-use)
      // await env.SHARES.delete(token);
      return Response.json(JSON.parse(payload));
    }
    
    // DELETE /api/relay/receive/:token (revoke)
    if (request.method === 'DELETE' && url.pathname.startsWith('/api/relay/receive/')) {
      const token = url.pathname.split('/').pop()!;
      await env.SHARES.delete(token);
      return new Response(null, { status: 204 });
    }
    
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
};

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => chars[b % chars.length]).join('');
}
```

### E.2 — Tauri Build Configuration

**File: `src-tauri/tauri.conf.json`**

Key configuration:
```json
{
  "build": {
    "devUrl": "http://localhost:5173",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "HaploClinical",
        "width": 1400,
        "height": 900,
        "minWidth": 1024,
        "minHeight": 700
      }
    ],
    "security": {
      "csp": "default-src 'self'; connect-src 'self' https://relay.haploclinical.app"
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/icon.icns", "icons/icon.ico"],
    "windows": {
      "wix": {
        "language": "en-US"
      }
    },
    "macOS": {
      "frameworks": [],
      "minimumSystemVersion": "12.0"
    },
    "linux": {
      "deb": {
        "depends": ["libwebkit2gtk-4.1-0", "libgtk-3-0"]
      }
    }
  },
  "plugins": {
    "updater": {
      "endpoints": [
        "https://github.com/your-org/haploclinical/releases/latest/download/latest.json"
      ],
      "pubkey": "<Ed25519 public key for update signing>"
    }
  }
}
```

### E.3 — GitHub Actions CI/CD

**File: `.github/workflows/build.yml`**

```yaml
name: Build & Release
on:
  push:
    tags: ['v*']

jobs:
  build-tauri:
    strategy:
      matrix:
        include:
          - os: windows-latest
            target: x86_64-pc-windows-msvc
            artifact: msi
          - os: macos-latest
            target: universal-apple-darwin
            artifact: dmg
          - os: ubuntu-latest
            target: x86_64-unknown-linux-gnu
            artifact: appimage
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'pnpm' }
      - run: pnpm install
      - uses: tauri-apps/tauri-action@v0
        with:
          projectPath: artifacts/haplopainter
          tagName: ${{ github.ref_name }}
          releaseName: 'HaploClinical v__VERSION__'
          releaseBody: 'See CHANGELOG.md for details.'
          includeUpdaterJson: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}

  deploy-relay:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          workingDirectory: services/relay

  deploy-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install && pnpm --filter @workspace/haplopainter build:web
      - uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          accountId: ${{ secrets.CF_ACCOUNT_ID }}
          projectName: haploclinical-web
          directory: artifacts/haplopainter/dist
```

### E.4 — Compliance Documentation

**Files to create:**
- `docs/COMPLIANCE-HIPAA.md` — Expanded HIPAA Technical Safeguards mapping with implementation evidence
- `docs/COMPLIANCE-GDPR.md` — Data processing register, DPO contact placeholder, data flow diagrams
- `docs/SECURITY.md` — Vulnerability disclosure policy, key management procedures, incident response playbook
- `CHANGELOG.md` — Standard keep-a-changelog format started at v0.1.0

---

## 7. Dependency Graph

```
Week 1:  ┌── A.1 (SQLite schemas) ──┐
         │                           │
         ├── A.2 (Postgres schemas) ─┤
         │                           │
         └── B.1 (TS crypto lib) ────┤
                                     │
Week 2:  ┌── A.3 (Rust migrations) ──┤
         │                           ├──► C.1 (Tauri init)
         ├── B.2 (Rust crypto) ──────┤
         │                           │
         └── B.3 (Keychain plugin) ──┘
                                     │
Week 3:  ┌── C.2 (Rust backend) ─────┤
         │                           ├──► D.1 (API adapter)
         ├── C.3 (DB init) ──────────┤
         │                           │
         ├── C.4 (Commands) ─────────┤
         │                           │
         └── D.2 (React hooks) ──────┤
                                     │
Week 4:  ┌── C.5 (Export/import) ────┤
         │                           ├──► D.3 (Profile UI)
         ├── C.6 (Relay client) ─────┤
         │                           │
         ├── D.4 (Share UI) ─────────┤
         │                           │
         └── D.5 (Deprecations) ─────┤
                                     │
Week 5:  ┌── E.1 (Relay worker) ─────┤
         │                           ├──► Integration testing
         ├── E.2 (Build config) ─────┤
         │                           │
         ├── E.3 (CI/CD) ────────────┤
         │                           │
         └── D.3-5 (UI polish) ──────┘
                                     │
Week 6:  ┌── E.4 (Compliance docs) ──┤
         │                           │
         ├── Integration testing ────┤
         │                           │
         ├── Cross-platform smoke ───┤
         │                           │
         └── v0.1.0 release ─────────┘
```

---

## 8. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **SQLCipher cross-compilation fails on one platform** | Medium | High | Test cross-compilation early (Week 2). Use `bundled` feature to compile from source. Fallback: `better-sqlite3` + application-layer encryption for affected platform only. |
| **Tauri IPC performance issues with large pedigree data** | Low | Medium | Canvas data is already JSON text; IPC passes strings efficiently. For abnormally large pedigrees (>10k nodes), implement streaming/chunked transfer. |
| **Browser WASM SQLCipher not available or broken** | Low | Medium | Fallback: `@vercel/sqlite` (unencrypted WASM) + application-layer libsodium encryption (degraded mode with warning banner). |
| **OS keychain plugin unavailable on a Linux variant** | Medium | Low | Fallback: PBKDF2-derived key from machine fingerprint (ADR-003 §3.2.3). |
| **Existing data loss during migration** | Low | High | Database backed up before migration. Dual-write ensures old columns remain populated. Migration is additive (new columns only), not destructive. |
| **OpenAPI spec desync from Tauri commands** | Medium | Medium | Tauri commands are the canonical API. OpenAPI spec updated manually for Server Mode. Consider code generation from a shared schema definition in Phase 1+. |

---

## 9. Exit Criteria for Phase 0-E

Phase 0 (Architectural Discovery) is complete when:

- [ ] All 4 ADRs reviewed and approved
- [ ] Implementation plan signed off
- [ ] Repository fully decontaminated of Replit artifacts
- [ ] `INFRASTRUCTURE.md` documents zero-cost deployment model
- [ ] Team aligned on Tauri as primary distribution
- [ ] Team aligned on local profiles + Ed25519 as identity model
- [ ] Team aligned on SQLCipher as encryption engine
- [ ] Team aligned on encrypted snapshot export (not CRDT) for sync
- [ ] Phase 1 development can begin immediately against the defined interfaces

---

## 10. Phase 1 Preview (For Reference Only)

Phase 1 implementation work, scheduled to begin after Phase 0 sign-off:

| Week | Work |
|---|---|
| 1-2 | Track A: Schema definitions updated; SQL migrations written |
| 1-3 | Track B: TypeScript + Rust crypto libraries implemented |
| 2-4 | Track C: Tauri backend with SQLCipher, all 30+ commands |
| 3-5 | Track D: Frontend adapter, profile UI, sharing UX |
| 5-6 | Track E: Relay deployment, CI/CD, packaging, compliance docs |
| 7+ | Integration testing, cross-platform QA, v0.1.0 release |
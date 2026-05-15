# ADR-004: Infrastructure — Backend/Frontend Split, Distribution & Compliance

**Status:** Draft  
**Date:** 2026-05-03  
**Depends on:** ADR-001 (Trust Model), ADR-002 (Schema Redesign), ADR-003 (Database Strategy)  
**Supersedes:** Existing Express API server (`artifacts/api-server/`) and Vite dev servers

---

## 1. Context

ADRs 001–003 define a local-first architecture: encrypted SQLite via SQLCipher, local profiles with Ed25519 keypairs, cryptographic provenance, and encrypted snapshot sharing. This ADR defines the concrete deployment architecture — how the application ships, runs, and complies with clinical regulations across three distribution modes:

1. **Tauri Desktop App** (primary — clinicians install on workstations)
2. **Static Web App** (secondary — browser-only, locked-down workstations)
3. **On-Premises Server Mode** (tertiary — institutional deployment with shared database)

### 1.1 Current State

| Component | Path | Current Role | Post-Phase-0-D Fate |
|---|---|---|---|
| `artifacts/haplopainter/` | React + Vite + Tailwind frontend | Main pedigree UI | **Becomes the unified frontend** for both Tauri and web mode |
| `artifacts/api-server/` | Express 5 + Drizzle + pino | REST API server | **Deprecated for Tauri mode** (replaced by Rust commands); **preserved for Server Mode** |
| `artifacts/mockup-sandbox/` | React + Vite playground | UI component development | **Keep** — essential for rapid UI iteration without backend |
| `lib/db/` | Drizzle ORM schemas + SQLite adapter | Database layer | **Unified schema source** — shared by Tauri Rust (via SQL migrations) and browser WASM (via Drizzle) |
| `lib/api-spec/` | OpenAPI 3.1 spec | API contract | **Refactored** — Tauri commands become the canonical API; OpenAPI spec serves Server Mode and relay |
| `lib/api-zod/` | Generated Zod schemas | Type-safe API contracts | **Preserved** — used by frontend for validation; Tauri commands mirror these schemas |
| `lib/api-client-react/` | Generated React Query hooks | API client | **Refactored** — hooks route to Tauri `invoke()` in desktop mode, `fetch()` in web mode |

---

## 2. Distribution Modes

### 2.1 Primary: Tauri Desktop Application

```
┌──────────────────────────────────────────────────────────────────┐
│                    HaploClinical Desktop                          │
│                                                                   │
│  ┌─────────────────────────────┐  ┌────────────────────────────┐ │
│  │    Frontend Process          │  │    Rust Backend Process     │ │
│  │    (React + Vite + Tailwind) │  │    (Single binary)         │ │
│  │                              │  │                            │ │
│  │  • Pedigree Canvas           │  │  • SQLite + SQLCipher      │ │
│  │  • Risk Calculator           │  │  • Ed25519 signing         │ │
│  │  • Validation Engine         │  │  • Content hashing (SHA2)  │ │
│  │  • Theme System              │  │  • Encrypted export/import │ │
│  │  • Local Profile Manager     │  │  • Relay client (HTTP)     │ │
│  │  • Import/Export UI          │  │  • Auto-update check       │ │
│  │                              │  │  • OS keychain integration │ │
│  └──────────────┬──────────────┘  └─────────────┬──────────────┘ │
│                 │                                │                │
│                 │  Tauri Bridge (IPC)             │                │
│                 │  invoke("cmd_name", args)       │                │
│                 └────────────────────────────────┘                │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                    OS Integration                             │ │
│  │  • ~/.haploclinical/data.db       (SQLCipher-encrypted)      │ │
│  │  • ~/.haploclinical/exports/      (Encrypted export packages) │ │
│  │  • OS Keychain (private keys)                                 │ │
│  │  • File associations (.ppro files)                            │ │
│  └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

**Build Output:**
| Platform | Installer | Size Estimate |
|---|---|---|
| Windows 10/11 (x64) | `.msi` | ~15 MB |
| macOS 12+ (Intel + Apple Silicon) | `.dmg` (universal) | ~18 MB |
| Linux (x64) | `.AppImage` + `.deb` | ~16 MB |

**Auto-Update:**
- Tauri updater plugin checks GitHub Releases API
- Update metadata: version, signature, download URL
- Updates are verified via Ed25519 signature before installation
- Optional: allow IT administrators to pin versions via group policy

**System Requirements:**
- Windows 10+, macOS 12+, Linux (glibc 2.31+)
- 100 MB disk space (app + database)
- No administrator privileges required (per-user installation)
- No internet connection required for core functionality
- Internet required only for: updates, sharing via relay, optional Web of Trust key exchange

### 2.2 Secondary: Static Web App (Browser-Only)

For locked-down hospital workstations where software installation is prohibited:

```
┌──────────────────────────────────────────────────────────────┐
│  Browser (Chrome/Firefox/Edge 2024+)                         │
│                                                               │
│  ┌──────────────────────────────────────────────────────────┐│
│  │  Single-Page Application (React + Vite + Tailwind)        ││
│  │                                                           ││
│  │  • @sqlite.org/sqlcipher-wasm  — SQLCipher in browser     ││
│  │  • OPFS (Origin Private File System) — persistent storage ││
│  │  • libsodium.js — Ed25519 + XChaCha20-Poly1305            ││
│  │  • Web Crypto API — key generation, PBKDF2               ││
│  │  • IndexedDB — encrypted key backup                       ││
│  │                                                           ││
│  │  Limitations:                                             ││
│  │  ❌ No native filesystem access (exports via download)    ││
│  │  ❌ No OS keychain (passphrase-derived keys)              ││
│  │  ❌ No file associations                                  ││
│  │  ❌ Browser storage quotas (~2GB OPFS)                    ││
│  └──────────────────────────────────────────────────────────┘│
│                                                               │
│  Hosted on: Cloudflare Pages / GitHub Pages                   │
│  Cost: $0/month                                               │
└──────────────────────────────────────────────────────────────┘
```

**Key Differences from Desktop:**
- No native OS integration → user creates a passphrase on first launch
- Private key encrypted with passphrase-derived key, stored in IndexedDB
- All crypto ops in JavaScript (libsodium.js + Web Crypto API)
- Export files via browser download dialog (`.ppro` format)
- Share via relay service (Cloudflare Workers)

### 2.3 Tertiary: On-Premises Server Mode

For institutions (hospitals, research labs) that want a shared deployment:

```
┌──────────────────────────────────────────────────────────────┐
│              Institutional Server (On-Premises)                │
│                                                               │
│  ┌──────────────────────────────────────────────────────────┐│
│  │  Express API Server (preserved from artifacts/api-server) ││
│  │  • Routes: patients, pedigrees, versions, dashboard       ││
│  │  • Database: Postgres (not SQLite) — concurrency support  ││
│  │  • Auth: Client TLS certificates OR IP allowlist           ││
│  │  • Audit: Server-side signature verification              ││
│  │  • Backups: Automated pg_dump                             ││
│  └──────────────────────────────────────────────────────────┘│
│                         │                                     │
│                    ┌────┴────┐                                │
│                    │ Postgres │                                │
│                    │ (encrypted│                               │
│                    │  at rest) │                                │
│                    └─────────┘                                │
│                                                               │
│  Client Access:                                               │
│  • Desktop app → connects to institutional server URL         │
│  • Browser app → connects to institutional server URL         │
│  • Both use client TLS certificates for mutual auth           │
└──────────────────────────────────────────────────────────────┘
```

**Use Case:** A genetics department wants all counselors to share one pedigree database. The server runs on the hospital's internal network (never exposed to the internet). Clinicians connect from their workstations.

**Auth Model (Server Mode):**
- **No passwords.** Device-level TLS client certificates issued by institutional IT.
- Alternatively: IP allowlist for air-gapped networks.
- The `users` table is repurposed as a "registered public keys" registry — administrators register clinicians' Ed25519 public keys. The server verifies signatures against this registry.

**Implementation Status:** This mode is **deferred to Phase 1+**. The Express API server code is preserved but not the primary focus of Phase 0 implementation.

---

## 3. Backend/Frontend Contract

### 3.1 API Surface (Tauri Commands)

The Tauri Rust backend exposes a set of typed commands. These replace the Express REST API for desktop mode.

```rust
// ─── Local Profiles ────────────────────────────────────────────
#[tauri::command] fn create_profile(name: String, role: String) -> Result<Profile, String>
#[tauri::command] fn list_profiles() -> Result<Vec<Profile>, String>
#[tauri::command] fn switch_profile(profile_id: String) -> Result<Profile, String>
#[tauri::command] fn delete_profile(profile_id: String) -> Result<(), String>
#[tauri::command] fn export_profile(profile_id: String, passphrase: String) -> Result<String, String> // returns base64
#[tauri::command] fn import_profile(encrypted_blob: String, passphrase: String) -> Result<Profile, String>

// ─── Patients ───────────────────────────────────────────────────
#[tauri::command] fn list_patients(search: Option<String>) -> Result<Vec<Patient>, String>
#[tauri::command] fn get_patient(id: i64) -> Result<Patient, String>
#[tauri::command] fn create_patient(data: CreatePatientInput) -> Result<Patient, String>
#[tauri::command] fn update_patient(id: i64, data: UpdatePatientInput) -> Result<Patient, String>
#[tauri::command] fn delete_patient(id: i64) -> Result<(), String>

// ─── Pedigrees ──────────────────────────────────────────────────
#[tauri::command] fn list_pedigrees(patient_id: Option<i64>, search: Option<String>) -> Result<Vec<PedigreeSummary>, String>
#[tauri::command] fn get_pedigree(id: i64) -> Result<Pedigree, String>
#[tauri::command] fn create_pedigree(data: CreatePedigreeInput) -> Result<Pedigree, String>
#[tauri::command] fn update_pedigree(id: i64, data: UpdatePedigreeInput) -> Result<Pedigree, String>
#[tauri::command] fn delete_pedigree(id: i64) -> Result<(), String>

// ─── Versions ───────────────────────────────────────────────────
#[tauri::command] fn list_versions(pedigree_id: i64) -> Result<Vec<PedigreeVersion>, String>
#[tauri::command] fn save_version(pedigree_id: i64, data: SaveVersionInput) -> Result<PedigreeVersion, String>
#[tauri::command] fn restore_version(pedigree_id: i64, version_id: i64) -> Result<Pedigree, String>

// ─── Sharing (Relay Client) ─────────────────────────────────────
#[tauri::command] fn share_pedigree(pedigree_id: i64, recipient_key: String) -> Result<ShareResult, String>
#[tauri::command] fn import_shared(share_token: String) -> Result<Pedigree, String>

// ─── Crypto (used by frontend for inline operations) ────────────
#[tauri::command] fn sign_data(data: String) -> Result<String, String>   // returns base64 signature
#[tauri::command] fn verify_signature(data: String, signature: String, public_key: String) -> Result<bool, String>
#[tauri::command] fn compute_hash(data: String) -> Result<String, String> // returns hex SHA-256

// ─── Export/Import ───────────────────────────────────────────────
#[tauri::command] fn export_pedigree(pedigree_id: i64, format: String) -> Result<String, String> // returns file path
#[tauri::command] fn import_pedigree(file_path: String) -> Result<Pedigree, String>

// ─── Dashboard ───────────────────────────────────────────────────
#[tauri::command] fn get_dashboard_stats() -> Result<DashboardStats, String>
#[tauri::command] fn get_recent_activity(limit: Option<i64>) -> Result<Vec<ActivityLog>, String>

// ─── Preferences ─────────────────────────────────────────────────
#[tauri::command] fn get_preferences() -> Result<Preferences, String>
#[tauri::command] fn save_preferences(theme: String) -> Result<Preferences, String>
```

**Frontend Integration:**
```typescript
// lib/api-client-react/src/hooks.ts (refactored)
// Desktop mode:
import { invoke } from '@tauri-apps/api/core';
const pedigrees = await invoke('list_pedigrees', { search: 'Smith' });

// Web mode (browser fallback):
const response = await fetch('/api/pedigrees?search=Smith');
const pedigrees = await response.json();

// Unified hook:
function usePedigrees(search?: string) {
  const isDesktop = typeof window !== 'undefined' && '__TAURI__' in window;
  return useQuery({
    queryKey: ['pedigrees', search],
    queryFn: () => isDesktop
      ? invoke('list_pedigrees', { search })
      : fetch(`/api/pedigrees?search=${search}`).then(r => r.json())
  });
}
```

### 3.2 Relay Service API Contract

The zero-knowledge relay for encrypted sharing:

```
POST /api/relay/share
  Content-Type: application/json
  Body: {
    "ciphertext": "<base64-encoded encrypted export JSON>",
    "encrypted_key": "<base64-encoded libsodium crypto_box_seal output>",
    "ttl_hours": 168         // default 7 days
  }
  Response 201: {
    "share_token": "Ab3Xk9pQ2mN7vL1",
    "expires_at": "2026-05-10T12:00:00Z"
  }

GET /api/relay/receive/:token
  Response 200: {
    "ciphertext": "<base64>",
    "encrypted_key": "<base64>"
  }
  Response 404: { "error": "Token expired or not found" }
  Response 410: { "error": "Token already consumed" }

DELETE /api/relay/receive/:token
  Response 204: (sender revokes token)
```

**Relay Implementation:** Cloudflare Worker (JavaScript/TypeScript)
- Stores payloads in Cloudflare Workers KV (free tier: 100k reads/day, 1k writes/day)
- Token validation: check KV, return payload if exists + not expired
- On first GET: optionally delete payload (single-use) or decrement access counter
- On TTL expiry: automatic deletion (KV expiration)
- **No decryption capability** — relay never sees plaintext

**Cost Analysis (Cloudflare Workers Free Tier):**
| Resource | Free Limit | Projected Usage | Over Limit? |
|---|---|---|---|
| Requests/day | 100,000 | < 100 | No |
| CPU time/request | 10 ms | ~2 ms | No |
| KV reads/day | 100,000 | < 200 | No |
| KV writes/day | 1,000 | < 20 | No |
| KV storage | 1 GB | < 10 MB | No |

**$0/month — confirmed.**

---

## 4. Compliance Framework

### 4.1 HIPAA Technical Safeguards Mapping

HaploClinical is designed as a **medical device component** (pedigree visualization and risk calculation for clinical genetics). While not a Covered Entity itself, it must demonstrate HIPAA Technical Safeguards for institutions that deploy it with PHI.

| HIPAA Safeguard (§164.312) | Requirement | HaploClinical Implementation |
|---|---|---|
| **(a)(1) Access Control** | Unique user identification | ✅ Ed25519 keypair per local profile provides cryptographic unique identification. In Server Mode, TLS client certificates. |
| **(a)(2)(i) Automatic Logoff** | Session timeout | ✅ No persistent sessions. In Tauri mode, database connection closes when app exits. Key material evicted from memory. |
| **(a)(2)(ii) Encryption & Decryption** | Encrypt PHI at rest | ✅ SQLCipher AES-256-CBC with HMAC-SHA1 page-level integrity. Entire database file is encrypted. |
| **(a)(2)(iv) Encryption in Transit** | Encrypt PHI over networks | ✅ All sharing payloads end-to-end encrypted (libsodium sealed boxes). Relay sees only ciphertext. Server Mode uses TLS 1.3 with mutual auth. |
| **(b) Audit Controls** | Record and examine PHI activity | ✅ `activity_log` table with cryptographic signatures. Every mutation signed by actor's private key. Content hashing provides tamper evidence. |
| **(c)(1) Integrity** | Protect PHI from improper alteration | ✅ `canvas_hash` (SHA-256) on every pedigree version. Per-page HMAC on database. Ed25519 signatures verify provenance. |
| **(c)(2) Authentication** | Verify entity seeking access | ✅ Zero-knowledge relay: recipient must possess private key to decrypt shared data. Server Mode: TLS client certificates + signature verification. |
| **(d) Transmission Security** | Guard against unauthorized access during transmission | ✅ Encrypted export packages. Relay payloads are sealed boxes — relay operator cannot decrypt. WebRTC alternative uses DTLS-SRTP. |

### 4.2 GDPR Data Minimization

| GDPR Principle | Implementation |
|---|---|
| **Data minimization** | Only fields necessary for pedigree analysis are stored. Free-text fields are clinician-controlled. |
| **Storage limitation** | Data lives on clinician's device. No cloud database. Backups are clinician-managed. |
| **Right of access** | Clinician exports full database snapshot (encrypted). Patient data export produces a structured `.ppro` file. |
| **Right to erasure** | Delete pedigree/patient → `activity_log` records deletion event. Physical deletion from SQLite (`DELETE` + `VACUUM`). |
| **Data portability** | `.ppro` format is documented JSON with cryptographic provenance. Open standard — no vendor lock-in. |
| **Privacy by design** | Default: no data leaves the device. Sharing requires explicit clinician action. Relay is zero-knowledge. |

### 4.3 Data Export Format (.ppro)

```json
{
  "format_version": "1.0",
  "export_type": "pedigree",
  "pedigree": {
    "title": "Smith Family",
    "canvas_data": { "nodes": [...], "edges": [...] },
    "canvas_hash": "a3f2b...",
    "notes": "...",
    "node_annotations": [...],
    "phenotypes": [...],
    "version_history": [...]
  },
  "provenance": {
    "creator_key": "6a2c...e4f1",
    "creator_signature": "d8e1...3f",
    "exported_at": "2026-05-03T12:00:00Z",
    "exported_by_key": "6a2c...e4f1",
    "export_signature": "f2a3..."
  }
}
```

**File Association:**
- Extension: `.ppro` (HaploClinical Pedigree Link)
- MIME type: `application/vnd.haploclinical.pedigree+json`
- Registered with OS on Tauri installation → double-click opens in HaploClinical

---

## 5. Development Environment

### 5.1 Monorepo Structure (Post-Phase-0)

```
Haplo-Clinical/
├── artifacts/
│   ├── haplopainter/              ← UNIFIED FRONTEND (Tauri + Web)
│   │   ├── src/                   ← React + Vite + Tailwind
│   │   ├── src-tauri/             ← Tauri Rust backend
│   │   │   ├── Cargo.toml
│   │   │   ├── tauri.conf.json
│   │   │   ├── src/
│   │   │   │   ├── main.rs        ← App entry, Tauri builder
│   │   │   │   ├── db.rs          ← SQLCipher init, migrations
│   │   │   │   ├── commands.rs    ← Tauri command handlers
│   │   │   │   ├── signatures.rs  ← Ed25519 ops
│   │   │   │   ├── export.rs      ← Export/import logic
│   │   │   │   └── relay.rs       ← Relay client
│   │   │   └── migrations/
│   │   │       ├── 001_initial.sql
│   │   │       ├── 002_crypto_columns.sql
│   │   │       └── 003_clinical_annotations.sql
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   ├── api-server/                ← PRESERVED for Server Mode (Phase 1+)
│   │   └── (existing code, updated for crypto columns)
│   │
│   └── mockup-sandbox/            ← UI component playground (keep)
│       └── (existing code)
│
├── lib/
│   ├── db/                        ← Drizzle schemas (shared type source)
│   │   └── src/
│   │       ├── schema/            ← Postgres schemas (Server Mode)
│   │       └── schema_sqlite_*.ts ← SQLite schemas (Desktop + Web)
│   │
│   ├── api-spec/                  ← OpenAPI spec (Server Mode + Relay)
│   │
│   ├── api-zod/                   ← Generated Zod validators
│   │
│   └── api-client-react/          ← Unified React Query hooks
│       └── src/
│           ├── tauri-client.ts    ← invoke() based
│           └── fetch-client.ts    ← fetch() based (Web/Server Mode)
│
├── services/
│   └── relay/                     ← Cloudflare Worker
│       ├── wrangler.toml
│       ├── src/
│       │   └── index.ts
│       └── package.json
│
├── docs/
│   ├── ADR-001-trust-model.md
│   ├── ADR-002-schema-redesign.md
│   ├── ADR-003-database-strategy.md
│   └── ADR-004-infrastructure-distribution.md
│
├── INFRASTRUCTURE.md
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

### 5.2 Development Workflow

```bash
# 1. Full-stack Tauri development (desktop mode)
cd artifacts/haplopainter
pnpm tauri dev          # Starts Vite + Rust backend

# 2. Frontend-only development (browser mode, no Rust)
pnpm dev                # Vite dev server with mock data

# 3. Component playground
pnpm --filter @workspace/mockup-sandbox dev

# 4. Relay service development
cd services/relay
pnpm wrangler dev        # Cloudflare Workers local dev

# 5. Type checking across workspace
pnpm typecheck

# 6. Build Tauri installer
cd artifacts/haplopainter
pnpm tauri build         # Produces .msi/.dmg/.AppImage
```

---

## 6. Decision Summary

| Aspect | Decision |
|---|---|
| **Primary distribution** | Tauri desktop app (.msi/.dmg/.AppImage) with Rust backend + SQLCipher |
| **Secondary distribution** | Static web app (Cloudflare Pages) with WASM SQLCipher + OPFS |
| **Tertiary distribution** | On-premises Express server with Postgres (deferred to Phase 1+) |
| **API contract** | Tauri commands (typed Rust → JS bridge) for desktop; REST API preserved for web/server modes |
| **Frontend codebase** | Single unified React app in `artifacts/haplopainter/` — Tauri mode and web mode share the same UI code |
| **Relay service** | Cloudflare Worker (zero-knowledge, stores only ciphertext) |
| **Compliance** | HIPAA Technical Safeguards mapped; GDPR data minimization by design |
| **Data export format** | `.ppro` — documented JSON with cryptographic provenance |
| **Auto-update** | GitHub Releases + Tauri updater plugin, Ed25519-signed update metadata |
| **Total infrastructure cost** | $0.00/month (all components within free tiers) |
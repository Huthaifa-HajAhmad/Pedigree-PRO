# ADR-003: Database Strategy — Local-First Architecture with Encryption

**Status:** Draft  
**Date:** 2026-05-03  
**Depends on:** ADR-001 (Trust Model), ADR-002 (Schema Redesign)  
**Supersedes:** `lib/db/src/sqlite-adapter.ts` dual-driver approach (extended, not replaced)

---

## 1. Context

ADR-001 established that patient pedigree data remains on the clinician's device, encrypted at rest, with no cloud database. ADR-002 defined the re-engineered schema with cryptographic provenance. This ADR defines **how** the local database operates — encryption, storage engine selection, and synchronization strategy.

### 1.1 Current State

The existing SQLite adapter (`lib/db/src/sqlite-adapter.ts`) is already production-ready:

| Feature | Current Implementation |
|---|---|
| **Primary driver** | `@vercel/sqlite` (WASM, zero native builds) |
| **Fallback driver** | `better-sqlite3` (native, synchronous) |
| **Drizzle ORM** | Wraps both drivers behind Drizzle's SQLite dialect |
| **Dual-mode** | Postgres (client-server) or SQLite (local) based on `DATABASE_URL` prefix |
| **Encryption** | ❌ None — data stored as plaintext SQLite file |
| **Migrations** | `drizzle-kit` with Drizzle Kit config (Postgres dialect, needs SQLite support) |

### 1.2 Constraints

| Constraint | Impact |
|---|---|
| Clinical data at rest must be encrypted | HIPAA Technical Safeguard §164.312(a)(2)(iv) — encryption |
| No mandatory internet connectivity | Encryption must work fully offline |
| Cross-platform (Windows, macOS, Linux) | Cipher stack must compile across all Tauri targets |
| Zero-cost infrastructure | No cloud key management service (KMS) — keys derived from OS keychain |
| Browser fallback mode | WASM-compatible encryption when running in-browser |
| Existing codebase compatibility | Drizzle ORM must remain the query layer |

---

## 2. Architectural Options Evaluated

### 2.1 Option A: SQLCipher (Transparent Database Encryption)

**Mechanism:** SQLCipher is an open-source extension to SQLite that provides transparent 256-bit AES encryption. Pages are encrypted/decrypted at the I/O boundary — the application sees standard SQL, but the on-disk file is encrypted.

```rust
// In the Tauri Rust backend:
let conn = Connection::open_with_flags(
    db_path,
    OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_CREATE,
    None, // vfs
    Some(("sqlcipher", None)), // extension
)?;
conn.execute_batch(&format!("PRAGMA key = '{}';", hex_encoded_key))?;
```

**Integration with Drizzle:**
- Drizzle ORM operates over the driver without modification
- The encryption is below Drizzle's abstraction layer — Drizzle issues SQL, SQLCipher handles I/O encryption
- No schema changes, no query changes, no type changes

**Pros:**
- ✅ Transparent to application code — no Drizzle or query modifications needed
- ✅ Field-proven: SQLCipher is used by Signal, WhatsApp, and numerous healthcare applications
- ✅ AES-256-CBC with per-page HMAC-SHA1 (Page-level integrity)
- ✅ Key derivation support (PBKDF2-HMAC-SHA512 with configurable iterations)
- ✅ Available as a Rust crate (`rusqlite` with `sqlcipher` feature) for Tauri
- ✅ WASM build exists (`@sqlite.org/sqlcipher-wasm`) for browser mode

**Cons:**
- Requires compiling SQLCipher as part of the Tauri build (adds ~2MB to binary, build-time dependency)
- Browser WASM build is maintained separately from the core SQLite WASM team
- Key management is still application-level (we decide where the key comes from)

### 2.2 Option B: Application-Layer Encryption (JSON Blob Encryption)

**Mechanism:** The SQLite database remains unencrypted. Sensitive columns (e.g., `canvas_data`, `notes`, `first_name`, `last_name`, `mrn`) are individually encrypted at the application layer using libsodium `crypto_secretbox` before INSERT, and decrypted after SELECT.

```typescript
// Application layer:
function encryptField(value: string, key: Uint8Array): string {
  const nonce = randombytes_buf(crypto_secretbox_NONCEBYTES);
  const ciphertext = crypto_secretbox_easy(value, nonce, key);
  return base64(nonce) + '.' + base64(ciphertext);
}
```

**Pros:**
- No SQLite compilation complications
- Works identically in WASM (browser) and native (Tauri)
- Can be selective — encrypt only PHI fields, leave metadata indexable
- No dependency on SQLCipher build chain

**Cons:**
- ❌ Cannot query encrypted columns server-side (`WHERE first_name = 'John'` becomes impossible)
- ❌ Indexes on encrypted columns are useless (they index ciphertext, not plaintext)
- ❌ Requires application-level encryption aware in every query — massive refactor of Drizzle usage
- ❌ Metadata leakage: table names, row counts, timestamp patterns visible in plaintext
- ❌ Per-field encryption adds nonce overhead (~24 bytes per field)

**Verdict:** ❌ **Rejected.** The loss of server-side query capability and the invasive refactor across all Drizzle queries outweighs the build simplicity.

### 2.3 Option C: SQLite Encryption Extension (SEE)

**Mechanism:** The official SQLite Encryption Extension — a closed-source, paid license ($2,000 one-time) offering AES-256-OFB encryption.

**Pros:**
- Official, maintained by the SQLite team, highest compatibility
- RSA-4096 key verification option

**Cons:**
- ❌ Closed-source — cannot audit, cannot redistribute source
- ❌ $2,000 per-developer license (conflicts with zero-cost mandate)
- ❌ WASM build not publicly available

**Verdict:** ❌ **Rejected.** Violates zero-cost principle and auditability requirements for clinical software.

### 2.4 Option D: Filesystem-Level Encryption (OS-provided)

**Mechanism:** Rely on the operating system's full-disk encryption (BitLocker on Windows, FileVault on macOS, LUKS on Linux).

**Pros:**
- Zero implementation cost
- No application changes

**Cons:**
- ❌ Cannot guarantee encryption on shared workstations without FDE
- ❌ User must configure OS-level encryption — not enforceable
- ❌ SQLite file is unencrypted when copied to removable media
- ❌ No integrity verification at the database level

**Verdict:** ❌ **Rejected.** Non-guarantee and non-portable security posture is unacceptable for clinical software.

---

## 3. Decision: SQLCipher for Transparent Database Encryption

**SQLCipher is selected** as the sole encryption mechanism for the local-first SQLite database.

### 3.1 Implementation Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Application Layer                     │
│  ┌───────────────────┐  ┌─────────────────────────────┐ │
│  │  React Frontend    │  │  Tauri Commands (Rust API)  │ │
│  │  (UI & Canvas)     │  │                             │ │
│  └───────┬───────────┘  └──────────────┬──────────────┘ │
│          │                              │                │
│          │    Tauri invoke()            │                │
│          └──────────────────────────────┘                │
│                         │                                │
│  ┌──────────────────────┴──────────────────────────────┐ │
│  │              Drizzle ORM (TypeScript)                 │ │
│  │  - Schema definitions                                │ │
│  │  - Query building                                    │ │
│  │  - Migrations (drizzle-kit)                          │ │
│  └──────────────────────┬──────────────────────────────┘ │
│                         │ SQL (plaintext — app sees SQL) │
│  ┌──────────────────────┴──────────────────────────────┐ │
│  │           rusqlite (Rust SQLite driver)               │ │
│  │  ┌────────────────────────────────────────────────┐  │ │
│  │  │        SQLCipher Extension                      │  │ │
│  │  │  - AES-256-CBC page-level encryption            │  │ │
│  │  │  - HMAC-SHA1 per-page integrity                 │  │ │
│  │  │  - PBKDF2-HMAC-SHA512 key derivation            │  │ │
│  │  └────────────────────────────────────────────────┘  │ │
│  └──────────────────────┬──────────────────────────────┘ │
│                         │ Encrypted I/O                  │
│                    ┌────┴────┐                           │
│                    │  data.db │  ← Fully encrypted       │
│                    └─────────┘                           │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Key Management

#### 3.2.1 Key Derivation

```
┌─────────────────────┐
│   OS Keychain        │  ← Protected by OS login
│   (Tauri keystore    │
│    plugin)           │
│                      │
│   db_master_secret   │  ← 32 random bytes, generated on first launch
└─────────┬───────────┘
          │
          │ Retrieved at app startup, held in memory only
          ▼
┌─────────────────────┐
│   PBKDF2-HMAC-SHA512 │
│   iterations: 256,000 │  ← Configurable; tuned per-platform
│   salt: device_id     │  ← Device UUID (stored in app_preferences)
│   output: 64-byte key │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│   SQLCipher PRAGMA   │
│   PRAGMA key =       │
│     "x'<hex_key>'"   │
└─────────────────────┘
```

**Key derivation parameters:**
- `kdf_iter`: 256,000 iterations (default; tunable up to 1,000,000)
- `cipher_page_size`: 4096 (default)
- `cipher_hmac_algorithm`: HMAC_SHA1 (default)
- `cipher_kdf_algorithm`: PBKDF2_HMAC_SHA512 (default)

#### 3.2.2 Key Lifecycle

| Event | Action |
|---|---|
| **First launch** | Generate 32-byte random `db_master_secret` → store in OS keychain → derive SQLCipher key → create encrypted DB |
| **Subsequent launches** | Retrieve `db_master_secret` from OS keychain → derive SQLCipher key → open encrypted DB |
| **Key rotation** | Generate new `db_master_secret` → rekey database (`PRAGMA rekey = 'x'...'`) → update OS keychain |
| **Device migration** | Encrypted profile export (ADR-001 §5) includes `db_master_secret` wrapped in passphrase-derived key |
| **App uninstall** | OS keychain entry deleted → database becomes irrecoverable (data sovereignty — user controls their data) |

#### 3.2.3 Key Storage by Platform

| Platform | Keychain | Tauri Plugin |
|---|---|---|
| **Windows** | Credential Manager (DPAPI-backed) | `tauri-plugin-keystore` |
| **macOS** | Keychain Services | `tauri-plugin-keystore` |
| **Linux** | Secret Service API (gnome-keyring / ksecretservice) | `tauri-plugin-keystore` |

**Fallback for headless Linux:** PBKDF2-derived key from a machine fingerprint (hostname + machine-id + salt stored alongside DB).

### 3.3 Security Properties

| Property | Mechanism |
|---|---|
| **Confidentiality at rest** | AES-256-CBC per-page encryption — entire database file is ciphertext |
| **Integrity** | Per-page HMAC-SHA1 — tampering with any page is detected on read |
| **Forward secrecy** | Not applicable — data-at-rest encryption is static |
| **Key compromise recovery** | `PRAGMA rekey` with new key, old key deleted from keychain |
| **Brute-force resistance** | PBKDF2 with 256k iterations; OS keychain access requires authenticated login |
| **Memory protection** | Key held in process memory only while app is running; Rust's ownership model prevents leaks |

---

## 4. Storage Engine Decision: Tauri-side Rust SQLite (Primary) + WASM SQLite (Browser Fallback)

### 4.1 Primary: Tauri Rust Backend with rusqlite + SQLCipher

```
Tauri App
├── Rust Backend (src-tauri/)
│   ├── Cargo.toml
│   │   └── [dependencies]
│   │       rusqlite = { version = "0.31", features = ["sqlcipher", "bundled"] }
│   │       tauri-plugin-keystore = "2"
│   │       sha2 = "0.10"
│   │       ed25519-dalek = "2"
│   │
│   ├── src/
│   │   ├── db.rs           — Database initialization, key derivation, PRAGMA setup
│   │   ├── commands.rs     — Tauri command handlers (CRUD operations)
│   │   ├── signatures.rs   — Ed25519 signing/verification for provenance
│   │   └── export.rs       — Encrypted export/import
│   │
│   └── migrations/         — SQL migration files (run at startup)
│       ├── 001_initial.sql
│       ├── 002_add_crypto_columns.sql
│       └── 003_add_clinical_annotations.sql
│
├── Frontend (artifacts/haplopainter/)
│   └── invokes Rust commands via Tauri bridge
```

**Rationale for Rust-side DB:**
1. **Single language for crypto + DB** — Rust does Ed25519 signing, hash verification, and SQLCipher in one process with zero FFI overhead
2. **Drizzle ORM remains on frontend** for schema definition and type safety, but queries execute through Tauri commands
3. **Migrations run at app startup** — Rust loads and executes `.sql` files in order
4. **Connection pooling not needed** — single-user desktop app, one connection

**Tauri Command Interface (examples):**

```rust
#[tauri::command]
fn create_pedigree(
    state: tauri::State<AppState>,
    title: String,
    patient_id: Option<i64>,
    canvas_data: Option<String>,
    notes: Option<String>,
    creator_key: String,
    creator_signature: String,
) -> Result<Pedigree, String> {
    let db = state.db.lock().unwrap();
    let canvas_hash = if let Some(ref data) = canvas_data {
        Some(hex::encode(sha2::Sha256::digest(data.as_bytes())))
    } else { None };
    
    db.execute(
        "INSERT INTO pedigrees (title, patient_id, canvas_data, canvas_hash, notes, creator_key, creator_signature, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'), datetime('now'))",
        params![title, patient_id, canvas_data, canvas_hash, notes, creator_key, creator_signature],
    ).map_err(|e| e.to_string())?;
    
    // Return the created pedigree...
}
```

### 4.2 Secondary: WASM SQLite for Browser-Only Mode

For environments where Tauri installation is blocked (locked-down hospital workstations):

```
Browser
├── @sqlite.org/sqlcipher-wasm    — SQLCipher compiled to WASM
├── Origin Private File System    — Persistent storage (OPFS)
└── libsodium.js                  — Ed25519 signing in browser
    └── Key from Web Crypto API   — SubtleCrypto for key generation
        └── Stored in IndexedDB   — Encrypted with a passphrase-derived key
```

**Key differences from Tauri mode:**
- No OS keychain → user enters a passphrase on first launch (or biometric WebAuthn PRF)
- Private key stored in IndexedDB, encrypted with passphrase-derived key
- All crypto ops in JavaScript (libsodium.js + Web Crypto API)
- Same schema, same queries, same Drizzle ORM — only the driver changes

**Drizzle adapter for WASM mode:**
```typescript
// lib/db/src/sqlite-adapter.ts (extended)
if (isBrowserMode()) {
  const sqlite3 = await import('@sqlite.org/sqlcipher-wasm');
  const db = new sqlite3.oo1.DB('/data.db', 'c'); // OPFS path
  db.exec(`PRAGMA key = '${hexKey}';`);
  // Wrap for Drizzle...
}
```

### 4.3 Codebase Impact

| Component | Current | After Phase 0-C |
|---|---|---|
| `lib/db/src/sqlite-adapter.ts` | Dual `@vercel/sqlite` / `better-sqlite3` | Extended with SQLCipher WASM driver, PRAGMA key setup |
| `lib/db/src/index.ts` | Dynamic import of sqlite-adapter | Unchanged interface — adapter pattern preserved |
| API Server (`artifacts/api-server/`) | Express server for local API | Deprecated for Tauri mode; preserved for "Server Mode" |
| Frontend queries | Via React Query → fetch to API server | Via Tauri `invoke()` → Rust commands (desktop) OR fetch (browser) |
| Migrations | `drizzle-kit` (Postgres dialect) | Rust-side `.sql` migrations + `drizzle-kit` config updated |

---

## 5. Synchronization Strategy: Encrypted Snapshot Export (NOT CRDT)

### 5.1 CRDT Evaluation

**Question:** Can we use Conflict-free Replicated Data Types (CRDTs) like Yjs or Automerge for real-time pedigree collaboration?

**Analysis:**

| Factor | CRDT Suitability for Pedigree Data |
|---|---|
| **Data shape** | JSON graph (nodes + edges) — CRDTs handle this well |
| **Conflict semantics** | Pedigree edits are structural (add/remove nodes, change edges) — CRDT merges may produce invalid pedigrees (e.g., self-loop introduced by merge) |
| **Validation post-merge** | Every CRDT merge would need full validation pass (cycle detection, duplicate edges, etc.) — defeats the purpose of conflict-free merging |
| **Canvas layout data** | Node positions (x, y) are high-frequency and conflict-prone — CRDT last-writer-wins would discard manual positioning work |
| **Use case** | Clinicians don't simultaneously co-edit pedigrees — collaboration is asynchronous (share → review → send back) |
| **Complexity** | CRDT adds significant code complexity and dependency footprint for a use case that doesn't require real-time collaboration |

**Verdict:** ❌ **CRDT is not suitable for pedigree collaboration.**

The pedigree data model is:
1. **Structurally constrained** (no cycles, no self-loops, valid relationship types)
2. **Spatially sensitive** (node positions carry semantic meaning — generations, sibling order)
3. **Asynchronously shared** (clinicians share, review, and return — not real-time co-editing)

### 5.2 Selected Strategy: Encrypted Snapshot Export/Import

```
┌─────────────────┐                    ┌─────────────────┐
│   Device A       │                    │   Device B       │
│                  │                    │                  │
│  Pedigree v12    │                    │  Pedigree v12    │
│  (local state)   │                    │  (imported)      │
│       │          │                    │       ▲          │
│       ▼          │                    │       │          │
│  ┌───────────┐   │    Encrypted       │  ┌───────────┐   │
│  │ Export     │───┼──────────────────▶│  │ Import    │   │
│  │ Package    │   │    via Relay       │  │ & Merge   │   │
│  │            │   │                    │  │           │   │
│  │ .data      │   │  Package:          │  │ 1. Decrypt│   │
│  │ .sig       │   │  - Encrypted JSON  │  │ 2. Verify │   │
│  │ .key       │   │  - Sender's sig    │  │ 3. Apply  │   │
│  └───────────┘   │  - Version vector   │  │ 4. If     │   │
│                  │  - Type: full|diff  │  │  conflict │   │
│                  │                    │  │  → prompt  │   │
└─────────────────┘                    └─────────────┘
```

**Export Package Format:**
```json
{
  "version": 2,
  "export_type": "full",           // "full" | "diff" (from version X to Y)
  "pedigree_id": 42,
  "version_vector": {              // Monotonic version tracking
    "pedigree_version": 12,
    "export_timestamp": "2026-05-03T12:00:00Z"
  },
  "payload": {
    "title": "Smith Family",
    "canvas_data": { "nodes": [...], "edges": [...] },
    "canvas_hash": "a3f2b...",
    "notes": "...",
    "annotations": [...],
    "phenotypes": [...]
  },
  "sender_key": "6a2c...e4f1",    // Sender's Ed25519 public key
  "sender_signature": "d8e1...3f"  // Ed25519 signature over payload
}
```

**Encryption envelope (for sharing via relay):**
```
1. Generate ephemeral XChaCha20-Poly1305 key (sym_key)
2. Encrypt export JSON with sym_key → ciphertext
3. Encrypt sym_key with recipient's Ed25519 public key → encrypted_key (crypto_box_seal)
4. POST { ciphertext, encrypted_key } to relay
5. Relay returns share_token
```

**Conflict Resolution (when importing):**
1. If recipient already has the pedigree with a LOWER version_vector → auto-accept (update)
2. If recipient has the pedigree with a HIGHER version_vector → warn, offer merge options
3. If recipient doesn't have the pedigree → auto-import as new

**Future enhancement (Phase 1+):**
- Merkle DAG-based version history: each export references the parent version's hash, forming a verifiable chain
- This enables "diff" exports (send only the delta between version N and version N+3)

### 5.3 Multi-Device Sync (Same Clinician)

For clinicians with desktop + laptop:

```
Device A (Desktop)                    Device B (Laptop)
     │                                      │
     │  1. Export full snapshot             │
     │     (encrypted with own public key)  │
     │─────────────────────────────────────▶│
     │                                      │  2. Import → merge
     │                                      │
     │  3. Work on Device B                 │
     │                                      │
     │  4. Export updated snapshot          │
     │◀─────────────────────────────────────│
     │                                      │
     │  5. Import → merge                   │
```

Implemented as "Sync Profile" export — a self-encrypted package containing the full database snapshot, encrypted with the clinician's own public key, transferred via portable media or local network.

---

## 6. Implementation Sequence (Phase 0-C Execution)

### 6.1 Tauri Project Scaffolding

```bash
# Create Tauri project within the monorepo
pnpm create tauri-app artifacts/haploclinical-desktop --template react-ts
# Or add Tauri to existing haplopainter artifact:
cd artifacts/haplopainter && pnpm add @tauri-apps/api @tauri-apps/cli
```

### 6.2 Rust Dependencies (Cargo.toml)

```toml
[dependencies]
rusqlite = { version = "0.31", features = ["sqlcipher", "bundled"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
sha2 = "0.10"
hex = "0.4"
ed25519-dalek = { version = "2", features = ["rand_core"] }
rand = "0.8"
tauri-plugin-keystore = "2"
uuid = { version = "1", features = ["v4"] }
```

### 6.3 Migration SQL Files

Three migration files to create the re-engineered schema:

1. `001_initial.sql` — Core tables (patients, pedigrees, pedigree_versions, activity_log, app_preferences, local_profiles) with dual columns (old + new)
2. `002_add_crypto_columns.sql` — canvas_hash, creator_signature, saver_signature, actor_signature (if not in 001)
3. `003_add_clinical_annotations.sql` — pedigree_node_annotations, pedigree_phenotypes

### 6.4 Key Initialization Flow

```rust
// src/db.rs (pseudocode)
fn init_db(app_data_dir: &Path, keystore: &KeyStore) -> Result<Connection, Error> {
    let db_path = app_data_dir.join("data.db");
    let exists = db_path.exists();
    
    let key = if exists {
        keystore.get("db_master_secret")?
    } else {
        let secret: [u8; 32] = rand::random();
        keystore.set("db_master_secret", &secret)?;
        secret.to_vec()
    };
    
    // Derive SQLCipher key using PBKDF2
    let device_id = get_device_id(); // from app_preferences or generated
    let derived_key = pbkdf2::derive(
        &key,
        device_id.as_bytes(), // salt
        256_000,              // iterations
        32,                   // key length (for PRAGMA key)
    );
    
    let conn = Connection::open(&db_path)?;
    conn.execute_batch(&format!(
        "PRAGMA key = \"x'{}'\";",
        hex::encode(&derived_key)
    ))?;
    
    if !exists {
        // Run migrations
        run_migrations(&conn)?;
    }
    
    Ok(conn)
}
```

---

## 7. Decision Summary

| Aspect | Decision |
|---|---|
| **Encryption mechanism** | SQLCipher (transparent AES-256-CBC page-level encryption) |
| **Key derivation** | PBKDF2-HMAC-SHA512 (256k iterations) from master secret stored in OS keychain |
| **Key storage** | OS-native keychain via `tauri-plugin-keystore` (Windows Credential Manager / macOS Keychain / Linux Secret Service) |
| **Primary storage engine** | Tauri Rust backend with `rusqlite` + SQLCipher feature (bundled compilation) |
| **Browser fallback** | `@sqlite.org/sqlcipher-wasm` + OPFS + passphrase-derived key |
| **ORM layer** | Drizzle ORM preserved for schema definitions and type generation; queries execute via Tauri commands (Rust) or direct WASM driver (browser) |
| **Synchronization** | Encrypted snapshot export/import (NOT CRDT) — full or diff packages with version vectors |
| **Collaboration** | Asynchronous share → review → return flow via zero-knowledge relay |
| **Migrations** | Rust-side `.sql` files run at startup; `drizzle-kit` config updated for dual dialect |
# ADR-001: Trust & Identity Model for Zero-Account Clinical Architecture

**Status:** Draft  
**Date:** 2026-05-03  
**Decider:** Phase 0-A Architectural Discovery  
**Supersedes:** Implicit traditional user-account model (existing `usersTable`)

---

## 1. Context

### 1.1 Problem Statement

The Pedigree PRO platform serves clinicians and genetic counselors in professional healthcare environments. The platform mandate is:

1. **Zero Mandatory Accounts:** No centralized user database, no passwords, no email verification, no auth SaaS dependency.
2. **Data Sovereignty:** Patient pedigree data remains on the clinician's device; no cloud database stores identifiable patient information.
3. **Colleague-to-Colleague Sharing:** Clinicians must be able to share pedigrees with colleagues for consultation, maintaining cryptographic integrity and access control.
4. **Audit Trail Integrity:** For clinical compliance, every mutation to a pedigree must be attributable to a verifiable actor — without a traditional user account.

### 1.2 Current State

The existing codebase models identity as:

| Table | Identity Column | Problem |
|---|---|---|
| `users` | `id` (serial), `email` (unique), `name`, `role`, `department` | Traditional account model with no auth mechanism; `email` uniqueness implies a registration workflow that doesn't exist |
| `patients` | `clinicianId` → `users.id` | Ties patient records to a user account |
| `pedigrees` | `createdById` → `users.id` | Ties pedigree provenance to a user account |
| `pedigree_versions` | `savedById` → `users.id` | Ties version history to a user account |
| `activity_log` | `userId` → `users.id` | Ties audit trail to a user account |
| `app_preferences` | `deviceId` (text PK) | ✅ **Already device-centric** — the correct pattern |

Additionally, the application has:
- **No authentication middleware** — all API routes are open
- Share token generation (`randomBytes(24).toString("hex")`) with no cryptographic binding
- Share tokens stored in plaintext in the database (`share_token` column)

### 1.3 Constraints

| Constraint | Impact |
|---|---|
| Clinical environments may use shared workstations | Device-identity alone is insufficient — multiple clinicians may use one machine |
| Air-gapped or restricted-network deployments | Cannot rely on internet connectivity for identity verification |
| HIPAA/GDPR compliance | Must support data access auditing, data erasure, and access control |
| Colleague-to-colleague sharing | Must support ad-hoc collaboration without pre-shared infrastructure |
| Tauri desktop as primary distribution | Can leverage native keychain (OS credential store) for key material |

---

## 2. Architectural Options Evaluated

### 2.1 Option A: Pure Device-as-Identity

**Mechanism:** On first launch, the Tauri app generates a hardware-bound Ed25519 keypair. The public key IS the device's identity. All provenance signatures use this keypair.

**Pros:**
- No accounts, no passwords, no cloud
- Strong cryptographic binding
- Simple implementation

**Cons:**
- **Does not support multi-clinician workstations** — a shared computer conflates all clinicians into one identity
- Device loss = identity loss (unless key is backed up — which introduces security risk)
- Cannot distinguish which clinician performed an action on a shared device

**Verdict:** ❌ **Rejected.** Insufficient for clinical environments with shared workstations.

### 2.2 Option B: Workspace/Context Identity (Filesystem ACL)

**Mechanism:** Identity is defined by filesystem access. A "workspace" is a directory containing the encrypted SQLite database. Whoever has OS-level read/write permission to that directory is authorized. No in-app identity concept exists.

**Pros:**
- Zero implementation overhead
- Leverages existing OS security infrastructure
- Natural fit for network-shared drives in hospital environments

**Cons:**
- No per-action provenance — all actions from a workspace are undifferentiated
- Cannot support granular audit trails ("who edited this node?")
- Sharing requires exporting/importing files manually — no secure token mechanism
- No way to revoke access to shared data short of file deletion

**Verdict:** ❌ **Rejected.** Insufficient audit granularity for clinical compliance.

### 2.3 Option C: Ephemeral Keypair + Local Encrypted Profile

**Mechanism:**
1. On the Tauri desktop app, a clinician creates a **local profile** — a display name, role label, and optional department. 
2. The app generates an Ed25519 keypair for that profile.
3. The private key is stored in the OS keychain (Windows Credential Manager / macOS Keychain / Linux Secret Service).
4. The public key is stored in the local SQLite database as the "creator identity."
5. All mutations (pedigree creation, version saves) are signed with the private key. The signature is stored alongside the data.
6. Multiple profiles can exist on one device — each with its own keypair.
7. **No profile data leaves the device.** The profile is purely local.

**Sharing Model:**
- When exporting a pedigree for a colleague, the sender's app encrypts the payload with the recipient's public key (libsodium `crypto_box_seal`).
- The encrypted blob is transmitted via the relay service or a file.
- The recipient decrypts with their private key.
- Share tokens evolve into **Capability URLs** — a one-time URL encoding an encrypted session key + relay endpoint. The relay never sees plaintext.

**Pros:**
- ✅ Zero centralized accounts
- ✅ Multi-clinician workstations supported (multiple local profiles)
- ✅ Cryptographic provenance (every save is signed)
- ✅ Share tokens can be end-to-end encrypted
- ✅ OS keychain provides hardware-level key protection where available
- ✅ Works fully offline

**Cons:**
- Profile portability: if a clinician moves to a new device, they need to export/import their keypair (or generate a new one — provenance chain breaks)
- Profile "trust" is self-asserted — a display name has no external verification (acceptable for niche professional environments where colleagues know each other)
- Slightly more complex key management UX than pure device-identity

**Verdict:** ✅ **Selected.** Best fit for the clinical niche, balancing cryptographic integrity with practical multi-user workstation support.

### 2.4 Option D: Invite-Linked Context (Pure Share Token)

**Mechanism:** The application has no identity concept at all. All collaboration happens via share tokens. A token is a self-contained encrypted capability — whoever holds the token can access the shared data. Provenance is derived from the token itself (token A was created by someone who held token B).

**Pros:**
- Simplest possible model
- Elegant for pure sharing use cases

**Cons:**
- No local provenance for the original creator — the first pedigree has no "creator"
- Token chain analysis for audit trails becomes complex and fragile
- Does not support the local workflow (creating pedigrees for yourself, not sharing them)

**Verdict:** ❌ **Rejected.** Fails the local-first use case where clinicians work privately.

---

## 3. Decision: Hybrid Model — Local Profiles + Encrypted Capability Sharing

The selected architecture combines **Option C (Local Encrypted Profiles)** for local identity with **encrypted capability-based sharing** evolved from the existing share token mechanism.

### 3.1 Identity Plane (Local)

```
┌─────────────────────────────────────────────────────┐
│                 Tauri Desktop App                     │
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │            Local Profile Manager                 │ │
│  │                                                  │ │
│  │  Profile: "Dr. Sarah Chen"                       │ │
│  │  Role: "Clinical Geneticist"                     │ │
│  │  Public Key: 6a2c...e4f1 (Ed25519)               │ │
│  │  Private Key: [in OS Keychain]                   │ │
│  │                                                  │ │
│  │  Profile: "Dr. James Okonkwo"                    │ │
│  │  Role: "Genetic Counselor"                       │ │
│  │  Public Key: b8d3...91a7 (Ed25519)               │ │
│  │  Private Key: [in OS Keychain]                   │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  Active Profile: "Dr. Sarah Chen"                     │
│  → All mutations signed with 6a2c...e4f1             │
└─────────────────────────────────────────────────────┘
```

**Profile Schema (in local SQLite):**
```sql
CREATE TABLE local_profiles (
  id            TEXT PRIMARY KEY,        -- UUID
  display_name  TEXT NOT NULL,           -- "Dr. Sarah Chen"
  role_label    TEXT NOT NULL DEFAULT '', -- "Clinical Geneticist"
  public_key    TEXT NOT NULL UNIQUE,    -- base64-encoded Ed25519 public key
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Key material is stored in the OS keychain, not in the database. The `local_profiles` table stores only the public key and display metadata.

### 3.2 Provenance Model (Schema Evolution)

The existing `createdById`/`savedById`/`userId` foreign keys to `users` are replaced with **public key fingerprints**:

| Old Column | New Approach |
|---|---|
| `pedigrees.createdById` → `users.id` | `pedigrees.creator_key` → `TEXT` (Ed25519 public key) + `pedigrees.creator_signature` → `TEXT` (signature over creation payload) |
| `pedigree_versions.savedById` → `users.id` | `pedigree_versions.saver_key` → `TEXT` + `pedigree_versions.saver_signature` → `TEXT` |
| `activity_log.userId` → `users.id` | `activity_log.actor_key` → `TEXT` + `activity_log.actor_signature` → `TEXT` |
| `patients.clinicianId` → `users.id` | `patients.clinician_key` → `TEXT` (nullable — clinician assignment is optional) |

**Signature Verification:**
Any consumer of the data can verify that a pedigree version was genuinely saved by the claimed keypair by checking `Ed25519.verify(payload, signature, public_key)`. This provides non-repudiable provenance without a central authority.

### 3.3 Encrypted Sharing (Capability URLs)

The existing share token mechanism evolves:

**Before (Current):**
```
Client → POST /pedigrees/:id/share → Server generates random hex token → stores in DB
Recipient → GET /share/:token → Server looks up token → returns pedigree
```
Problem: The server sees everything. The token is a bearer credential stored in plaintext.

**After (Proposed):**
```
Sender's App:
  1. Generates ephemeral symmetric key (XChaCha20-Poly1305)
  2. Encrypts pedigree data with symmetric key → ciphertext
  3. Encrypts symmetric key with recipient's public key → encrypted_key (libsodium crypto_box_seal)
  4. Posts ciphertext + encrypted_key to relay service → gets share_token
  5. Sends share_token URL to colleague (via email, chat, QR code, etc.)

Recipient's App:
  1. Opens share_token URL
  2. Fetches ciphertext + encrypted_key from relay
  3. Decrypts encrypted_key with own private key → symmetric key
  4. Decrypts ciphertext with symmetric key → pedigree data
  5. Imports into local database

Relay Service:
  - Stores ciphertext + encrypted_key, keyed by random token
  - CANNOT decrypt anything (doesn't have any private keys)
  - Token expires after first access OR after TTL (configurable, default 7 days)
  - After expiry/first-access, ciphertext is deleted
```

**Share Token URL format:**
```
https://relay.Pedigree PRO.app/s/Ab3Xk9... (short random token)
```
The URL encodes only the relay endpoint + token. The encrypted payload is fetched from the relay. The relay never possesses decryption keys.

### 3.4 Threat Model

| Threat | Mitigation |
|---|---|
| **Device theft / loss** | SQLite database encrypted with SQLCipher (password derived from OS keychain). Private keys in OS keychain are protected by OS login. Full-disk encryption recommended. |
| **Network eavesdropper** | All sharing payloads are end-to-end encrypted (libsodium sealed boxes). Relay sees only ciphertext. |
| **Malicious relay operator** | Zero-knowledge relay design — relay cannot decrypt payloads. Relay can deny service (availability threat) but cannot breach confidentiality. |
| **Unauthorized colleague access** | Share tokens are single-use or time-limited. Token holder needs the recipient's private key to decrypt — a stolen token URL is useless without the key. |
| **Profile impersonation** | Self-asserted display names can be spoofed. Mitigation: in niche professional environments, colleagues know each other. Future: optional Web of Trust (cross-signing of public keys by known colleagues). |
| **Key compromise** | Private keys are stored in OS keychain. Key rotation: generate new keypair; old signatures remain verifiable. Rotated key is noted in profile metadata. |
| **Audit subpoena** | All mutations are cryptographically signed. Signatures + public keys provide non-repudiable evidence of which profile performed which action. Timestamps + content hashes (SHA-256 of canvasData) provide tamper evidence. |
| **Ransomware encrypting local DB** | SQLite file should be backed up. Recommend automated encrypted backups to a network share or external drive. |

---

## 4. Schema Transition Plan

### 4.1 Phase 0-A Schema Changes (Proposed)

The `users` table is **deprecated** (not yet dropped — allows migration window):

```sql
-- NEW: Local profiles (never synced, device-only)
CREATE TABLE local_profiles (
  id            TEXT PRIMARY KEY,
  display_name  TEXT NOT NULL,
  role_label    TEXT NOT NULL DEFAULT '',
  public_key    TEXT NOT NULL UNIQUE,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- MODIFIED: patients
ALTER TABLE patients ADD COLUMN clinician_key TEXT;  -- replaces clinicianId

-- MODIFIED: pedigrees
ALTER TABLE pedigrees ADD COLUMN creator_key TEXT;      -- replaces createdById
ALTER TABLE pedigrees ADD COLUMN creator_signature TEXT;
ALTER TABLE pedigrees ADD COLUMN canvas_hash TEXT;      -- SHA-256 of canvasData (tamper evidence)

-- MODIFIED: pedigree_versions
ALTER TABLE pedigree_versions ADD COLUMN saver_key TEXT;      -- replaces savedById
ALTER TABLE pedigree_versions ADD COLUMN saver_signature TEXT;
ALTER TABLE pedigree_versions ADD COLUMN canvas_hash TEXT;    -- SHA-256 of canvasData

-- MODIFIED: activity_log
ALTER TABLE activity_log ADD COLUMN actor_key TEXT;           -- replaces userId
ALTER TABLE activity_log ADD COLUMN actor_signature TEXT;

-- MODIFIED: share tokens (remove plaintext token from DB)
-- Share tokens move to the relay service. Local DB no longer stores share_token.
-- The share_token column in pedigrees is deprecated.
```

### 4.2 Migration Strategy

1. **Add new columns alongside old ones** — dual-write during transition
2. **Populate new columns** for existing data (use a "migration profile" key for historical records where the original creator is unknown)
3. **Update application code** to read from new columns, fall back to old
4. **Remove old columns and `users` table** in a subsequent phase

---

## 5. Open Questions & Future Work

| Question | Resolution Plan |
|---|---|
| **Profile portability:** How does a clinician move their profile to a new device? | Phase 0-D: Design encrypted profile export (private key wrapped in a passphrase-derived key, exported as a file/QR code) |
| **Cross-signing for trust:** How do we prevent display name spoofing? | Phase 1+: Optional Web of Trust — clinicians can sign each other's public keys in-person (QR code exchange), building a local trust graph |
| **Multi-device sync:** Clinician uses desktop + laptop? | Phase 0-C: Evaluate CRDT-based sync between devices owned by the same profile, encrypted with the profile's keypair |
| **Institutional deployment:** Hospital wants centralized audit? | Phase 0-D: "Server Mode" preserves current API server; public keys are registered with the institutional server; signatures are verified server-side |
| **Regulatory certification:** HIPAA compliance audit? | Phase 0-D: Map each trust mechanism to HIPAA Technical Safeguards (§164.312) |

---

## 6. Decision Summary

| Aspect | Decision |
|---|---|
| **Identity Model** | Local encrypted profiles with Ed25519 keypairs (not centralized accounts) |
| **Key Storage** | OS-native keychain (Windows Credential Manager / macOS Keychain / Linux Secret Service via Tauri plugin) |
| **Provenance** | Cryptographic signatures on all mutations; public key stored as creator/saver identity |
| **Sharing** | End-to-end encrypted capability URLs via zero-knowledge relay (Cloudflare Workers) |
| **Database Encryption** | SQLCipher for local SQLite (Phase 0-C) |
| **Share Token Storage** | Moved from local DB to relay service; tokens are single-use or TTL-bound; server never sees plaintext |
| **Users Table** | Deprecated — replaced by `local_profiles` (device-only) and public key references in entity tables |
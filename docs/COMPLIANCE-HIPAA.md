# HIPAA Technical Safeguards — Pedigree PRO Compliance Mapping

**Document Version:** 1.0  
**Date:** 2026-05-03  
**Status:** Phase 1  
**References:** ADR-001, ADR-003, ADR-004

---

## 1. Scope

Pedigree PRO is designed as a **medical device component** for clinical genetics workflows (pedigree visualization and risk calculation). While not a Covered Entity itself, it must demonstrate HIPAA Technical Safeguards (§164.312) for institutions that deploy it with Protected Health Information (PHI).

---

## 2. Access Control (§164.312(a)(1))

| Requirement | Implementation | Evidence |
|---|---|---|
| Unique user identification | Ed25519 keypair per local profile provides cryptographic unique identification | `local_profiles` table: UUID + Ed25519 public key (ADR-001 §3.1) |
| Emergency access procedure | Database encrypted with SQLCipher; master secret in OS keychain accessible via OS login | `db.rs` §key derivation |
| Automatic logoff | No persistent sessions; database connection closes when app exits; key material evicted from memory | Tauri lifecycle: connection dropped on exit |

---

## 3. Audit Controls (§164.312(b))

| Requirement | Implementation | Evidence |
|---|---|---|
| Record and examine PHI activity | `activity_log` table with cryptographic signatures on every mutation | ADR-002 §2.1.5: `actor_key`, `actor_signature`, `action`, `subject`, `timestamp` |
| Tamper evidence | `canvas_hash` (SHA-256) on every pedigree version; Ed25519 signatures verify provenance | `signatures.rs`: `hash_sha256()`, `verify()` |
| Audit export | `.ppro` format exports full pedigree with version history and provenance | `export.rs`: `export_pedigree_hpcl()` |

---

## 4. Integrity (§164.312(c)(1))

| Requirement | Implementation | Evidence |
|---|---|---|
| Protect PHI from improper alteration | Per-page HMAC-SHA1 via SQLCipher; `canvas_hash` on every pedigree version | ADR-003 §3.3 |
| Signature verification | Ed25519 signatures on all mutations verifiable by any consumer | `signatures.rs`: `verify()` |
| Content hashing | SHA-256 of `canvas_data` stored as `canvas_hash`; verified on read | `commands.rs`: `create_pedigree()`, `save_version()` |

---

## 5. Person or Entity Authentication (§164.312(d))

| Requirement | Implementation | Evidence |
|---|---|---|
| Verify entity seeking access | Zero-knowledge relay: recipient must possess private key to decrypt shared data | ADR-001 §3.3: Encrypted Capability URLs |
| Server Mode auth | TLS client certificates + Ed25519 signature verification | ADR-004 §2.3 |

---

## 6. Transmission Security (§164.312(e)(1))

| Requirement | Implementation | Evidence |
|---|---|---|
| Guard against unauthorized access during transmission | All sharing payloads end-to-end encrypted (libsodium sealed boxes) | `relay.rs`: relay sees only ciphertext |
| TLS for relay | Cloudflare Workers default TLS 1.3 | `services/relay/src/index.ts` |
| Server Mode | TLS 1.3 with mutual auth (client certificates) | ADR-004 §2.3 |

---

## 7. Encryption at Rest (§164.312(a)(2)(iv))

| Requirement | Implementation | Evidence |
|---|---|---|
| Encrypt PHI at rest | SQLCipher AES-256-CBC with HMAC-SHA1 page-level integrity | `db.rs`: `PRAGMA key` |
| Key derivation | PBKDF2-HMAC-SHA512 (256,000 iterations) from OS keychain master secret | `db.rs` §PBKDF2 |
| Key storage | OS-native keychain via `tauri-plugin-keystore` | `db.rs` §get_or_create_master_secret |
| Key rotation | `PRAGMA rekey` via `rotate_encryption_key()` | `db.rs` §rotate_encryption_key |

---

## 8. Data Backup & Disaster Recovery

| Requirement | Implementation |
|---|---|
| Encrypted backup | `backup_database()` copies SQLCipher database to timestamped file in `backups/` directory |
| Restore procedure | `restore_database()` creates safety backup before overwriting current database |
| Offsite backup | Clinician-managed: copy backup files to network share or encrypted removable media |

---

## 9. Audit Log Reference

All HIPAA-relevant events are recorded in `activity_log`:

| Event | Action | Evidence |
|---|---|---|
| Pedigree created | `created` | `creator_key`, `creator_signature`, `canvas_hash` |
| Pedigree updated | `updated` | `actor_key`, timestamp |
| Pedigree deleted | `deleted` | Subject title preserved |
| Version saved | `save_version` | `saver_key`, `saver_signature`, `canvas_hash` |
| Profile created | `profile_created` | `public_key` (actor) |
| Profile deleted | `profile_deleted` | Display name preserved |
| Import (native) | `imported` | Source filename |
| Import (legacy) | `legacy_import` | Record counts, migration profile key |
| Key rotated | `key_rotated` | Timestamp |

---

## 10. Breach Notification Readiness

- Database is encrypted at rest → lost/stolen device does not expose PHI
- Sharing payloads are end-to-end encrypted → relay compromise does not expose PHI
- Audit log enables identification of affected records
- Export format (.ppro) enables patient data access requests
- `DELETE` + `VACUUM` enables right to erasure
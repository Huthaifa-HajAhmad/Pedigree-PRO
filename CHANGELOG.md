# Changelog

All notable changes to the Pedigree PRO project.

## [1.2.5] — 2026-06-15

### Added
- **Genotype Customization Support**: Canvas support for rendering genotypes dynamically below pedigree nodes. Added settings for genotype font size (8px–24px), symbol offset, and colors for mutant (+), wild-type (-), and separator (/) symbols.
- **Segmented Panel Controls**: Replaced traditional radio buttons with interactive segmented button selectors with custom icons for Gender and Affection Status in both Properties Panel and Node Quick-Edit Popover.
- **Interactive Feature Tour**: Added onboarding feature tour modal (`FeatureTourModal`) highlighting offline privacy, rapid shortcuts, genotype customization, risk calculation, and peer-to-peer sharing.
- **Canvas Layout Integration**: Relocated the pedigree `TabBar` inside the canvas container for a cleaner view and updated overlays like the Minimap to align correctly with collapsible side panels.
- **Theme-Adaptive Inputs**: Configured dynamic theme loaders to add/remove the `.dark` class to `document.documentElement` for Tailwind-like styling, and custom styled all range inputs across light, dark, and specialized themes.
- **Skeuomorphic Planner Tab Design**: Redesigned the tab bar and canvas page with a cream paper texture and stacked index-tab aesthetic; tab visuals now use 3D gradients with a white background, no dividing border, scaled-up sizing, lightened inactive tint, and aligned corner radii for a cohesive planner look.

## [1.2.2] — 2026-06-13

### Added
- **Cross-Platform macOS Build**: Full support for macOS builds, WebView2 zoom reset guards, platform-specific compilation, and cross-platform home directory configuration.
- **Pedigree Wizard**: Added a guided step-by-step pedigree creation wizard dialog.
- **Onboarding Setup Screen**: Wired a setup screen showing configuration options for new profiles instead of a blank canvas.
- **Profile deletion safety checks**: Included key revocation warning notifications and dialogs when deleting profiles.
- **Layout Adjustments**: Added the `evenOutSiblingSpacing` layout arranging algorithm and spouse placement optimizations.

## [1.2.0] — 2026-06-08

### Added
- **Unified Sidebar**: Consolidated version timeline scrubber and session history list into a single vertical panel.
- **Visual Diff Engine**: Added visual delta highlighting for node/edge additions, deletions, and updates on the canvas.
- **Minimap Enhancements**: Re-rendered canvas bounds correctly and clipped minimap overflow.

## [1.1.0] — 2026-05-24

### Added
- **Accessibility Benchmarks**: Implemented axe-core automated accessibility tests, context menu keyboard navigation controls, focus traps, and semantic ARIA labeling.

---

## [0.1.0] — 2026-05-03 (Phase 0–1 Complete)

### Added

#### Trust & Identity (ADR-001)
- Local encrypted profiles with Ed25519 keypairs replacing centralized `users` table
- OS-native keychain integration via `tauri-plugin-keystore`
- Cryptographic provenance: all mutations signed with profile private key
- Zero-knowledge relay for encrypted colleague-to-colleague sharing

#### Schema Re-engineering (ADR-002)
- Dual-column migration strategy: old `*ById` + new `*_key` / `*_signature` columns
- Content integrity: SHA-256 `canvas_hash` on all pedigree versions
- Clinical annotation extension: `pedigree_node_annotations`, `pedigree_phenotypes`
- Deprecated `users` table, `share_token` column, legacy `*ById` FKs

#### Database Encryption (ADR-003)
- SQLCipher AES-256-CBC with HMAC-SHA1 page-level integrity
- PBKDF2-HMAC-SHA512 key derivation (256,000 iterations)
- Migration version tracking (`_migrations` table)
- Persistent device UUID in `app_preferences`
- Key rotation via `PRAGMA rekey`
- Database backup/restore with safety backups

#### Infrastructure & Distribution (ADR-004)
- Tauri desktop application (Windows, macOS, Linux)
- Cloudflare Workers zero-knowledge relay (free tier)
- `.ppro` export format with cryptographic provenance
- GitHub Actions CI/CD for multi-platform builds

#### Rust Backend (37 Tauri Commands)
- Full CRUD: profiles, patients, pedigrees, versions
- Dashboard stats + recent activity with computed `node_count`
- Encrypted export/import (.ppro + legacy .db)
- Async relay client (HTTP POST/GET/DELETE)
- Database management: backup, restore, key rotation
- Activity logging for all mutations (profile create/switch/delete, pedigree CRUD)

#### Two-Path Import Architecture
- **Path A (Native):** `.ppro` import with Ed25519 signature verification
- **Path B (Legacy):** Legacy SQLite migration with dual-write, user name preservation, content hashing

#### Frontend (React + TypeScript)
- Unified API adapter (Tauri `invoke()` vs web `fetch()` mode detection)
- 27 adapter-based React Query hooks with auto-invalidation
- Profile Manager page (create/list/delete local profiles)
- Dashboard with adapter hooks, activity log, profile count
- Import Dialog supporting three modes: PED/CSV, Pedigree PRO .ppro, legacy .db
- Share Modal with zero-knowledge relay integration
- Navigation updated: Profiles replaces deprecated Users

#### Crypto Library
- Ed25519 key generation, signing, verification (`@noble/ed25519`)
- SHA-256 content hashing (`@noble/hashes`)
- AES-256-GCM symmetric encryption (Web Crypto API)
- PBKDF2 key derivation for browser mode
- Renamed functions with deprecation aliases
- Documented sealed box interop gap

#### Compliance
- HIPAA Technical Safeguards mapping (COMPLIANCE-HIPAA.md)
- GDPR data minimization by design
- Zero-cost infrastructure ($0/month within free tiers)

### Changed
- `export.rs`: Split into export-only module; import logic moved to `import_native.rs` and `import_legacy.rs`
- `commands.rs`: Complete rewrite with signatures, node_count, activity logging, DB management
- `db.rs`: True PBKDF2, verified keystore writes, migration tracking, backup/restore/rotation
- `lib/crypto/src/index.ts`: Renamed `sealData` → `encryptAesGcm`, added deprecation aliases
- `Layout.tsx`: Profiles nav replaces Users
- `App.tsx`: `/profiles` route replaces `/users`

### Deprecated
- `users` table and `/users` route (kept for migration window)
- `share_token` column in `pedigrees` table (moved to relay)
- Legacy `*ById` columns (dual-write preserved until Phase 0-D cleanup)
- `sealData`, `unsealData`, `sealForRecipient`, `unsealFromSender` TS functions (aliases preserved)

### Remaining (Deferred to Phase 1+)
- Client-side libsodium sealed box encryption for sharing (TS ↔ Rust sealed box interop)
- Profile switcher UI component (active profile indicator in sidebar)
- Rust compilation verification (requires Tauri SDK toolchain)
- Integration and E2E tests
- Pedigree editor pages migration to adapter hooks (existing generated hooks still functional)
# HaploClinical — Infrastructure & Zero-Cost Deployment Roadmap

**Document Version:** 1.0  
**Date:** 2026-05-03  
**Status:** Draft — Phase 0-0 Deliverable  

---

## 1. Platform Decontamination (Phase 0-0.1 — Complete)

All Replit-specific deployment artifacts have been removed from the repository.

### Removed Artifacts

| Artifact | Type | Disposition |
|---|---|---|
| `artifacts/api-server/.replit-artifact/artifact.toml` | Replit API service config (port 8080, health check `/api/healthz`) | ✅ Deleted |
| `artifacts/haplopainter/.replit-artifact/artifact.toml` | Replit web service config (port 23977, React/Vite skill) | ✅ Deleted |
| `artifacts/mockup-sandbox/.replit-artifact/artifact.toml` | Replit design preview config (port 8081, `/__mockup`) | ✅ Deleted |
| `.replit` | Replit workspace config (empty) | ✅ Deleted |
| `.replitignore` | Replit deploy ignore filter | ✅ Deleted |
| `replit.md` | Replit documentation placeholder (empty) | ✅ Deleted |
| `.kilo/plans/` | Replit Agent planning metadata | ✅ Deleted |

### Retained (Platform-Agnostic)

| Artifact | Rationale |
|---|---|
| `scripts/post-merge.sh` / `.cmd` / `.ps1` / `.js` | Generic `pnpm install --frozen-lockfile` + `pnpm --filter db push` — no Replit coupling. Shell scripts are idiomatically named and useful for any Git hosting. |
| `@vercel/sqlite` dependency | This is Vercel's WASM SQLite driver, not Replit-specific. It enables zero-config SQLite in browser/server environments. Keep as primary driver with `better-sqlite3` as fallback. |
| Git history | Commit author emails (`@users.noreply.replit.com`) and `Replit-Commit-*` trailers remain in history. These are cosmetic and have zero runtime impact. No rebase needed unless public repository history grooming is desired. |

### Preventative Measure

`.gitignore` updated to permanently exclude Replit artifacts (`.kilo/`, `.replit`, `.replitignore`, `replit.md`, `**/.replit-artifact/`).

---

## 2. Environment Variable Audit (Phase 0-0.2 — Complete)

Every `process.env` access across the codebase was catalogued. **Zero Replit-specific runtime variables exist.** All are standard, platform-agnostic identifiers.

| Variable | Used In | Purpose | Required? | Post-Replit Fate |
|---|---|---|---|---|
| `DATABASE_URL` | `lib/db/src/index.ts`, `lib/db/drizzle.config.ts`, `scripts/init-sqlite.js`, `scripts/init-sqlite-async.mjs`, `scripts/post-merge.js` | Connection string for Postgres or `sqlite:./data/db.sqlite` for local mode | Yes | **Keep** — dual-mode DB switching is a core architectural feature |
| `PORT` | `artifacts/api-server/`, `artifacts/haplopainter/vite.config.ts`, `artifacts/mockup-sandbox/vite.config.ts` | API server port (default 3000), Vite dev server port | Optional | **Keep** — standard Node.js/web convention |
| `BASE_PATH` | `artifacts/haplopainter/vite.config.ts`, `artifacts/mockup-sandbox/vite.config.ts` | URL base path for deployed static assets | Optional | **Keep** — standard Vite deployment variable |
| `NODE_ENV` | `artifacts/api-server/src/lib/logger.ts`, `.replit-artifact` (removed) | "production" mode flag | Optional | **Keep** — standard Node.js convention |
| `LOG_LEVEL` | `artifacts/api-server/src/lib/logger.ts` | Pino logger level (default: "info") | Optional | **Keep** — standard observability |
| `SQLITE_FILE` | `lib/db/src/sqlite-adapter.ts`, `scripts/init-sqlite.js`, `scripts/init-sqlite-async.mjs` | Alternative SQLite file path (fallback when DATABASE_URL doesn't use sqlite: prefix) | Optional | **Keep** — useful for custom DB locations |
| `DB_CLIENT` | `scripts/post-merge.js` | Explicit driver selection (`sqlite` vs. `pg`), overrides DATABASE_URL prefix detection | Optional | **Keep** — useful for CI/CD clarity |
| `npm_config_user_agent` | `scripts/preinstall.js` | Enforces pnpm as the package manager | Build-time | **Keep** — standard npm config, not Replit-specific |

### Key Finding

The `.env.example` file is clean:

```
DATABASE_URL=sqlite:./data/db.sqlite
PORT=3000
```

No Replit-injected variables (e.g., `REPLIT_DB_URL`, `REPL_ID`, `REPL_SLUG`) are referenced anywhere in source code. The codebase has **zero runtime dependency on Replit infrastructure.**

---

## 3. Zero-Cost Infrastructure Roadmap (Phase 0-0.3)

### 3.1 Guiding Principles

1. **Local-First by Default:** The application runs entirely on a clinician's workstation. No cloud server is required for core functionality.
2. **Zero Mandatory Accounts:** No centralized user database. Identity is device-bound or ephemeral-token-based.
3. **Encrypted Data-at-Rest:** The local SQLite database is encrypted (SQLCipher or application-layer via libsodium).
4. **Optional Peer-to-Peer Sharing:** Colleague collaboration uses encrypted export/import or an encrypted relay — never plaintext on a server.
5. **Free Tier Only:** Any external service used must operate within a free tier (Cloudflare Workers, GitHub Pages, Fly.io free allowance, etc.).

### 3.2 Primary Distribution: Tauri Desktop Application

```
┌──────────────────────────────────────────────────────────┐
│                    Tauri Desktop App                      │
│                                                          │
│  ┌──────────────────────┐  ┌──────────────────────────┐ │
│  │   Frontend (React)   │  │    Rust Backend           │ │
│  │   Vite + Tailwind    │  │    (actix-web / axum)     │ │
│  │                      │  │                           │ │
│  │   Pedigree Canvas    │  │  REST API (localhost)     │ │
│  │   Validation Engine  │  │  SQLite via rusqlite      │ │
│  │   Risk Calculator    │  │  SQLCipher encryption     │ │
│  │   Export/Import      │  │  Device identity mgmt     │ │
│  │   Theme System       │  │  Encrypted export/import  │ │
│  └──────────────────────┘  └──────────────────────────┘ │
│                                                          │
│                   Local SQLite File                      │
│              Encrypted with SQLCipher                    │
│              ~/.haploclinical/data.db                    │
└──────────────────────────────────────────────────────────┘
```

**Cost:** $0/month  
**Platforms:** Windows (.msi), macOS (.dmg), Linux (.AppImage/.deb)  
**Rationale:** Tauri is the ideal vehicle for local-first clinical software. It bundles a Rust backend with the React frontend, giving direct filesystem access for SQLite, and supports auto-updates. No cloud server, no hosting costs, no database-as-a-service.

### 3.3 Secondary Distribution: Static Web Frontend (Browser-Only Mode)

For environments where desktop installation is blocked (locked-down hospital workstations, shared terminals), a browser-only mode using SQLite via WASM + Origin Private File System (OPFS):

```
┌──────────────────────────────────────────────────────────┐
│              Browser (WASM SQLite Mode)                   │
│                                                          │
│  ┌──────────────────────────────────────────────────────┐│
│  │  React + Vite SPA (Static Files)                     ││
│  │  @vercel/sqlite (WASM) + OPFS persistence            ││
│  │  libsodium.js for encryption                         ││
│  │  All logic runs client-side                          ││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  Hosted on: GitHub Pages or Cloudflare Pages (Free Tier) │
│  Cost: $0/month                                          │
└──────────────────────────────────────────────────────────┘
```

**Cost:** $0/month  
**Limitations:** No native filesystem access; sharing requires the relay service.  
**Use Case:** Quick access / demo mode / locked-down workstations.

### 3.4 Peer-to-Peer Sharing: Encrypted Relay Service

For colleague-to-colleague sharing without a central server:

```
┌──────────────┐                              ┌──────────────┐
│  Clinician A  │                              │  Clinician B  │
│  (Tauri App)  │                              │  (Tauri App)  │
│               │                              │               │
│  1. Exports   │                              │  5. Decrypts  │
│     pedigree  │                              │     & imports │
│     ┌───┐     │                              │     ┌───┐     │
│     │🔒 │────>│  2. Encrypted blob           │────>│🔓 │     │
│     └───┘     │     via relay                │     └───┘     │
│               │                              │               │
└───────────────┘                              └───────────────┘
                         │
                    ┌────┴────┐
                    │  Relay   │
                    │ (Cloudflare
                    │  Workers)
                    │          │
                    │ Sees only│
                    │ encrypted│
                    │ blobs    │
                    └─────────┘
```

**Relay Service:** Cloudflare Workers (free tier: 100,000 requests/day)  
**Cost:** $0/month  
**Encryption:** libsodium sealed boxes (public-key authenticated encryption). The relay never possesses the private keys and cannot decrypt payloads.  
**Discovery:** Share tokens are short, one-time-use URLs generated by the sender. The token encodes the relay endpoint + encrypted session key.  
**Alternative:** If a relay is undesirable, direct WebRTC peer-to-peer (via STUN/TURN) eliminates the relay entirely — but requires both clinicians to be online simultaneously.

### 3.5 Cost Analysis Matrix

| Component | Service | Free Tier Limit | Projected Usage | Cost |
|---|---|---|---|---|
| **Desktop App Distribution** | GitHub Releases | Unlimited | N/A | $0 |
| **Static Web Frontend** | Cloudflare Pages / GitHub Pages | Unlimited bandwidth (CF) / 100 GB/mo (GH) | < 10 GB/mo | $0 |
| **Relay Service** | Cloudflare Workers | 100,000 req/day, 10 ms CPU/req | < 1,000 req/day | $0 |
| **STUN/TURN (WebRTC)** | Google STUN (free) + Metered TURN (free tier) | 50 GB/mo | < 1 GB/mo | $0 |
| **Auto-Update Server** | GitHub Releases API | 5,000 req/hr (unauthenticated) | < 100 req/hr | $0 |
| **Database** | SQLite (local) | N/A (local filesystem) | N/A | $0 |
| **Authentication** | None (Zero-Account) | N/A | N/A | $0 |
| **Monitoring/Observability** | Console logs only (local) | N/A | N/A | $0 |
| **CI/CD** | GitHub Actions | 2,000 min/mo (free) | ~500 min/mo | $0 |

**Total Monthly Infrastructure Cost: $0.00**

### 3.6 What We Explicitly Do NOT Use

| Service | Why Avoided |
|---|---|
| **Supabase / Firebase / Auth0** | Centralized auth contradicts the Zero-Account mandate |
| **Neon / Turso / PlanetScale** | Cloud databases centralize patient data — violates local-first privacy model |
| **Vercel / Netlify Serverless Functions** | Requires a server-side execution environment; Tauri + local Rust backend is superior for local-first |
| **AWS / GCP / Azure** | Enterprise cloud is unnecessary overhead for a desktop application with optional encrypted relay |
| **Sentry / Datadog / LogRocket** | Telemetry SaaS raises privacy concerns for clinical software; local-only logging suffices |

### 3.7 Distribution Summary

```
Primary:   Tauri Desktop App (.msi / .dmg / .AppImage)
           └─ Rust backend + SQLite + SQLCipher
           └─ React/Vite frontend
           └─ Auto-update via GitHub Releases
           └─ Cost: $0

Secondary: Static Web App (GitHub Pages / Cloudflare Pages)
           └─ WASM SQLite + OPFS + libsodium.js
           └─ Cost: $0

Sharing:   Encrypted Relay (Cloudflare Workers)
           └─ libsodium sealed boxes
           └─ OR WebRTC peer-to-peer (no relay)
           └─ Cost: $0
```

---

## 4. Next Steps

| Phase | Description | Depends On |
|---|---|---|
| **0-A** | Trust Model Design (Device Identity, Encryption Strategy, Threat Model ADR) | Phase 0-0 (complete) |
| **0-B** | Pedigree Schema Re-engineering (remove user coupling, add content hashing) | Phase 0-A decisions |
| **0-C** | Database Strategy Finalization (SQLCipher integration, CRDT feasibility) | Phase 0-A decisions |
| **0-D** | Tauri Architecture Blueprint & Compliance Framework | Phase 0-C decisions |
| **0-E** | Implementation Execution | All prior phases |
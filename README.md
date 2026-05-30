<div align="center">

# Pedigree PRO

**Zero-server clinical pedigree editor**

[![Release](https://img.shields.io/github/v/release/Huthaifa-HajAhmad/Pedigree-PRO?include_prereleases&label=beta)](https://github.com/Huthaifa-HajAhmad/Pedigree-PRO/releases)
[![License](https://img.shields.io/badge/license-Proprietary-blue)](LICENSE)

A privacy-first pedigree drawing tool for clinical geneticists. No cloud. No accounts. No data leaves your device.

[Download Beta](#installation) · [Features](#features) · [Architecture](#architecture) · [Development](#development)

</div>

---

## Features

### Pedigree Canvas
- Interactive pedigree editor with drag-and-drop, auto-layout, and snap guides
- Standard genetic nomenclature: male/female/unknown symbols, twins, consanguinity, adoption
- Sibship groups, relationship lines, and annotation overlays
- Context menu with keyboard navigation for quick node operations
- Minimap, find bar, and zoom controls for large pedigrees
- Version history with thumbnail previews (virtualized for 50+ versions)

### Clinical Annotations
- HPO terms, OMIM IDs, variant HGVS notation per node
- Phenotype tracking with inheritance mode
- Affected/carrier status indicators
- Risk calculator panel

### Privacy & Compliance
- **Zero-server architecture** — no cloud, no accounts, no telemetry
- **Encrypted at rest** — AES-256-GCM (browser) or SQLCipher (desktop)
- **HIPAA-aligned** — no third-party services, keys stored in IndexedDB (never localStorage)
- Self-hosted fonts — no Google Fonts CDN calls (IP leak prevention)

### Sharing & Collaboration
- **WebRTC peer-to-peer** — share pedigrees directly over your LAN, no signaling server
- **Hybrid encryption** — Ed25519 keypairs + AES-GCM envelopes per recipient
- **Relay share** — encrypted blob relay for out-of-network sharing (tokens auto-expire)
- Share log for HIPAA audit trail

### Export
- PDF, PNG, PowerPoint (PPTX), and native `.ppro` format
- Professional export themes (clinical, dark, high-contrast)
- Clipboard copy for paste-into-EMR workflows

### Multi-Profile
- Multiple clinician profiles on one device
- Ed25519 keypair per profile for signing and encryption
- Profile selection on startup

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React + Vite Frontend                │
│            (artifacts/ppro — unified codebase)          │
├──────────────────────┬──────────────────────────────────┤
│   Tauri Desktop      │       Browser Standalone          │
│   ┌──────────────┐   │   ┌───────────────────────────┐  │
│   │  Rust IPC    │   │   │  sql.js WASM (IndexedDB)  │  │
│   │  SQLCipher   │   │   │  Web Crypto API           │  │
│   │  (filesystem)│   │   │  (browser storage)        │  │
│   └──────────────┘   │   └───────────────────────────┘  │
└──────────────────────┴──────────────────────────────────┘
```

The frontend uses a **unified adapter** (`lib/api-client-react/src/adapter.ts`) that detects the runtime at launch:
- `window.__TAURI__` present → Tauri IPC (`invoke`) → Rust backend → SQLCipher on disk
- Otherwise → lazy-loads `@workspace/browser-backend` → sql.js WASM → IndexedDB + Web Crypto

**No REST API. No Postgres. No internet required.**

### Key Packages

| Package | Role |
|---|---|
| `artifacts/ppro` | React + Vite frontend (canvas, dashboard, patients, profiles) |
| `lib/api-client-react` | Unified adapter + React Query hooks + direct API functions |
| `lib/browser-backend` | sql.js WASM SQLite, IndexedDB persistence, Web Crypto, TypeScript command port |
| `lib/crypto` | Shared Ed25519, SHA-256, AES-GCM, libsodium sealed-box primitives |
| `lib/db` | Drizzle schemas + SQLite migrations |

---

## Installation

### Windows (Beta)

| Installer | Download |
|---|---|
| **MSI** (enterprise) | [`Pedigree PRO_1.0.0-1_x64_en-US.msi`](https://github.com/Huthaifa-HajAhmad/Pedigree-PRO/releases/download/v1.0.0-1/Pedigree.PRO_1.0.0-1_x64_en-US.msi) |
| **NSIS** (standard) | [`Pedigree PRO_1.0.0-1_x64-setup.exe`](https://github.com/Huthaifa-HajAhmad/Pedigree-PRO/releases/download/v1.0.0-1/Pedigree.PRO_1.0.0-1_x64-setup.exe) |

### Browser Mode

Open `index.html` from the built `dist/public/` directory, or serve it locally:

```bash
pnpm --filter @workspace/ppro run dev
# → http://localhost:4173
```

---

## Development

### Prerequisites

- **Node.js** 18+ and **pnpm**
- **Rust toolchain** (Tauri desktop builds only)
- **VS Build Tools 2022** + **OpenSSL** (Windows, Tauri builds only)

### Setup

```bash
# Install dependencies (bypasses preinstall guard)
pnpm install --ignore-scripts

# Build workspace libraries
pnpm -r --if-present run build

# Start frontend dev server (browser mode)
pnpm --filter @workspace/ppro run dev
```

### Typecheck & Test

```bash
pnpm run typecheck
pnpm --filter @workspace/ppro run test
```

### Build Tauri Desktop

```powershell
# Set OpenSSL environment (Windows)
$env:OPENSSL_DIR = "C:\path\to\vcpkg\installed\x64-windows-static"
$env:OPENSSL_STATIC = "1"
$env:VCPKGRS_DYNAMIC = "0"

# Build MSI + NSIS
cd artifacts/ppro
cargo tauri build
```

### Frontend-Only Build

```bash
npx vite build --config artifacts/ppro/vite.config.ts
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 7, Tailwind CSS 4, Radix UI |
| State | React Query, React Hook Form, Zod |
| Canvas | Custom SVG pedigree engine, html2canvas |
| Desktop | Tauri 2, Rust, SQLCipher |
| Browser | sql.js (WASM SQLite), IndexedDB, Web Crypto API |
| Crypto | Ed25519 (@noble/ed25519), AES-256-GCM, PBKDF2 |
| Export | jsPDF, pptxgenjs, DOMPurify |

---

## Security Model

### Encryption at Rest
- **Browser**: Database blob encrypted with AES-256-GCM before writing to IndexedDB. Key wrapped with a second AES key. Optional passphrase via PBKDF2-HMAC-SHA512 (256k iterations).
- **Desktop**: SQLCipher database file on disk.

### Profile Keys
- Ed25519 keypairs generated in-browser via `@noble/ed25519`
- Private keys stored exclusively in IndexedDB via `idb-keyval`
- **Never stored in localStorage** (XSS-vulnerable)

### Data Privacy
- No server. No cloud sync. All data stays on the local device.
- WebRTC LAN sharing is direct peer-to-peer; no signaling server, no data leaves the local network.

---

## License

Proprietary. All rights reserved.

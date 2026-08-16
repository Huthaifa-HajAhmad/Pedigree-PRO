# Contributing to Pedigree PRO

Thank you for your interest in contributing to **Pedigree PRO**! We welcome contributions from software engineers, UI/UX designers, geneticists, genetic counselors, and medical researchers.

Pedigree PRO is an open-source, local-first clinical pedigree drawing tool designed for high security, offline reliability, and clinical utility.

---

## Code of Conduct

All contributors and participants are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md). Please report unacceptable behavior following the guidelines in that document.

---

## Architectural Principles & Requirements

Before writing code, please review our core architectural rules:

### 1. Dual-Build Parity Mandate (Strict)
Pedigree PRO operates in two runtime modes from a unified codebase:
1. **Tauri Desktop (`tauri`)**: Rust backend + SQLCipher SQLite on the local filesystem.
2. **Browser Standalone (`browser`)**: sql.js WASM SQLite + IndexedDB persistence + Web Crypto API.

**Every feature, bug fix, or code change in `artifacts/ppro/src/` or `lib/` MUST be implemented and verified for BOTH modes.**
* If adding a new backend operation, update both `lib/browser-backend/src/commands/` and `artifacts/ppro/src-tauri/src/commands.rs`.
* Register the command in `BrowserCommandName` / `CommandMap` in `lib/api-client-react/src/adapter.ts`.
* Handle both the browser download (Blob/URL) path and native desktop file dialogs.

### 2. Zero-Server / Local-First Privacy
* **Never store cryptographic private keys in `localStorage`** (vulnerable to XSS). Always use the isolated IndexedDB store in `@workspace/browser-backend`.
* **No remote telemetry or analytics**. Pedigree data must never leave the user's device without explicit, peer-to-peer user action.

### 3. Layout Engine Constraints
The pedigree auto-layout engine (`artifacts/ppro/src/lib/layout-engine.ts`) handles complex family topologies and consanguineous marriages. Any change must preserve performance constraints ($O(N \log N)$ sweep-line, no per-collision cloning) and pass all topological regression tests.

---

## Development Setup

### Prerequisites
* **Node.js** (v20 or v22 LTS recommended)
* **pnpm** (`npm install -g pnpm`)
* **Rust toolchain** (required only for Tauri desktop builds)
* **Windows Desktop Builds Only:** [Strawberry Perl](https://strawberryperl.com/) (required to compile vendored OpenSSL statically from source: `choco install strawberryperl -y`).

### Installation & Build

```bash
# 1. Clone the repository
git clone https://github.com/Huthaifa-HajAhmad/Pedigree-PRO.git
cd Pedigree-PRO

# 2. Install dependencies (supply-chain guarded)
pnpm install --ignore-scripts

# 3. Build workspace libraries
pnpm -r --if-present run build

# 4. Start local development server (browser mode)
pnpm --filter @workspace/ppro run dev
# -> http://localhost:4173
```

---

## Quality Gates & Verification

Before submitting a Pull Request, verify all quality gates pass:

```bash
# Typecheck entire workspace
pnpm run typecheck

# Run unit tests and accessibility suite
pnpm run test

# Run linter
pnpm run lint

# Check formatting
pnpm run format:check
```

---

## Pull Request Guidelines

1. **Create a topic branch:** Branch off `main` with a descriptive name (e.g. `feat/fhir-export`, `fix/twin-spacing`).
2. **Developer Certificate of Origin (DCO):**
   Please sign off on your commits using `git commit -s`. By signing off, you certify the [Developer Certificate of Origin](https://developercertificate.org/):
   ```
   Signed-off-by: Jane Doe <jane.doe@example.com>
   ```
3. **Commit Messages:** Follow [Conventional Commits](https://www.conventionalcommits.org/) (e.g., `feat: ...`, `fix: ...`, `refactor: ...`, `docs: ...`).
4. **Automated CI:** Every PR will trigger automated typecheck, lint, and unit test suites across Ubuntu runners.

---

## Reporting Bugs & Suggesting Features

* **Bug Reports:** Please use our [Bug Report Template](.github/ISSUE_TEMPLATE/bug_report.yml) and specify whether the issue occurs on Desktop (Windows, macOS, Linux) or Browser.
* **Clinical Feedback:** Clinicians and genetic researchers are invited to submit feedback via the [Clinical Feedback Template](.github/ISSUE_TEMPLATE/clinical_feedback.yml).
* **Security Issues:** Please refer to [SECURITY.md](SECURITY.md) for confidential vulnerability reporting.

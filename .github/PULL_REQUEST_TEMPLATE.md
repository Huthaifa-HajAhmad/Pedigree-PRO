## Description
<!-- Provide a concise description of the changes made and the motivation behind them. -->

## Type of Change
- [ ] 🐛 Bug fix (non-breaking change fixing an issue)
- [ ] ✨ New feature (non-breaking change adding functionality)
- [ ] 🧬 Clinical / Nomenclature improvement
- [ ] ⚡ Performance optimization (Layout engine, rendering, WASM)
- [ ] 🔒 Security / Privacy hardening
- [ ] 📚 Documentation update
- [ ] 🧪 Tests / CI infrastructure

## Dual-Build Parity Verification (Required)
Pedigree PRO operates in both Browser (sql.js WASM + IndexedDB) and Tauri Desktop (Rust + SQLCipher):
- [ ] Changes verified in **Browser mode** (`pnpm --filter @workspace/ppro dev`)
- [ ] Changes verified in **Desktop mode** (or audited for command/parity equivalence)
- [ ] Any new backend command added to **both** `commands.ts` (Browser) and `commands.rs` (Tauri)

## Quality Checklist
- [ ] `pnpm run typecheck` passes with zero errors
- [ ] `pnpm run test` passes (including layout regression and a11y tests)
- [ ] `pnpm run lint` passes
- [ ] Code follows existing project conventions and architecture guidelines
- [ ] Commits are signed off with `git commit -s` (Developer Certificate of Origin)
- [ ] No real Protected Health Information (PHI) or secrets in code or test fixtures

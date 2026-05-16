# Local-first Development (Browser Mode)

1. Install dependencies:
   pnpm install --ignore-scripts

2. Build libraries:
   pnpm -r --if-present run build

3. Start the frontend dev server:
   pnpm --filter @workspace/ppro run dev
   → http://localhost:4173

4. Run typechecking:
   pnpm run typecheck

5. Run tests:
   pnpm run test

Notes:
- Browser mode uses sql.js (WASM SQLite) with IndexedDB persistence — no server required.
- Data is encrypted at rest using AES-256-GCM via Web Crypto API.
- Desktop mode uses Tauri + SQLCipher; see `artifacts/ppro/src-tauri/`.
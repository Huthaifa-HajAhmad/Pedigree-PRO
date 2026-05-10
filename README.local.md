Local-first run (SQLite)

1. Install dependencies (pnpm):
   pnpm install -w

2. Initialize local SQLite DB:
   pnpm --filter @workspace/db run init-sqlite

3. Start the API server (set env from .env.example):
   copy .env.example .env.local
   set DATABASE_URL=sqlite:./data/db.sqlite
   pnpm --filter @workspace/api-server run start

4. Frontend (dev):
   pnpm --filter @workspace/mockup-sandbox run dev

Notes:
- This creates ./data/db.sqlite (single file DB) suitable for distribution.
- Later packaging (Tauri) will bundle the server + this DB file and the frontend static assets into an installer for clinicians.

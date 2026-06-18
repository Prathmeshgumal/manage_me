# MySchedule

A fast, keyboard-driven task prioritization board — a personal take on Linear, built with the **Signal** visual identity (color reserved for priority; a heat-spine on every card). Web first, mobile app planned.

This is a pnpm monorepo: the React frontend (`apps/web`) and Express API (`apps/api`) deploy separately, sharing a typed contract (`packages/shared`).

## Stack

- **Monorepo:** pnpm workspaces + Turborepo
- **Frontend:** React + Vite + TypeScript, Tailwind, shadcn/ui, TanStack Query, dnd-kit, cmdk → Vercel
- **Backend:** Express + TypeScript, Prisma, Zod → Render
- **Database:** PostgreSQL (Neon)
- **Tests:** Vitest

## Layout

```
apps/web        React app (Vercel)
apps/api        Express API (Render)
packages/shared Zod schemas + TS types (the API contract, used by both)
```

## Prerequisites

- Node 20+ (`.nvmrc` pins 20)
- pnpm 9 (`corepack enable` then `corepack prepare pnpm@9.12.0 --activate`)
- A PostgreSQL connection string (a free [Neon](https://neon.tech) database works great)

## Local development

```bash
# 1. Install
pnpm install

# 2. Configure the API database
cp apps/api/.env.example apps/api/.env
#   edit apps/api/.env and set DATABASE_URL to your Postgres/Neon URL

# 3. Create the schema (and generate the Prisma client)
pnpm --filter @myschedule/api prisma:migrate

# 4. (optional) Load demo data
pnpm --filter @myschedule/api prisma:seed

# 5. Point the web app at the API
cp apps/web/.env.example apps/web/.env   # defaults to http://localhost:4000

# 6. Run both apps
pnpm dev
```

- API: http://localhost:4000 (health at `/health`)
- Web: http://localhost:5173

> **Neon note:** the free tier auto-suspends an idle database, so the first request after a pause may be slow or transiently fail while the compute wakes — retry once.

## Useful commands

```bash
pnpm test                                  # all test suites (shared + api)
pnpm build                                 # build every workspace
pnpm --filter @myschedule/api test         # API tests — DESTRUCTIVE (see note)
pnpm --filter @myschedule/web lint         # typecheck the web app
pnpm --filter @myschedule/api prisma:seed  # reset + load demo data
```

> **The API tests are destructive.** They clear the tables (`deleteMany`) against whatever `DATABASE_URL` is set. Point `apps/api/.env` at a **separate test database** before running them, or re-seed afterwards with `pnpm --filter @myschedule/api prisma:seed`.

## Keyboard shortcuts

- `⌘K` / `Ctrl+K` — command palette
- `C` — new task
- `/` — search

## Deployment

### API → Render

Use `apps/api/render.yaml` (Blueprint) or a manual Web Service:

- **Build:** `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @myschedule/api prisma generate && pnpm --filter @myschedule/api build && pnpm --filter @myschedule/api prisma migrate deploy`
- **Start:** `pnpm --filter @myschedule/api start`
- **Env:** `DATABASE_URL` (your Neon pooled connection string)
- **Health check:** `/health`

### Web → Vercel

- **Root Directory:** `apps/web` (Vercel auto-installs the pnpm workspace from the repo root)
- **Framework:** Vite (auto-detected; `apps/web/vercel.json` is included)
- **Env:** `VITE_API_URL` = your deployed Render API URL (e.g. `https://myschedule-api.onrender.com`)

The API enables permissive CORS, so the Vercel frontend can call the Render API directly.

## Roadmap

See [PLAN.md](./PLAN.md) — Phase 1 (this board) is done; later phases cover auth/multi-user, richer task management, project planning, docs, collaboration, and the mobile app.

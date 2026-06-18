# MySchedule

A fast, keyboard-driven task prioritization board — a personal take on Linear, built with the **Signal** visual identity (color reserved for priority; a heat-spine on every card). Web first, mobile app planned.

Two independent projects in one repo, each deployed on its own:

```
backend/    Express + Prisma API   → Render
frontend/   React + Vite SPA        → Vercel
```

They share no build tooling — each has its own `package.json`, install, and lockfile. The API contract types live in `frontend/src/types.ts` and `backend/src/schemas.ts` (kept in sync by hand).

## Stack

- **Backend:** Express + TypeScript, Prisma, Zod → Render
- **Frontend:** React + Vite + TypeScript, Tailwind, shadcn/ui, TanStack Query, dnd-kit, cmdk → Vercel
- **Database:** PostgreSQL (Neon)
- **Tests:** Vitest

## Prerequisites

- Node 20+ (`.nvmrc` pins 20)
- pnpm 9 (`corepack enable` then `corepack prepare pnpm@9.12.0 --activate`)
- A PostgreSQL connection string (a free [Neon](https://neon.tech) database works great)

## Local development

Each project is set up and run independently — two terminals.

### Backend

```bash
cd backend
pnpm install
cp .env.example .env          # set DATABASE_URL to your Postgres/Neon URL
pnpm prisma:migrate           # create schema + generate the Prisma client
pnpm prisma:seed              # (optional) load demo data
pnpm dev                      # http://localhost:4000  (health at /health)
```

### Frontend

```bash
cd frontend
pnpm install
cp .env.example .env          # defaults to VITE_API_URL=http://localhost:4000
pnpm dev                      # http://localhost:5173
```

> **Neon note:** the free tier auto-suspends an idle database, so the first request after a pause may be slow or transiently fail while the compute wakes — retry once.

## Useful commands

Run inside `backend/` or `frontend/`:

```bash
# backend
pnpm test            # API tests — DESTRUCTIVE (see note)
pnpm build           # bundle to dist/ (tsup)
pnpm prisma:seed     # reset + load demo data

# frontend
pnpm lint            # typecheck
pnpm build           # production build to dist/
```

> **The backend tests are destructive.** They clear the tables (`deleteMany`) against whatever `DATABASE_URL` is set. Point `backend/.env` at a **separate test database** before running them, or re-seed afterwards with `pnpm prisma:seed`.

## Keyboard shortcuts

- `⌘K` / `Ctrl+K` — command palette
- `C` — new task
- `/` — search

## GitHub integration (optional)

Connecting GitHub (to see your contribution chart and, later, repo/org context) needs a **GitHub App** you register once. Without it, the rest of the app works fine.

**1. Create the GitHub App** — github.com → Settings → Developer settings → GitHub Apps → New GitHub App:

- **Callback URL:** `http://localhost:4000/github/callback` (add your deployed API URL too in production).
- **Setup URL:** `http://localhost:4000/github/setup`, and tick "Redirect on update".
- **Expire user authorization tokens:** **OFF** (we store a long-lived user token).
- **Webhook:** Off.
- **Repository permissions:** Metadata, Contents, Issues, Pull requests → **Read-only** (used by the upcoming project dashboard).
- Generate a **private key** (downloads a `.pem`). Note the **App ID**, **Client ID**, a generated **Client secret**, and the app **slug** (the `…/apps/<slug>` part of its public page URL).

**2. Fill `backend/.env`:**

```bash
# base64-encode the private key so it survives env newlines:
base64 -w0 your-app.private-key.pem        # value -> GITHUB_APP_PRIVATE_KEY_BASE64
openssl rand -base64 32                     # value -> GITHUB_TOKEN_ENC_KEY (must be 32 bytes)
openssl rand -hex 32                        # value -> GITHUB_STATE_SECRET
```

Set `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_PRIVATE_KEY_BASE64`, the two generated secrets, `GITHUB_OAUTH_REDIRECT_URI=http://localhost:4000/github/callback`, and `FRONTEND_URL=http://localhost:5173`. None of these are committed.

**3. Use it:** restart the backend, then in the app: sidebar → **Connect GitHub** → **Authorize GitHub** (approve on GitHub) → **Install / Configure on GitHub** (pick account/org + repos) → sidebar → **My GitHub** shows your contribution chart. **Disconnect** clears the stored token.

> The `/github/*` backend logic is covered by unit + route tests with GitHub mocked, so the test suite runs without a configured App.

## Deployment

### Backend → Render

New Web Service, **Root Directory = `backend`** (or use `backend/render.yaml`):

- **Build:** `corepack enable && pnpm install --frozen-lockfile && pnpm prisma generate && pnpm build && pnpm prisma migrate deploy`
- **Start:** `pnpm start`
- **Env:** `DATABASE_URL` (your Neon pooled connection string)
- **Health check:** `/health`

### Frontend → Vercel

- **Root Directory:** `frontend`
- **Framework:** Vite (auto-detected; `frontend/vercel.json` included)
- **Env:** `VITE_API_URL` = your deployed Render API URL (e.g. `https://myschedule-api.onrender.com`)

The API enables permissive CORS, so the Vercel frontend can call the Render API directly.

## Roadmap

See [PLAN.md](./PLAN.md) — Phase 1 (this board) is done; later phases cover auth/multi-user, richer task management, project planning, docs, collaboration, and the mobile app.

# MySchedule

A fast, keyboard-driven task prioritization board — a personal take on Linear, built with the **Signal** visual identity (color reserved for priority; a heat-spine on every card). Web first, mobile app planned.

Two independent projects in one repo, each deployed on its own:

```
backend-py/  FastAPI + SQLAlchemy + Alembic API  → Render
frontend/    React + Vite SPA                     → Vercel
```

They share no build tooling — the backend is Python (managed with `uv`), the frontend is Node (pnpm). The API contract types live in `frontend/src/types.ts` and `backend-py/app/schemas.py` (kept in sync by hand).

## Stack

- **Backend:** FastAPI + Python, SQLAlchemy 2.0 (async) + asyncpg, Alembic, Pydantic v2 → Render
- **Frontend:** React + Vite + TypeScript, Tailwind, shadcn/ui, TanStack Query, dnd-kit, cmdk → Vercel
- **Database:** PostgreSQL (Supabase in prod; local Postgres in dev)
- **Tests:** pytest (backend)

## Prerequisites

- **Backend:** Python 3.12 + [`uv`](https://docs.astral.sh/uv/) (uv manages the Python toolchain)
- **Frontend:** Node 20+ (`.nvmrc` pins 20) and pnpm 9 (`corepack enable`)
- A PostgreSQL database (local Postgres for dev; a role/db like `myschedule` / `myschedule_dev`)

## Local development

Each project is set up and run independently — two terminals.

### Backend

```bash
cd backend-py
uv sync
cp .env.example .env          # set DATABASE_URL to your local Postgres
uv run alembic upgrade head   # create schema on a fresh database
uv run uvicorn app.main:app --reload --port 4000   # http://localhost:4000 (health at /health)
```

> If you reuse a database created by an older Prisma-managed deployment, run
> `uv run alembic stamp head` once instead of `upgrade` (the tables already exist).

### Frontend

```bash
cd frontend
pnpm install
cp .env.example .env          # defaults to VITE_API_URL=http://localhost:4000
pnpm dev                      # http://localhost:5173
```

## Useful commands

```bash
# backend (backend-py)
uv run pytest          # API tests (against a dedicated test DB — see note)
uv run uvicorn app.main:app --reload --port 4000

# frontend
pnpm lint              # typecheck
pnpm build             # production build to dist/
```

> **Backend tests** run against a dedicated `myschedule_test` database, which is
> auto-migrated and truncated between tests — they never touch your dev data.
> Create it once with `createdb -h localhost -U myschedule myschedule_test`.

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

**2. Fill `backend-py/.env`:**

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

New Web Service, **Root Directory = `backend-py`**:

- **Build:** `uv sync && uv run alembic upgrade head`
- **Start:** `gunicorn app.main:app -k uvicorn.workers.UvicornWorker -b 0.0.0.0:$PORT`
- **Env:** `APP_ENV=production`, `DATABASE_URL` (Supabase **session** connection, port 5432), `FRONTEND_URL`, and the `GITHUB_*` vars if using GitHub.
- **Health check:** `/health`

> For a database that already has the schema (e.g. migrated from the previous
> Prisma backend), run `alembic stamp head` against it once before the first deploy.

### Frontend → Vercel

- **Root Directory:** `frontend`
- **Framework:** Vite (auto-detected; `frontend/vercel.json` included)
- **Env:** `VITE_API_URL` = `/api` (the SPA calls the backend through a same-origin Vercel rewrite → first-party session cookie).

## Roadmap

See [PLAN.md](./PLAN.md) — Phase 1 (this board) is done; later phases cover auth/multi-user, richer task management, project planning, docs, collaboration, and the mobile app.

# MySchedule backend (FastAPI)

Python reimplementation of the backend, API-compatible with the frontend:
`auth`, `tasks`, `projects`, `labels`, `library`, and `github` (OAuth, App
installations, repositories, file browser, contributions). This is a full
drop-in replacement for the TypeScript `backend/`; cutover to production is the
remaining step.

## Setup (local)

Requires `uv` (and Python 3.12, which uv manages) plus local Postgres with role
`myschedule` / database `myschedule_dev` (see repo root setup). Create the test
DB once:

```bash
PGPASSWORD=myschedule createdb -h localhost -U myschedule myschedule_test
```

Install deps and apply migrations:

```bash
cd backend-py
uv sync
# fresh / test databases:
uv run alembic upgrade head
# the existing dev DB was created by Prisma; mark it baselined instead:
DATABASE_URL=postgresql://myschedule:myschedule@localhost:5432/myschedule_dev uv run alembic stamp head
```

## Run

```bash
uv run uvicorn app.main:app --reload --port 4000
```

The frontend (`frontend/`, `pnpm dev`) talks to `http://localhost:4000` with no
changes — this backend is API-compatible.

## Test

```bash
uv run pytest -v
```

Tests run against a dedicated `myschedule_test` database (auto-migrated, with
per-test truncation).

## Environment (`.env`)

- `DATABASE_URL` — Postgres URL (local dev points at `myschedule_dev`).
- `APP_ENV` — `development` (default) or `production`. Production locks CORS to
  `FRONTEND_URL` and sets `Secure`/`SameSite=None` cookies.
- `FRONTEND_URL` — required when `APP_ENV=production`.
- `PORT` — default 4000.

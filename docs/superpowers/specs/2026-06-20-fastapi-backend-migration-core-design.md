# FastAPI Backend Migration — Phase 1 (Core) Design

**Date:** 2026-06-20
**Status:** Approved (design); spec under review
**Author:** Prathmesh + Claude

## Summary

Reimplement the **core** of the MySchedule backend in **FastAPI (Python)**, replacing the
Express 4 + TypeScript + Prisma backend, with **byte-for-byte API parity** so the existing
React frontend needs **zero changes**.

This is **Phase 1 of 2**:

- **Phase 1 (this spec):** auth/sessions, tasks, projects, labels, library (shelf/book/page).
- **Phase 2 (separate spec, later):** GitHub App integration (OAuth, installation tokens,
  encrypted token storage, repo browsing, contributions GraphQL).

## Motivation

The driver is **not** that Express is broken. The recent pain (latency, third-party cookies,
optimistic updates, local DB setup) was infra/frontend, unrelated to Express. The reasons for
the migration are strategic:

1. **Python preference** — the team is more productive in Python.
2. **Future AI/ML features** — Python's ecosystem is a clear advantage for upcoming work.

The rewrite adds no features by itself; it is an investment that pays off later. Phase 1 must
re-achieve parity with what already works.

## Non-Goals (Phase 1)

- Porting GitHub integration (Phase 2).
- Cutting over production. **Prod stays on the TS backend for all of Phase 1.** Cutover is a
  later, deliberate step — ideally a single switch after Phase 2 so prod is never split across
  two backends.
- Changing the database schema or the frontend.
- Email verification / password reset (still deferred — needs an email service).

## Architecture

### Tech stack

- **Python 3.12**, **FastAPI**, **Uvicorn** (Gunicorn + `uvicorn.workers.UvicornWorker` in prod)
- **SQLAlchemy 2.0 (async)** + **asyncpg**
- **Alembic** for migrations
- **Pydantic v2** + **pydantic-settings** for config
- **uv** for dependency/venv management
- **pytest** + **pytest-asyncio** + **httpx** `AsyncClient` for tests

### Repo layout (parallel, non-destructive)

New `backend-py/` directory alongside the existing `backend/`. The TS backend stays fully
intact and runnable until cutover.

```
backend-py/
  pyproject.toml          # uv-managed deps
  alembic.ini
  alembic/
    env.py
    versions/
  app/
    main.py               # FastAPI app, CORS, exception handlers, router mounting
    config.py             # env settings (pydantic-settings)
    db.py                 # async engine + AsyncSession dependency
    ids.py                # cuid generator for new row IDs
    models.py             # SQLAlchemy models mapped to EXISTING tables
    schemas.py            # Pydantic request/response models (camelCase via alias)
    auth/
      password.py         # scrypt hash/verify (Node-compatible format)
      sessions.py         # create/find/delete sessions
      cookies.py          # set/clear sid cookie (env-aware)
      deps.py             # require_auth dependency -> (user_id, workspace_id)
      routes.py           # /auth/* endpoints
    routers/
      tasks.py
      projects.py
      labels.py
      library.py
  tests/
    conftest.py           # test DB + AsyncClient fixtures
    test_auth.py
    test_tasks.py
    test_projects.py
    test_labels.py
    test_library.py
    test_app.py           # health, 404, cross-workspace isolation
```

### Database: reuse the existing schema exactly

SQLAlchemy models map onto the tables **Prisma already created** — no new schema, no data
migration:

- **Table names** are quoted PascalCase as Prisma generated them: `"User"`, `"Workspace"`,
  `"Membership"`, `"Session"`, `"Project"`, `"Label"`, `"Task"`, `"Shelf"`, `"Book"`, `"Page"`,
  plus the implicit Task↔Label many-to-many join table `"_LabelToTask"` (columns `"A"` →
  `Label.id`, `"B"` → `Task.id`), confirmed by DB introspection.
- **Column names** match exactly: `createdAt`, `updatedAt`, `workspaceId`, `sortOrder`,
  `tokenHash`, etc. SQLAlchemy `Column(..., name="createdAt")` mapping; Python attributes may be
  snake_case internally.
- **Enums** map to the existing Postgres enum types via
  `sqlalchemy.dialects.postgresql.ENUM(..., name="Status", create_type=False)` (and `Priority`,
  `Role`). `create_type=False` so SQLAlchemy never tries to recreate them.
- **IDs**: existing rows use Prisma cuids (client-generated text, no DB default). New rows are
  generated app-side with a `cuid` generator (`app/ids.py`) so the format stays consistent. IDs
  are opaque to the frontend, so exact format is not contractually required, only that they are
  unique text.
- **Timestamps**: `createdAt` uses `server_default=func.now()`; `updatedAt` uses
  `onupdate=func.now()` (Prisma managed these client-side; we move the update bump into the ORM).

**Alembic baseline:** initialize Alembic, generate an initial revision that represents the
current schema, and **stamp** the existing DB as being at that revision (so Alembic does not try
to recreate existing tables). Future schema changes go through `alembic revision --autogenerate`.

### Auth parity (must match precisely)

- **Passwords — scrypt, identical format.** Stored as `saltHex:hashHex`. Parameters match Node's
  `scryptSync` defaults: `N=16384, r=8, p=1, keylen=64`. Implemented with
  `hashlib.scrypt(password, salt=salt, n=16384, r=8, p=1, dklen=64, maxmem=...)`. Verification
  uses `hmac.compare_digest`. This means **existing accounts keep working** with no forced reset.
- **Sessions — identical scheme.** On login/signup: generate 32 random bytes, base64url-encode
  as the opaque token returned in the cookie; store `sha256(token)` hex in `Session.tokenHash`
  with a 30-day `expiresAt`. On request: hash the cookie token, look up the session, reject/delete
  if expired. `change-password` revokes all other sessions for the user.
- **Cookie — identical.** Name `sid`; `httpOnly=True`, `path=/`; env-aware: production →
  `secure=True, samesite="none"`, dev → `secure=False, samesite="lax"`. 30-day max age.
- **`require_auth` dependency.** A FastAPI dependency reads the `sid` cookie, resolves the
  session, loads the user's membership, and yields `(user_id, workspace_id)`; raises 401 if
  missing/invalid. Every data route depends on it. Per-workspace isolation: reads filter by
  `workspaceId`; update/delete guard by `workspaceId`; cross-workspace IDs return **404**.

### Contract fidelity

- **camelCase JSON.** Pydantic response models use a camelCase alias generator with
  `populate_by_name=True`; responses serialized `by_alias=True`. Internal Python stays snake_case.
- **Error shape.** Custom exception handlers return `{"error": {"message": "..."}}` for 400
  (validation), 401, 404, 409 (duplicate email), overriding FastAPI's default 422 body, so the
  frontend's `body.error.message` and 401 handling keep working. A 401 response is what triggers
  the frontend's `auth:unauthorized` event.
- **Status codes** match the current backend (201 vs 200 where applicable — confirmed per
  endpoint against the TS handlers during implementation).

### CORS & config

- `CORSMiddleware` with `allow_credentials=True`. Prod: `allow_origins=[FRONTEND_URL]`. Dev:
  reflect local frontend origin (`http://localhost:5173`). Credentialed CORS cannot use `*`, so
  origins are explicit.
- **Config** via `pydantic-settings`, reading the same env vars: `DATABASE_URL`, `FRONTEND_URL`,
  `PORT`, and an environment flag (reuse `NODE_ENV` or introduce `APP_ENV`; default to dev).
- **asyncpg specifics:** URL scheme `postgresql+asyncpg://`; strip `?pgbouncer=true`; set
  `statement_cache_size=0` for Supabase transaction-pooler compatibility (prod). Local dev uses
  the plain local Postgres URL.

## Complete endpoint surface (Phase 1)

All paths and behaviors mirror the current TS backend. Response bodies match
`frontend/src/types.ts`.

**Auth** (`/auth`, mounted without global guard; `/me`, `/logout`, `/change-password` require auth):
- `POST /auth/signup` — create user + workspace + membership; 409 on duplicate email; sets `sid`.
- `POST /auth/login` — 401 on bad credentials; sets `sid`.
- `GET /auth/me` — `{ user: { id, email } }`.
- `POST /auth/logout` — clears `sid`, deletes session.
- `POST /auth/change-password` — verifies current, updates, revokes other sessions.

**Tasks** (`/tasks`, require auth):
- `GET /tasks` — filters: `status`, `priority`, `projectId`, `labelId`.
- `POST /tasks`
- `GET /tasks/:id`
- `PATCH /tasks/:id` (includes `sortOrder` reordering, `labelIds`)
- `DELETE /tasks/:id`

**Projects** (`/projects`, require auth):
- `GET /projects` · `POST /projects` · `PATCH /projects/:id` · `DELETE /projects/:id`

**Labels** (`/labels`, require auth):
- `GET /labels` · `POST /labels` · `PATCH /labels/:id` · `DELETE /labels/:id`

**Library** (mounted at root, require auth):
- `GET /shelf` — general (project-less) shelf for the workspace.
- `GET /projects/:projectId/shelf`
- `PATCH /shelves/:id`
- `POST /shelves/:shelfId/books`
- `GET /books/:id` · `PATCH /books/:id` · `DELETE /books/:id`
- `POST /books/:bookId/pages`
- `GET /pages/:id` · `PATCH /pages/:id` · `DELETE /pages/:id`

**Health:** `GET /health` — `{ "ok": true }`.

## Testing

- pytest + pytest-asyncio + httpx `AsyncClient` (ASGI transport, no network).
- A dedicated local test database `myschedule_test`, schema created via Alembic; per-test cleanup
  (truncate or transactional rollback). Mirrors the current vitest coverage but runs fast against
  local Postgres.
- A test helper creates a fresh user+workspace via signup and returns a cookie-bearing client
  (parity with the current `authedAgent`).
- Coverage: auth (signup/login/me/logout/change-password, dup email, bad creds), CRUD for tasks/
  projects/labels/library, per-workspace isolation (cross-workspace IDs → 404), health, unknown
  route → 404.

## Deployment (deferred to cutover)

Not applied during Phase 1. When we cut over:
- Render build: install uv, `uv sync`, `alembic upgrade head`.
- Render start: `gunicorn app.main:app -k uvicorn.workers.UvicornWorker -b 0.0.0.0:$PORT`.
- Cutover sequence (post-Phase 2): validate parity locally → deploy Python service → switch the
  frontend's API target → decommission the TS backend.

## Risks & mitigations

- **scrypt mismatch** would lock out existing users. Mitigation: a unit test that verifies a hash
  produced by the Node backend validates in Python (and vice versa) before relying on it.
- **Enum / table-name drift** between Prisma's generated DDL and the SQLAlchemy models.
  Mitigation: introspect the live DB for exact names (especially the Task↔Label join table) and
  assert an empty Alembic autogenerate diff against the existing schema.
- **asyncpg + pgbouncer** statement-cache errors in prod. Mitigation: `statement_cache_size=0`;
  validated at Phase-2 cutover, not Phase 1 (local dev unaffected).
- **Contract drift** (camelCase, status codes, error shape). Mitigation: parity tests assert exact
  JSON keys and status codes against `frontend/src/types.ts`.

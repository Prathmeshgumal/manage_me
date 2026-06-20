# FastAPI Migration — Phase 2 (GitHub) + Cutover Design

**Date:** 2026-06-20
**Status:** Approved (design); spec under review
**Branch:** `feat/fastapi-backend-migration` (continues from Phase 1)
**Predecessor:** `2026-06-20-fastapi-backend-migration-core-design.md` (Phase 1, complete)

## Summary

Port the **GitHub integration** from the TypeScript backend to the FastAPI backend
(`backend-py/`) with byte-for-byte API parity, then **cut over** production from the TS backend
to FastAPI and retire the TS backend. This completes the migration: after cutover, FastAPI is the
sole backend.

Phase 1 (auth/sessions, tasks, projects, labels, library) is already built, tested (25/25), and
verified end-to-end locally. This spec covers the remaining two pieces.

## Goals

1. **Phase 2 — GitHub parity:** replicate all 9 `/github/*` endpoints in FastAPI so the frontend
   GitHub features (connect, install, repositories, file browser, contribution calendar) work
   unchanged.
2. **Cutover:** deploy FastAPI to Render (reusing the existing service), repoint production at it,
   retire the TS backend — with no frontend change.

## Non-Goals

- No new GitHub features; pure parity.
- No schema changes (the `GithubUserToken` / `GithubInstallation` tables already exist).
- No frontend changes (`VITE_API_URL=/api` and the Vercel proxy stay as-is).

## Decisions (locked)

- **Token encryption:** reuse the exact AES-256-GCM scheme and the same `GITHUB_TOKEN_ENC_KEY`,
  so existing encrypted tokens decrypt without forcing reconnection. Proven by a cross-decrypt
  unit test against a Node-encrypted sample.
- **GitHub client:** raw `httpx` + `PyJWT` (RS256 App JWT) — mirrors the lightweight
  `@octokit/request` approach; no heavy SDK.
- **Testing:** unit-test all pure logic; mock `httpx` for route tests; verify the real
  OAuth/REST/GraphQL flows live in production at cutover.
- **Prod DB:** the Python service connects to Supabase's **session connection (port 5432)**, not
  the transaction pooler (6543) — avoids asyncpg + pgbouncer prepared-statement breakage. With
  the existing `NullPool` and `statement_cache_size=0` as belt-and-suspenders.
- **Render:** **reuse the existing service**, swapping its root/build to `backend-py`. The Vercel
  `/api/*` rewrite already targets it, so the frontend is untouched.
- **OAuth callback:** routed through the Vercel proxy path so the first-party `sid` cookie flows
  (env + GitHub App setting; no code change).

## Architecture — Phase 2

### Dependencies to add (`backend-py/pyproject.toml`)

- Promote `httpx` from dev to runtime.
- Add `pyjwt[crypto]` (RS256 JWT signing; pulls `cryptography`, used for AES-GCM too).

### New files (`backend-py/app/github/`)

- `__init__.py`
- `config.py` — load `GITHUB_*` env vars; validate the 32-byte enc key; expose a `GithubConfig`.
- `crypto.py` — `encrypt_token` / `decrypt_token` (AES-256-GCM) and `sign_state` / `verify_state`
  (HMAC-SHA256).
- `app_auth.py` — `app_jwt()` (RS256, `iss=appId`, `iat`, `exp ~9min`), `installation_token(id)`
  (POST `/app/installations/{id}/access_tokens`), `get_installation(id)`
  (GET `/app/installations/{id}`).
- `oauth.py` — `authorize_url(state)`, `exchange_code(code)`
  (POST `github.com/login/oauth/access_token`), `get_authed_user(token)` (GET `/user`).
- `repos.py` — `list_repositories(workspace_id)` (aggregate `/installation/repositories` across the
  workspace's installations; sorted by full name).
- `contents.py` — `get_repo_contents(installation_id, owner, repo, path)` with the dir/file/binary/
  too-large shaping (1 MB cap, NUL-byte binary heuristic).
- `contributions.py` — `fetch_contributions(user_token)` (GraphQL `viewer.contributionsCollection`)
  + `level_for_count` + `map_calendar`.
- `store.py` — SQLAlchemy versions of `save_user_token` / `get_user_token` / `delete_user_token` /
  `save_installation` / `list_installations`.
- `routes.py` — `github_router` (prefix `/github`, `require_auth`).

### Models to add (`backend-py/app/models.py`)

Mapping the existing tables (no DDL change):

- `GithubUserToken`: `id`, `github_user_id` (`githubUserId`, int), `login`, `avatar_url`
  (`avatarUrl`), `access_token` (`accessToken`, encrypted text), `scope` (nullable),
  `workspace_id`, `created_at`, `updated_at`; unique `(workspaceId, githubUserId)`.
- `GithubInstallation`: `id`, `installation_id` (`installationId`, int, unique), `account_login`
  (`accountLogin`), `account_type` (`accountType`), `repository_selection`
  (`repositorySelection`), `workspace_id`, `created_at`, `updated_at`.

### Crypto parity detail

Node's `aes-256-gcm` keeps the 16-byte auth tag separate (`cipher.getAuthTag()`), serialized as
`b64url(iv).b64url(tag).b64url(data)`. Python's `cryptography` `AESGCM.encrypt` returns
`ciphertext || tag` (tag appended). Therefore:

- **Encrypt:** `ct = AESGCM(key).encrypt(iv, plain, None)`; `data, tag = ct[:-16], ct[-16:]`;
  emit `b64url(iv).b64url(tag).b64url(data)`.
- **Decrypt:** split the three segments; `AESGCM(key).decrypt(iv, data + tag, None)`.

`GITHUB_TOKEN_ENC_KEY` is base64 → 32 raw bytes (validated). State signing mirrors the TS exactly:
`payload = b64url(json({nonce, exp}))`, `sig = b64url(HMAC_SHA256(stateSecret, payload))`,
serialized `payload.sig`; verify checks constant-time signature equality and `exp`.

### Endpoints (parity, mounted at `/github`, all under `require_auth`)

| Method | Path | Behavior |
|---|---|---|
| GET | `/github/status` | `{user: {login, avatarUrl}|null, installations: [...]}` |
| GET | `/github/authorize` | 302 → GitHub OAuth authorize URL (signed state) |
| GET | `/github/callback` | verify state → exchange code → fetch user → save token → 302 → `FRONTEND_URL/settings/github?connected=1` (error variants: `?error=state|code`) |
| GET | `/github/install` | 302 → `https://github.com/apps/{slug}/installations/new` |
| GET | `/github/setup` | save installation (from `installation_id`) → 302 → `…?installed=1` (or `?error=install`) |
| GET | `/github/repositories` | aggregated repo list |
| GET | `/github/repos/contents` | query `installationId,owner,repo,path` → dir/file contents |
| GET | `/github/contributions` | 409 if not connected, else contribution calendar |
| POST | `/github/disconnect` | delete user token → 204 |

Response shapes match `frontend/src/types.ts` (`GithubRepo`, `RepoContents`, `RepoDirEntry`) and
`frontend/src/hooks/useGithub.ts` (`GithubStatus`, `ContributionCalendar`, `ContributionDay`).

### Error handling

- Reuse the Phase 1 `AppError` + handlers (`{"error":{"message":...}}`). GitHub failures raise
  `AppError(400, ...)` (OAuth) / `AppError(409, "GitHub not connected")` / `AppError(500, ...)`
  for missing config, matching the TS statuses.
- Outbound `httpx` calls use explicit timeouts; non-2xx GitHub responses raise `AppError` with a
  clear message rather than leaking a 500 stack.

## Testing — Phase 2

**Unit (no network):**
- `crypto`: encrypt→decrypt round-trip; **decrypt a Node-encrypted token** (cross-compat) using a
  sample produced by the TS backend; state sign/verify incl. tamper + expiry.
- `app_auth`: App JWT has `iss`, `iat`, `exp`, alg RS256 (decode with the public key / `verify=False`
  claims check).
- `contributions`: `level_for_count` thresholds; `map_calendar` reshape.
- `contents`: dir sort (dirs first), file decode, binary (NUL) detection, too-large (>1 MB) flag.

**Route tests (mock `httpx`):** monkeypatch the GitHub HTTP calls to assert `/status`,
`/disconnect`, `/repositories`, `/repos/contents`, `/contributions` shapes and the redirect
behaviors of `/authorize`, `/callback`, `/install`, `/setup` (incl. `require_auth` 401s).

## Cutover

Executed only on explicit go-ahead, after Phase 2 is built and tested.

1. **Stamp prod DB:** one-time `alembic stamp head` against the prod Supabase DB (already has all
   tables from Prisma), so Alembic never recreates them.
2. **Render service (reuse existing):** swap build/start to `backend-py`:
   - Build: `uv sync` then `alembic upgrade head` (no-op after stamp).
   - Start: `gunicorn app.main:app -k uvicorn.workers.UvicornWorker -b 0.0.0.0:$PORT`.
   - Env: `APP_ENV=production`, `DATABASE_URL` = Supabase **session connection (5432)**,
     `FRONTEND_URL`, all `GITHUB_*`, and `GITHUB_OAUTH_REDIRECT_URI` =
     `https://manage-me-gamma.vercel.app/api/github/callback`.
3. **GitHub App settings:** add the proxy callback/setup URL above to the GitHub App.
4. **Traffic:** the Vercel `/api/*` rewrite already targets this service; no frontend change.
5. **Verify in prod:** auth + board/library CRUD; then connect (OAuth), install, repositories,
   file browser, contributions.
6. **Retire TS:** once verified, remove the TS `backend/` from deployment (kept in git for
   rollback — repoint the Render service back to it if needed).
7. **Secrets:** rotate the secrets exposed in chat earlier (DB password, GitHub client secret,
   `GITHUB_TOKEN_ENC_KEY`, `GITHUB_STATE_SECRET`). Note: rotating `GITHUB_TOKEN_ENC_KEY` invalidates
   stored encrypted tokens (users reconnect once); rotate it deliberately.

## Risks & mitigations

- **AES-GCM tag handling mismatch** → cross-decrypt unit test against a Node sample before relying
  on it.
- **asyncpg + pgbouncer** prepared-statement errors in prod → use the session connection (5432) +
  `statement_cache_size=0`.
- **OAuth callback cookie** not sent (cross-site) → callback routed through the Vercel proxy path so
  the cookie is first-party.
- **First prod deploy tries to recreate tables** → stamp prod before deploy.
- **Rollback** → the TS backend stays in git; repoint the Render service to it if cutover misbehaves.

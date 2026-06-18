# GitHub Connection Foundation — Design (Sub-project 1)

**Date:** 2026-06-18
**Status:** Draft for review
**Part of:** the larger "generic projects + GitHub integration" effort. This spec covers ONLY the connection foundation. The project↔GitHub dashboard (repo/org data panels) is Sub-project 2 and gets its own spec.

## 1. Goal

Let the (single) user connect their GitHub to MySchedule via a **GitHub App**, doing both GitHub auth flows, and prove it end-to-end by rendering their **contribution calendar** in a global "My GitHub" area. Also capture and list **installations** (personal account + organizations) so org/repo access is granted — repo/org *data display* is deferred to Sub-project 2.

## 2. Decisions locked (from brainstorming)

- **Integration:** GitHub App (not OAuth App) — native granular access (all / selected repos) and org-level install.
- **Both flows:** server-to-server (installation, for future repo/org data) **and** user-to-server OAuth (user token, for the contributions calendar).
- **Auth model:** app stays single-user / no login. GitHub artifacts stored globally.
- **Org selection:** happens on GitHub's native install screen; the user can install on multiple orgs/account, each with all-or-selected repos. We list the resulting installations.
- **Contributions chart:** in a global "My GitHub" area (not per-project).
- **Data fetching:** proxy on-demand from the backend; no caching in v1.
- **User token lifetime:** the GitHub App is configured with user-token expiration **disabled**, so we store a long-lived user token and avoid refresh logic in v1.

## 3. Scope

**In:** GitHub App setup runbook; backend OAuth (user-to-server) + installation capture + token storage; install-token minting via signed JWT (wired, used to fetch installation metadata); "Connect GitHub" settings page; "My GitHub" area with the contributions chart; disconnect.

**Out (→ later specs):** linking a project to a repo/org; repo/org data panels (README, issues, PRs, commits); the generic project dashboard; real multi-user auth; caching; webhooks / auto-sync on uninstall (v1 uses manual disconnect); automated user-token refresh.

## 4. GitHub App setup runbook (performed by the user, once)

In GitHub → Settings → Developer settings → **GitHub Apps → New GitHub App**:

1. **Name / Homepage:** anything (e.g. "MySchedule Dev").
2. **Callback URL (user authorization):** `http://localhost:4000/github/callback` (dev) and the deployed `https://<api-host>/github/callback` (prod). GitHub permits multiple and allows `localhost`.
3. **Setup URL (after install):** `http://localhost:4000/github/setup` (and prod equivalent). Check "Redirect on update".
4. **Expire user authorization tokens:** **OFF** (so user tokens are long-lived — no refresh logic in v1).
5. **Request user authorization (OAuth) during installation:** optional; we trigger OAuth separately.
6. **Webhook:** **Off** for v1.
7. **Permissions (Repository):** Metadata: Read; Contents: Read; Issues: Read; Pull requests: Read. (These cover Sub-project 2; requested now so the install grant is complete.)
8. **Account permissions:** none required for the contribution calendar (it's read via the user-to-server token on the GraphQL `viewer`).
9. Generate a **private key** (PEM) and note **App ID**, **Client ID**, **Client secret**, and the app **slug** (from its public page URL).

These values become backend env vars (Section 9). Nothing here is committed to git.

## 5. Architecture

```
Frontend (Vercel)                 Backend (Render)                     GitHub
  Settings/GitHub  --click-->  GET /github/authorize  --302-->  github.com/login/oauth/authorize
  My GitHub page                GET /github/callback   <--code--  (redirect back)
                                  exchange code -> user token (stored, encrypted)
  "Install/Configure" --click-> GET /github/install    --302-->  github.com/apps/<slug>/installations/new
                                GET /github/setup      <--installation_id-- (redirect back)
                                  app JWT -> install metadata (stored)
  contributions widget --GET--> GET /github/contributions
                                  user token -> GraphQL viewer.contributionsCollection
```

All GitHub secrets and tokens live only on the backend. The frontend never sees the private key, client secret, or stored tokens — it only calls our backend endpoints and follows backend redirects.

**Backend module boundaries** (new folder `backend/src/github/`):
- `config.ts` — reads + validates required env; throws a clear error if missing.
- `crypto.ts` — AES-256-GCM encrypt/decrypt for tokens at rest; HMAC sign/verify for OAuth `state`.
- `appAuth.ts` — mint app JWT and installation access tokens (via `@octokit/auth-app`).
- `oauth.ts` — build authorize URL, exchange code → user token.
- `contributions.ts` — GraphQL query + map response to our calendar shape.
- `store.ts` — Prisma read/write for installation + user-token rows.
- `routes.ts` — the Express router mounting `/github/*`, using the above.

Each file has one responsibility and is unit-testable in isolation (crypto, oauth URL building, contributions mapping are pure; routes are tested with GitHub HTTP mocked).

## 6. Data model (Prisma, Postgres)

```
model GithubUserToken {        // single row in v1 (the connected user)
  id           String   @id @default(cuid())
  githubUserId Int      @unique
  login        String
  avatarUrl    String
  accessToken  String            // AES-256-GCM ciphertext (never plaintext)
  scope        String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model GithubInstallation {
  id                   String   @id @default(cuid())
  installationId       Int      @unique   // GitHub's installation id
  accountLogin         String              // org or user login the app is installed on
  accountType          String              // "User" | "Organization"
  repositorySelection  String              // "all" | "selected"
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
}
```

Installation **access tokens** are short-lived (~1h) and minted on demand — never stored. OAuth `state` is stateless (signed HMAC token) — no table.

## 7. Backend API

All JSON errors keep the existing `{ error: { message } }` shape.

- `GET /github/status` → `{ user: { login, avatarUrl } | null, installations: [{ installationId, accountLogin, accountType, repositorySelection }] }`. Drives the settings UI.
- `GET /github/authorize` → 302 to GitHub's user-authorization URL with a signed `state`.
- `GET /github/callback?code&state` → verify `state`; exchange `code` → user token; fetch the user's `login`/`avatarUrl`/`id`; upsert encrypted token; 302 to `${FRONTEND_URL}/settings/github?connected=1` (or `?error=`).
- `GET /github/install` → 302 to `https://github.com/apps/<slug>/installations/new` (GitHub shows the org + repo chooser).
- `GET /github/setup?installation_id&setup_action` → mint app JWT, GET the installation metadata, upsert `GithubInstallation`; 302 back to `${FRONTEND_URL}/settings/github?installed=1`.
- `GET /github/contributions` → require stored user token; GraphQL `viewer.contributionsCollection.contributionCalendar`; return `{ totalContributions, weeks: [{ days: [{ date, count, level }] }] }` where `level` 0–4 is bucketed by count (so the UI uses our own palette, not GitHub's colors).
- `POST /github/disconnect` → delete the stored user token row (and optionally installation rows); 204. (Does not uninstall on GitHub — the user manages installs there.)

## 8. Frontend

- **Settings → GitHub** (`/settings/github`): reads `GET /github/status`; shows connected user (avatar + login) or an "Authorize GitHub" button (→ backend `/github/authorize`); an "Install / Configure on GitHub" button (→ backend `/github/install`) with copy explaining org/repo selection happens on GitHub; a list of installations (org/account + repo-selection badge); a "Disconnect" button. Reads `?connected/installed/error` query flags for toasts.
- **My GitHub** area (sidebar entry → `/my-github`): if connected, render the **contributions chart** from `GET /github/contributions` — a 7×53 heatmap with 5 intensity buckets using the Signal palette (reuse the priority heat ramp idea: muted→hot), a total-contributions caption, and month labels. If not connected, an empty state linking to Settings → GitHub.
- New shadcn primitives as needed (e.g., `card`, `badge`, `avatar`) added via the CLI and relocated into `src/components/ui` (the CLI's `@/` folder quirk).

## 9. Configuration (backend env)

```
GITHUB_APP_ID=
GITHUB_APP_SLUG=
GITHUB_APP_CLIENT_ID=
GITHUB_APP_CLIENT_SECRET=
GITHUB_APP_PRIVATE_KEY_BASE64=   # PEM, base64-encoded to survive env newlines
GITHUB_OAUTH_REDIRECT_URI=       # e.g. http://localhost:4000/github/callback
GITHUB_TOKEN_ENC_KEY=            # 32-byte key (base64) for AES-256-GCM at-rest encryption
GITHUB_STATE_SECRET=             # HMAC secret for signing OAuth state
FRONTEND_URL=                    # e.g. http://localhost:5173, for post-flow redirects
```

`config.ts` validates these at first use and returns a clear error if any are missing. All are documented in `backend/.env.example`. None are committed.

## 10. Security

- Secrets and tokens are backend-only; never serialized to the frontend.
- User access/refresh tokens stored **encrypted** (AES-256-GCM, key from `GITHUB_TOKEN_ENC_KEY`).
- OAuth `state` is a signed, short-expiry HMAC token → CSRF protection without server state.
- Installation tokens minted on demand, never persisted.
- Prod is HTTPS (Render/Vercel). Dev uses `http://localhost` callbacks, which GitHub allows.

## 11. Error handling

- Missing/!ok GitHub responses → `{ error: { message } }` with an appropriate status; the UI shows a toast and a retry.
- `state` mismatch/expired on callback → redirect to `…/settings/github?error=state`.
- `/github/contributions` with no stored token → 409 `{ error: { message: "GitHub not connected" } }`; the widget shows the connect prompt.
- Missing env config → 500 with a message naming the missing variable.

## 12. Libraries

`@octokit/auth-app` (app + installation tokens), `@octokit/request`/`octokit` (REST for user + installation metadata), `@octokit/graphql` (contributions). Node built-in `crypto` for AES-GCM + HMAC.

## 13. Testing (Vitest)

- **Pure units:** token encrypt→decrypt round-trip; `state` sign→verify (valid, tampered, expired); contributions GraphQL response → calendar mapping incl. count→level bucketing; authorize-URL builder.
- **Routes:** GitHub HTTP mocked (no live calls) — `/github/callback` happy path stores a token and redirects; `/github/status` reflects stored rows; `/github/contributions` maps a mocked GraphQL payload; `/github/disconnect` clears the row.
- No test hits real GitHub.

## 14. Known v1 limitations

- Uninstalling the app on GitHub doesn't auto-sync our `GithubInstallation` rows (no webhooks yet) — the user can disconnect/clean up in our UI; stale install rows simply fail when used later.
- Single connected user (matches the app's current single-user model).
- No caching — every widget load calls GitHub (fine at single-user scale).

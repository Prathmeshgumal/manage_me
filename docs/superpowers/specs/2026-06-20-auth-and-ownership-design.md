# Auth + Ownership Foundation — Design

**Date:** 2026-06-20
**Status:** Approved (pending spec review)
**Phase:** 2, sub-project 1 (see `PLAN.md`)

## Summary

MySchedule is currently single-user: no `User` model exists and all data
(`Task`, `Project`, `Label`, the library tree `Shelf`/`Book`/`Page`, and the
GitHub token/installation) is global and unscoped. This sub-project adds the
authentication and per-user ownership foundation that makes the app multi-user,
and is deliberately modeled so that collaboration/sharing can be layered on
later (sub-projects 2 and 3) without a painful migration.

**In scope (v1):** email/password signup, login, logout, change-password
(while logged in), DB-backed sessions, and per-user data isolation via a
`Workspace`.

**Deferred** (need an email-sending service, own spec later): email
verification, password reset. Tracked in `PLAN.md`.

**Existing data:** wiped on migration (clean slate) — current rows are demo/seed
data, so required ownership columns need no backfill.

## Goals

- A user can create an account with email + password (hashed), log in with those
  credentials, and log out.
- A logged-in user can change their password.
- Every piece of data is owned by a workspace; users only ever see and mutate
  their own workspace's data.
- The ownership model (`Workspace` + `Membership`) supports adding shared
  workspaces/roles later as an additive migration.
- Sessions are secure (XSS-resistant) and revocable.

## Non-goals

- Email verification, password reset (deferred — need email service).
- Inviting users, roles enforcement, sharing (sub-project 2).
- OAuth / social login.
- Activity attribution, real-time collaboration (sub-project 3).

## Architecture

An `auth` layer sits in front of the existing routes. Requests to data routes
must carry a valid session cookie; middleware resolves the cookie to a **user**
and their **workspace** and attaches both to the request. All data queries are
scoped to that workspace. Signup creates a user, their personal workspace, an
owner membership, and a session in a single transaction.

```
Browser (Vercel)                         Backend (Render)
  | login form ----POST /auth/login----->  verify password (scrypt)
  |                                         create Session row (store sha256)
  | <---Set-Cookie: sid (httpOnly) -------  return { user }
  |
  | GET /tasks (cookie sent automatically)
  |   --------------------------------->   requireAuth: hash cookie -> Session
  |                                         -> User -> Membership -> workspaceId
  |                                         query scoped by workspaceId
  | <---- tasks for this workspace -------
```

## Data model (Prisma)

### New models

```prisma
enum Role {
  OWNER
  MEMBER
  VIEWER
}

model User {
  id           String       @id @default(cuid())
  email        String       @unique          // stored lowercased
  passwordHash String
  memberships  Membership[]
  sessions     Session[]
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt
}

model Workspace {
  id          String       @id @default(cuid())
  name        String       @default("My Workspace")
  memberships Membership[]
  projects    Project[]
  labels      Label[]
  tasks       Task[]
  shelves     Shelf[]
  githubUserTokens   GithubUserToken[]
  githubInstallations GithubInstallation[]
  createdAt   DateTime     @default(now())
}

model Membership {
  id          String    @id @default(cuid())
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId      String
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  workspaceId String
  role        Role      @default(OWNER)
  createdAt   DateTime  @default(now())

  @@unique([userId, workspaceId])
  @@index([workspaceId])
}

model Session {
  id        String   @id @default(cuid())
  tokenHash String   @unique          // sha256 of the raw cookie token
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([userId])
}
```

In v1 each user has exactly one workspace and one `OWNER` membership (created at
signup). `Membership` is what makes sharing additive later: sub-project 2 just
inserts more membership rows and starts enforcing `role`.

### Ownership columns on existing models

Each top-level entity gains a required `workspaceId` FK with
`onDelete: Cascade`:

- `Project`, `Label`, `Task`, `Shelf`, `GithubUserToken`, `GithubInstallation`.

`Book` and `Page` are **not** given their own `workspaceId`; they inherit scope
through their parent `Shelf` / `Book` and are protected by joining on the parent
in queries.

`GithubUserToken.githubUserId` drops its global `@unique` constraint; uniqueness
becomes per-workspace (`@@unique([workspaceId, githubUserId])`).

New indexes: add `workspaceId` to the existing composite indexes / add
`@@index([workspaceId])` where lists are queried per workspace.

### Migration

A single migration that **drops all existing rows** in the affected tables
(demo/seed data), then adds the new models and the required `workspaceId`
columns. Because data is wiped, the new non-null columns need no backfill. The
seed script (if any) is updated to also create a demo user + workspace, or left
to be populated by the first real signup.

## Password & session security

- **Hashing:** Node built-in `crypto.scrypt`. Generate a random 16-byte salt per
  password; store as `salt:derivedKey` (both hex/base64). Verify with
  `crypto.timingSafeEqual`. No native dependencies, OWASP-accepted KDF.
- **Session token:** 32 random bytes (`crypto.randomBytes`) encoded `base64url`
  becomes the cookie value. Only its **sha256 hash** is stored in `Session`.
  Lookup is by hash, so a DB leak does not expose usable tokens.
- **Expiry:** 30 days from creation. Expired sessions are rejected and may be
  lazily deleted.
- **Revocation:** logout deletes the session row; change-password deletes all of
  the user's other sessions.
- **Cookie attributes:** `httpOnly`, `Secure`, `SameSite=None`, `Path=/`, name
  `sid`, `Max-Age` matching expiry. `SameSite=None` is required because frontend
  (Vercel) and backend (Render) are cross-site; `Secure` is satisfied because
  both are HTTPS.

## Backend changes

### New module `src/auth/`

- `password.ts` — `hashPassword(plain)`, `verifyPassword(plain, stored)`.
- `sessions.ts` — `createSession(userId)` (returns raw token), `findSession(rawToken)`,
  `deleteSession(rawToken)`, `deleteUserSessions(userId, exceptToken?)`.
- `routes.ts` — the `/auth` router.
- `middleware.ts` — `requireAuth`.

### Routes (`/auth`)

| Method | Path               | Auth | Body / Result |
|--------|--------------------|------|----------------|
| POST   | `/auth/signup`     | no   | `{ email, password }` → creates user+workspace+membership+session, sets cookie, returns `{ user }` |
| POST   | `/auth/login`      | no   | `{ email, password }` → verifies, creates session, sets cookie, returns `{ user }` |
| POST   | `/auth/logout`     | yes  | deletes session, clears cookie, `204` |
| GET    | `/auth/me`         | yes* | returns `{ user }` or `401` (used by frontend to bootstrap auth state) |
| POST   | `/auth/change-password` | yes | `{ currentPassword, newPassword }` → verifies current, rehashes, revokes other sessions, `204` |

Zod validation: email must be a valid email (lowercased before storage);
password min length 8. Signup returns `409` on duplicate email. Login/`/auth/me`
return generic `401` on failure (no user-enumeration leak).

\* `GET /auth/me` returns `401` when unauthenticated rather than an error page;
the frontend treats `401` as "logged out".

### `requireAuth` middleware

Reads the `sid` cookie → `findSession` (hash + expiry check) → loads the user and
their (single, v1) membership → attaches `req.user` and `req.workspaceId`.
Returns `401` if missing/invalid. Applied to `/tasks`, `/projects`, `/labels`,
`/github`, and the library router. Public: `/health`, `/auth/signup`,
`/auth/login`.

### Scoping existing routes/stores

Every existing query is scoped by `req.workspaceId`:

- **Reads:** filter `where: { workspaceId }` (and for library children, join
  through the parent's `workspaceId`).
- **Creates:** set `workspaceId` from the request.
- **Updates/Deletes:** match on `{ id, workspaceId }` so an id from another
  workspace yields "not found" rather than a cross-tenant mutation.

### GitHub integration

- `GithubUserToken` / `GithubInstallation` queries become workspace-scoped
  (`store.ts` functions take/derive `workspaceId`).
- The OAuth `state` (signed in `crypto.ts` / `signState`) carries `workspaceId`
  so `/github/callback` and `/github/setup` persist under the connecting user's
  workspace. `verifyState` returns the `workspaceId`.
- `/github/*` routes sit behind `requireAuth`. Note: GitHub redirects hit
  `/github/callback` and `/github/setup` directly in the browser, carrying the
  session cookie — these remain authenticated via the cookie; the signed `state`
  provides defense in depth and the workspace binding.

### App wiring

- Replace `app.use(cors())` with `cors({ origin: FRONTEND_URL, credentials: true })`.
- Add `cookie-parser`.
- Mount `/auth` before the auth-guarded routers.

## Frontend changes

- **`src/lib/auth-context.tsx`** — `AuthProvider` + `useAuth()`; calls
  `GET /auth/me` once on load to determine state (`loading` / `authenticated` /
  `anonymous`), exposes `login`, `signup`, `logout`, `changePassword`, `user`.
- **`src/hooks/useAuth.ts`** — thin hook over the context (mirrors existing hook
  style).
- **`src/pages/AuthPage.tsx`** — combined Login / Signup screen (shadcn form
  components), toggling between modes; shows validation + server errors.
- **`App.tsx`** — an `AuthGate`: while `loading` show a spinner; if `anonymous`
  render `AuthPage`; if `authenticated` render the existing app. A logout control
  is added to the sidebar/topbar.
- **`src/lib/api.ts`** — add `credentials: "include"` to every fetch so the
  cookie is sent; on `401`, clear auth state and route back to login.

No router library is introduced — this follows the existing conditional-render /
query-param pattern already in `App.tsx`.

## Error handling

- Auth failures return `401` with the standard error envelope
  (`{ error: { message } }`); duplicate signup returns `409`; validation errors
  `400` (existing Zod error middleware).
- Login and `/auth/me` use generic messages to avoid user enumeration.
- Frontend maps `401` from any data request to "session expired → show login".

## Testing

- **New:** `password.test.ts` (hash/verify round-trip, wrong password,
  tamper-resistance), `sessions.test.ts` (create/find/expire/delete), auth
  `routes.test.ts` (signup, duplicate email, login success/failure, logout,
  change-password, `/auth/me`), middleware test (no cookie → 401, valid cookie →
  passes, expired → 401).
- **Test helper:** creates a user + session and returns the cookie; used to
  update the **existing** route tests (which now require auth).
- **Isolation test:** workspace A cannot read or mutate workspace B's
  tasks/projects/labels/library/GitHub data (cross-tenant id returns not-found).

## Env / ops

- No new secrets. `FRONTEND_URL` (already set locally and must be set on Render)
  is now load-bearing for CORS origin and cookie acceptance.
- Cookies require HTTPS on both ends — already true on Vercel and Render.
- Confirm `FRONTEND_URL` on Render exactly matches the deployed Vercel origin
  (scheme + host, no trailing slash).

## Rollout

1. Schema + migration (wipe + new models/columns).
2. Backend auth module + middleware + route scoping + CORS/cookie wiring + tests.
3. Frontend auth context + AuthPage + AuthGate + `api.ts` credentials + logout.
4. Set/verify `FRONTEND_URL` on Render; deploy backend then frontend.
5. Manual verification: signup → see empty workspace → logout → login → data
   persists and is isolated.

## Open questions / future

- Email verification + password reset land when an email service is chosen
  (deferred spec).
- Sub-project 2 (membership/sharing) builds directly on `Workspace` +
  `Membership` + `Role` introduced here.

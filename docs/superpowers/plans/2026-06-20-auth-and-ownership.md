# Auth + Ownership Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single-user MySchedule app into a multi-user app where each account signs up with email + password, logs in, and only ever sees/mutates its own workspace's data.

**Architecture:** A new `src/auth/` module adds password hashing (scrypt), DB-backed sessions delivered via an httpOnly cookie, and a `requireAuth` middleware that resolves the cookie to a `userId` + `workspaceId`. Every existing data route is scoped by `req.workspaceId`. The frontend gains an auth context, a login/signup screen, and a logged-in shell. Spec: `docs/superpowers/specs/2026-06-20-auth-and-ownership-design.md`.

**Tech Stack:** Backend — Express 4, Prisma 5, Zod 3, Node `crypto` (scrypt/sha256), `cookie-parser`, Vitest + supertest. Frontend — React 19, Vite, TanStack Query, shadcn/ui.

## Global Constraints

- Backend is ESM (`"type": "module"`); **all relative imports use the `.js` extension** (e.g. `import { prisma } from "../prisma.js"`).
- Error envelope is always `{ error: { message, details? } }`; throw `AppError(status, message)` or let Zod/`P2025` flow to `errorMiddleware`.
- Wrap every async Express handler in `asyncHandler(...)`.
- Password minimum length: **8 characters**. Emails stored **lowercased**.
- Session cookie name is `sid`; expiry **30 days**.
- Cookie attributes are environment-aware: production → `secure: true, sameSite: "none"`; otherwise → `secure: false, sameSite: "lax"`. Gate on `process.env.NODE_ENV === "production"`.
- Package manager is `pnpm`. Run backend commands from `backend/`, frontend from `frontend/`.
- TDD: write the failing test first, watch it fail, implement, watch it pass, commit.

---

## File Structure

**Backend — new files**
- `backend/src/auth/password.ts` — `hashPassword`, `verifyPassword` (scrypt).
- `backend/src/auth/sessions.ts` — session create/find/delete (sha256-hashed tokens).
- `backend/src/auth/middleware.ts` — `requireAuth`, `SESSION_COOKIE`, Express `Request` augmentation.
- `backend/src/auth/cookies.ts` — `setSessionCookie`, `clearSessionCookie`, shared cookie options.
- `backend/src/auth/routes.ts` — `/auth` router.
- `backend/src/auth/password.test.ts`, `sessions.test.ts`, `routes.test.ts`, `middleware.test.ts`.
- `backend/src/test/auth.ts` — shared test helper to create an authenticated supertest agent.

**Backend — modified files**
- `backend/prisma/schema.prisma`, `backend/prisma/seed.ts`
- `backend/src/app.ts`
- `backend/src/routes/tasks.ts`, `projects.ts`, `labels.ts`, `library.ts` (+ their tests)
- `backend/src/github/store.ts`, `repos.ts`, `routes.ts` (+ `store.test.ts`, `routes.test.ts`)
- `backend/package.json` (add `cookie-parser`), `backend/render.yaml` (add `NODE_ENV`)

**Frontend — new files**
- `frontend/src/lib/auth-context.tsx` — `AuthProvider` + context.
- `frontend/src/hooks/useAuth.ts` — `useAuth()` hook.
- `frontend/src/pages/AuthPage.tsx` — login/signup screen.
- `frontend/src/components/account/AccountMenu.tsx` — logout + change-password dialog.

**Frontend — modified files**
- `frontend/src/lib/api.ts`, `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/components/layout/Sidebar.tsx`, `frontend/src/types.ts`

---

## Task 1: Schema — User/Workspace/Membership/Session + ownership columns

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Migration: generated under `backend/prisma/migrations/`

**Interfaces:**
- Produces: Prisma models `User`, `Workspace`, `Membership`, `Session`, enum `Role`; a required `workspaceId String` + relation on `Project`, `Label`, `Task`, `Shelf`, `GithubUserToken`, `GithubInstallation`. `GithubUserToken` loses global `@unique` on `githubUserId`, gains `@@unique([workspaceId, githubUserId])`.

- [ ] **Step 1: Add the new models and enum to `schema.prisma`**

Add after the existing `enum Priority { ... }` block:

```prisma
enum Role {
  OWNER
  MEMBER
  VIEWER
}

model User {
  id           String       @id @default(cuid())
  email        String       @unique
  passwordHash String
  memberships  Membership[]
  sessions     Session[]
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt
}

model Workspace {
  id                  String               @id @default(cuid())
  name                String               @default("My Workspace")
  memberships         Membership[]
  projects            Project[]
  labels              Label[]
  tasks               Task[]
  shelves             Shelf[]
  githubUserTokens    GithubUserToken[]
  githubInstallations GithubInstallation[]
  createdAt           DateTime             @default(now())
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
  tokenHash String   @unique
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([userId])
}
```

- [ ] **Step 2: Add `workspaceId` to each top-level model**

On `Project`, add inside the model body:
```prisma
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  workspaceId String
```
and add `@@index([workspaceId])`.

On `Label`, add the same two relation lines and `@@index([workspaceId])`.

On `Task`, add the same two relation lines; update the index block to include `@@index([workspaceId])`.

On `Shelf`, add the same two relation lines and `@@index([workspaceId])`.

On `GithubUserToken`: add the two relation lines, **remove** `@unique` from `githubUserId` (change `githubUserId Int @unique` to `githubUserId Int`), and add `@@unique([workspaceId, githubUserId])`.

On `GithubInstallation`: add the two relation lines and `@@index([workspaceId])` (keep `installationId @unique`).

- [ ] **Step 3: Create the migration (wipes existing data)**

The required `workspaceId` columns cannot be added to tables that contain rows, so the migration must clear them first. Run:

```bash
cd backend && pnpm prisma migrate dev --name multi_user_auth --create-only
```

Then open the generated `migration.sql` and add, **at the very top**, before the generated `ALTER TABLE`/`CREATE TABLE` statements:

```sql
-- Wipe existing single-user demo data so required workspaceId columns can be added.
TRUNCATE TABLE "Page", "Book", "Shelf", "Task", "Label", "Project", "GithubUserToken", "GithubInstallation" RESTART IDENTITY CASCADE;
```

- [ ] **Step 4: Apply the migration and regenerate the client**

Run:
```bash
cd backend && pnpm prisma migrate dev --name multi_user_auth
```
Expected: migration applies cleanly; `prisma generate` runs; output ends with "Your database is now in sync with your schema."

- [ ] **Step 5: Verify the client compiles**

Run: `cd backend && pnpm lint`
Expected: PASS (no type errors). The seed and existing routes will be fixed in later tasks; if `pnpm lint` reports errors only in `seed.ts`/route files about missing `workspaceId`, that is expected and fixed in Tasks 8–12. (Schema-only compile of generated client should pass.)

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(db): add User/Workspace/Membership/Session and workspace ownership"
```

---

## Task 2: Password hashing utility

**Files:**
- Create: `backend/src/auth/password.ts`
- Test: `backend/src/auth/password.test.ts`

**Interfaces:**
- Produces: `hashPassword(plain: string): string`, `verifyPassword(plain: string, stored: string): boolean`.

- [ ] **Step 1: Write the failing test**

`backend/src/auth/password.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password", () => {
  it("round-trips a correct password", () => {
    const stored = hashPassword("correct horse battery");
    expect(stored).toContain(":");
    expect(stored).not.toContain("correct horse battery");
    expect(verifyPassword("correct horse battery", stored)).toBe(true);
  });

  it("rejects a wrong password", () => {
    const stored = hashPassword("right-one");
    expect(verifyPassword("wrong-one", stored)).toBe(false);
  });

  it("produces a different hash each call (random salt)", () => {
    expect(hashPassword("same")).not.toBe(hashPassword("same"));
  });

  it("returns false for a malformed stored value", () => {
    expect(verifyPassword("x", "garbage-no-colon")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pnpm vitest run src/auth/password.test.ts`
Expected: FAIL ("Cannot find module './password'").

- [ ] **Step 3: Write the implementation**

`backend/src/auth/password.ts`:
```ts
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEYLEN = 64;

export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, KEYLEN);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(plain, Buffer.from(saltHex, "hex"), KEYLEN);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pnpm vitest run src/auth/password.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/auth/password.ts backend/src/auth/password.test.ts
git commit -m "feat(auth): scrypt password hashing"
```

---

## Task 3: Session store

**Files:**
- Create: `backend/src/auth/sessions.ts`
- Test: `backend/src/auth/sessions.test.ts`

**Interfaces:**
- Consumes: `prisma` from `../prisma.js`.
- Produces:
  - `createSession(userId: string): Promise<{ token: string; expiresAt: Date }>`
  - `findSession(token: string): Promise<{ id: string; userId: string; expiresAt: Date } | null>`
  - `deleteSession(token: string): Promise<void>`
  - `deleteUserSessions(userId: string, exceptToken?: string): Promise<void>`

- [ ] **Step 1: Write the failing test**

`backend/src/auth/sessions.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../prisma";
import { createSession, findSession, deleteSession, deleteUserSessions } from "./sessions";

async function makeUser() {
  return prisma.user.create({ data: { email: `u${Math.random()}@e.com`, passwordHash: "x" } });
}

beforeEach(async () => {
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
});
afterAll(async () => { await prisma.$disconnect(); });

describe("sessions", () => {
  it("creates a session and finds it by raw token, storing only a hash", async () => {
    const user = await makeUser();
    const { token } = await createSession(user.id);
    const row = await prisma.session.findFirst();
    expect(row!.tokenHash).not.toBe(token);
    const found = await findSession(token);
    expect(found!.userId).toBe(user.id);
  });

  it("returns null for an unknown token", async () => {
    expect(await findSession("nope")).toBeNull();
  });

  it("rejects and removes an expired session", async () => {
    const user = await makeUser();
    const { token } = await createSession(user.id);
    await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await findSession(token)).toBeNull();
    expect(await prisma.session.count()).toBe(0);
  });

  it("deletes a single session by token", async () => {
    const user = await makeUser();
    const { token } = await createSession(user.id);
    await deleteSession(token);
    expect(await findSession(token)).toBeNull();
  });

  it("deletes all of a user's sessions except an optional one", async () => {
    const user = await makeUser();
    const keep = await createSession(user.id);
    await createSession(user.id);
    await deleteUserSessions(user.id, keep.token);
    expect(await prisma.session.count()).toBe(1);
    expect(await findSession(keep.token)).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pnpm vitest run src/auth/sessions.test.ts`
Expected: FAIL ("Cannot find module './sessions'").

- [ ] **Step 3: Write the implementation**

`backend/src/auth/sessions.ts`:
```ts
import { randomBytes, createHash } from "node:crypto";
import { prisma } from "../prisma.js";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + THIRTY_DAYS_MS);
  await prisma.session.create({ data: { tokenHash: sha256(token), userId, expiresAt } });
  return { token, expiresAt };
}

export async function findSession(token: string) {
  const session = await prisma.session.findUnique({ where: { tokenHash: sha256(token) } });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session;
}

export async function deleteSession(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
}

export async function deleteUserSessions(userId: string, exceptToken?: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId, ...(exceptToken ? { tokenHash: { not: sha256(exceptToken) } } : {}) },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pnpm vitest run src/auth/sessions.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/auth/sessions.ts backend/src/auth/sessions.test.ts
git commit -m "feat(auth): DB-backed sessions with hashed tokens"
```

---

## Task 4: Cookie helpers + auth middleware

**Files:**
- Create: `backend/src/auth/cookies.ts`, `backend/src/auth/middleware.ts`
- Test: `backend/src/auth/middleware.test.ts`
- Modify: `backend/package.json` (add `cookie-parser` + `@types/cookie-parser`)

**Interfaces:**
- Consumes: `findSession` (Task 3), `prisma`, `asyncHandler`.
- Produces:
  - `cookies.ts`: `SESSION_COOKIE = "sid"`, `setSessionCookie(res, token, expiresAt)`, `clearSessionCookie(res)`.
  - `middleware.ts`: `requireAuth` Express handler; augments `Express.Request` with `userId?: string` and `workspaceId?: string`.

- [ ] **Step 1: Install cookie-parser**

Run:
```bash
cd backend && pnpm add cookie-parser && pnpm add -D @types/cookie-parser
```
Expected: both packages added to `package.json`.

- [ ] **Step 2: Write the cookie helper**

`backend/src/auth/cookies.ts`:
```ts
import type { Response } from "express";

export const SESSION_COOKIE = "sid";

const isProd = process.env.NODE_ENV === "production";
const baseOpts = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? "none" : "lax") as "none" | "lax",
  path: "/",
};

export function setSessionCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(SESSION_COOKIE, token, { ...baseOpts, expires: expiresAt });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, baseOpts);
}
```

- [ ] **Step 3: Write the failing middleware test**

`backend/src/auth/middleware.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { prisma } from "../prisma";
import { createSession } from "./sessions";
import { requireAuth } from "./middleware";

function appWithGuard() {
  const app = express();
  app.use(cookieParser());
  app.get("/secret", requireAuth, (req, res) => res.json({ workspaceId: req.workspaceId, userId: req.userId }));
  return app;
}

async function userWithWorkspace() {
  const ws = await prisma.workspace.create({ data: {} });
  const user = await prisma.user.create({
    data: { email: `u${Math.random()}@e.com`, passwordHash: "x", memberships: { create: { role: "OWNER", workspaceId: ws.id } } },
  });
  return { user, ws };
}

beforeEach(async () => {
  await prisma.session.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.workspace.deleteMany();
});
afterAll(async () => { await prisma.$disconnect(); });

describe("requireAuth", () => {
  it("401s with no cookie", async () => {
    const res = await request(appWithGuard()).get("/secret");
    expect(res.status).toBe(401);
  });

  it("401s with an invalid token", async () => {
    const res = await request(appWithGuard()).get("/secret").set("Cookie", "sid=bogus");
    expect(res.status).toBe(401);
  });

  it("passes and attaches userId + workspaceId for a valid session", async () => {
    const { user, ws } = await userWithWorkspace();
    const { token } = await createSession(user.id);
    const res = await request(appWithGuard()).get("/secret").set("Cookie", `sid=${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ userId: user.id, workspaceId: ws.id });
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd backend && pnpm vitest run src/auth/middleware.test.ts`
Expected: FAIL ("Cannot find module './middleware'").

- [ ] **Step 5: Write the middleware**

`backend/src/auth/middleware.ts`:
```ts
import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../errors.js";
import { prisma } from "../prisma.js";
import { findSession } from "./sessions.js";
import { SESSION_COOKIE } from "./cookies.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      workspaceId?: string;
    }
  }
}

function unauthorized(res: Response) {
  return res.status(401).json({ error: { message: "Unauthorized" } });
}

export const requireAuth = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!token) return unauthorized(res);
  const session = await findSession(token);
  if (!session) return unauthorized(res);
  const membership = await prisma.membership.findFirst({ where: { userId: session.userId } });
  if (!membership) return unauthorized(res);
  req.userId = session.userId;
  req.workspaceId = membership.workspaceId;
  next();
});
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd backend && pnpm vitest run src/auth/middleware.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add backend/src/auth/cookies.ts backend/src/auth/middleware.ts backend/src/auth/middleware.test.ts backend/package.json backend/pnpm-lock.yaml
git commit -m "feat(auth): session cookie helpers and requireAuth middleware"
```

---

## Task 5: Auth routes (/auth)

**Files:**
- Create: `backend/src/auth/routes.ts`
- Test: `backend/src/auth/routes.test.ts`

**Interfaces:**
- Consumes: `hashPassword`/`verifyPassword` (Task 2), session fns (Task 3), cookie helpers + `requireAuth` (Task 4), `prisma`, `asyncHandler`, `AppError`.
- Produces: `authRouter` with `POST /signup`, `POST /login`, `POST /logout`, `GET /me`, `POST /change-password`.

- [ ] **Step 1: Write the failing test**

`backend/src/auth/routes.test.ts`:
```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { prisma } from "../prisma";
import { errorMiddleware } from "../middleware/error";
import { authRouter } from "./routes";

function app() {
  const a = express();
  a.use(express.json());
  a.use(cookieParser());
  a.use("/auth", authRouter);
  a.use(errorMiddleware);
  return a;
}

beforeEach(async () => {
  await prisma.session.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.workspace.deleteMany();
});
afterAll(async () => { await prisma.$disconnect(); });

describe("auth routes", () => {
  it("signs up: creates user + workspace + membership, sets cookie", async () => {
    const res = await request(app()).post("/auth/signup").send({ email: "A@Example.com", password: "password1" });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("a@example.com");
    expect(res.headers["set-cookie"][0]).toContain("sid=");
    expect(await prisma.workspace.count()).toBe(1);
    expect(await prisma.membership.count()).toBe(1);
  });

  it("rejects a short password with 400", async () => {
    const res = await request(app()).post("/auth/signup").send({ email: "a@e.com", password: "short" });
    expect(res.status).toBe(400);
  });

  it("rejects a duplicate email with 409", async () => {
    await request(app()).post("/auth/signup").send({ email: "dup@e.com", password: "password1" });
    const res = await request(app()).post("/auth/signup").send({ email: "dup@e.com", password: "password1" });
    expect(res.status).toBe(409);
  });

  it("logs in with correct credentials and 401s on wrong password", async () => {
    await request(app()).post("/auth/signup").send({ email: "l@e.com", password: "password1" });
    const ok = await request(app()).post("/auth/login").send({ email: "l@e.com", password: "password1" });
    expect(ok.status).toBe(200);
    const bad = await request(app()).post("/auth/login").send({ email: "l@e.com", password: "nope" });
    expect(bad.status).toBe(401);
  });

  it("GET /me returns the user when authed, 401 when not", async () => {
    const agent = request.agent(app());
    await agent.post("/auth/signup").send({ email: "me@e.com", password: "password1" });
    const me = await agent.get("/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe("me@e.com");
    const anon = await request(app()).get("/auth/me");
    expect(anon.status).toBe(401);
  });

  it("logout clears the session", async () => {
    const agent = request.agent(app());
    await agent.post("/auth/signup").send({ email: "out@e.com", password: "password1" });
    expect((await agent.post("/auth/logout")).status).toBe(204);
    expect((await agent.get("/auth/me")).status).toBe(401);
  });

  it("change-password verifies current, updates, and invalidates other sessions", async () => {
    const agent = request.agent(app());
    await agent.post("/auth/signup").send({ email: "cp@e.com", password: "password1" });
    // a second, independent session for the same user
    const other = request.agent(app());
    await other.post("/auth/login").send({ email: "cp@e.com", password: "password1" });

    const bad = await agent.post("/auth/change-password").send({ currentPassword: "wrong", newPassword: "password2" });
    expect(bad.status).toBe(400);

    const ok = await agent.post("/auth/change-password").send({ currentPassword: "password1", newPassword: "password2" });
    expect(ok.status).toBe(204);

    // current session still valid, the other one is revoked
    expect((await agent.get("/auth/me")).status).toBe(200);
    expect((await other.get("/auth/me")).status).toBe(401);
    // new password works
    expect((await request(app()).post("/auth/login").send({ email: "cp@e.com", password: "password2" })).status).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pnpm vitest run src/auth/routes.test.ts`
Expected: FAIL ("Cannot find module './routes'").

- [ ] **Step 3: Write the implementation**

`backend/src/auth/routes.ts`:
```ts
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { asyncHandler, AppError } from "../errors.js";
import { hashPassword, verifyPassword } from "./password.js";
import { createSession, deleteSession, deleteUserSessions } from "./sessions.js";
import { requireAuth } from "./middleware.js";
import { setSessionCookie, clearSessionCookie, SESSION_COOKIE } from "./cookies.js";

export const authRouter = Router();

const credentials = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(200),
});
const changePassword = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(200),
});

const publicUser = (u: { id: string; email: string }) => ({ id: u.id, email: u.email });

authRouter.post("/signup", asyncHandler(async (req, res) => {
  const { email, password } = credentials.parse(req.body);
  const normalized = email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email: normalized } })) {
    throw new AppError(409, "Email already registered");
  }
  const user = await prisma.user.create({
    data: {
      email: normalized,
      passwordHash: hashPassword(password),
      memberships: { create: { role: "OWNER", workspace: { create: {} } } },
    },
  });
  const { token, expiresAt } = await createSession(user.id);
  setSessionCookie(res, token, expiresAt);
  res.status(201).json({ user: publicUser(user) });
}));

authRouter.post("/login", asyncHandler(async (req, res) => {
  const { email, password } = credentials.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new AppError(401, "Invalid email or password");
  }
  const { token, expiresAt } = await createSession(user.id);
  setSessionCookie(res, token, expiresAt);
  res.json({ user: publicUser(user) });
}));

authRouter.get("/me", requireAuth, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { id: true, email: true },
  });
  if (!user) throw new AppError(401, "Unauthorized");
  res.json({ user });
}));

authRouter.post("/logout", requireAuth, asyncHandler(async (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (token) await deleteSession(token);
  clearSessionCookie(res);
  res.status(204).end();
}));

authRouter.post("/change-password", requireAuth, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = changePassword.parse(req.body);
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
    throw new AppError(400, "Current password is incorrect");
  }
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(newPassword) } });
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  await deleteUserSessions(user.id, token);
  res.status(204).end();
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pnpm vitest run src/auth/routes.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/auth/routes.ts backend/src/auth/routes.test.ts
git commit -m "feat(auth): signup/login/logout/me/change-password routes"
```

---

## Task 6: Wire app.ts (cookies, CORS, mount /auth, guard data routes)

**Files:**
- Modify: `backend/src/app.ts`
- Create: `backend/src/test/auth.ts` (test helper)
- Test: `backend/src/app.test.ts` (extend existing)

**Interfaces:**
- Consumes: `authRouter`, `requireAuth`, `cookieParser`.
- Produces: `backend/src/test/auth.ts` exporting `authedAgent(app): Promise<TestAgent>` and `signup(agent, email?, password?)`. Data routers are now mounted behind `requireAuth`.

- [ ] **Step 1: Update `app.ts`**

Replace the body of `createApp` so it reads:
```ts
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { AppError } from "./errors.js";
import { errorMiddleware } from "./middleware/error.js";
import { authRouter } from "./auth/routes.js";
import { requireAuth } from "./auth/middleware.js";
import { tasksRouter } from "./routes/tasks.js";
import { projectsRouter } from "./routes/projects.js";
import { labelsRouter } from "./routes/labels.js";
import { githubRouter } from "./github/routes.js";
import { libraryRouter } from "./routes/library.js";

export function createApp() {
  const app = express();
  app.use(cors({ origin: process.env.FRONTEND_URL || true, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/auth", authRouter);
  app.use("/tasks", requireAuth, tasksRouter);
  app.use("/projects", requireAuth, projectsRouter);
  app.use("/labels", requireAuth, labelsRouter);
  app.use("/github", requireAuth, githubRouter);
  app.use(requireAuth, libraryRouter);

  app.use((_req, _res, next) => next(new AppError(404, "Not found")));
  app.use(errorMiddleware);
  return app;
}
```

- [ ] **Step 2: Write the test helper**

`backend/src/test/auth.ts`:
```ts
import request from "supertest";
import type { Express } from "express";

export type Agent = ReturnType<typeof request.agent>;

let counter = 0;

/** Create a fresh user + workspace and return a cookie-persisting agent for it. */
export async function authedAgent(app: Express): Promise<Agent> {
  const agent = request.agent(app);
  const email = `user${counter++}_${Date.now()}@test.com`;
  const res = await agent.post("/auth/signup").send({ email, password: "password1" });
  if (res.status !== 201) throw new Error(`signup failed: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}
```

- [ ] **Step 3: Update `app.test.ts` for the new auth surface**

Read the existing `backend/src/app.test.ts` first. It currently asserts unauthenticated behaviour on `/health` and likely a 404. Keep the `/health` assertion. Add a guard assertion and replace any unauthenticated data-route call. Ensure the file contains these cases (add the ones missing):
```ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "./app";

const app = createApp();

describe("app", () => {
  it("health is public", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("guards data routes with 401 when unauthenticated", async () => {
    expect((await request(app).get("/tasks")).status).toBe(401);
    expect((await request(app).get("/projects")).status).toBe(401);
  });

  it("unknown route 404s", async () => {
    expect((await request(app).get("/definitely-not-a-route")).status).toBe(404);
  });
});
```

- [ ] **Step 4: Run the app test**

Run: `cd backend && pnpm vitest run src/app.test.ts`
Expected: PASS. (Other route tests will fail until Tasks 7–11 update them — that is expected now.)

- [ ] **Step 5: Commit**

```bash
git add backend/src/app.ts backend/src/test/auth.ts backend/src/app.test.ts
git commit -m "feat(auth): mount /auth, guard data routes, CORS credentials, test helper"
```

---

## Task 7: Scope the tasks routes by workspace

**Files:**
- Modify: `backend/src/routes/tasks.ts`
- Test: `backend/src/routes/tasks.test.ts`

**Interfaces:**
- Consumes: `req.workspaceId` (Task 4), `authedAgent` (Task 6).
- Produces: tasks routes that filter/create/guard by `req.workspaceId`.

- [ ] **Step 1: Update the tasks test to use an authed agent + add isolation**

Rewrite `backend/src/routes/tasks.test.ts` to obtain an agent and assert cross-workspace isolation:
```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { createApp } from "../app";
import { prisma } from "../prisma";
import { authedAgent, type Agent } from "../test/auth";

const app = createApp();
let agent: Agent;

beforeEach(async () => {
  await prisma.task.deleteMany();
  await prisma.label.deleteMany();
  await prisma.project.deleteMany();
  await prisma.session.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.workspace.deleteMany();
  agent = await authedAgent(app);
});
afterAll(async () => { await prisma.$disconnect(); });

describe("tasks API", () => {
  it("creates and lists a task", async () => {
    const create = await agent.post("/tasks").send({ title: "First" });
    expect(create.status).toBe(201);
    expect(create.body.title).toBe("First");
    expect(create.body.status).toBe("BACKLOG");
    const list = await agent.get("/tasks");
    expect(list.body).toHaveLength(1);
    expect(typeof list.body[0].createdAt).toBe("string");
  });

  it("rejects invalid create with 400", async () => {
    const res = await agent.post("/tasks").send({ title: "" });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe("Validation failed");
  });

  it("patches status and 404s unknown id", async () => {
    const t = await agent.post("/tasks").send({ title: "x" });
    const patch = await agent.patch(`/tasks/${t.body.id}`).send({ status: "DONE", sortOrder: 5 });
    expect(patch.status).toBe(200);
    expect(patch.body.status).toBe("DONE");
    expect((await agent.patch("/tasks/nope").send({ status: "DONE" })).status).toBe(404);
  });

  it("filters by status", async () => {
    await agent.post("/tasks").send({ title: "a", status: "TODO" });
    await agent.post("/tasks").send({ title: "b", status: "DONE" });
    const res = await agent.get("/tasks?status=TODO");
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe("a");
  });

  it("attaches labels", async () => {
    const label = await agent.post("/labels").send({ name: "bug" });
    const t = await agent.post("/tasks").send({ title: "y", labelIds: [label.body.id] });
    expect(t.body.labels[0].name).toBe("bug");
  });

  it("deletes a task", async () => {
    const t = await agent.post("/tasks").send({ title: "z" });
    expect((await agent.delete(`/tasks/${t.body.id}`)).status).toBe(204);
    expect((await agent.get("/tasks")).body).toHaveLength(0);
  });

  it("isolates tasks between workspaces", async () => {
    const mine = await agent.post("/tasks").send({ title: "mine" });
    const other = await authedAgent(app);
    expect((await other.get("/tasks")).body).toHaveLength(0);
    expect((await other.get(`/tasks/${mine.body.id}`)).status).toBe(404);
    expect((await other.patch(`/tasks/${mine.body.id}`).send({ status: "DONE" })).status).toBe(404);
    expect((await other.delete(`/tasks/${mine.body.id}`)).status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pnpm vitest run src/routes/tasks.test.ts`
Expected: FAIL (isolation test fails — other workspace currently sees/edits the task; list/get not scoped).

- [ ] **Step 3: Scope the tasks router**

Rewrite `backend/src/routes/tasks.ts` handlers to use `req.workspaceId`:
```ts
import { Router } from "express";
import { createTaskSchema, updateTaskSchema, taskFilterSchema } from "../schemas.js";
import { prisma } from "../prisma.js";
import { asyncHandler } from "../errors.js";

export const tasksRouter = Router();

const taskInclude = { labels: { select: { id: true, name: true, color: true } } } as const;

type Row = {
  id: string; title: string; description: string | null;
  status: string; priority: string; dueDate: Date | null;
  projectId: string | null; sortOrder: number;
  labels: { id: string; name: string; color: string }[];
  createdAt: Date; updatedAt: Date;
};

function serializeTask(t: Row) {
  return {
    ...t,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

tasksRouter.get("/", asyncHandler(async (req, res) => {
  const f = taskFilterSchema.parse(req.query);
  const rows = await prisma.task.findMany({
    where: {
      workspaceId: req.workspaceId,
      status: f.status, priority: f.priority, projectId: f.projectId,
      ...(f.labelId ? { labels: { some: { id: f.labelId } } } : {}),
    },
    include: taskInclude,
    orderBy: { sortOrder: "asc" },
  });
  res.json(rows.map(serializeTask));
}));

tasksRouter.post("/", asyncHandler(async (req, res) => {
  const { labelIds, ...data } = createTaskSchema.parse(req.body);
  const row = await prisma.task.create({
    data: {
      ...data,
      workspaceId: req.workspaceId!,
      labels: labelIds ? { connect: labelIds.map((id) => ({ id })) } : undefined,
    },
    include: taskInclude,
  });
  res.status(201).json(serializeTask(row));
}));

tasksRouter.get("/:id", asyncHandler(async (req, res) => {
  const row = await prisma.task.findFirst({
    where: { id: req.params.id, workspaceId: req.workspaceId },
    include: taskInclude,
  });
  if (!row) return res.status(404).json({ error: { message: "Not found" } });
  res.json(serializeTask(row));
}));

tasksRouter.patch("/:id", asyncHandler(async (req, res) => {
  const { labelIds, ...data } = updateTaskSchema.parse(req.body);
  const existing = await prisma.task.findFirst({ where: { id: req.params.id, workspaceId: req.workspaceId } });
  if (!existing) return res.status(404).json({ error: { message: "Not found" } });
  const row = await prisma.task.update({
    where: { id: req.params.id },
    data: { ...data, labels: labelIds ? { set: labelIds.map((id) => ({ id })) } : undefined },
    include: taskInclude,
  });
  res.json(serializeTask(row));
}));

tasksRouter.delete("/:id", asyncHandler(async (req, res) => {
  const result = await prisma.task.deleteMany({ where: { id: req.params.id, workspaceId: req.workspaceId } });
  if (result.count === 0) return res.status(404).json({ error: { message: "Not found" } });
  res.status(204).end();
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pnpm vitest run src/routes/tasks.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/tasks.ts backend/src/routes/tasks.test.ts
git commit -m "feat(tasks): scope tasks routes to workspace"
```

---

## Task 8: Scope the projects and labels routes by workspace

**Files:**
- Modify: `backend/src/routes/projects.ts`, `backend/src/routes/labels.ts`
- Test: `backend/src/routes/projects.test.ts`, `backend/src/routes/labels.test.ts`

**Interfaces:**
- Consumes: `req.workspaceId`, `authedAgent`.
- Produces: projects/labels routes scoped by workspace.

- [ ] **Step 1: Update the projects + labels tests to use an authed agent + isolation**

Read `backend/src/routes/projects.test.ts` and `labels.test.ts`. In each: add the auth/membership/workspace tables to the `beforeEach` cleanup (same six `deleteMany` calls as Task 7), create `agent = await authedAgent(app)` in `beforeEach`, and replace every `request(app)` with `agent`. Add one isolation test per file. For projects:
```ts
it("isolates projects between workspaces", async () => {
  const mine = await agent.post("/projects").send({ name: "Mine" });
  const other = await authedAgent(app);
  expect((await other.get("/projects")).body).toHaveLength(0);
  expect((await other.patch(`/projects/${mine.body.id}`).send({ name: "Hax" })).status).toBe(404);
  expect((await other.delete(`/projects/${mine.body.id}`)).status).toBe(404);
});
```
For labels (same shape, `/labels`, body `{ name: "bug" }`, patch `{ name: "x" }`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && pnpm vitest run src/routes/projects.test.ts src/routes/labels.test.ts`
Expected: FAIL (isolation assertions fail).

- [ ] **Step 3: Scope the projects router**

Rewrite `backend/src/routes/projects.ts`:
```ts
import { Router } from "express";
import { createProjectSchema, updateProjectSchema } from "../schemas.js";
import { prisma } from "../prisma.js";
import { asyncHandler } from "../errors.js";

export const projectsRouter = Router();

const ser = (p: { createdAt: Date; updatedAt: Date } & Record<string, unknown>) => ({
  ...p, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(),
});

projectsRouter.get("/", asyncHandler(async (req, res) => {
  res.json((await prisma.project.findMany({
    where: { workspaceId: req.workspaceId }, orderBy: { createdAt: "asc" },
  })).map(ser));
}));
projectsRouter.post("/", asyncHandler(async (req, res) => {
  const data = createProjectSchema.parse(req.body);
  res.status(201).json(ser(await prisma.project.create({ data: { ...data, workspaceId: req.workspaceId! } })));
}));
projectsRouter.patch("/:id", asyncHandler(async (req, res) => {
  const data = updateProjectSchema.parse(req.body);
  const existing = await prisma.project.findFirst({ where: { id: req.params.id, workspaceId: req.workspaceId } });
  if (!existing) return res.status(404).json({ error: { message: "Not found" } });
  res.json(ser(await prisma.project.update({ where: { id: req.params.id }, data })));
}));
projectsRouter.delete("/:id", asyncHandler(async (req, res) => {
  const result = await prisma.project.deleteMany({ where: { id: req.params.id, workspaceId: req.workspaceId } });
  if (result.count === 0) return res.status(404).json({ error: { message: "Not found" } });
  res.status(204).end();
}));
```

- [ ] **Step 4: Scope the labels router**

Rewrite `backend/src/routes/labels.ts`:
```ts
import { Router } from "express";
import { createLabelSchema, updateLabelSchema } from "../schemas.js";
import { prisma } from "../prisma.js";
import { asyncHandler } from "../errors.js";

export const labelsRouter = Router();

const ser = (l: { createdAt: Date } & Record<string, unknown>) => ({ ...l, createdAt: l.createdAt.toISOString() });

labelsRouter.get("/", asyncHandler(async (req, res) => {
  res.json((await prisma.label.findMany({
    where: { workspaceId: req.workspaceId }, orderBy: { createdAt: "asc" },
  })).map(ser));
}));
labelsRouter.post("/", asyncHandler(async (req, res) => {
  const data = createLabelSchema.parse(req.body);
  res.status(201).json(ser(await prisma.label.create({ data: { ...data, workspaceId: req.workspaceId! } })));
}));
labelsRouter.patch("/:id", asyncHandler(async (req, res) => {
  const data = updateLabelSchema.parse(req.body);
  const existing = await prisma.label.findFirst({ where: { id: req.params.id, workspaceId: req.workspaceId } });
  if (!existing) return res.status(404).json({ error: { message: "Not found" } });
  res.json(ser(await prisma.label.update({ where: { id: req.params.id }, data })));
}));
labelsRouter.delete("/:id", asyncHandler(async (req, res) => {
  const result = await prisma.label.deleteMany({ where: { id: req.params.id, workspaceId: req.workspaceId } });
  if (result.count === 0) return res.status(404).json({ error: { message: "Not found" } });
  res.status(204).end();
}));
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && pnpm vitest run src/routes/projects.test.ts src/routes/labels.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/projects.ts backend/src/routes/labels.ts backend/src/routes/projects.test.ts backend/src/routes/labels.test.ts
git commit -m "feat(projects,labels): scope routes to workspace"
```

---

## Task 9: Scope the library routes by workspace

**Files:**
- Modify: `backend/src/routes/library.ts`
- Test: `backend/src/routes/library.test.ts`

**Interfaces:**
- Consumes: `req.workspaceId`, `authedAgent`.
- Produces: library routes scoped by workspace. Shelves carry `workspaceId`; books/pages are reached only through a shelf the workspace owns. New helper `ownedShelfId(workspaceId, shelfId)` / ownership guards on book/page operations.

- [ ] **Step 1: Update the library test to use an authed agent + isolation**

Read `backend/src/routes/library.test.ts`. Add the six auth/workspace `deleteMany` calls to `beforeEach`, plus `await prisma.page.deleteMany(); await prisma.book.deleteMany(); await prisma.shelf.deleteMany();`. Create `agent = await authedAgent(app)` and replace `request(app)` with `agent`. Add:
```ts
it("isolates the general shelf and books between workspaces", async () => {
  const shelf = await agent.get("/shelf");
  const book = await agent.post(`/shelves/${shelf.body.id}/books`).send({ name: "Mine" });
  const other = await authedAgent(app);
  const otherShelf = await other.get("/shelf");
  expect(otherShelf.body.id).not.toBe(shelf.body.id);
  expect(otherShelf.body.books).toHaveLength(0);
  expect((await other.get(`/books/${book.body.id}`)).status).toBe(404);
  expect((await other.delete(`/books/${book.body.id}`)).status).toBe(404);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pnpm vitest run src/routes/library.test.ts`
Expected: FAIL (general shelf is shared; cross-workspace book access succeeds).

- [ ] **Step 3: Scope the library router**

Rewrite `backend/src/routes/library.ts`:
```ts
import { Router } from "express";
import { createBookSchema, updateBookSchema, updateShelfSchema, createPageSchema, updatePageSchema } from "../schemas.js";
import { prisma } from "../prisma.js";
import { asyncHandler, AppError } from "../errors.js";

export const libraryRouter = Router();

const iso = (d: Date) => d.toISOString();

type ShelfRow = { id: string; projectId: string | null; name: string; description: string | null };

async function shelfWithBooks(shelf: ShelfRow) {
  const books = await prisma.book.findMany({
    where: { shelfId: shelf.id },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { pages: true } } },
  });
  return {
    id: shelf.id, projectId: shelf.projectId, name: shelf.name, description: shelf.description,
    books: books.map((b) => ({
      id: b.id, name: b.name, description: b.description, color: b.color,
      sortOrder: b.sortOrder, pageCount: b._count.pages,
    })),
  };
}

// Confirm a shelf belongs to the workspace; returns it or null.
async function ownedShelf(workspaceId: string | undefined, shelfId: string) {
  return prisma.shelf.findFirst({ where: { id: shelfId, workspaceId } });
}
// Confirm a book belongs to a shelf in the workspace; returns it or null.
async function ownedBook(workspaceId: string | undefined, bookId: string) {
  return prisma.book.findFirst({ where: { id: bookId, shelf: { workspaceId } } });
}
// Confirm a page belongs to a book/shelf in the workspace; returns it or null.
async function ownedPage(workspaceId: string | undefined, pageId: string) {
  return prisma.page.findFirst({ where: { id: pageId, book: { shelf: { workspaceId } } } });
}

// General shelf: not tied to any project; one per workspace (projectId = null).
libraryRouter.get("/shelf", asyncHandler(async (req, res) => {
  let shelf = await prisma.shelf.findFirst({ where: { projectId: null, workspaceId: req.workspaceId } });
  if (!shelf) shelf = await prisma.shelf.create({ data: { projectId: null, name: "General", workspaceId: req.workspaceId! } });
  res.json(await shelfWithBooks(shelf));
}));

libraryRouter.get("/projects/:projectId/shelf", asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId: req.workspaceId } });
  if (!project) throw new AppError(404, "Project not found");
  const shelf = await prisma.shelf.upsert({
    where: { projectId },
    create: { projectId, name: project.name, workspaceId: req.workspaceId! },
    update: { name: project.name },
  });
  res.json(await shelfWithBooks(shelf));
}));

libraryRouter.patch("/shelves/:id", asyncHandler(async (req, res) => {
  const data = updateShelfSchema.parse(req.body);
  if (!(await ownedShelf(req.workspaceId, req.params.id))) throw new AppError(404, "Shelf not found");
  const s = await prisma.shelf.update({ where: { id: req.params.id }, data });
  res.json({ id: s.id, projectId: s.projectId, name: s.name, description: s.description });
}));

libraryRouter.post("/shelves/:shelfId/books", asyncHandler(async (req, res) => {
  const data = createBookSchema.parse(req.body);
  if (!(await ownedShelf(req.workspaceId, req.params.shelfId))) throw new AppError(404, "Shelf not found");
  const b = await prisma.book.create({ data: { ...data, shelfId: req.params.shelfId, sortOrder: Date.now() } });
  res.status(201).json({ id: b.id, name: b.name, description: b.description, color: b.color, sortOrder: b.sortOrder, createdAt: iso(b.createdAt), updatedAt: iso(b.updatedAt) });
}));

libraryRouter.get("/books/:id", asyncHandler(async (req, res) => {
  if (!(await ownedBook(req.workspaceId, req.params.id))) throw new AppError(404, "Book not found");
  const b = await prisma.book.findUnique({
    where: { id: req.params.id },
    include: { pages: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true, sortOrder: true, updatedAt: true } } },
  });
  res.json({
    id: b!.id, name: b!.name, description: b!.description, color: b!.color, sortOrder: b!.sortOrder,
    pages: b!.pages.map((p) => ({ id: p.id, title: p.title, sortOrder: p.sortOrder, updatedAt: iso(p.updatedAt) })),
  });
}));

libraryRouter.patch("/books/:id", asyncHandler(async (req, res) => {
  const data = updateBookSchema.parse(req.body);
  if (!(await ownedBook(req.workspaceId, req.params.id))) throw new AppError(404, "Book not found");
  const b = await prisma.book.update({ where: { id: req.params.id }, data });
  res.json({ id: b.id, name: b.name, description: b.description, color: b.color, sortOrder: b.sortOrder });
}));

libraryRouter.delete("/books/:id", asyncHandler(async (req, res) => {
  if (!(await ownedBook(req.workspaceId, req.params.id))) throw new AppError(404, "Book not found");
  await prisma.book.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

libraryRouter.post("/books/:bookId/pages", asyncHandler(async (req, res) => {
  const data = createPageSchema.parse(req.body);
  if (!(await ownedBook(req.workspaceId, req.params.bookId))) throw new AppError(404, "Book not found");
  const p = await prisma.page.create({ data: { ...data, bookId: req.params.bookId, sortOrder: Date.now() } });
  res.status(201).json({ id: p.id, bookId: p.bookId, title: p.title, content: p.content, sortOrder: p.sortOrder, createdAt: iso(p.createdAt), updatedAt: iso(p.updatedAt) });
}));

libraryRouter.get("/pages/:id", asyncHandler(async (req, res) => {
  const p = await ownedPage(req.workspaceId, req.params.id);
  if (!p) throw new AppError(404, "Page not found");
  res.json({ id: p.id, bookId: p.bookId, title: p.title, content: p.content, sortOrder: p.sortOrder, createdAt: iso(p.createdAt), updatedAt: iso(p.updatedAt) });
}));

libraryRouter.patch("/pages/:id", asyncHandler(async (req, res) => {
  const data = updatePageSchema.parse(req.body);
  if (!(await ownedPage(req.workspaceId, req.params.id))) throw new AppError(404, "Page not found");
  const p = await prisma.page.update({ where: { id: req.params.id }, data });
  res.json({ id: p.id, bookId: p.bookId, title: p.title, content: p.content, sortOrder: p.sortOrder, createdAt: iso(p.createdAt), updatedAt: iso(p.updatedAt) });
}));

libraryRouter.delete("/pages/:id", asyncHandler(async (req, res) => {
  if (!(await ownedPage(req.workspaceId, req.params.id))) throw new AppError(404, "Page not found");
  await prisma.page.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pnpm vitest run src/routes/library.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/library.ts backend/src/routes/library.test.ts
git commit -m "feat(library): scope shelves/books/pages to workspace"
```

---

## Task 10: Scope the GitHub store, repos, and routes by workspace

**Files:**
- Modify: `backend/src/github/store.ts`, `backend/src/github/repos.ts`, `backend/src/github/routes.ts`
- Test: `backend/src/github/store.test.ts`, `backend/src/github/routes.test.ts`

**Interfaces:**
- Consumes: `req.workspaceId`, `authedAgent`.
- Produces (new signatures):
  - `saveUserToken(input: { workspaceId: string; githubUserId: number; login: string; avatarUrl: string; accessToken: string; scope: string })`
  - `getUserToken(workspaceId: string)` → same return shape as before (`{ login, avatarUrl, accessToken } | null`)
  - `deleteUserToken(workspaceId: string)`
  - `saveInstallation(i: { workspaceId: string; installationId: number; accountLogin: string; accountType: string; repositorySelection: string })`
  - `listInstallations(workspaceId: string)` → same return shape as before
  - `listRepositories(workspaceId: string)` → `RepoRef[]`

- [ ] **Step 1: Update the github store test**

Rewrite `backend/src/github/store.test.ts` to create a workspace and pass its id:
```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "../prisma";
import { saveUserToken, getUserToken, deleteUserToken, saveInstallation, listInstallations } from "./store";

const ENV = {
  GITHUB_TOKEN_ENC_KEY: Buffer.alloc(32, 3).toString("base64"), GITHUB_STATE_SECRET: "z",
  GITHUB_APP_ID: "1", GITHUB_APP_SLUG: "s", GITHUB_APP_CLIENT_ID: "c", GITHUB_APP_CLIENT_SECRET: "x",
  GITHUB_APP_PRIVATE_KEY_BASE64: Buffer.from("p").toString("base64"),
  GITHUB_OAUTH_REDIRECT_URI: "http://localhost:4000/github/callback", FRONTEND_URL: "http://localhost:5173",
};
Object.assign(process.env, ENV);

let workspaceId: string;
beforeEach(async () => {
  await prisma.githubUserToken.deleteMany();
  await prisma.githubInstallation.deleteMany();
  await prisma.workspace.deleteMany();
  workspaceId = (await prisma.workspace.create({ data: {} })).id;
});
afterAll(async () => { await prisma.$disconnect(); });

describe("github store", () => {
  it("saves and reads a user token (encrypted at rest)", async () => {
    await saveUserToken({ workspaceId, githubUserId: 7, login: "octo", avatarUrl: "http://a", accessToken: "ghu_secret", scope: "" });
    const row = await prisma.githubUserToken.findFirst();
    expect(row!.accessToken).not.toContain("ghu_secret");
    expect(await getUserToken(workspaceId)).toEqual({ login: "octo", avatarUrl: "http://a", accessToken: "ghu_secret" });
  });

  it("upserts installations and lists them per workspace", async () => {
    await saveInstallation({ workspaceId, installationId: 11, accountLogin: "acme", accountType: "Organization", repositorySelection: "all" });
    await saveInstallation({ workspaceId, installationId: 11, accountLogin: "acme", accountType: "Organization", repositorySelection: "selected" });
    const list = await listInstallations(workspaceId);
    expect(list).toHaveLength(1);
    expect(list[0].repositorySelection).toBe("selected");
  });

  it("deletes the user token", async () => {
    await saveUserToken({ workspaceId, githubUserId: 7, login: "o", avatarUrl: "a", accessToken: "t", scope: "" });
    await deleteUserToken(workspaceId);
    expect(await getUserToken(workspaceId)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pnpm vitest run src/github/store.test.ts`
Expected: FAIL (signatures don't accept `workspaceId`).

- [ ] **Step 3: Update `store.ts`**

Rewrite `backend/src/github/store.ts`:
```ts
import { prisma } from "../prisma.js";
import { encryptToken, decryptToken } from "./crypto.js";

export async function saveUserToken(input: {
  workspaceId: string; githubUserId: number; login: string; avatarUrl: string; accessToken: string; scope: string;
}): Promise<void> {
  const data = {
    login: input.login, avatarUrl: input.avatarUrl,
    accessToken: encryptToken(input.accessToken), scope: input.scope,
  };
  await prisma.githubUserToken.upsert({
    where: { workspaceId_githubUserId: { workspaceId: input.workspaceId, githubUserId: input.githubUserId } },
    create: { workspaceId: input.workspaceId, githubUserId: input.githubUserId, ...data },
    update: data,
  });
}

export async function getUserToken(workspaceId: string): Promise<{ login: string; avatarUrl: string; accessToken: string } | null> {
  const row = await prisma.githubUserToken.findFirst({ where: { workspaceId }, orderBy: { createdAt: "asc" } });
  if (!row) return null;
  return { login: row.login, avatarUrl: row.avatarUrl, accessToken: decryptToken(row.accessToken) };
}

export async function deleteUserToken(workspaceId: string): Promise<void> {
  await prisma.githubUserToken.deleteMany({ where: { workspaceId } });
}

export async function saveInstallation(i: {
  workspaceId: string; installationId: number; accountLogin: string; accountType: string; repositorySelection: string;
}): Promise<void> {
  const data = { accountLogin: i.accountLogin, accountType: i.accountType, repositorySelection: i.repositorySelection };
  await prisma.githubInstallation.upsert({
    where: { installationId: i.installationId },
    create: { installationId: i.installationId, workspaceId: i.workspaceId, ...data },
    update: { ...data, workspaceId: i.workspaceId },
  });
}

export async function listInstallations(workspaceId: string): Promise<Array<{
  installationId: number; accountLogin: string; accountType: string; repositorySelection: string;
}>> {
  const rows = await prisma.githubInstallation.findMany({ where: { workspaceId }, orderBy: { createdAt: "asc" } });
  return rows.map((r) => ({
    installationId: r.installationId, accountLogin: r.accountLogin,
    accountType: r.accountType, repositorySelection: r.repositorySelection,
  }));
}
```

Note: the upsert `where` uses the compound unique `workspaceId_githubUserId` from Task 1's `@@unique([workspaceId, githubUserId])`.

- [ ] **Step 4: Update `repos.ts`**

Rewrite `backend/src/github/repos.ts`:
```ts
import { request } from "@octokit/request";
import { installationToken } from "./appAuth.js";
import { listInstallations } from "./store.js";

export type RepoRef = { id: number; fullName: string; private: boolean; installationId: number };

/** Repositories the app can access for a workspace, aggregated across its installations. */
export async function listRepositories(workspaceId: string): Promise<RepoRef[]> {
  const installations = await listInstallations(workspaceId);
  const out: RepoRef[] = [];
  for (const inst of installations) {
    const token = await installationToken(inst.installationId);
    const res = await request("GET /installation/repositories", {
      headers: { authorization: `token ${token}` },
      per_page: 100,
    });
    const repos = (res.data as { repositories: { id: number; full_name: string; private: boolean }[] }).repositories;
    for (const r of repos) {
      out.push({ id: r.id, fullName: r.full_name, private: r.private, installationId: inst.installationId });
    }
  }
  out.sort((a, b) => a.fullName.localeCompare(b.fullName));
  return out;
}
```

- [ ] **Step 5: Update `routes.ts` to pass `req.workspaceId`**

In `backend/src/github/routes.ts`, update the handlers that call store/repos functions:

`/status`:
```ts
githubRouter.get("/status", asyncHandler(async (req, res) => {
  const user = await getUserToken(req.workspaceId!);
  res.json({
    user: user ? { login: user.login, avatarUrl: user.avatarUrl } : null,
    installations: await listInstallations(req.workspaceId!),
  });
}));
```

`/callback` — change the `saveUserToken` call to include the workspace:
```ts
  await saveUserToken({ workspaceId: req.workspaceId!, githubUserId: user.id, login: user.login, avatarUrl: user.avatarUrl, accessToken, scope });
```

`/setup` — change the `saveInstallation` call:
```ts
  await saveInstallation({ workspaceId: req.workspaceId!, ...meta });
```

`/repositories`:
```ts
githubRouter.get("/repositories", asyncHandler(async (req, res) => {
  res.json(await listRepositories(req.workspaceId!));
}));
```

`/contributions`:
```ts
githubRouter.get("/contributions", asyncHandler(async (req, res) => {
  const user = await getUserToken(req.workspaceId!);
  if (!user) throw new AppError(409, "GitHub not connected");
  res.json(await fetchContributions(user.accessToken));
}));
```

`/disconnect`:
```ts
githubRouter.post("/disconnect", asyncHandler(async (req, res) => {
  await deleteUserToken(req.workspaceId!);
  res.status(204).end();
}));
```

(The `/authorize`, `/install`, and `/repos/contents` handlers are unchanged except that they now run behind `requireAuth`.)

- [ ] **Step 6: Update the github routes test to use an authed agent**

Rewrite the harness section of `backend/src/github/routes.test.ts` (keep the `vi.mock(...)` blocks and `ENV` exactly as they are). Replace the app/cleanup/requests:
```ts
import { createApp } from "../app";
import { prisma } from "../prisma";
import { signState } from "./crypto";
import { authedAgent, type Agent } from "../test/auth";

const app = createApp();
let agent: Agent;

beforeEach(async () => {
  await prisma.githubUserToken.deleteMany();
  await prisma.githubInstallation.deleteMany();
  await prisma.session.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.workspace.deleteMany();
  agent = await authedAgent(app);
});
afterAll(async () => { await prisma.$disconnect(); });
```
Then replace every `request(app)` in the test bodies with `agent`. Add one isolation assertion at the end of the suite:
```ts
it("isolates github status between workspaces", async () => {
  await agent.get(`/github/callback?code=c&state=${encodeURIComponent(signState())}`);
  const other = await authedAgent(app);
  expect((await other.get("/github/status")).body).toEqual({ user: null, installations: [] });
});
```

- [ ] **Step 7: Run the github tests**

Run: `cd backend && pnpm vitest run src/github/store.test.ts src/github/routes.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/src/github/store.ts backend/src/github/repos.ts backend/src/github/routes.ts backend/src/github/store.test.ts backend/src/github/routes.test.ts
git commit -m "feat(github): scope tokens, installations, and repos to workspace"
```

---

## Task 11: Update the seed script + full backend test run + render.yaml

**Files:**
- Modify: `backend/prisma/seed.ts`, `backend/render.yaml`

**Interfaces:**
- Consumes: schema from Task 1.
- Produces: a seed that creates a demo user + workspace and attaches demo data to it; `NODE_ENV=production` on Render.

- [ ] **Step 1: Update `seed.ts` to create a demo user + workspace**

Rewrite `backend/prisma/seed.ts`:
```ts
import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";

const prisma = new PrismaClient();

function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(plain, salt, 64).toString("hex")}`;
}

async function main() {
  // Reset
  await prisma.task.deleteMany();
  await prisma.label.deleteMany();
  await prisma.project.deleteMany();

  const workspace = await prisma.workspace.create({ data: { name: "Demo Workspace" } });
  await prisma.user.create({
    data: {
      email: "demo@myschedule.app",
      passwordHash: hashPassword("password1"),
      memberships: { create: { role: "OWNER", workspaceId: workspace.id } },
    },
  });
  const workspaceId = workspace.id;

  const web = await prisma.project.create({ data: { name: "Website redesign", color: "#4FA3D1", workspaceId } });
  const mobile = await prisma.project.create({ data: { name: "Mobile app", color: "#E0B341", workspaceId } });

  const bug = await prisma.label.create({ data: { name: "bug", color: "#F4404A", workspaceId } });
  const feature = await prisma.label.create({ data: { name: "feature", color: "#4FA3D1", workspaceId } });
  const design = await prisma.label.create({ data: { name: "design", color: "#E0B341", workspaceId } });

  const tasks: Array<Parameters<typeof prisma.task.create>[0]["data"]> = [
    { title: "Fix the login redirect loop", status: "IN_PROGRESS", priority: "URGENT", sortOrder: 1,
      workspaceId, projectId: web.id, labels: { connect: [{ id: bug.id }] } },
    { title: "Ship the priority heat-spine on cards", status: "IN_PROGRESS", priority: "HIGH", sortOrder: 2,
      workspaceId, projectId: web.id, labels: { connect: [{ id: feature.id }] } },
    { title: "Design the empty-state for the board", status: "TODO", priority: "MEDIUM", sortOrder: 1,
      workspaceId, projectId: web.id, labels: { connect: [{ id: design.id }] } },
    { title: "Wire up the command palette search ranking", status: "TODO", priority: "LOW", sortOrder: 2, workspaceId },
    { title: "Add keyboard shortcut cheatsheet", status: "BACKLOG", priority: "NONE", sortOrder: 1,
      workspaceId, projectId: mobile.id },
    { title: "Evaluate offline-first sync for the app", status: "BACKLOG", priority: "MEDIUM", sortOrder: 2,
      workspaceId, projectId: mobile.id, labels: { connect: [{ id: feature.id }] } },
    { title: "Account & multi-user phase kickoff", status: "DONE", priority: "HIGH", sortOrder: 1, workspaceId },
  ];

  for (const data of tasks) await prisma.task.create({ data });

  const count = await prisma.task.count();
  console.log(`Seeded demo@myschedule.app / password1 with ${count} tasks, 2 projects, 3 labels.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Add `NODE_ENV=production` to `render.yaml`**

In `backend/render.yaml`, under `envVars:`, add:
```yaml
      - key: NODE_ENV
        value: production
```

- [ ] **Step 3: Run the full backend test suite + typecheck**

Run: `cd backend && pnpm test && pnpm lint`
Expected: ALL test files PASS; `pnpm lint` (tsc --noEmit) reports no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/seed.ts backend/render.yaml
git commit -m "chore(backend): seed demo user+workspace, set NODE_ENV on Render"
```

---

## Task 12: Frontend — auth API client + types

**Files:**
- Modify: `frontend/src/lib/api.ts`, `frontend/src/types.ts`

**Interfaces:**
- Produces: `api` fetch wrapper sends `credentials: "include"` and emits a global `auth:unauthorized` event on 401; `AuthUser` type.

- [ ] **Step 1: Update `api.ts` to send cookies and signal 401**

Rewrite `frontend/src/lib/api.ts`:
```ts
const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export const AUTH_UNAUTHORIZED_EVENT = "auth:unauthorized";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...init,
  });
  if (res.status === 401) {
    window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Request failed (${res.status})`);
  }
  return res.status === 204 ? (undefined as T) : (res.json() as Promise<T>);
}

export const api = {
  get: <T>(p: string) => req<T>(p),
  post: <T>(p: string, body: unknown) => req<T>(p, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(p: string, body: unknown) => req<T>(p, { method: "PATCH", body: JSON.stringify(body) }),
  del: (p: string) => req<void>(p, { method: "DELETE" }),
};
```

- [ ] **Step 2: Add the `AuthUser` type**

Append to `frontend/src/types.ts`:
```ts
export type AuthUser = { id: string; email: string };
```

- [ ] **Step 3: Verify the frontend typechecks**

Run: `cd frontend && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/types.ts
git commit -m "feat(web): send credentials and signal 401 from api client"
```

---

## Task 13: Frontend — auth context + hook

**Files:**
- Create: `frontend/src/lib/auth-context.tsx`, `frontend/src/hooks/useAuth.ts`

**Interfaces:**
- Consumes: `api`, `AUTH_UNAUTHORIZED_EVENT`, `AuthUser`.
- Produces:
  - `AuthProvider` component.
  - `useAuth()` → `{ status: "loading" | "authenticated" | "anonymous"; user: AuthUser | null; login(email,password); signup(email,password); logout(); changePassword(current,next) }`.

- [ ] **Step 1: Write the auth context**

`frontend/src/lib/auth-context.tsx`:
```tsx
import { createContext, useCallback, useEffect, useState, type ReactNode } from "react";
import { api, AUTH_UNAUTHORIZED_EVENT } from "@/lib/api";
import type { AuthUser } from "@/types";

type Status = "loading" | "authenticated" | "anonymous";

export type AuthContextValue = {
  status: Status;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  const setAuthed = useCallback((u: AuthUser) => { setUser(u); setStatus("authenticated"); }, []);
  const setAnon = useCallback(() => { setUser(null); setStatus("anonymous"); }, []);

  useEffect(() => {
    api.get<{ user: AuthUser }>("/auth/me")
      .then((r) => setAuthed(r.user))
      .catch(() => setAnon());
  }, [setAuthed, setAnon]);

  useEffect(() => {
    const onUnauthorized = () => setAnon();
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
  }, [setAnon]);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api.post<{ user: AuthUser }>("/auth/login", { email, password });
    setAuthed(r.user);
  }, [setAuthed]);

  const signup = useCallback(async (email: string, password: string) => {
    const r = await api.post<{ user: AuthUser }>("/auth/signup", { email, password });
    setAuthed(r.user);
  }, [setAuthed]);

  const logout = useCallback(async () => {
    await api.post("/auth/logout", {});
    setAnon();
  }, [setAnon]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await api.post("/auth/change-password", { currentPassword, newPassword });
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, login, signup, logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}
```

- [ ] **Step 2: Write the hook**

`frontend/src/hooks/useAuth.ts`:
```ts
import { useContext } from "react";
import { AuthContext, type AuthContextValue } from "@/lib/auth-context";

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

- [ ] **Step 3: Verify typecheck**

Run: `cd frontend && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/auth-context.tsx frontend/src/hooks/useAuth.ts
git commit -m "feat(web): auth context and useAuth hook"
```

---

## Task 14: Frontend — login/signup page

**Files:**
- Create: `frontend/src/pages/AuthPage.tsx`

**Interfaces:**
- Consumes: `useAuth`, `Button`, `Input`.
- Produces: `AuthPage` (default-less named export) rendering login/signup with mode toggle and error display.

- [ ] **Step 1: Write the AuthPage**

`frontend/src/pages/AuthPage.tsx`:
```tsx
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AuthPage() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") await signup(email, password);
      else await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-sm">
        <h1 className="font-display text-xl font-bold tracking-tight mb-1">MySchedule</h1>
        <p className="text-sm text-ink-muted mb-6">
          {mode === "login" ? "Sign in to your account" : "Create a new account"}
        </p>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <Input
            type="email" placeholder="you@example.com" autoComplete="email" required
            value={email} onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            type="password" placeholder="Password (min 8 characters)"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required minLength={8}
            value={password} onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy}>
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </form>
        <button
          type="button"
          className="mt-4 text-sm text-ink-muted hover:text-ink w-full text-center"
          onClick={() => { setError(null); setMode((m) => (m === "login" ? "signup" : "login")); }}
        >
          {mode === "login" ? "No account? Sign up" : "Have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd frontend && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/AuthPage.tsx
git commit -m "feat(web): login/signup page"
```

---

## Task 15: Frontend — account menu (logout + change password)

**Files:**
- Create: `frontend/src/components/account/AccountMenu.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`

**Interfaces:**
- Consumes: `useAuth`, `Button`, `Input`, `Dialog*`.
- Produces: `AccountMenu` showing the user's email, a Logout button, and a "Change password" dialog; rendered at the bottom of the sidebar.

- [ ] **Step 1: Write the AccountMenu**

`frontend/src/components/account/AccountMenu.tsx`:
```tsx
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";

export function AccountMenu() {
  const { user, logout, changePassword } = useAuth();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setDone(false); setBusy(true);
    try {
      await changePassword(current, next);
      setDone(true); setCurrent(""); setNext("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-auto border-t border-border pt-3 flex flex-col gap-2">
      <span className="px-2 text-xs text-ink-muted truncate" title={user?.email}>{user?.email}</span>
      <div className="flex gap-2">
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); setError(null); setDone(false); }}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="flex-1">Change password</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Change password</DialogTitle></DialogHeader>
            <form onSubmit={onSubmit} className="flex flex-col gap-3">
              <Input type="password" placeholder="Current password" autoComplete="current-password"
                required value={current} onChange={(e) => setCurrent(e.target.value)} />
              <Input type="password" placeholder="New password (min 8)" autoComplete="new-password"
                required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} />
              {error && <p className="text-sm text-destructive">{error}</p>}
              {done && <p className="text-sm text-ink-muted">Password updated.</p>}
              <DialogFooter>
                <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Update password"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        <Button variant="ghost" size="sm" onClick={() => logout()}>Log out</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Render `AccountMenu` in the sidebar**

In `frontend/src/components/layout/Sidebar.tsx`:
- Add the import at the top: `import { AccountMenu } from "@/components/account/AccountMenu";`
- Place `<AccountMenu />` as the last child inside the inner `<div className="w-60 h-screen p-4 flex flex-col gap-6">`, immediately before the closing `</div>` that wraps the dialogs (i.e. after the `<LabelDialog ... />` line). The flex column with `mt-auto` on `AccountMenu` pins it to the bottom.

- [ ] **Step 3: Verify typecheck**

Run: `cd frontend && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/account/AccountMenu.tsx frontend/src/components/layout/Sidebar.tsx
git commit -m "feat(web): account menu with logout and change password"
```

---

## Task 16: Frontend — wire AuthProvider + AuthGate

**Files:**
- Modify: `frontend/src/main.tsx`, `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `AuthProvider`, `useAuth`, `AuthPage`.
- Produces: app renders `AuthPage` when anonymous, a spinner when loading, and the existing UI when authenticated.

- [ ] **Step 1: Wrap the app with `AuthProvider`**

In `frontend/src/main.tsx`, add the import `import { AuthProvider } from "@/lib/auth-context";` and wrap `<App />` so the provider sits inside `QueryClientProvider` and around `ThemeProvider`:
```tsx
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
```

- [ ] **Step 2: Add the AuthGate to `App.tsx`**

In `frontend/src/App.tsx`:
- Add imports: `import { useAuth } from "@/hooks/useAuth";` and `import { AuthPage } from "@/pages/AuthPage";`
- At the very top of the `App` component body (before the other `useState`/hooks that fetch data is fine since they are gated below), add:
```tsx
  const { status } = useAuth();
```
- Immediately before the existing `return (` of the component, add the gate:
```tsx
  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center text-ink-muted">Loading…</div>;
  }
  if (status === "anonymous") {
    return <AuthPage />;
  }
```

Note: `useAuth()` and the data hooks must run unconditionally (Rules of Hooks), so add `const { status } = useAuth();` alongside the other hook calls near the top; only the early `return`s are conditional. The data query `useTasks(...)` will run while loading but its 401 simply triggers the anonymous state via the api client — acceptable, and it stops once `AuthPage` renders.

- [ ] **Step 3: Manual smoke test**

Start backend and frontend:
```bash
cd backend && pnpm dev   # terminal 1
cd frontend && pnpm dev  # terminal 2
```
In the browser: you should see the login screen. Click "No account? Sign up", create an account, and land on an empty board. Create a task. Reload — the task persists and you stay logged in. Open the sidebar account menu → Log out → the login screen returns. Log back in → your task is still there.

- [ ] **Step 4: Final full typecheck (both packages)**

Run: `cd frontend && pnpm lint && cd ../backend && pnpm lint && pnpm test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/main.tsx frontend/src/App.tsx
git commit -m "feat(web): gate the app behind authentication"
```

---

## Deployment notes (after all tasks pass)

1. **Render env:** ensure `FRONTEND_URL` exactly equals the Vercel origin (scheme + host, no trailing slash) and `NODE_ENV=production` is set (Task 11 adds it to the blueprint). The migration with the `TRUNCATE` runs via the existing `pnpm prisma migrate deploy` build step.
2. **Order:** deploy backend first (runs migration), then frontend.
3. **Cookies require HTTPS** on both ends (already true on Vercel + Render). With `secure`/`SameSite=None` the cross-site cookie will only work over HTTPS — local dev uses `lax`/non-secure automatically.
4. **Verify:** sign up on the production site, confirm the board is empty and isolated, then connect GitHub and confirm the contribution chart loads for that workspace.

---

## Self-Review Notes

- **Spec coverage:** User/Workspace/Membership/Session models + ownership columns (Task 1) ✓; scrypt hashing (Task 2) ✓; DB sessions + hashed tokens + revoke (Tasks 3, 5) ✓; cookie attributes env-aware (Task 4) ✓; routes signup/login/logout/me/change-password (Task 5) ✓; CORS credentials + cookie-parser + guards (Task 6) ✓; per-workspace scoping of tasks/projects/labels/library/github (Tasks 7–10) ✓; cross-workspace isolation tests (Tasks 7–10) ✓; wipe-on-migration (Task 1) ✓; frontend context/login/gate/logout/change-password (Tasks 12–16) ✓; FRONTEND_URL/NODE_ENV ops (Tasks 6, 11) ✓.
- **Deferred (out of scope, in PLAN.md):** email verification, password reset.
- **Type consistency:** store fn signatures defined in Task 10 interfaces match their usages in routes; `req.userId`/`req.workspaceId` augmentation defined in Task 4 and used everywhere after.

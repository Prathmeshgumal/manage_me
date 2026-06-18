# GitHub Connection Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the single user connect their GitHub via a GitHub App (installation + user OAuth), store tokens securely, and render their contribution calendar in a global "My GitHub" area; capture and list installations (orgs/account).

**Architecture:** New `backend/src/github/` module with one-responsibility files (config, crypto, appAuth, oauth, contributions, store, routes) mounted at `/github/*`. All secrets/tokens stay backend-only. Frontend gets a Settings→GitHub page (starts the flows via backend redirects) and a My GitHub page (contributions heatmap). Standalone `backend/` + `frontend/` projects (no monorepo).

**Tech Stack:** Express + TypeScript + Prisma + Zod (backend); `@octokit/auth-app`, `@octokit/request`, `@octokit/graphql`, Node `crypto`; React + Vite + shadcn/ui + TanStack Query (frontend); Vitest.

## Global Constraints

- **Package manager:** pnpm. Node >= 20. TypeScript strict in both projects.
- **Git:** commit as the configured repo identity; NEVER add a `Co-Authored-By: Claude` trailer or author as "Claude". Branch is `main`-style (currently `feat/prioritization-board`).
- **Error shape (verbatim):** all API errors return `{ error: { message: string } }`.
- **Secrets:** the GitHub private key, client secret, and stored user tokens are backend-only and must never be serialized to the frontend.
- **Token storage:** user access tokens stored AES-256-GCM encrypted; OAuth `state` is a signed HMAC token; installation tokens minted on demand, never persisted.
- **User-token expiration:** assume the GitHub App is configured with user-token expiration OFF (long-lived user token; no refresh logic).
- **Env vars (verbatim names):** `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_PRIVATE_KEY_BASE64`, `GITHUB_OAUTH_REDIRECT_URI`, `GITHUB_TOKEN_ENC_KEY`, `GITHUB_STATE_SECRET`, `FRONTEND_URL`.
- **Frontend API base:** `import.meta.env.VITE_API_URL` (existing `api` client in `frontend/src/lib/api.ts`).
- **Existing API error middleware** in `backend/src/middleware/error.ts` converts `ZodError`→400 and `AppError`→its status; reuse `AppError` from `backend/src/errors.ts`.

---

## File Structure

```
backend/
├── prisma/schema.prisma                 # + GithubUserToken, GithubInstallation models
├── .env.example                         # + the 9 GITHUB_* / FRONTEND_URL vars
└── src/github/
    ├── config.ts        # read+validate env (githubConfig())
    ├── crypto.ts        # encryptToken/decryptToken (AES-256-GCM); signState/verifyState (HMAC)
    ├── appAuth.ts       # appJwt(), installationToken(installationId), getInstallation(installationId)
    ├── oauth.ts         # authorizeUrl(state), exchangeCode(code) -> {accessToken,scope}; getAuthedUser(token)
    ├── contributions.ts # fetchContributions(token) -> ContributionCalendar (GraphQL + map)
    ├── store.ts         # upsert/get/delete user token + installation rows (Prisma)
    ├── routes.ts        # githubRouter: /status /authorize /callback /install /setup /contributions /disconnect
    └── *.test.ts        # vitest for crypto, oauth url, contributions mapping, routes (mocked)
frontend/
└── src/
    ├── lib/api.ts                        # (exists) used as-is
    ├── hooks/useGithub.ts                # useGithubStatus, useContributions, useDisconnectGithub
    ├── components/github/ContributionsChart.tsx
    ├── pages/SettingsGithubPage.tsx
    ├── pages/MyGithubPage.tsx
    └── App.tsx                           # + simple view switch for settings/my-github + sidebar links
```

---

## Task 1: Prisma models for GitHub tokens + installations

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/.env.example`

**Interfaces:**
- Produces: Prisma models `GithubUserToken` (fields: id, githubUserId Int @unique, login, avatarUrl, accessToken, scope?, createdAt, updatedAt) and `GithubInstallation` (id, installationId Int @unique, accountLogin, accountType, repositorySelection, createdAt, updatedAt). Generated client used by `store.ts`.

- [ ] **Step 1: Add models to `backend/prisma/schema.prisma`** (append at end)

```prisma
model GithubUserToken {
  id           String   @id @default(cuid())
  githubUserId Int      @unique
  login        String
  avatarUrl    String
  accessToken  String
  scope        String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model GithubInstallation {
  id                  String   @id @default(cuid())
  installationId      Int      @unique
  accountLogin        String
  accountType         String
  repositorySelection String
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}
```

- [ ] **Step 2: Append the GitHub env vars to `backend/.env.example`**

```
GITHUB_APP_ID=
GITHUB_APP_SLUG=
GITHUB_APP_CLIENT_ID=
GITHUB_APP_CLIENT_SECRET=
GITHUB_APP_PRIVATE_KEY_BASE64=
GITHUB_OAUTH_REDIRECT_URI=http://localhost:4000/github/callback
GITHUB_TOKEN_ENC_KEY=
GITHUB_STATE_SECRET=
FRONTEND_URL=http://localhost:5173
```

- [ ] **Step 3: Create the migration + generate client**

Run: `cd backend && pnpm exec prisma migrate dev --name github_connection`
Expected: new migration folder created and applied; client regenerated. (Needs network + `DATABASE_URL`.)

- [ ] **Step 4: Commit**

```bash
git add backend/prisma backend/.env.example
git commit -m "feat(github): prisma models for user token and installations"
```

---

## Task 2: Install GitHub deps + config loader

**Files:**
- Modify: `backend/package.json`
- Create: `backend/src/github/config.ts`
- Test: `backend/src/github/config.test.ts`

**Interfaces:**
- Produces: `githubConfig(): GithubConfig` where
  `type GithubConfig = { appId: string; slug: string; clientId: string; clientSecret: string; privateKey: string; redirectUri: string; encKey: Buffer; stateSecret: string; frontendUrl: string }`.
  Throws `AppError(500, "Missing GitHub env: <NAME>")` for any missing var. `privateKey` is the decoded PEM (from `GITHUB_APP_PRIVATE_KEY_BASE64`); `encKey` is the base64-decoded 32-byte buffer.

- [ ] **Step 1: Add dependencies**

Run:
```bash
cd backend
pnpm add @octokit/auth-app @octokit/request @octokit/graphql
```
Expected: the three packages added to `dependencies`.

- [ ] **Step 2: Write the failing test `backend/src/github/config.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { githubConfig } from "./config";

const FULL = {
  GITHUB_APP_ID: "123",
  GITHUB_APP_SLUG: "myschedule-dev",
  GITHUB_APP_CLIENT_ID: "Iv1.abc",
  GITHUB_APP_CLIENT_SECRET: "secret",
  GITHUB_APP_PRIVATE_KEY_BASE64: Buffer.from("PEMDATA").toString("base64"),
  GITHUB_OAUTH_REDIRECT_URI: "http://localhost:4000/github/callback",
  GITHUB_TOKEN_ENC_KEY: Buffer.alloc(32, 7).toString("base64"),
  GITHUB_STATE_SECRET: "statesecret",
  FRONTEND_URL: "http://localhost:5173",
};

describe("githubConfig", () => {
  let saved: NodeJS.ProcessEnv;
  beforeEach(() => { saved = { ...process.env }; Object.assign(process.env, FULL); });
  afterEach(() => { process.env = saved; });

  it("loads and decodes config", () => {
    const c = githubConfig();
    expect(c.appId).toBe("123");
    expect(c.privateKey).toBe("PEMDATA");
    expect(c.encKey).toHaveLength(32);
  });

  it("throws naming the missing var", () => {
    delete process.env.GITHUB_APP_CLIENT_SECRET;
    expect(() => githubConfig()).toThrow(/GITHUB_APP_CLIENT_SECRET/);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && pnpm exec vitest run src/github/config.test.ts`
Expected: FAIL — cannot find `./config`.

- [ ] **Step 4: Implement `backend/src/github/config.ts`**

```ts
import { AppError } from "../errors.js";

export interface GithubConfig {
  appId: string; slug: string; clientId: string; clientSecret: string;
  privateKey: string; redirectUri: string; encKey: Buffer;
  stateSecret: string; frontendUrl: string;
}

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new AppError(500, `Missing GitHub env: ${name}`);
  return v;
}

export function githubConfig(): GithubConfig {
  const encKey = Buffer.from(need("GITHUB_TOKEN_ENC_KEY"), "base64");
  if (encKey.length !== 32) throw new AppError(500, "GITHUB_TOKEN_ENC_KEY must be 32 bytes (base64)");
  return {
    appId: need("GITHUB_APP_ID"),
    slug: need("GITHUB_APP_SLUG"),
    clientId: need("GITHUB_APP_CLIENT_ID"),
    clientSecret: need("GITHUB_APP_CLIENT_SECRET"),
    privateKey: Buffer.from(need("GITHUB_APP_PRIVATE_KEY_BASE64"), "base64").toString("utf8"),
    redirectUri: need("GITHUB_OAUTH_REDIRECT_URI"),
    encKey,
    stateSecret: need("GITHUB_STATE_SECRET"),
    frontendUrl: need("FRONTEND_URL"),
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && pnpm exec vitest run src/github/config.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/package.json backend/pnpm-lock.yaml backend/src/github/config.ts backend/src/github/config.test.ts
git commit -m "feat(github): octokit deps and validated env config loader"
```

---

## Task 3: Crypto — token encryption + signed state (TDD)

**Files:**
- Create: `backend/src/github/crypto.ts`
- Test: `backend/src/github/crypto.test.ts`

**Interfaces:**
- Consumes: `githubConfig()` (for `encKey`, `stateSecret`).
- Produces:
  - `encryptToken(plain: string): string` and `decryptToken(cipher: string): string` (AES-256-GCM; cipher format `iv.tag.data` base64url joined by `.`).
  - `signState(ttlMs?: number): string` → an HMAC-signed token `payloadB64.sig` where payload is `{ nonce, exp }`.
  - `verifyState(state: string): boolean` → true iff signature valid and not expired.

- [ ] **Step 1: Write the failing test `backend/src/github/crypto.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encryptToken, decryptToken, signState, verifyState } from "./crypto";

const ENV = {
  GITHUB_TOKEN_ENC_KEY: Buffer.alloc(32, 9).toString("base64"),
  GITHUB_STATE_SECRET: "statesecret",
  // other config vars are not touched by crypto, but githubConfig() needs them:
  GITHUB_APP_ID: "1", GITHUB_APP_SLUG: "s", GITHUB_APP_CLIENT_ID: "c",
  GITHUB_APP_CLIENT_SECRET: "x", GITHUB_APP_PRIVATE_KEY_BASE64: Buffer.from("p").toString("base64"),
  GITHUB_OAUTH_REDIRECT_URI: "http://localhost:4000/github/callback",
  FRONTEND_URL: "http://localhost:5173",
};

describe("crypto", () => {
  let saved: NodeJS.ProcessEnv;
  beforeEach(() => { saved = { ...process.env }; Object.assign(process.env, ENV); });
  afterEach(() => { process.env = saved; });

  it("round-trips token encryption", () => {
    const c = encryptToken("ghu_secret_value");
    expect(c).not.toContain("ghu_secret_value");
    expect(decryptToken(c)).toBe("ghu_secret_value");
  });

  it("accepts a fresh signed state and rejects tampered/expired", () => {
    const s = signState();
    expect(verifyState(s)).toBe(true);
    expect(verifyState(s + "x")).toBe(false);
    expect(verifyState(signState(-1))).toBe(false); // already expired
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pnpm exec vitest run src/github/crypto.test.ts`
Expected: FAIL — cannot find `./crypto`.

- [ ] **Step 3: Implement `backend/src/github/crypto.ts`**

```ts
import { createCipheriv, createDecipheriv, randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { githubConfig } from "./config.js";

const b64u = (b: Buffer) => b.toString("base64url");
const fromB64u = (s: string) => Buffer.from(s, "base64url");

export function encryptToken(plain: string): string {
  const { encKey } = githubConfig();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encKey, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [b64u(iv), b64u(tag), b64u(data)].join(".");
}

export function decryptToken(payload: string): string {
  const { encKey } = githubConfig();
  const [iv, tag, data] = payload.split(".").map(fromB64u);
  const decipher = createDecipheriv("aes-256-gcm", encKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

function hmac(input: string): string {
  return b64u(createHmac("sha256", githubConfig().stateSecret).update(input).digest());
}

export function signState(ttlMs = 10 * 60 * 1000): string {
  const payload = b64u(Buffer.from(JSON.stringify({ nonce: b64u(randomBytes(8)), exp: Date.now() + ttlMs })));
  return `${payload}.${hmac(payload)}`;
}

export function verifyState(state: string): boolean {
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return false;
  const expected = hmac(payload);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  try {
    const { exp } = JSON.parse(fromB64u(payload).toString("utf8"));
    return typeof exp === "number" && Date.now() < exp;
  } catch { return false; }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pnpm exec vitest run src/github/crypto.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/github/crypto.ts backend/src/github/crypto.test.ts
git commit -m "feat(github): AES-GCM token encryption and signed OAuth state"
```

---

## Task 4: OAuth helpers — authorize URL + code exchange + authed user

**Files:**
- Create: `backend/src/github/oauth.ts`
- Test: `backend/src/github/oauth.test.ts`

**Interfaces:**
- Consumes: `githubConfig()`.
- Produces:
  - `authorizeUrl(state: string): string` → `https://github.com/login/oauth/authorize?client_id=...&redirect_uri=...&state=...`.
  - `exchangeCode(code: string): Promise<{ accessToken: string; scope: string }>` → POSTs to `https://github.com/login/oauth/access_token`.
  - `getAuthedUser(accessToken: string): Promise<{ id: number; login: string; avatarUrl: string }>` → GET `https://api.github.com/user`.
- Both async fns use `@octokit/request`, so tests mock it via `vi.mock("@octokit/request")`.

- [ ] **Step 1: Write the failing test `backend/src/github/oauth.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@octokit/request", () => ({ request: vi.fn() }));
import { request } from "@octokit/request";
import { authorizeUrl, exchangeCode, getAuthedUser } from "./oauth";

const ENV = {
  GITHUB_APP_ID: "1", GITHUB_APP_SLUG: "s", GITHUB_APP_CLIENT_ID: "Iv1.abc",
  GITHUB_APP_CLIENT_SECRET: "secret",
  GITHUB_APP_PRIVATE_KEY_BASE64: Buffer.from("p").toString("base64"),
  GITHUB_OAUTH_REDIRECT_URI: "http://localhost:4000/github/callback",
  GITHUB_TOKEN_ENC_KEY: Buffer.alloc(32, 1).toString("base64"),
  GITHUB_STATE_SECRET: "z", FRONTEND_URL: "http://localhost:5173",
};

describe("oauth", () => {
  let saved: NodeJS.ProcessEnv;
  beforeEach(() => { saved = { ...process.env }; Object.assign(process.env, ENV); vi.mocked(request).mockReset(); });
  afterEach(() => { process.env = saved; });

  it("builds an authorize URL with client_id, redirect_uri, state", () => {
    const url = new URL(authorizeUrl("STATE123"));
    expect(url.origin + url.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("Iv1.abc");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:4000/github/callback");
    expect(url.searchParams.get("state")).toBe("STATE123");
  });

  it("exchanges a code for an access token", async () => {
    vi.mocked(request).mockResolvedValueOnce({ data: { access_token: "ghu_x", scope: "" } } as any);
    const r = await exchangeCode("code123");
    expect(r.accessToken).toBe("ghu_x");
  });

  it("throws when GitHub returns an oauth error", async () => {
    vi.mocked(request).mockResolvedValueOnce({ data: { error: "bad_verification_code" } } as any);
    await expect(exchangeCode("nope")).rejects.toThrow(/bad_verification_code/);
  });

  it("maps the authed user", async () => {
    vi.mocked(request).mockResolvedValueOnce({ data: { id: 42, login: "octo", avatar_url: "http://a/x.png" } } as any);
    expect(await getAuthedUser("ghu_x")).toEqual({ id: 42, login: "octo", avatarUrl: "http://a/x.png" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pnpm exec vitest run src/github/oauth.test.ts`
Expected: FAIL — cannot find `./oauth`.

- [ ] **Step 3: Implement `backend/src/github/oauth.ts`**

```ts
import { request } from "@octokit/request";
import { AppError } from "../errors.js";
import { githubConfig } from "./config.js";

export function authorizeUrl(state: string): string {
  const c = githubConfig();
  const u = new URL("https://github.com/login/oauth/authorize");
  u.searchParams.set("client_id", c.clientId);
  u.searchParams.set("redirect_uri", c.redirectUri);
  u.searchParams.set("state", state);
  return u.toString();
}

export async function exchangeCode(code: string): Promise<{ accessToken: string; scope: string }> {
  const c = githubConfig();
  const res = await request("POST https://github.com/login/oauth/access_token", {
    headers: { accept: "application/json" },
    client_id: c.clientId, client_secret: c.clientSecret,
    code, redirect_uri: c.redirectUri,
  });
  const data = res.data as { access_token?: string; scope?: string; error?: string };
  if (data.error || !data.access_token) throw new AppError(400, `GitHub OAuth failed: ${data.error ?? "no token"}`);
  return { accessToken: data.access_token, scope: data.scope ?? "" };
}

export async function getAuthedUser(accessToken: string): Promise<{ id: number; login: string; avatarUrl: string }> {
  const res = await request("GET /user", { headers: { authorization: `token ${accessToken}` } });
  const u = res.data as { id: number; login: string; avatar_url: string };
  return { id: u.id, login: u.login, avatarUrl: u.avatar_url };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pnpm exec vitest run src/github/oauth.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/github/oauth.ts backend/src/github/oauth.test.ts
git commit -m "feat(github): oauth authorize url, code exchange, authed user"
```

---

## Task 5: App auth — JWT, installation token, installation metadata

**Files:**
- Create: `backend/src/github/appAuth.ts`
- Test: `backend/src/github/appAuth.test.ts`

**Interfaces:**
- Consumes: `githubConfig()`, `@octokit/auth-app`, `@octokit/request`.
- Produces:
  - `installationToken(installationId: number): Promise<string>` (server-to-server token; minted on demand, not stored).
  - `getInstallation(installationId: number): Promise<{ installationId: number; accountLogin: string; accountType: string; repositorySelection: string }>` — GET `/app/installations/:id` using an app JWT, mapped to our shape.
- Tests mock `@octokit/auth-app` (`createAppAuth`) and `@octokit/request`.

- [ ] **Step 1: Write the failing test `backend/src/github/appAuth.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const authFn = vi.fn();
vi.mock("@octokit/auth-app", () => ({ createAppAuth: vi.fn(() => authFn) }));
vi.mock("@octokit/request", () => ({ request: vi.fn() }));
import { request } from "@octokit/request";
import { installationToken, getInstallation } from "./appAuth";

const ENV = {
  GITHUB_APP_ID: "55", GITHUB_APP_SLUG: "s", GITHUB_APP_CLIENT_ID: "Iv1.abc",
  GITHUB_APP_CLIENT_SECRET: "secret",
  GITHUB_APP_PRIVATE_KEY_BASE64: Buffer.from("PEM").toString("base64"),
  GITHUB_OAUTH_REDIRECT_URI: "http://localhost:4000/github/callback",
  GITHUB_TOKEN_ENC_KEY: Buffer.alloc(32, 1).toString("base64"),
  GITHUB_STATE_SECRET: "z", FRONTEND_URL: "http://localhost:5173",
};

describe("appAuth", () => {
  let saved: NodeJS.ProcessEnv;
  beforeEach(() => { saved = { ...process.env }; Object.assign(process.env, ENV); authFn.mockReset(); vi.mocked(request).mockReset(); });
  afterEach(() => { process.env = saved; });

  it("mints an installation token", async () => {
    authFn.mockResolvedValueOnce({ token: "ghs_inst" });
    expect(await installationToken(999)).toBe("ghs_inst");
    expect(authFn).toHaveBeenCalledWith(expect.objectContaining({ type: "installation", installationId: 999 }));
  });

  it("maps installation metadata", async () => {
    authFn.mockResolvedValueOnce({ token: "jwt" });
    vi.mocked(request).mockResolvedValueOnce({ data: {
      id: 999, account: { login: "acme", type: "Organization" }, repository_selection: "selected",
    } } as any);
    expect(await getInstallation(999)).toEqual({
      installationId: 999, accountLogin: "acme", accountType: "Organization", repositorySelection: "selected",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pnpm exec vitest run src/github/appAuth.test.ts`
Expected: FAIL — cannot find `./appAuth`.

- [ ] **Step 3: Implement `backend/src/github/appAuth.ts`**

```ts
import { createAppAuth } from "@octokit/auth-app";
import { request } from "@octokit/request";
import { githubConfig } from "./config.js";

function auth() {
  const c = githubConfig();
  return createAppAuth({ appId: c.appId, privateKey: c.privateKey, clientId: c.clientId, clientSecret: c.clientSecret });
}

export async function installationToken(installationId: number): Promise<string> {
  const res = await auth()({ type: "installation", installationId });
  return (res as { token: string }).token;
}

export async function getInstallation(installationId: number): Promise<{
  installationId: number; accountLogin: string; accountType: string; repositorySelection: string;
}> {
  const appJwt = await auth()({ type: "app" });
  const res = await request("GET /app/installations/{installation_id}", {
    installation_id: installationId,
    headers: { authorization: `Bearer ${(appJwt as { token: string }).token}` },
  });
  const d = res.data as { id: number; account: { login: string; type: string }; repository_selection: string };
  return {
    installationId: d.id, accountLogin: d.account.login,
    accountType: d.account.type, repositorySelection: d.repository_selection,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pnpm exec vitest run src/github/appAuth.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/github/appAuth.ts backend/src/github/appAuth.test.ts
git commit -m "feat(github): app jwt, installation token, installation metadata"
```

---

## Task 6: Contributions — GraphQL fetch + calendar mapping (TDD)

**Files:**
- Create: `backend/src/github/contributions.ts`
- Test: `backend/src/github/contributions.test.ts`

**Interfaces:**
- Consumes: `@octokit/graphql`.
- Produces:
  - `type ContributionDay = { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 }`
  - `type ContributionCalendar = { totalContributions: number; weeks: { days: ContributionDay[] }[] }`
  - `levelForCount(count: number): 0|1|2|3|4` (0; 1–3→1; 4–6→2; 7–9→3; ≥10→4).
  - `mapCalendar(raw): ContributionCalendar` — pure mapper from GitHub's GraphQL shape.
  - `fetchContributions(userToken: string): Promise<ContributionCalendar>` — runs the GraphQL query with the user token, then `mapCalendar`.

- [ ] **Step 1: Write the failing test `backend/src/github/contributions.test.ts`**

```ts
import { describe, it, expect, vi } from "vitest";

const gqlFn = vi.fn();
vi.mock("@octokit/graphql", () => ({ graphql: { defaults: vi.fn(() => gqlFn) } }));
import { levelForCount, mapCalendar, fetchContributions } from "./contributions";

describe("contributions", () => {
  it("buckets counts into levels", () => {
    expect(levelForCount(0)).toBe(0);
    expect(levelForCount(2)).toBe(1);
    expect(levelForCount(5)).toBe(2);
    expect(levelForCount(8)).toBe(3);
    expect(levelForCount(20)).toBe(4);
  });

  it("maps the GraphQL calendar shape", () => {
    const raw = { user: { contributionsCollection: { contributionCalendar: {
      totalContributions: 3,
      weeks: [{ contributionDays: [
        { date: "2026-06-01", contributionCount: 0 },
        { date: "2026-06-02", contributionCount: 5 },
      ] }],
    } } } };
    const cal = mapCalendar(raw);
    expect(cal.totalContributions).toBe(3);
    expect(cal.weeks[0].days[1]).toEqual({ date: "2026-06-02", count: 5, level: 2 });
  });

  it("fetchContributions runs the query and maps", async () => {
    gqlFn.mockResolvedValueOnce({ user: { contributionsCollection: { contributionCalendar: {
      totalContributions: 1, weeks: [{ contributionDays: [{ date: "2026-06-02", contributionCount: 1 }] }],
    } } } });
    const cal = await fetchContributions("ghu_x");
    expect(cal.totalContributions).toBe(1);
    expect(cal.weeks[0].days[0].level).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pnpm exec vitest run src/github/contributions.test.ts`
Expected: FAIL — cannot find `./contributions`.

- [ ] **Step 3: Implement `backend/src/github/contributions.ts`**

```ts
import { graphql } from "@octokit/graphql";

export type ContributionDay = { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 };
export type ContributionCalendar = { totalContributions: number; weeks: { days: ContributionDay[] }[] };

export function levelForCount(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count <= 3) return 1;
  if (count <= 6) return 2;
  if (count <= 9) return 3;
  return 4;
}

type RawDay = { date: string; contributionCount: number };
type Raw = { user: { contributionsCollection: { contributionCalendar: {
  totalContributions: number; weeks: { contributionDays: RawDay[] }[];
} } } };

export function mapCalendar(raw: Raw): ContributionCalendar {
  const cal = raw.user.contributionsCollection.contributionCalendar;
  return {
    totalContributions: cal.totalContributions,
    weeks: cal.weeks.map((w) => ({
      days: w.contributionDays.map((d) => ({
        date: d.date, count: d.contributionCount, level: levelForCount(d.contributionCount),
      })),
    })),
  };
}

const QUERY = `query {
  viewer { contributionsCollection { contributionCalendar {
    totalContributions
    weeks { contributionDays { date contributionCount } }
  } } }
}`;

export async function fetchContributions(userToken: string): Promise<ContributionCalendar> {
  const run = graphql.defaults({ headers: { authorization: `token ${userToken}` } });
  // `viewer` returns the authorizing user; reshape to the mapCalendar input form.
  const data = await run<{ viewer: Raw["user"] }>(QUERY);
  return mapCalendar({ user: data.viewer });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pnpm exec vitest run src/github/contributions.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/github/contributions.ts backend/src/github/contributions.test.ts
git commit -m "feat(github): contributions graphql fetch and calendar mapping"
```

---

## Task 7: Store — Prisma read/write for tokens + installations

**Files:**
- Create: `backend/src/github/store.ts`
- Test: `backend/src/github/store.test.ts`

**Interfaces:**
- Consumes: `prisma` (`backend/src/prisma.ts`), `encryptToken`/`decryptToken`.
- Produces (all async):
  - `saveUserToken(input: { githubUserId: number; login: string; avatarUrl: string; accessToken: string; scope: string }): Promise<void>` (upsert by `githubUserId`; encrypts `accessToken`).
  - `getUserToken(): Promise<{ login: string; avatarUrl: string; accessToken: string } | null>` (first row; decrypts).
  - `deleteUserToken(): Promise<void>` (deletes all rows).
  - `saveInstallation(i: { installationId: number; accountLogin: string; accountType: string; repositorySelection: string }): Promise<void>` (upsert by `installationId`).
  - `listInstallations(): Promise<Array<{ installationId: number; accountLogin: string; accountType: string; repositorySelection: string }>>`.

- [ ] **Step 1: Write the failing test `backend/src/github/store.test.ts`** (uses the real DB, like existing route tests)

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

beforeEach(async () => { await prisma.githubUserToken.deleteMany(); await prisma.githubInstallation.deleteMany(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("github store", () => {
  it("saves and reads a user token (encrypted at rest)", async () => {
    await saveUserToken({ githubUserId: 7, login: "octo", avatarUrl: "http://a", accessToken: "ghu_secret", scope: "" });
    const row = await prisma.githubUserToken.findFirst();
    expect(row!.accessToken).not.toContain("ghu_secret");
    const got = await getUserToken();
    expect(got).toEqual({ login: "octo", avatarUrl: "http://a", accessToken: "ghu_secret" });
  });

  it("upserts installations and lists them", async () => {
    await saveInstallation({ installationId: 11, accountLogin: "acme", accountType: "Organization", repositorySelection: "all" });
    await saveInstallation({ installationId: 11, accountLogin: "acme", accountType: "Organization", repositorySelection: "selected" });
    const list = await listInstallations();
    expect(list).toHaveLength(1);
    expect(list[0].repositorySelection).toBe("selected");
  });

  it("deletes the user token", async () => {
    await saveUserToken({ githubUserId: 7, login: "o", avatarUrl: "a", accessToken: "t", scope: "" });
    await deleteUserToken();
    expect(await getUserToken()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pnpm exec vitest run src/github/store.test.ts`
Expected: FAIL — cannot find `./store`.

- [ ] **Step 3: Implement `backend/src/github/store.ts`**

```ts
import { prisma } from "../prisma.js";
import { encryptToken, decryptToken } from "./crypto.js";

export async function saveUserToken(input: {
  githubUserId: number; login: string; avatarUrl: string; accessToken: string; scope: string;
}): Promise<void> {
  const data = {
    login: input.login, avatarUrl: input.avatarUrl,
    accessToken: encryptToken(input.accessToken), scope: input.scope,
  };
  await prisma.githubUserToken.upsert({
    where: { githubUserId: input.githubUserId },
    create: { githubUserId: input.githubUserId, ...data },
    update: data,
  });
}

export async function getUserToken(): Promise<{ login: string; avatarUrl: string; accessToken: string } | null> {
  const row = await prisma.githubUserToken.findFirst({ orderBy: { createdAt: "asc" } });
  if (!row) return null;
  return { login: row.login, avatarUrl: row.avatarUrl, accessToken: decryptToken(row.accessToken) };
}

export async function deleteUserToken(): Promise<void> {
  await prisma.githubUserToken.deleteMany();
}

export async function saveInstallation(i: {
  installationId: number; accountLogin: string; accountType: string; repositorySelection: string;
}): Promise<void> {
  const data = { accountLogin: i.accountLogin, accountType: i.accountType, repositorySelection: i.repositorySelection };
  await prisma.githubInstallation.upsert({
    where: { installationId: i.installationId },
    create: { installationId: i.installationId, ...data },
    update: data,
  });
}

export async function listInstallations(): Promise<Array<{
  installationId: number; accountLogin: string; accountType: string; repositorySelection: string;
}>> {
  const rows = await prisma.githubInstallation.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map((r) => ({
    installationId: r.installationId, accountLogin: r.accountLogin,
    accountType: r.accountType, repositorySelection: r.repositorySelection,
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && pnpm exec vitest run src/github/store.test.ts`
Expected: PASS (3 tests). (Needs `DATABASE_URL`.)

- [ ] **Step 5: Commit**

```bash
git add backend/src/github/store.ts backend/src/github/store.test.ts
git commit -m "feat(github): prisma-backed token and installation store"
```

---

## Task 8: Routes — mount `/github/*` and wire flows (TDD)

**Files:**
- Create: `backend/src/github/routes.ts`
- Modify: `backend/src/app.ts` (mount the router)
- Test: `backend/src/github/routes.test.ts`

**Interfaces:**
- Consumes: everything above (`githubConfig`, `signState`/`verifyState`, `authorizeUrl`/`exchangeCode`/`getAuthedUser`, `getInstallation`, `fetchContributions`, store fns), `AppError`, `asyncHandler`.
- Produces: `githubRouter` mounted at `/github`, with routes from spec §7. `app.ts` mounts `app.use("/github", githubRouter)`.

- [ ] **Step 1: Write the failing test `backend/src/github/routes.test.ts`** (mock the GitHub-touching modules; use the real Express app + DB)

```ts
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import request from "supertest";

vi.mock("./oauth", () => ({
  authorizeUrl: vi.fn(() => "https://github.com/login/oauth/authorize?x=1"),
  exchangeCode: vi.fn(async () => ({ accessToken: "ghu_x", scope: "" })),
  getAuthedUser: vi.fn(async () => ({ id: 7, login: "octo", avatarUrl: "http://a" })),
}));
vi.mock("./appAuth", () => ({
  getInstallation: vi.fn(async () => ({ installationId: 11, accountLogin: "acme", accountType: "Organization", repositorySelection: "all" })),
  installationToken: vi.fn(async () => "ghs_x"),
}));
vi.mock("./contributions", () => ({
  fetchContributions: vi.fn(async () => ({ totalContributions: 2, weeks: [{ days: [{ date: "2026-06-02", count: 2, level: 1 }] }] })),
}));

const ENV = {
  GITHUB_APP_ID: "1", GITHUB_APP_SLUG: "myschedule-dev", GITHUB_APP_CLIENT_ID: "Iv1.abc",
  GITHUB_APP_CLIENT_SECRET: "secret", GITHUB_APP_PRIVATE_KEY_BASE64: Buffer.from("p").toString("base64"),
  GITHUB_OAUTH_REDIRECT_URI: "http://localhost:4000/github/callback",
  GITHUB_TOKEN_ENC_KEY: Buffer.alloc(32, 4).toString("base64"), GITHUB_STATE_SECRET: "statesecret",
  FRONTEND_URL: "http://localhost:5173",
};
Object.assign(process.env, ENV);

import { createApp } from "../app";
import { prisma } from "../prisma";
import { signState } from "./crypto";

const app = createApp();
beforeEach(async () => { await prisma.githubUserToken.deleteMany(); await prisma.githubInstallation.deleteMany(); });
afterAll(async () => { await prisma.$disconnect(); });

describe("github routes", () => {
  it("status is empty before connecting", async () => {
    const res = await request(app).get("/github/status");
    expect(res.body).toEqual({ user: null, installations: [] });
  });

  it("authorize redirects to GitHub", async () => {
    const res = await request(app).get("/github/authorize");
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("github.com/login/oauth/authorize");
  });

  it("install redirects to the app install page", async () => {
    const res = await request(app).get("/github/install");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("https://github.com/apps/myschedule-dev/installations/new");
  });

  it("callback rejects a bad state", async () => {
    const res = await request(app).get("/github/callback?code=c&state=bogus");
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("error=state");
  });

  it("callback with valid state stores the user and redirects connected", async () => {
    const res = await request(app).get(`/github/callback?code=c&state=${encodeURIComponent(signState())}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("connected=1");
    const status = await request(app).get("/github/status");
    expect(status.body.user).toEqual({ login: "octo", avatarUrl: "http://a" });
  });

  it("setup stores an installation and redirects", async () => {
    const res = await request(app).get("/github/setup?installation_id=11&setup_action=install");
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("installed=1");
    const status = await request(app).get("/github/status");
    expect(status.body.installations[0].accountLogin).toBe("acme");
  });

  it("contributions 409s when not connected, 200 after connect", async () => {
    expect((await request(app).get("/github/contributions")).status).toBe(409);
    await request(app).get(`/github/callback?code=c&state=${encodeURIComponent(signState())}`);
    const res = await request(app).get("/github/contributions");
    expect(res.status).toBe(200);
    expect(res.body.totalContributions).toBe(2);
  });

  it("disconnect clears the user", async () => {
    await request(app).get(`/github/callback?code=c&state=${encodeURIComponent(signState())}`);
    expect((await request(app).post("/github/disconnect")).status).toBe(204);
    expect((await request(app).get("/github/status")).body.user).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pnpm exec vitest run src/github/routes.test.ts`
Expected: FAIL — cannot find `./routes` (and `/github/*` not mounted).

- [ ] **Step 3: Implement `backend/src/github/routes.ts`**

```ts
import { Router } from "express";
import { asyncHandler, AppError } from "../errors.js";
import { githubConfig } from "./config.js";
import { signState, verifyState } from "./crypto.js";
import { authorizeUrl, exchangeCode, getAuthedUser } from "./oauth.js";
import { getInstallation } from "./appAuth.js";
import { fetchContributions } from "./contributions.js";
import {
  saveUserToken, getUserToken, deleteUserToken, saveInstallation, listInstallations,
} from "./store.js";

export const githubRouter = Router();

githubRouter.get("/status", asyncHandler(async (_req, res) => {
  const user = await getUserToken();
  res.json({
    user: user ? { login: user.login, avatarUrl: user.avatarUrl } : null,
    installations: await listInstallations(),
  });
}));

githubRouter.get("/authorize", asyncHandler(async (_req, res) => {
  res.redirect(authorizeUrl(signState()));
}));

githubRouter.get("/callback", asyncHandler(async (req, res) => {
  const { frontendUrl } = githubConfig();
  const back = `${frontendUrl}/settings/github`;
  const code = String(req.query.code ?? "");
  const state = String(req.query.state ?? "");
  if (!verifyState(state)) return res.redirect(`${back}?error=state`);
  if (!code) return res.redirect(`${back}?error=code`);
  const { accessToken, scope } = await exchangeCode(code);
  const user = await getAuthedUser(accessToken);
  await saveUserToken({ githubUserId: user.id, login: user.login, avatarUrl: user.avatarUrl, accessToken, scope });
  res.redirect(`${back}?connected=1`);
}));

githubRouter.get("/install", asyncHandler(async (_req, res) => {
  const { slug } = githubConfig();
  res.redirect(`https://github.com/apps/${slug}/installations/new`);
}));

githubRouter.get("/setup", asyncHandler(async (req, res) => {
  const { frontendUrl } = githubConfig();
  const back = `${frontendUrl}/settings/github`;
  const installationId = Number(req.query.installation_id);
  if (!installationId) return res.redirect(`${back}?error=install`);
  const meta = await getInstallation(installationId);
  await saveInstallation(meta);
  res.redirect(`${back}?installed=1`);
}));

githubRouter.get("/contributions", asyncHandler(async (_req, res) => {
  const user = await getUserToken();
  if (!user) throw new AppError(409, "GitHub not connected");
  res.json(await fetchContributions(user.accessToken));
}));

githubRouter.post("/disconnect", asyncHandler(async (_req, res) => {
  await deleteUserToken();
  res.status(204).end();
}));
```

- [ ] **Step 4: Mount the router in `backend/src/app.ts`**

Add the import near the other route imports:
```ts
import { githubRouter } from "./github/routes.js";
```
And mount it alongside the others (after `app.use("/labels", labelsRouter);`):
```ts
app.use("/github", githubRouter);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && pnpm exec vitest run src/github/routes.test.ts`
Expected: PASS (8 tests). (Needs `DATABASE_URL`.)

- [ ] **Step 6: Run the whole backend suite + typecheck**

Run: `cd backend && pnpm test && pnpm lint`
Expected: all suites pass; `tsc --noEmit` clean.

- [ ] **Step 7: Commit**

```bash
git add backend/src/github/routes.ts backend/src/github/routes.test.ts backend/src/app.ts
git commit -m "feat(github): /github routes for status, oauth, install, contributions, disconnect"
```

---

## Task 9: Frontend — GitHub hooks

**Files:**
- Create: `frontend/src/hooks/useGithub.ts`

**Interfaces:**
- Consumes: `api` (`frontend/src/lib/api.ts`), TanStack Query.
- Produces:
  - `type GithubStatus = { user: { login: string; avatarUrl: string } | null; installations: Array<{ installationId: number; accountLogin: string; accountType: string; repositorySelection: string }> }`
  - `type ContributionCalendar = { totalContributions: number; weeks: { days: { date: string; count: number; level: 0|1|2|3|4 }[] }[] }`
  - `useGithubStatus()` → query `["github","status"]`.
  - `useContributions()` → query `["github","contributions"]` (does not throw the UI down on 409; returns error state).
  - `useDisconnectGithub()` → mutation POST `/github/disconnect`, invalidates `["github"]`.
  - `apiBase` export: `import.meta.env.VITE_API_URL ?? "http://localhost:4000"` (so pages can build backend redirect links).

- [ ] **Step 1: Implement `frontend/src/hooks/useGithub.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const apiBase = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export type GithubStatus = {
  user: { login: string; avatarUrl: string } | null;
  installations: Array<{ installationId: number; accountLogin: string; accountType: string; repositorySelection: string }>;
};

export type ContributionDay = { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 };
export type ContributionCalendar = { totalContributions: number; weeks: { days: ContributionDay[] }[] };

export function useGithubStatus() {
  return useQuery({ queryKey: ["github", "status"], queryFn: () => api.get<GithubStatus>("/github/status") });
}

export function useContributions(enabled: boolean) {
  return useQuery({
    queryKey: ["github", "contributions"],
    queryFn: () => api.get<ContributionCalendar>("/github/contributions"),
    enabled,
    retry: false,
  });
}

export function useDisconnectGithub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/github/disconnect", {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["github"] }),
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && pnpm lint`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useGithub.ts
git commit -m "feat(github): frontend hooks for status, contributions, disconnect"
```

---

## Task 10: Frontend — contributions heatmap component

**Files:**
- Create: `frontend/src/components/github/ContributionsChart.tsx`

**Interfaces:**
- Consumes: `ContributionCalendar` type from `@/hooks/useGithub`.
- Produces: `<ContributionsChart calendar={ContributionCalendar} />` — a 7-row × N-week grid of cells colored by `level` using the Signal palette, plus a total caption.

- [ ] **Step 1: Implement `frontend/src/components/github/ContributionsChart.tsx`**

```tsx
import type { ContributionCalendar } from "@/hooks/useGithub";

const LEVEL_COLOR: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "var(--border)",
  1: "var(--p-low)",
  2: "var(--p-medium)",
  3: "var(--p-high)",
  4: "var(--p-urgent)",
};

export function ContributionsChart({ calendar }: { calendar: ContributionCalendar }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1 overflow-x-auto">
        {calendar.weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.days.map((d) => (
              <span
                key={d.date}
                title={`${d.date}: ${d.count} contribution${d.count === 1 ? "" : "s"}`}
                className="size-3 rounded-[2px]"
                style={{ background: LEVEL_COLOR[d.level] }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="font-mono text-xs text-ink-muted">
        {calendar.totalContributions} contributions in the last year
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && pnpm lint`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/github/ContributionsChart.tsx
git commit -m "feat(github): contributions heatmap component"
```

---

## Task 11: Frontend — Settings/GitHub + My GitHub pages, wired into App

**Files:**
- Create: `frontend/src/pages/SettingsGithubPage.tsx`
- Create: `frontend/src/pages/MyGithubPage.tsx`
- Modify: `frontend/src/App.tsx` (add a lightweight view switch + sidebar entry points)
- Modify: `frontend/src/components/layout/Sidebar.tsx` (links to the two pages)

**Interfaces:**
- Consumes: `useGithubStatus`, `useContributions`, `useDisconnectGithub`, `apiBase`, `ContributionsChart`, shadcn `Button`.
- Produces: two routable views reachable from the sidebar. App tracks a `view` that can now also be `"settings-github"` or `"my-github"` in addition to the board/list (kept minimal — no router lib).

- [ ] **Step 1: Implement `frontend/src/pages/SettingsGithubPage.tsx`**

```tsx
import { apiBase, useGithubStatus, useDisconnectGithub } from "@/hooks/useGithub";
import { Button } from "@/components/ui/button";

export function SettingsGithubPage() {
  const { data: status } = useGithubStatus();
  const disconnect = useDisconnectGithub();
  const connected = !!status?.user;

  return (
    <div className="max-w-2xl mx-auto p-6 flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold">Connect GitHub</h1>

      <section className="rounded-lg border border-border p-4 flex flex-col gap-3 bg-surface">
        <div className="font-mono text-xs uppercase tracking-wide text-ink-muted">Account</div>
        {connected ? (
          <div className="flex items-center gap-3">
            <img src={status!.user!.avatarUrl} alt="" className="size-8 rounded-full" />
            <span className="text-sm">Connected as <b>{status!.user!.login}</b></span>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => disconnect.mutate()}>Disconnect</Button>
          </div>
        ) : (
          <a href={`${apiBase}/github/authorize`}>
            <Button>Authorize GitHub</Button>
          </a>
        )}
      </section>

      <section className="rounded-lg border border-border p-4 flex flex-col gap-3 bg-surface">
        <div className="font-mono text-xs uppercase tracking-wide text-ink-muted">Installations</div>
        <p className="text-sm text-ink-muted">
          Install the app on your account or an organization. On GitHub you choose the org and either all repositories
          or only selected ones.
        </p>
        <a href={`${apiBase}/github/install`}>
          <Button variant="outline">Install / Configure on GitHub</Button>
        </a>
        <ul className="text-sm flex flex-col gap-1">
          {(status?.installations ?? []).map((i) => (
            <li key={i.installationId} className="flex items-center gap-2">
              <span className="size-2 rounded-sm bg-ink" />
              <span>{i.accountLogin}</span>
              <span className="font-mono text-[11px] text-ink-muted">{i.accountType}</span>
              <span className="ml-auto font-mono text-[11px] text-ink-muted">{i.repositorySelection} repos</span>
            </li>
          ))}
          {(status?.installations ?? []).length === 0 && (
            <li className="text-ink-muted text-xs">No installations yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Implement `frontend/src/pages/MyGithubPage.tsx`**

```tsx
import { useGithubStatus, useContributions } from "@/hooks/useGithub";
import { ContributionsChart } from "@/components/github/ContributionsChart";

export function MyGithubPage({ onGoToSettings }: { onGoToSettings: () => void }) {
  const { data: status } = useGithubStatus();
  const connected = !!status?.user;
  const { data: calendar, isLoading, isError } = useContributions(connected);

  return (
    <div className="max-w-3xl mx-auto p-6 flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold">My GitHub</h1>
      {!connected ? (
        <p className="text-sm text-ink-muted">
          Not connected.{" "}
          <button className="underline" onClick={onGoToSettings}>Connect GitHub</button> to see your contributions.
        </p>
      ) : isLoading ? (
        <p className="text-sm text-ink-muted">Loading contributions…</p>
      ) : isError || !calendar ? (
        <p className="text-sm text-ink-muted">Couldn't load contributions. Try reconnecting in settings.</p>
      ) : (
        <section className="rounded-lg border border-border p-4 bg-surface">
          <ContributionsChart calendar={calendar} />
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add sidebar entries in `frontend/src/components/layout/Sidebar.tsx`**

Add these props to the component signature:
```tsx
onOpenMyGithub: () => void;
onOpenSettingsGithub: () => void;
```
And render a nav block right under the existing "All tasks" `<nav>`:
```tsx
<nav className="text-sm flex flex-col gap-1">
  <button onClick={onOpenMyGithub} className="w-full text-left px-2 py-1 rounded-md hover:bg-bg">My GitHub</button>
  <button onClick={onOpenSettingsGithub} className="w-full text-left px-2 py-1 rounded-md hover:bg-bg">Connect GitHub</button>
</nav>
```

- [ ] **Step 4: Wire the views in `frontend/src/App.tsx`**

Add a separate `page` state above the board (kept independent of the board/list `view`):
```tsx
const [page, setPage] = useState<"tasks" | "my-github" | "settings-github">("tasks");
```
Pass the two handlers to `<Sidebar … onOpenMyGithub={() => setPage("my-github")} onOpenSettingsGithub={() => setPage("settings-github")} />`, and make the "All tasks" button also call `setPage("tasks")`.
Replace the `<section …>` content selection so that when `page !== "tasks"` it renders the page instead of the board/list:
```tsx
{page === "my-github" ? (
  <MyGithubPage onGoToSettings={() => setPage("settings-github")} />
) : page === "settings-github" ? (
  <SettingsGithubPage />
) : view === "board" ? (
  <BoardView groupBy={groupBy} projectId={projectId} dueFilter={dueFilter} onOpenTask={setOpenTask} onCreateInColumn={openCreate} />
) : (
  <ListView projectId={projectId} dueFilter={dueFilter} onOpenTask={setOpenTask} />
)}
```
Add the imports:
```tsx
import { SettingsGithubPage } from "@/pages/SettingsGithubPage";
import { MyGithubPage } from "@/pages/MyGithubPage";
```
Also handle the post-OAuth redirect flag: on mount, if `location.search` contains `connected=1`/`installed=1`/`error=`, set `page` to `"settings-github"` and strip the query with `history.replaceState`.
```tsx
useEffect(() => {
  const p = new URLSearchParams(location.search);
  if (p.has("connected") || p.has("installed") || p.has("error")) {
    setPage("settings-github");
    history.replaceState(null, "", location.pathname);
  }
}, []);
```

- [ ] **Step 5: Typecheck + build**

Run: `cd frontend && pnpm lint && pnpm build`
Expected: clean typecheck; production build succeeds.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages frontend/src/components/layout/Sidebar.tsx frontend/src/App.tsx
git commit -m "feat(github): settings + my-github pages wired into the app shell"
```

---

## Task 12: Setup runbook in README + manual end-to-end verification

**Files:**
- Modify: `README.md` (GitHub App setup section)

**Interfaces:**
- Produces: documented setup so a fresh clone can configure the GitHub App and run the flows.

- [ ] **Step 1: Add a "GitHub integration (optional)" section to `README.md`**

Document, as a numbered runbook: creating the GitHub App (callback `http://localhost:4000/github/callback`, setup URL `http://localhost:4000/github/setup`, user-token expiration OFF, repo permissions Metadata/Contents/Issues/Pull requests = Read), generating the private key and base64-encoding it (`base64 -w0 key.pem`), generating `GITHUB_TOKEN_ENC_KEY` (`openssl rand -base64 32`) and `GITHUB_STATE_SECRET` (`openssl rand -hex 32`), and filling `backend/.env`. Note that `FRONTEND_URL=http://localhost:5173`.

- [ ] **Step 2: Manual end-to-end check (requires a real GitHub App configured)**

With `backend/.env` filled and both servers running:
1. Open the app → sidebar → "Connect GitHub" → "Authorize GitHub" → approve on GitHub → returns to settings showing "Connected as <you>".
2. Click "Install / Configure on GitHub" → pick account/org + repos → returns showing the installation in the list.
3. Sidebar → "My GitHub" → contributions heatmap renders with your totals.
4. "Disconnect" → status returns to not-connected.

Expected: all four steps work. If GitHub isn't configured, this step is skipped (the unit/route tests already cover the logic with mocks).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs(github): setup runbook for the GitHub App integration"
```

---

## Self-Review Notes

- **Spec coverage:** GitHub App + both flows (Tasks 4,5,8); single-user global storage (Tasks 1,7); org/repo selection via install redirect + listing (Tasks 8,11); contributions in a global My GitHub area (Tasks 6,10,11); on-demand proxy, no caching (Tasks 6,8); user-token expiration-off assumption (no refresh code anywhere); data model (Task 1); backend module boundaries config/crypto/appAuth/oauth/contributions/store/routes (Tasks 2–8); API endpoints §7 (Task 8); frontend settings + My GitHub (Tasks 9–11); env vars (Tasks 1,2); security: backend-only secrets, AES-GCM token encryption, signed state, on-demand install tokens (Tasks 2,3,7,8); error handling incl. 409-not-connected and state error redirect (Task 8); testing pure units + mocked routes (Tasks 3,4,5,6,8); setup runbook + known limitations (Task 12). No gaps.
- **Type consistency:** `ContributionCalendar`/`ContributionDay` identical in `contributions.ts` (Task 6) and `useGithub.ts` (Task 9). Install shape `{ installationId, accountLogin, accountType, repositorySelection }` consistent across `appAuth.ts`, `store.ts`, routes, and frontend. `getUserToken()` returns `{ login, avatarUrl, accessToken }` used by routes for status + contributions. `signState`/`verifyState` names consistent across crypto, oauth flow, and routes/tests.
- **Placeholder scan:** none — every code step is concrete; the only blank values are env placeholders in `.env.example`/README, which are intended.

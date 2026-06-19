import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";

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
vi.mock("./repos", () => ({
  listRepositories: vi.fn(async () => [{ id: 10, fullName: "acme/website", private: true, installationId: 1 }]),
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

describe("github routes", () => {
  it("status is empty before connecting", async () => {
    const res = await agent.get("/github/status");
    expect(res.body).toEqual({ user: null, installations: [] });
  });

  it("authorize redirects to GitHub", async () => {
    const res = await agent.get("/github/authorize");
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("github.com/login/oauth/authorize");
  });

  it("install redirects to the app install page", async () => {
    const res = await agent.get("/github/install");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("https://github.com/apps/myschedule-dev/installations/new");
  });

  it("callback rejects a bad state", async () => {
    const res = await agent.get("/github/callback?code=c&state=bogus");
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("error=state");
  });

  it("callback with valid state stores the user and redirects connected", async () => {
    const res = await agent.get(`/github/callback?code=c&state=${encodeURIComponent(signState())}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("connected=1");
    const status = await agent.get("/github/status");
    expect(status.body.user).toEqual({ login: "octo", avatarUrl: "http://a" });
  });

  it("setup stores an installation and redirects", async () => {
    const res = await agent.get("/github/setup?installation_id=11&setup_action=install");
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("installed=1");
    const status = await agent.get("/github/status");
    expect(status.body.installations[0].accountLogin).toBe("acme");
  });

  it("contributions 409s when not connected, 200 after connect", async () => {
    expect((await agent.get("/github/contributions")).status).toBe(409);
    await agent.get(`/github/callback?code=c&state=${encodeURIComponent(signState())}`);
    const res = await agent.get("/github/contributions");
    expect(res.status).toBe(200);
    expect(res.body.totalContributions).toBe(2);
  });

  it("lists repositories", async () => {
    const res = await agent.get("/github/repositories");
    expect(res.status).toBe(200);
    expect(res.body[0].fullName).toBe("acme/website");
  });

  it("disconnect clears the user", async () => {
    await agent.get(`/github/callback?code=c&state=${encodeURIComponent(signState())}`);
    expect((await agent.post("/github/disconnect")).status).toBe(204);
    expect((await agent.get("/github/status")).body.user).toBeNull();
  });

  it("isolates github status between workspaces", async () => {
    await agent.get(`/github/callback?code=c&state=${encodeURIComponent(signState())}`);
    const other = await authedAgent(app);
    expect((await other.get("/github/status")).body).toEqual({ user: null, installations: [] });
  });
});

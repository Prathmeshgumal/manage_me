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

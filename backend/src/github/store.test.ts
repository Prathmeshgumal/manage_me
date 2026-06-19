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

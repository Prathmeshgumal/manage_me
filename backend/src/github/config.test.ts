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

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encryptToken, decryptToken, signState, verifyState } from "./crypto";

const ENV = {
  GITHUB_TOKEN_ENC_KEY: Buffer.alloc(32, 9).toString("base64"),
  GITHUB_STATE_SECRET: "statesecret",
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

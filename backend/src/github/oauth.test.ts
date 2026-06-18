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
    vi.mocked(request).mockResolvedValueOnce({ data: { access_token: "ghu_x", scope: "" } } as never);
    const r = await exchangeCode("code123");
    expect(r.accessToken).toBe("ghu_x");
  });

  it("throws when GitHub returns an oauth error", async () => {
    vi.mocked(request).mockResolvedValueOnce({ data: { error: "bad_verification_code" } } as never);
    await expect(exchangeCode("nope")).rejects.toThrow(/bad_verification_code/);
  });

  it("maps the authed user", async () => {
    vi.mocked(request).mockResolvedValueOnce({ data: { id: 42, login: "octo", avatar_url: "http://a/x.png" } } as never);
    expect(await getAuthedUser("ghu_x")).toEqual({ id: 42, login: "octo", avatarUrl: "http://a/x.png" });
  });
});

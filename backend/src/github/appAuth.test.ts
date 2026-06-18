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
    } } as never);
    expect(await getInstallation(999)).toEqual({
      installationId: 999, accountLogin: "acme", accountType: "Organization", repositorySelection: "selected",
    });
  });
});

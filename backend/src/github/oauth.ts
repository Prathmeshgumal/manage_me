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

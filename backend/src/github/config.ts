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

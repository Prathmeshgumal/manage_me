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

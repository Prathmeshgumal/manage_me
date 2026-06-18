import { request } from "@octokit/request";
import { installationToken } from "./appAuth.js";
import { listInstallations } from "./store.js";

export type RepoRef = { id: number; fullName: string; private: boolean; installationId: number };

/** Repositories the app can access, aggregated across all installations. */
export async function listRepositories(): Promise<RepoRef[]> {
  const installations = await listInstallations();
  const out: RepoRef[] = [];
  for (const inst of installations) {
    const token = await installationToken(inst.installationId);
    const res = await request("GET /installation/repositories", {
      headers: { authorization: `token ${token}` },
      per_page: 100,
    });
    const repos = (res.data as { repositories: { id: number; full_name: string; private: boolean }[] }).repositories;
    for (const r of repos) {
      out.push({ id: r.id, fullName: r.full_name, private: r.private, installationId: inst.installationId });
    }
  }
  out.sort((a, b) => a.fullName.localeCompare(b.fullName));
  return out;
}

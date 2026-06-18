import { request } from "@octokit/request";
import { installationToken } from "./appAuth.js";

export type DirEntry = { name: string; path: string; type: "dir" | "file" };
export type RepoContents =
  | { type: "dir"; entries: DirEntry[] }
  | { type: "file"; name: string; path: string; size: number; content: string; isBinary: boolean; tooLarge: boolean };

const MAX_BYTES = 1_000_000;

function looksBinary(buf: Buffer): boolean {
  // Heuristic: a NUL byte in the first chunk means binary.
  return buf.subarray(0, 8000).includes(0);
}

export async function getRepoContents(
  installationId: number, owner: string, repo: string, path: string,
): Promise<RepoContents> {
  const token = await installationToken(installationId);
  const res = await request("GET /repos/{owner}/{repo}/contents/{path}", {
    owner, repo, path,
    headers: { authorization: `token ${token}` },
  });

  if (Array.isArray(res.data)) {
    const entries = (res.data as DirEntry[])
      .map((e) => ({ name: e.name, path: e.path, type: e.type === "dir" ? "dir" as const : "file" as const }))
      .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1));
    return { type: "dir", entries };
  }

  const f = res.data as { name: string; path: string; size: number; encoding?: string; content?: string };
  const base = { type: "file" as const, name: f.name, path: f.path, size: f.size };
  if (f.size > MAX_BYTES || f.encoding !== "base64" || !f.content) {
    return { ...base, content: "", isBinary: false, tooLarge: f.size > MAX_BYTES };
  }
  const buf = Buffer.from(f.content, "base64");
  if (looksBinary(buf)) return { ...base, content: "", isBinary: true, tooLarge: false };
  return { ...base, content: buf.toString("utf8"), isBinary: false, tooLarge: false };
}

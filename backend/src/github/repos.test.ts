import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@octokit/request", () => ({ request: vi.fn() }));
vi.mock("./appAuth", () => ({ installationToken: vi.fn(async () => "ghs_tok") }));
vi.mock("./store", () => ({ listInstallations: vi.fn() }));

import { request } from "@octokit/request";
import { listInstallations } from "./store";
import { listRepositories } from "./repos";

describe("listRepositories", () => {
  beforeEach(() => { vi.mocked(request).mockReset(); });

  it("aggregates repos across installations, sorted by fullName", async () => {
    vi.mocked(listInstallations).mockResolvedValueOnce([
      { installationId: 1, accountLogin: "acme", accountType: "Organization", repositorySelection: "all" },
      { installationId: 2, accountLogin: "you", accountType: "User", repositorySelection: "selected" },
    ]);
    vi.mocked(request)
      .mockResolvedValueOnce({ data: { repositories: [{ id: 10, full_name: "acme/website", private: true }] } } as never)
      .mockResolvedValueOnce({ data: { repositories: [{ id: 20, full_name: "you/app", private: false }] } } as never);

    const repos = await listRepositories();
    expect(repos).toEqual([
      { id: 20, fullName: "you/app", private: false, installationId: 2 },
      { id: 10, fullName: "acme/website", private: true, installationId: 1 },
    ].sort((a, b) => a.fullName.localeCompare(b.fullName)));
    expect(repos[0].fullName).toBe("acme/website");
    expect(repos[1].fullName).toBe("you/app");
  });

  it("returns empty when there are no installations", async () => {
    vi.mocked(listInstallations).mockResolvedValueOnce([]);
    expect(await listRepositories()).toEqual([]);
  });
});

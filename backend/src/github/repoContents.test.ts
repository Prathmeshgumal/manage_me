import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@octokit/request", () => ({ request: vi.fn() }));
vi.mock("./appAuth", () => ({ installationToken: vi.fn(async () => "ghs_tok") }));

import { request } from "@octokit/request";
import { getRepoContents } from "./repoContents";

describe("getRepoContents", () => {
  beforeEach(() => { vi.mocked(request).mockReset(); });

  it("returns a sorted directory listing (dirs first)", async () => {
    vi.mocked(request).mockResolvedValueOnce({ data: [
      { name: "README.md", path: "README.md", type: "file" },
      { name: "src", path: "src", type: "dir" },
      { name: "package.json", path: "package.json", type: "file" },
    ] } as never);
    const res = await getRepoContents(1, "octo", "app", "");
    expect(res.type).toBe("dir");
    if (res.type === "dir") {
      expect(res.entries.map((e) => e.name)).toEqual(["src", "package.json", "README.md"]);
    }
  });

  it("decodes a text file", async () => {
    vi.mocked(request).mockResolvedValueOnce({ data: {
      name: "README.md", path: "README.md", type: "file", size: 11,
      encoding: "base64", content: Buffer.from("hello world").toString("base64"),
    } } as never);
    const res = await getRepoContents(1, "octo", "app", "README.md");
    expect(res).toMatchObject({ type: "file", name: "README.md", content: "hello world", isBinary: false });
  });

  it("flags binary files without returning content", async () => {
    const bin = Buffer.from([0x00, 0x01, 0x02, 0x00]).toString("base64");
    vi.mocked(request).mockResolvedValueOnce({ data: {
      name: "logo.png", path: "logo.png", type: "file", size: 4, encoding: "base64", content: bin,
    } } as never);
    const res = await getRepoContents(1, "octo", "app", "logo.png");
    expect(res).toMatchObject({ type: "file", isBinary: true, content: "" });
  });

  it("flags too-large files", async () => {
    vi.mocked(request).mockResolvedValueOnce({ data: {
      name: "big.txt", path: "big.txt", type: "file", size: 2_000_000, encoding: "none", content: "",
    } } as never);
    const res = await getRepoContents(1, "octo", "app", "big.txt");
    expect(res).toMatchObject({ type: "file", tooLarge: true, content: "" });
  });
});

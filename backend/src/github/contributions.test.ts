import { describe, it, expect, vi } from "vitest";

const gqlFn = vi.fn();
vi.mock("@octokit/graphql", () => ({ graphql: { defaults: vi.fn(() => gqlFn) } }));
import { levelForCount, mapCalendar, fetchContributions } from "./contributions";

describe("contributions", () => {
  it("buckets counts into levels", () => {
    expect(levelForCount(0)).toBe(0);
    expect(levelForCount(2)).toBe(1);
    expect(levelForCount(5)).toBe(2);
    expect(levelForCount(8)).toBe(3);
    expect(levelForCount(20)).toBe(4);
  });

  it("maps the GraphQL calendar shape", () => {
    const raw = { user: { contributionsCollection: { contributionCalendar: {
      totalContributions: 3,
      weeks: [{ contributionDays: [
        { date: "2026-06-01", contributionCount: 0 },
        { date: "2026-06-02", contributionCount: 5 },
      ] }],
    } } } };
    const cal = mapCalendar(raw);
    expect(cal.totalContributions).toBe(3);
    expect(cal.weeks[0].days[1]).toEqual({ date: "2026-06-02", count: 5, level: 2 });
  });

  it("fetchContributions runs the query and maps", async () => {
    // `viewer` query returns data under the `viewer` key
    gqlFn.mockResolvedValueOnce({ viewer: { contributionsCollection: { contributionCalendar: {
      totalContributions: 1, weeks: [{ contributionDays: [{ date: "2026-06-02", contributionCount: 1 }] }],
    } } } });
    const cal = await fetchContributions("ghu_x");
    expect(cal.totalContributions).toBe(1);
    expect(cal.weeks[0].days[0].level).toBe(1);
  });
});

import { graphql } from "@octokit/graphql";

export type ContributionDay = { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 };
export type ContributionCalendar = { totalContributions: number; weeks: { days: ContributionDay[] }[] };

export function levelForCount(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count <= 3) return 1;
  if (count <= 6) return 2;
  if (count <= 9) return 3;
  return 4;
}

type RawDay = { date: string; contributionCount: number };
type Raw = { user: { contributionsCollection: { contributionCalendar: {
  totalContributions: number; weeks: { contributionDays: RawDay[] }[];
} } } };

export function mapCalendar(raw: Raw): ContributionCalendar {
  const cal = raw.user.contributionsCollection.contributionCalendar;
  return {
    totalContributions: cal.totalContributions,
    weeks: cal.weeks.map((w) => ({
      days: w.contributionDays.map((d) => ({
        date: d.date, count: d.contributionCount, level: levelForCount(d.contributionCount),
      })),
    })),
  };
}

const QUERY = `query {
  viewer { contributionsCollection { contributionCalendar {
    totalContributions
    weeks { contributionDays { date contributionCount } }
  } } }
}`;

export async function fetchContributions(userToken: string): Promise<ContributionCalendar> {
  const run = graphql.defaults({ headers: { authorization: `token ${userToken}` } });
  // `viewer` returns the authorizing user; reshape to the mapCalendar input form.
  const data = await run<{ viewer: Raw["user"] }>(QUERY);
  return mapCalendar({ user: data.viewer });
}

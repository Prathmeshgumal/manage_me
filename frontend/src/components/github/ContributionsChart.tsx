import type { ContributionCalendar } from "@/hooks/useGithub";

const LEVEL_COLOR: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "var(--border)",
  1: "var(--p-low)",
  2: "var(--p-medium)",
  3: "var(--p-high)",
  4: "var(--p-urgent)",
};

export function ContributionsChart({ calendar }: { calendar: ContributionCalendar }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1 overflow-x-auto">
        {calendar.weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.days.map((d) => (
              <span
                key={d.date}
                title={`${d.date}: ${d.count} contribution${d.count === 1 ? "" : "s"}`}
                className="size-3 rounded-[2px]"
                style={{ background: LEVEL_COLOR[d.level] }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="font-mono text-xs text-ink-muted">
        {calendar.totalContributions} contributions in the last year
      </div>
    </div>
  );
}

import type { ContributionCalendar, ContributionDay } from "@/hooks/useGithub";

const LEVEL_VAR: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "var(--gh-0)", 1: "var(--gh-1)", 2: "var(--gh-2)", 3: "var(--gh-3)", 4: "var(--gh-4)",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["", "Mon", "", "Wed", "", "Fri", ""]; // GitHub shows Mon/Wed/Fri

// Parse "YYYY-MM-DD" as a UTC calendar date (no timezone drift).
function utcParts(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return { weekday: dt.getUTCDay(), month: m - 1 };
}

function Cell({ day }: { day: ContributionDay | null }) {
  if (!day) return <span className="size-[11px]" />;
  const noun = day.count === 1 ? "contribution" : "contributions";
  return (
    <span
      className="size-[11px] rounded-[2px] outline outline-1 -outline-offset-1 outline-black/[0.06] dark:outline-white/[0.04]"
      style={{ background: LEVEL_VAR[day.level] }}
      title={`${day.count} ${noun} on ${day.date}`}
    />
  );
}

export function ContributionsChart({ calendar }: { calendar: ContributionCalendar }) {
  // Build each week as 7 weekday-aligned slots so partial first/last weeks line up.
  const columns = calendar.weeks.map((week) => {
    const slots: (ContributionDay | null)[] = [null, null, null, null, null, null, null];
    for (const d of week.days) slots[utcParts(d.date).weekday] = d;
    return slots;
  });

  // Month label per column: show when the month of the column's first day changes.
  const monthLabels = calendar.weeks.map((week, i) => {
    const first = week.days[0];
    if (!first) return "";
    const m = utcParts(first.date).month;
    const prev = calendar.weeks[i - 1]?.days[0];
    if (i === 0 || (prev && utcParts(prev.date).month !== m)) return MONTHS[m];
    return "";
  });

  return (
    <div className="flex flex-col gap-2 text-ink-muted">
      {/* Scrollable grid (falls back to horizontal scroll only on narrow screens) */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {/* Weekday labels */}
        <div className="flex flex-col gap-[3px] pt-[18px] shrink-0">
          {WEEKDAYS.map((w, i) => (
            <span key={i} className="h-[11px] text-[10px] leading-[11px] pr-1">{w}</span>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          {/* Month labels */}
          <div className="flex gap-[3px] h-[14px]">
            {monthLabels.map((label, i) => (
              <span key={i} className="w-[11px] text-[10px] leading-none whitespace-nowrap overflow-visible">
                {label}
              </span>
            ))}
          </div>
          {/* Grid */}
          <div className="flex gap-[3px]">
            {columns.map((slots, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {slots.map((day, di) => <Cell key={di} day={day} />)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer: total + legend (never scrolls) */}
      <div className="flex items-center justify-between text-[11px]">
        <span>{calendar.totalContributions.toLocaleString()} contributions in the last year</span>
        <span className="flex items-center gap-1">
          Less
          {([0, 1, 2, 3, 4] as const).map((l) => (
            <span
              key={l}
              className="size-[11px] rounded-[2px] outline outline-1 -outline-offset-1 outline-black/[0.06] dark:outline-white/[0.04]"
              style={{ background: LEVEL_VAR[l] }}
            />
          ))}
          More
        </span>
      </div>
    </div>
  );
}

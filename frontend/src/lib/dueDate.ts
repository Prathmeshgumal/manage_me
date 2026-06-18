// Shared due-date logic used by card highlighting, board grouping, and filtering.
// Works in pure calendar-date terms (yyyy-mm-dd) to avoid timezone off-by-one:
// the backend stores a due date at UTC midnight, so its canonical value is the
// UTC date portion (iso.slice(0,10)); "today" is the user's local calendar date.

export type DueBucket = "OVERDUE" | "TODAY" | "THIS_WEEK" | "LATER" | "NONE";

export const DUE_BUCKET_ORDER: DueBucket[] = ["OVERDUE", "TODAY", "THIS_WEEK", "LATER", "NONE"];

export const dueBucketMeta: Record<DueBucket, { label: string; accent: string }> = {
  OVERDUE:   { label: "Overdue",   accent: "var(--p-urgent)" },
  TODAY:     { label: "Today",     accent: "var(--p-high)" },
  THIS_WEEK: { label: "This week", accent: "var(--p-medium)" },
  LATER:     { label: "Later",     accent: "var(--p-low)" },
  NONE:      { label: "No date",   accent: "var(--p-none)" },
};

function localYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ymdToUTC(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Whole days from today to the due date (negative = past). */
export function daysFromToday(iso: string): number {
  const ms = ymdToUTC(iso.slice(0, 10)) - ymdToUTC(localYMD(new Date()));
  return Math.round(ms / 86400000);
}

export function dueBucket(iso: string | null): DueBucket {
  if (!iso) return "NONE";
  const d = daysFromToday(iso);
  if (d < 0) return "OVERDUE";
  if (d === 0) return "TODAY";
  if (d <= 7) return "THIS_WEEK";
  return "LATER";
}

/** Representative yyyy-mm-dd when a card is dropped into a bucket (null clears it). */
export function bucketAnchorDate(b: DueBucket): string | null {
  const d = new Date();
  switch (b) {
    case "OVERDUE": d.setDate(d.getDate() - 1); break;
    case "TODAY": break;
    case "THIS_WEEK": d.setDate(d.getDate() + 3); break;
    case "LATER": d.setDate(d.getDate() + 14); break;
    case "NONE": return null;
  }
  return localYMD(d);
}

/** Display text + color for a due date on a card or list row. */
export function dueDateDisplay(iso: string): { text: string; color: string } {
  const d = daysFromToday(iso);
  const date = new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
  if (d < 0) return { text: `${date} · overdue`, color: "var(--p-urgent)" };
  if (d === 0) return { text: "Today", color: "var(--p-high)" };
  if (d === 1) return { text: "Tomorrow", color: "var(--p-high)" };
  if (d <= 7) return { text: date, color: "var(--p-medium)" };
  return { text: date, color: "var(--ink-muted)" };
}

import type { Priority, Status } from "@myschedule/shared";

export const priorityMeta: Record<Priority, { label: string; color: string; glyph: string; rank: number }> = {
  URGENT: { label: "Urgent", color: "var(--p-urgent)", glyph: "▲", rank: 0 },
  HIGH:   { label: "High",   color: "var(--p-high)",   glyph: "▮▮▮", rank: 1 },
  MEDIUM: { label: "Medium", color: "var(--p-medium)", glyph: "▮▮▯", rank: 2 },
  LOW:    { label: "Low",    color: "var(--p-low)",    glyph: "▮▯▯", rank: 3 },
  NONE:   { label: "No priority", color: "var(--p-none)", glyph: "▯▯▯", rank: 4 },
};
export const PRIORITY_ORDER: Priority[] = ["URGENT", "HIGH", "MEDIUM", "LOW", "NONE"];

export const statusMeta: Record<Status, { label: string }> = {
  BACKLOG: { label: "Backlog" },
  TODO: { label: "Todo" },
  IN_PROGRESS: { label: "In Progress" },
  DONE: { label: "Done" },
  CANCELED: { label: "Canceled" },
};
export const STATUS_ORDER: Status[] = ["BACKLOG", "TODO", "IN_PROGRESS", "DONE", "CANCELED"];

import { z } from "zod";

export const statusEnum = z.enum([
  "BACKLOG", "TODO", "IN_PROGRESS", "DONE", "CANCELED",
]);
export type Status = z.infer<typeof statusEnum>;

export const priorityEnum = z.enum([
  "NONE", "LOW", "MEDIUM", "HIGH", "URGENT",
]);
export type Priority = z.infer<typeof priorityEnum>;

import { z } from "zod";
import { statusEnum, priorityEnum } from "./enums";

export const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(20000).nullish(),
  status: statusEnum.default("BACKLOG"),
  priority: priorityEnum.default("NONE"),
  dueDate: z.coerce.date().nullish(),
  projectId: z.string().nullish(),
  labelIds: z.array(z.string()).optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(20000).nullish(),
  status: statusEnum.optional(),
  priority: priorityEnum.optional(),
  dueDate: z.coerce.date().nullish(),
  projectId: z.string().nullish(),
  sortOrder: z.number().optional(),
  labelIds: z.array(z.string()).optional(),
});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const taskFilterSchema = z.object({
  status: statusEnum.optional(),
  priority: priorityEnum.optional(),
  projectId: z.string().optional(),
  labelId: z.string().optional(),
});
export type TaskFilter = z.infer<typeof taskFilterSchema>;

export const labelRefSchema = z.object({
  id: z.string(), name: z.string(), color: z.string(),
});
export const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: statusEnum,
  priority: priorityEnum,
  dueDate: z.string().nullable(),
  projectId: z.string().nullable(),
  sortOrder: z.number(),
  labels: z.array(labelRefSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Task = z.infer<typeof taskSchema>;

import { z } from "zod";

export const statusEnum = z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "DONE", "CANCELED"]);
export type Status = z.infer<typeof statusEnum>;

export const priorityEnum = z.enum(["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"]);
export type Priority = z.infer<typeof priorityEnum>;

const HEX = z.string().regex(/^#([0-9a-fA-F]{6})$/, "must be a #RRGGBB hex");

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

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  color: HEX.default("#8A8A86"),
  githubRepoId: z.number().int().nullish(),
  githubRepoFullName: z.string().nullish(),
  githubInstallationId: z.number().int().nullish(),
});
export const updateProjectSchema = createProjectSchema.partial();
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const createLabelSchema = z.object({
  name: z.string().min(1).max(100),
  color: HEX.default("#8A8A86"),
});
export const updateLabelSchema = createLabelSchema.partial();
export type CreateLabelInput = z.infer<typeof createLabelSchema>;
export type UpdateLabelInput = z.infer<typeof updateLabelSchema>;

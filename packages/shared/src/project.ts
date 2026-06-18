import { z } from "zod";

const HEX = z.string().regex(/^#([0-9a-fA-F]{6})$/, "must be a #RRGGBB hex");

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  color: HEX.default("#8A8A86"),
});
export const updateProjectSchema = createProjectSchema.partial();
export const projectSchema = z.object({
  id: z.string(), name: z.string(), color: z.string(),
  createdAt: z.string(), updatedAt: z.string(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type Project = z.infer<typeof projectSchema>;

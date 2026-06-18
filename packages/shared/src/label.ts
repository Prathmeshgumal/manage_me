import { z } from "zod";

const HEX = z.string().regex(/^#([0-9a-fA-F]{6})$/, "must be a #RRGGBB hex");

export const createLabelSchema = z.object({
  name: z.string().min(1).max(100),
  color: HEX.default("#8A8A86"),
});
export const labelSchema = z.object({
  id: z.string(), name: z.string(), color: z.string(), createdAt: z.string(),
});
export type CreateLabelInput = z.infer<typeof createLabelSchema>;
export type Label = z.infer<typeof labelSchema>;

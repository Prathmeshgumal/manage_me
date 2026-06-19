import { Router } from "express";
import { createLabelSchema, updateLabelSchema } from "../schemas.js";
import { prisma } from "../prisma.js";
import { asyncHandler } from "../errors.js";

export const labelsRouter = Router();

const ser = (l: { createdAt: Date } & Record<string, unknown>) => ({ ...l, createdAt: l.createdAt.toISOString() });

labelsRouter.get("/", asyncHandler(async (req, res) => {
  res.json((await prisma.label.findMany({
    where: { workspaceId: req.workspaceId }, orderBy: { createdAt: "asc" },
  })).map(ser));
}));
labelsRouter.post("/", asyncHandler(async (req, res) => {
  const data = createLabelSchema.parse(req.body);
  res.status(201).json(ser(await prisma.label.create({ data: { ...data, workspaceId: req.workspaceId! } })));
}));
labelsRouter.patch("/:id", asyncHandler(async (req, res) => {
  const data = updateLabelSchema.parse(req.body);
  const existing = await prisma.label.findFirst({ where: { id: req.params.id, workspaceId: req.workspaceId } });
  if (!existing) return res.status(404).json({ error: { message: "Not found" } });
  res.json(ser(await prisma.label.update({ where: { id: req.params.id }, data })));
}));
labelsRouter.delete("/:id", asyncHandler(async (req, res) => {
  const result = await prisma.label.deleteMany({ where: { id: req.params.id, workspaceId: req.workspaceId } });
  if (result.count === 0) return res.status(404).json({ error: { message: "Not found" } });
  res.status(204).end();
}));

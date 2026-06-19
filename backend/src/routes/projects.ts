import { Router } from "express";
import { createProjectSchema, updateProjectSchema } from "../schemas.js";
import { prisma } from "../prisma.js";
import { asyncHandler } from "../errors.js";

export const projectsRouter = Router();

const ser = (p: { createdAt: Date; updatedAt: Date } & Record<string, unknown>) => ({
  ...p, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(),
});

projectsRouter.get("/", asyncHandler(async (req, res) => {
  res.json((await prisma.project.findMany({
    where: { workspaceId: req.workspaceId }, orderBy: { createdAt: "asc" },
  })).map(ser));
}));
projectsRouter.post("/", asyncHandler(async (req, res) => {
  const data = createProjectSchema.parse(req.body);
  res.status(201).json(ser(await prisma.project.create({ data: { ...data, workspaceId: req.workspaceId! } })));
}));
projectsRouter.patch("/:id", asyncHandler(async (req, res) => {
  const data = updateProjectSchema.parse(req.body);
  const existing = await prisma.project.findFirst({ where: { id: req.params.id, workspaceId: req.workspaceId } });
  if (!existing) return res.status(404).json({ error: { message: "Not found" } });
  res.json(ser(await prisma.project.update({ where: { id: req.params.id }, data })));
}));
projectsRouter.delete("/:id", asyncHandler(async (req, res) => {
  const result = await prisma.project.deleteMany({ where: { id: req.params.id, workspaceId: req.workspaceId } });
  if (result.count === 0) return res.status(404).json({ error: { message: "Not found" } });
  res.status(204).end();
}));

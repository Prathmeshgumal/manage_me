import { Router } from "express";
import { createProjectSchema, updateProjectSchema } from "@myschedule/shared";
import { prisma } from "../prisma.js";
import { asyncHandler } from "../errors.js";

export const projectsRouter = Router();

const ser = (p: { createdAt: Date; updatedAt: Date } & Record<string, unknown>) => ({
  ...p, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(),
});

projectsRouter.get("/", asyncHandler(async (_req, res) => {
  res.json((await prisma.project.findMany({ orderBy: { createdAt: "asc" } })).map(ser));
}));
projectsRouter.post("/", asyncHandler(async (req, res) => {
  const data = createProjectSchema.parse(req.body);
  res.status(201).json(ser(await prisma.project.create({ data })));
}));
projectsRouter.patch("/:id", asyncHandler(async (req, res) => {
  const data = updateProjectSchema.parse(req.body);
  res.json(ser(await prisma.project.update({ where: { id: req.params.id }, data })));
}));
projectsRouter.delete("/:id", asyncHandler(async (req, res) => {
  await prisma.project.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

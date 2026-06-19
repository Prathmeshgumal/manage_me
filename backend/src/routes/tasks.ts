import { Router } from "express";
import { createTaskSchema, updateTaskSchema, taskFilterSchema } from "../schemas.js";
import { prisma } from "../prisma.js";
import { asyncHandler } from "../errors.js";

export const tasksRouter = Router();

const taskInclude = { labels: { select: { id: true, name: true, color: true } } } as const;

type Row = {
  id: string; title: string; description: string | null;
  status: string; priority: string; dueDate: Date | null;
  projectId: string | null; sortOrder: number;
  labels: { id: string; name: string; color: string }[];
  createdAt: Date; updatedAt: Date;
};

function serializeTask(t: Row) {
  return {
    ...t,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

tasksRouter.get("/", asyncHandler(async (req, res) => {
  const f = taskFilterSchema.parse(req.query);
  const rows = await prisma.task.findMany({
    where: {
      workspaceId: req.workspaceId,
      status: f.status, priority: f.priority, projectId: f.projectId,
      ...(f.labelId ? { labels: { some: { id: f.labelId } } } : {}),
    },
    include: taskInclude,
    orderBy: { sortOrder: "asc" },
  });
  res.json(rows.map(serializeTask));
}));

tasksRouter.post("/", asyncHandler(async (req, res) => {
  const { labelIds, ...data } = createTaskSchema.parse(req.body);
  const row = await prisma.task.create({
    data: {
      ...data,
      workspaceId: req.workspaceId!,
      labels: labelIds ? { connect: labelIds.map((id) => ({ id })) } : undefined,
    },
    include: taskInclude,
  });
  res.status(201).json(serializeTask(row));
}));

tasksRouter.get("/:id", asyncHandler(async (req, res) => {
  const row = await prisma.task.findFirst({
    where: { id: req.params.id, workspaceId: req.workspaceId },
    include: taskInclude,
  });
  if (!row) return res.status(404).json({ error: { message: "Not found" } });
  res.json(serializeTask(row));
}));

tasksRouter.patch("/:id", asyncHandler(async (req, res) => {
  const { labelIds, ...data } = updateTaskSchema.parse(req.body);
  const existing = await prisma.task.findFirst({ where: { id: req.params.id, workspaceId: req.workspaceId } });
  if (!existing) return res.status(404).json({ error: { message: "Not found" } });
  const row = await prisma.task.update({
    where: { id: req.params.id },
    data: { ...data, labels: labelIds ? { set: labelIds.map((id) => ({ id })) } : undefined },
    include: taskInclude,
  });
  res.json(serializeTask(row));
}));

tasksRouter.delete("/:id", asyncHandler(async (req, res) => {
  const result = await prisma.task.deleteMany({ where: { id: req.params.id, workspaceId: req.workspaceId } });
  if (result.count === 0) return res.status(404).json({ error: { message: "Not found" } });
  res.status(204).end();
}));

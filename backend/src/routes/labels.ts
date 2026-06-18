import { Router } from "express";
import { createLabelSchema } from "../schemas.js";
import { prisma } from "../prisma.js";
import { asyncHandler } from "../errors.js";

export const labelsRouter = Router();

const ser = (l: { createdAt: Date } & Record<string, unknown>) => ({
  ...l, createdAt: l.createdAt.toISOString(),
});

labelsRouter.get("/", asyncHandler(async (_req, res) => {
  res.json((await prisma.label.findMany({ orderBy: { createdAt: "asc" } })).map(ser));
}));
labelsRouter.post("/", asyncHandler(async (req, res) => {
  const data = createLabelSchema.parse(req.body);
  res.status(201).json(ser(await prisma.label.create({ data })));
}));
labelsRouter.delete("/:id", asyncHandler(async (req, res) => {
  await prisma.label.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

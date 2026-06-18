import { Router } from "express";
import { createBookSchema, updateBookSchema, updateShelfSchema, createPageSchema, updatePageSchema } from "../schemas.js";
import { prisma } from "../prisma.js";
import { asyncHandler, AppError } from "../errors.js";

export const libraryRouter = Router();

const iso = (d: Date) => d.toISOString();

type ShelfRow = { id: string; projectId: string | null; name: string; description: string | null };

async function shelfWithBooks(shelf: ShelfRow) {
  const books = await prisma.book.findMany({
    where: { shelfId: shelf.id },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { pages: true } } },
  });
  return {
    id: shelf.id, projectId: shelf.projectId, name: shelf.name, description: shelf.description,
    books: books.map((b) => ({
      id: b.id, name: b.name, description: b.description, color: b.color,
      sortOrder: b.sortOrder, pageCount: b._count.pages,
    })),
  };
}

// General shelf: not tied to any project; one shared shelf (projectId = null).
libraryRouter.get("/shelf", asyncHandler(async (_req, res) => {
  let shelf = await prisma.shelf.findFirst({ where: { projectId: null } });
  if (!shelf) shelf = await prisma.shelf.create({ data: { projectId: null, name: "General" } });
  res.json(await shelfWithBooks(shelf));
}));

libraryRouter.get("/projects/:projectId/shelf", asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new AppError(404, "Project not found");
  const shelf = await prisma.shelf.upsert({
    where: { projectId },
    create: { projectId },
    update: {},
  });
  res.json(await shelfWithBooks(shelf));
}));

libraryRouter.patch("/shelves/:id", asyncHandler(async (req, res) => {
  const data = updateShelfSchema.parse(req.body);
  const s = await prisma.shelf.update({ where: { id: req.params.id }, data });
  res.json({ id: s.id, projectId: s.projectId, name: s.name, description: s.description });
}));

libraryRouter.post("/shelves/:shelfId/books", asyncHandler(async (req, res) => {
  const data = createBookSchema.parse(req.body);
  const b = await prisma.book.create({ data: { ...data, shelfId: req.params.shelfId, sortOrder: Date.now() } });
  res.status(201).json({ id: b.id, name: b.name, description: b.description, color: b.color, sortOrder: b.sortOrder, createdAt: iso(b.createdAt), updatedAt: iso(b.updatedAt) });
}));

libraryRouter.get("/books/:id", asyncHandler(async (req, res) => {
  const b = await prisma.book.findUnique({
    where: { id: req.params.id },
    include: { pages: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true, sortOrder: true, updatedAt: true } } },
  });
  if (!b) throw new AppError(404, "Book not found");
  res.json({
    id: b.id, name: b.name, description: b.description, color: b.color, sortOrder: b.sortOrder,
    pages: b.pages.map((p) => ({ id: p.id, title: p.title, sortOrder: p.sortOrder, updatedAt: iso(p.updatedAt) })),
  });
}));

libraryRouter.patch("/books/:id", asyncHandler(async (req, res) => {
  const data = updateBookSchema.parse(req.body);
  const b = await prisma.book.update({ where: { id: req.params.id }, data });
  res.json({ id: b.id, name: b.name, description: b.description, color: b.color, sortOrder: b.sortOrder });
}));

libraryRouter.delete("/books/:id", asyncHandler(async (req, res) => {
  await prisma.book.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

libraryRouter.post("/books/:bookId/pages", asyncHandler(async (req, res) => {
  const data = createPageSchema.parse(req.body);
  const p = await prisma.page.create({ data: { ...data, bookId: req.params.bookId, sortOrder: Date.now() } });
  res.status(201).json({ id: p.id, bookId: p.bookId, title: p.title, content: p.content, sortOrder: p.sortOrder, createdAt: iso(p.createdAt), updatedAt: iso(p.updatedAt) });
}));

libraryRouter.get("/pages/:id", asyncHandler(async (req, res) => {
  const p = await prisma.page.findUnique({ where: { id: req.params.id } });
  if (!p) throw new AppError(404, "Page not found");
  res.json({ id: p.id, bookId: p.bookId, title: p.title, content: p.content, sortOrder: p.sortOrder, createdAt: iso(p.createdAt), updatedAt: iso(p.updatedAt) });
}));

libraryRouter.patch("/pages/:id", asyncHandler(async (req, res) => {
  const data = updatePageSchema.parse(req.body);
  const p = await prisma.page.update({ where: { id: req.params.id }, data });
  res.json({ id: p.id, bookId: p.bookId, title: p.title, content: p.content, sortOrder: p.sortOrder, createdAt: iso(p.createdAt), updatedAt: iso(p.updatedAt) });
}));

libraryRouter.delete("/pages/:id", asyncHandler(async (req, res) => {
  await prisma.page.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

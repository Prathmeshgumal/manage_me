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

// Confirm a shelf belongs to the workspace; returns it or null.
async function ownedShelf(workspaceId: string | undefined, shelfId: string) {
  return prisma.shelf.findFirst({ where: { id: shelfId, workspaceId } });
}
// Confirm a book belongs to a shelf in the workspace; returns it or null.
async function ownedBook(workspaceId: string | undefined, bookId: string) {
  return prisma.book.findFirst({ where: { id: bookId, shelf: { workspaceId } } });
}
// Confirm a page belongs to a book/shelf in the workspace; returns it or null.
async function ownedPage(workspaceId: string | undefined, pageId: string) {
  return prisma.page.findFirst({ where: { id: pageId, book: { shelf: { workspaceId } } } });
}

// General shelf: not tied to any project; one per workspace (projectId = null).
libraryRouter.get("/shelf", asyncHandler(async (req, res) => {
  let shelf = await prisma.shelf.findFirst({ where: { projectId: null, workspaceId: req.workspaceId } });
  if (!shelf) shelf = await prisma.shelf.create({ data: { projectId: null, name: "General", workspaceId: req.workspaceId! } });
  res.json(await shelfWithBooks(shelf));
}));

libraryRouter.get("/projects/:projectId/shelf", asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const project = await prisma.project.findFirst({ where: { id: projectId, workspaceId: req.workspaceId } });
  if (!project) throw new AppError(404, "Project not found");
  // The shelf always mirrors the project's name.
  const shelf = await prisma.shelf.upsert({
    where: { projectId },
    create: { projectId, name: project.name, workspaceId: req.workspaceId! },
    update: { name: project.name },
  });
  res.json(await shelfWithBooks(shelf));
}));

libraryRouter.patch("/shelves/:id", asyncHandler(async (req, res) => {
  const data = updateShelfSchema.parse(req.body);
  if (!(await ownedShelf(req.workspaceId, req.params.id))) throw new AppError(404, "Shelf not found");
  const s = await prisma.shelf.update({ where: { id: req.params.id }, data });
  res.json({ id: s.id, projectId: s.projectId, name: s.name, description: s.description });
}));

libraryRouter.post("/shelves/:shelfId/books", asyncHandler(async (req, res) => {
  const data = createBookSchema.parse(req.body);
  if (!(await ownedShelf(req.workspaceId, req.params.shelfId))) throw new AppError(404, "Shelf not found");
  const b = await prisma.book.create({ data: { ...data, shelfId: req.params.shelfId, sortOrder: Date.now() } });
  res.status(201).json({ id: b.id, name: b.name, description: b.description, color: b.color, sortOrder: b.sortOrder, createdAt: iso(b.createdAt), updatedAt: iso(b.updatedAt) });
}));

libraryRouter.get("/books/:id", asyncHandler(async (req, res) => {
  if (!(await ownedBook(req.workspaceId, req.params.id))) throw new AppError(404, "Book not found");
  const b = await prisma.book.findUnique({
    where: { id: req.params.id },
    include: { pages: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true, sortOrder: true, updatedAt: true } } },
  });
  res.json({
    id: b!.id, name: b!.name, description: b!.description, color: b!.color, sortOrder: b!.sortOrder,
    pages: b!.pages.map((p) => ({ id: p.id, title: p.title, sortOrder: p.sortOrder, updatedAt: iso(p.updatedAt) })),
  });
}));

libraryRouter.patch("/books/:id", asyncHandler(async (req, res) => {
  const data = updateBookSchema.parse(req.body);
  if (!(await ownedBook(req.workspaceId, req.params.id))) throw new AppError(404, "Book not found");
  const b = await prisma.book.update({ where: { id: req.params.id }, data });
  res.json({ id: b.id, name: b.name, description: b.description, color: b.color, sortOrder: b.sortOrder });
}));

libraryRouter.delete("/books/:id", asyncHandler(async (req, res) => {
  if (!(await ownedBook(req.workspaceId, req.params.id))) throw new AppError(404, "Book not found");
  await prisma.book.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

libraryRouter.post("/books/:bookId/pages", asyncHandler(async (req, res) => {
  const data = createPageSchema.parse(req.body);
  if (!(await ownedBook(req.workspaceId, req.params.bookId))) throw new AppError(404, "Book not found");
  const p = await prisma.page.create({ data: { ...data, bookId: req.params.bookId, sortOrder: Date.now() } });
  res.status(201).json({ id: p.id, bookId: p.bookId, title: p.title, content: p.content, sortOrder: p.sortOrder, createdAt: iso(p.createdAt), updatedAt: iso(p.updatedAt) });
}));

libraryRouter.get("/pages/:id", asyncHandler(async (req, res) => {
  const p = await ownedPage(req.workspaceId, req.params.id);
  if (!p) throw new AppError(404, "Page not found");
  res.json({ id: p.id, bookId: p.bookId, title: p.title, content: p.content, sortOrder: p.sortOrder, createdAt: iso(p.createdAt), updatedAt: iso(p.updatedAt) });
}));

libraryRouter.patch("/pages/:id", asyncHandler(async (req, res) => {
  const data = updatePageSchema.parse(req.body);
  if (!(await ownedPage(req.workspaceId, req.params.id))) throw new AppError(404, "Page not found");
  const p = await prisma.page.update({ where: { id: req.params.id }, data });
  res.json({ id: p.id, bookId: p.bookId, title: p.title, content: p.content, sortOrder: p.sortOrder, createdAt: iso(p.createdAt), updatedAt: iso(p.updatedAt) });
}));

libraryRouter.delete("/pages/:id", asyncHandler(async (req, res) => {
  if (!(await ownedPage(req.workspaceId, req.params.id))) throw new AppError(404, "Page not found");
  await prisma.page.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

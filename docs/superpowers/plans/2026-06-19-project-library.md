# Project Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A per-project documentation system — each project has one Shelf holding Books holding markdown Pages — surfaced via a right-side Shelves/Books rail on the board and a breadcrumb Library page.

**Architecture:** New Prisma models Shelf/Book/Page (cascade deletes); REST routes in `backend/src/routes/library.ts`; frontend hooks `useLibrary.ts`, a right rail, and a `LibraryPage` with shelf/book/page levels reusing the existing markdown render + edit-toggle pattern.

**Tech Stack:** Express + Prisma + Zod (backend); React + Vite + shadcn/ui + TanStack Query + react-markdown/remark-gfm (frontend); Vitest.

## Global Constraints

- **Package manager:** pnpm. Node >= 20. TypeScript strict in both projects.
- **Git:** commit as the configured repo identity; NEVER add a `Co-Authored-By: Claude` trailer or author as "Claude". Branch is `main`.
- **Error shape (verbatim):** `{ error: { message } }`.
- **Standalone projects:** `backend/` and `frontend/` each have their own deps; the API contract is duplicated by hand (`backend/src/schemas.ts` + `frontend/src/types.ts`).
- **Hierarchy (verbatim):** Project → 1 Shelf (auto-created, unique per project) → many Books → many Pages. Page = title + markdown content.
- **Cascade:** deleting a Book deletes its Pages; deleting a Project deletes its Shelf → Books → Pages.
- **Ordering:** `sortOrder` Float, defaults to creation order. No drag-reorder in v1.
- **Existing patterns:** route serialization helper `ser` (dates → ISO); `asyncHandler`/`AppError` from `backend/src/errors.js`; error middleware maps Zod→400 and Prisma `P2025`→404; frontend `api` client in `frontend/src/lib/api.ts`; markdown editor pattern from `frontend/src/components/task/TaskDetailPanel.tsx`.

---

## File Structure

```
backend/
├── prisma/schema.prisma         # + Shelf, Book, Page models; Project.shelf back-relation
└── src/
    ├── schemas.ts               # + shelf/book/page Zod schemas
    └── routes/
        ├── library.ts           # shelf/book/page routes
        └── library.test.ts      # vitest (real DB)
    └── app.ts                   # mount library routes
frontend/
└── src/
    ├── types.ts                 # + Shelf/Book/Page types
    ├── hooks/useLibrary.ts      # query+mutation hooks
    ├── components/library/
    │   ├── LibraryRail.tsx       # right rail: Shelves / Books
    │   ├── BookList.tsx          # books as cards/list + create
    │   ├── PageList.tsx          # pages list + create
    │   └── PageEditor.tsx        # markdown render + edit toggle
    ├── pages/LibraryPage.tsx     # breadcrumb + shelf/book/page levels
    └── App.tsx                   # wire library page + rail
```

---

## Task 1: Prisma models for Shelf/Book/Page

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Interfaces:**
- Produces: models `Shelf` (projectId @unique, name default "Library", description?), `Book` (shelfId, name, description?, color default "#8A8A86", sortOrder), `Page` (bookId, title, content default "", sortOrder); `Project` gains `shelf Shelf?`. All cascade on parent delete.

- [ ] **Step 1: Add the `shelf` back-relation to the `Project` model**

In `backend/prisma/schema.prisma`, inside `model Project { ... }` add this line after `githubInstallationId Int?`:
```prisma
  shelf                Shelf?
```

- [ ] **Step 2: Append the three models at the end of the schema**

```prisma
model Shelf {
  id          String   @id @default(cuid())
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  projectId   String   @unique
  name        String   @default("Library")
  description String?
  books       Book[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Book {
  id          String   @id @default(cuid())
  shelf       Shelf    @relation(fields: [shelfId], references: [id], onDelete: Cascade)
  shelfId     String
  name        String
  description String?
  color       String   @default("#8A8A86")
  sortOrder   Float    @default(0)
  pages       Page[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([shelfId, sortOrder])
}

model Page {
  id        String   @id @default(cuid())
  book      Book     @relation(fields: [bookId], references: [id], onDelete: Cascade)
  bookId    String
  title     String
  content   String   @default("")
  sortOrder Float    @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([bookId, sortOrder])
}
```

- [ ] **Step 3: Create + apply the migration (regenerates client)**

Run: `cd backend && pnpm exec prisma migrate dev --name project_library`
Expected: new migration folder created and applied; client regenerated. (Needs network + `DATABASE_URL`.)

- [ ] **Step 4: Commit**

```bash
git add backend/prisma
git commit -m "feat(library): prisma models for shelf, book, page"
```

---

## Task 2: Zod schemas for library inputs

**Files:**
- Modify: `backend/src/schemas.ts`

**Interfaces:**
- Produces: `updateShelfSchema`, `createBookSchema`, `updateBookSchema`, `createPageSchema`, `updatePageSchema` + inferred types.

- [ ] **Step 1: Append the schemas to `backend/src/schemas.ts`**

```ts
export const updateShelfSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullish(),
});
export type UpdateShelfInput = z.infer<typeof updateShelfSchema>;

export const createBookSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).nullish(),
  color: HEX.default("#8A8A86"),
});
export const updateBookSchema = createBookSchema.partial();
export type CreateBookInput = z.infer<typeof createBookSchema>;
export type UpdateBookInput = z.infer<typeof updateBookSchema>;

export const createPageSchema = z.object({
  title: z.string().min(1).max(300),
});
export const updatePageSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  content: z.string().max(500000).optional(),
});
export type CreatePageInput = z.infer<typeof createPageSchema>;
export type UpdatePageInput = z.infer<typeof updatePageSchema>;
```

> Note: `HEX` is already defined near the top of `schemas.ts` (used by project/label). Reuse it; do not redeclare.

- [ ] **Step 2: Typecheck**

Run: `cd backend && pnpm lint`
Expected: `tsc --noEmit` clean.

- [ ] **Step 3: Commit**

```bash
git add backend/src/schemas.ts
git commit -m "feat(library): zod schemas for shelf, book, page"
```

---

## Task 3: Library routes (TDD)

**Files:**
- Create: `backend/src/routes/library.ts`
- Create: `backend/src/routes/library.test.ts`
- Modify: `backend/src/app.ts`

**Interfaces:**
- Consumes: `prisma`, `asyncHandler`, `AppError`, the Task 2 schemas.
- Produces `libraryRouter` with:
  - `GET /projects/:projectId/shelf` → `{ id, projectId, name, description, books: BookSummary[] }` (lazily creates shelf). `BookSummary = { id, name, description, color, sortOrder, pageCount }`.
  - `PATCH /shelves/:id` → shelf (no books).
  - `POST /shelves/:shelfId/books` → Book (201).
  - `GET /books/:id` → `{ ...book, pages: PageSummary[] }`, `PageSummary = { id, title, sortOrder, updatedAt }`.
  - `PATCH /books/:id`, `DELETE /books/:id` (204).
  - `POST /books/:bookId/pages` → Page (201), `GET /pages/:id` (full), `PATCH /pages/:id`, `DELETE /pages/:id` (204).
- Mounted in `app.ts` via `app.use(libraryRouter)` (router defines absolute paths).

- [ ] **Step 1: Write the failing test `backend/src/routes/library.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { prisma } from "../prisma";

const app = createApp();

async function makeProject() {
  const res = await request(app).post("/projects").send({ name: "Proj" });
  return res.body.id as string;
}

beforeEach(async () => {
  await prisma.page.deleteMany();
  await prisma.book.deleteMany();
  await prisma.shelf.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
});
afterAll(async () => { await prisma.$disconnect(); });

describe("library API", () => {
  it("lazily creates one shelf per project and is idempotent", async () => {
    const projectId = await makeProject();
    const a = await request(app).get(`/projects/${projectId}/shelf`);
    expect(a.status).toBe(200);
    expect(a.body.projectId).toBe(projectId);
    expect(a.body.books).toEqual([]);
    const b = await request(app).get(`/projects/${projectId}/shelf`);
    expect(b.body.id).toBe(a.body.id);
    expect(await prisma.shelf.count()).toBe(1);
  });

  it("creates a book and lists it on the shelf with pageCount", async () => {
    const projectId = await makeProject();
    const shelf = (await request(app).get(`/projects/${projectId}/shelf`)).body;
    const created = await request(app).post(`/shelves/${shelf.id}/books`).send({ name: "Notes" });
    expect(created.status).toBe(201);
    expect(created.body.name).toBe("Notes");
    const reload = await request(app).get(`/projects/${projectId}/shelf`);
    expect(reload.body.books).toHaveLength(1);
    expect(reload.body.books[0].pageCount).toBe(0);
  });

  it("rejects an empty book name with 400", async () => {
    const projectId = await makeProject();
    const shelf = (await request(app).get(`/projects/${projectId}/shelf`)).body;
    const res = await request(app).post(`/shelves/${shelf.id}/books`).send({ name: "" });
    expect(res.status).toBe(400);
  });

  it("creates/reads/patches a page", async () => {
    const projectId = await makeProject();
    const shelf = (await request(app).get(`/projects/${projectId}/shelf`)).body;
    const book = (await request(app).post(`/shelves/${shelf.id}/books`).send({ name: "B" })).body;
    const page = (await request(app).post(`/books/${book.id}/pages`).send({ title: "P1" })).body;
    expect(page.content).toBe("");
    const got = await request(app).get(`/pages/${page.id}`);
    expect(got.body.title).toBe("P1");
    const patched = await request(app).patch(`/pages/${page.id}`).send({ content: "# Hello" });
    expect(patched.body.content).toBe("# Hello");
    const bookFull = await request(app).get(`/books/${book.id}`);
    expect(bookFull.body.pages[0].title).toBe("P1");
  });

  it("cascades: deleting a book removes its pages", async () => {
    const projectId = await makeProject();
    const shelf = (await request(app).get(`/projects/${projectId}/shelf`)).body;
    const book = (await request(app).post(`/shelves/${shelf.id}/books`).send({ name: "B" })).body;
    await request(app).post(`/books/${book.id}/pages`).send({ title: "P" });
    expect((await request(app).delete(`/books/${book.id}`)).status).toBe(204);
    expect(await prisma.page.count()).toBe(0);
  });

  it("cascades: deleting a project removes shelf, books, pages", async () => {
    const projectId = await makeProject();
    const shelf = (await request(app).get(`/projects/${projectId}/shelf`)).body;
    const book = (await request(app).post(`/shelves/${shelf.id}/books`).send({ name: "B" })).body;
    await request(app).post(`/books/${book.id}/pages`).send({ title: "P" });
    await request(app).delete(`/projects/${projectId}`);
    expect(await prisma.shelf.count()).toBe(0);
    expect(await prisma.book.count()).toBe(0);
    expect(await prisma.page.count()).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pnpm exec vitest run src/routes/library.test.ts`
Expected: FAIL — routes 404 (router not created/mounted).

- [ ] **Step 3: Implement `backend/src/routes/library.ts`**

```ts
import { Router } from "express";
import { createBookSchema, updateBookSchema, updateShelfSchema, createPageSchema, updatePageSchema } from "../schemas.js";
import { prisma } from "../prisma.js";
import { asyncHandler, AppError } from "../errors.js";

export const libraryRouter = Router();

const iso = (d: Date) => d.toISOString();

libraryRouter.get("/projects/:projectId/shelf", asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new AppError(404, "Project not found");
  const shelf = await prisma.shelf.upsert({
    where: { projectId },
    create: { projectId },
    update: {},
  });
  const books = await prisma.book.findMany({
    where: { shelfId: shelf.id },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { pages: true } } },
  });
  res.json({
    id: shelf.id, projectId: shelf.projectId, name: shelf.name, description: shelf.description,
    books: books.map((b) => ({
      id: b.id, name: b.name, description: b.description, color: b.color,
      sortOrder: b.sortOrder, pageCount: b._count.pages,
    })),
  });
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
```

- [ ] **Step 4: Mount the router in `backend/src/app.ts`**

Add the import after the github import:
```ts
import { libraryRouter } from "./routes/library.js";
```
Mount it after `app.use("/github", githubRouter);`:
```ts
app.use(libraryRouter);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && pnpm exec vitest run src/routes/library.test.ts`
Expected: PASS (6 tests). (Needs `DATABASE_URL`.)

- [ ] **Step 6: Whole backend suite + typecheck**

Run: `cd backend && pnpm exec vitest run --no-file-parallelism && pnpm lint`
Expected: all suites pass; tsc clean.

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/library.ts backend/src/routes/library.test.ts backend/src/app.ts
git commit -m "feat(library): shelf/book/page routes with cascade deletes"
```

---

## Task 4: Frontend types + hooks

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/hooks/useLibrary.ts`

**Interfaces:**
- Produces types: `BookSummary`, `Shelf`, `Book` (with `pages: PageSummary[]`), `PageSummary`, `Page`, and inputs.
- Produces hooks: `useShelf(projectId)`, `useUpdateShelf()`, `useCreateBook()`, `useBook(bookId)`, `useUpdateBook()`, `useDeleteBook()`, `useCreatePage()`, `usePage(pageId)`, `useUpdatePage()`, `useDeletePage()`.

- [ ] **Step 1: Append types to `frontend/src/types.ts`**

```ts
export interface BookSummary {
  id: string; name: string; description: string | null; color: string; sortOrder: number; pageCount: number;
}
export interface Shelf {
  id: string; projectId: string; name: string; description: string | null; books: BookSummary[];
}
export interface PageSummary { id: string; title: string; sortOrder: number; updatedAt: string; }
export interface Book {
  id: string; name: string; description: string | null; color: string; sortOrder: number; pages: PageSummary[];
}
export interface Page {
  id: string; bookId: string; title: string; content: string; sortOrder: number; createdAt: string; updatedAt: string;
}
export interface CreateBookInput { name: string; description?: string | null; color?: string; }
export interface UpdateBookInput { name?: string; description?: string | null; color?: string; }
export interface UpdateShelfInput { name?: string; description?: string | null; }
export interface CreatePageInput { title: string; }
export interface UpdatePageInput { title?: string; content?: string; }
```

- [ ] **Step 2: Create `frontend/src/hooks/useLibrary.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Shelf, Book, Page, CreateBookInput, UpdateBookInput, UpdateShelfInput, CreatePageInput, UpdatePageInput } from "@/types";
import { api } from "@/lib/api";

export function useShelf(projectId: string | null) {
  return useQuery({
    queryKey: ["library", "shelf", projectId],
    queryFn: () => api.get<Shelf>(`/projects/${projectId}/shelf`),
    enabled: !!projectId,
  });
}

export function useUpdateShelf(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateShelfInput }) => api.patch<Shelf>(`/shelves/${id}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["library", "shelf", projectId] }),
  });
}

export function useCreateBook(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ shelfId, input }: { shelfId: string; input: CreateBookInput }) => api.post<Book>(`/shelves/${shelfId}/books`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["library", "shelf", projectId] }),
  });
}

export function useBook(bookId: string | null) {
  return useQuery({
    queryKey: ["library", "book", bookId],
    queryFn: () => api.get<Book>(`/books/${bookId}`),
    enabled: !!bookId,
  });
}

export function useUpdateBook(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateBookInput }) => api.patch<Book>(`/books/${id}`, patch),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["library", "book", v.id] });
      qc.invalidateQueries({ queryKey: ["library", "shelf", projectId] });
    },
  });
}

export function useDeleteBook(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/books/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["library", "shelf", projectId] }),
  });
}

export function useCreatePage(bookId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePageInput) => api.post<Page>(`/books/${bookId}/pages`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["library", "book", bookId] }),
  });
}

export function usePage(pageId: string | null) {
  return useQuery({
    queryKey: ["library", "page", pageId],
    queryFn: () => api.get<Page>(`/pages/${pageId}`),
    enabled: !!pageId,
  });
}

export function useUpdatePage(bookId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdatePageInput }) => api.patch<Page>(`/pages/${id}`, patch),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["library", "page", v.id] });
      qc.invalidateQueries({ queryKey: ["library", "book", bookId] });
    },
  });
}

export function useDeletePage(bookId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/pages/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["library", "book", bookId] }),
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && pnpm lint`
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types.ts frontend/src/hooks/useLibrary.ts
git commit -m "feat(library): frontend types and tanstack hooks"
```

---

## Task 5: Page editor component

**Files:**
- Create: `frontend/src/components/library/PageEditor.tsx`

**Interfaces:**
- Consumes: `usePage`, `useUpdatePage`, `useDeletePage`, `react-markdown`, `remark-gfm`.
- Produces: `<PageEditor pageId bookId onDeleted />` — title (edit on blur), markdown body rendered by default with an **Edit** toggle (raw textarea + Save/Cancel), and a delete action.

- [ ] **Step 1: Implement `frontend/src/components/library/PageEditor.tsx`**

```tsx
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Pencil, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { usePage, useUpdatePage, useDeletePage } from "@/hooks/useLibrary";

export function PageEditor({ pageId, bookId, onDeleted }: {
  pageId: string; bookId: string; onDeleted: () => void;
}) {
  const { data: page, isLoading } = usePage(pageId);
  const update = useUpdatePage(bookId);
  const del = useDeletePage(bookId);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (page) { setTitle(page.title); setContent(page.content); setEditing(false); }
  }, [page?.id]);

  if (isLoading || !page) return <p className="text-sm text-ink-muted">Loading…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Input
          className="font-display text-lg"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title.trim() !== page.title && update.mutate({ id: page.id, patch: { title: title.trim() } })}
        />
        <Button variant="ghost" size="icon" aria-label="Delete page"
          onClick={() => del.mutate(page.id, { onSuccess: onDeleted })}>
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs uppercase tracking-wide text-ink-muted">Content</span>
          {!editing && (
            <Button variant="ghost" size="sm" className="gap-1 h-7" onClick={() => setEditing(true)}>
              <Pencil className="size-3.5" /> Edit
            </Button>
          )}
        </div>
        {editing ? (
          <div className="flex flex-col gap-2">
            <Textarea autoFocus className="min-h-64 font-mono text-sm" placeholder="Write markdown…"
              value={content} onChange={(e) => setContent(e.target.value)} />
            <div className="flex items-center gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => { setContent(page.content); setEditing(false); }}>Cancel</Button>
              <Button size="sm" onClick={() => update.mutate({ id: page.id, patch: { content } }, { onSuccess: () => setEditing(false) })}>Save</Button>
            </div>
          </div>
        ) : content.trim() ? (
          <div className="prose prose-sm max-w-none dark:prose-invert rounded-lg border border-border p-4">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        ) : (
          <button onClick={() => setEditing(true)}
            className="text-left text-sm text-ink-muted rounded-lg border border-dashed border-border p-4 hover:text-ink hover:border-ink/40">
            Empty page — click to write.
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && pnpm lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/library/PageEditor.tsx
git commit -m "feat(library): markdown page editor with render/edit toggle"
```

---

## Task 6: Book list + Page list components

**Files:**
- Create: `frontend/src/components/library/BookList.tsx`
- Create: `frontend/src/components/library/PageList.tsx`

**Interfaces:**
- Consumes: `BookSummary`, `PageSummary`, `useCreateBook`, `useCreatePage`.
- Produces:
  - `<BookList projectId shelfId books variant onOpenBook />` — `variant: "cards" | "list"`; renders books and a "New book" inline create.
  - `<PageList bookId pages onOpenPage />` — renders pages and a "New page" inline create.

- [ ] **Step 1: Implement `frontend/src/components/library/BookList.tsx`**

```tsx
import { useState } from "react";
import { Book as BookIcon, Plus } from "lucide-react";
import type { BookSummary } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCreateBook } from "@/hooks/useLibrary";
import { cn } from "@/lib/utils";

export function BookList({ projectId, shelfId, books, variant, onOpenBook }: {
  projectId: string; shelfId: string; books: BookSummary[]; variant: "cards" | "list"; onOpenBook: (id: string) => void;
}) {
  const create = useCreateBook(projectId);
  const [name, setName] = useState("");
  const add = () => {
    if (!name.trim()) return;
    create.mutate({ shelfId, input: { name: name.trim() } }, { onSuccess: () => setName("") });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 max-w-md">
        <Input placeholder="New book name" value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()} />
        <Button onClick={add} disabled={!name.trim() || create.isPending} className="gap-1 shrink-0">
          <Plus className="size-4" /> Book
        </Button>
      </div>

      {books.length === 0 ? (
        <p className="text-sm text-ink-muted">No books yet.</p>
      ) : variant === "cards" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {books.map((b) => (
            <button key={b.id} onClick={() => onOpenBook(b.id)}
              className="text-left rounded-lg border border-border bg-surface p-3 hover:border-ink/40 flex flex-col gap-2">
              <span className="h-1.5 w-10 rounded-full" style={{ background: b.color }} />
              <span className="text-sm font-medium truncate">{b.name}</span>
              <span className="font-mono text-[11px] text-ink-muted">{b.pageCount} pages</span>
            </button>
          ))}
        </div>
      ) : (
        <ul className="border border-border rounded-lg divide-y divide-border overflow-hidden">
          {books.map((b) => (
            <li key={b.id}>
              <button onClick={() => onOpenBook(b.id)} className={cn("w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-bg")}>
                <BookIcon className="size-4" style={{ color: b.color }} />
                <span className="flex-1 truncate">{b.name}</span>
                <span className="font-mono text-[11px] text-ink-muted">{b.pageCount} pages</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Implement `frontend/src/components/library/PageList.tsx`**

```tsx
import { useState } from "react";
import { FileText, Plus } from "lucide-react";
import type { PageSummary } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCreatePage } from "@/hooks/useLibrary";

export function PageList({ bookId, pages, onOpenPage }: {
  bookId: string; pages: PageSummary[]; onOpenPage: (id: string) => void;
}) {
  const create = useCreatePage(bookId);
  const [title, setTitle] = useState("");
  const add = () => {
    if (!title.trim()) return;
    create.mutate({ title: title.trim() }, { onSuccess: (p) => { setTitle(""); onOpenPage(p.id); } });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 max-w-md">
        <Input placeholder="New page title" value={title} onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()} />
        <Button onClick={add} disabled={!title.trim() || create.isPending} className="gap-1 shrink-0">
          <Plus className="size-4" /> Page
        </Button>
      </div>

      {pages.length === 0 ? (
        <p className="text-sm text-ink-muted">No pages yet.</p>
      ) : (
        <ul className="border border-border rounded-lg divide-y divide-border overflow-hidden">
          {pages.map((p) => (
            <li key={p.id}>
              <button onClick={() => onOpenPage(p.id)} className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-bg">
                <FileText className="size-4 text-ink-muted" />
                <span className="flex-1 truncate">{p.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + commit**

Run: `cd frontend && pnpm lint`
Expected: clean.
```bash
git add frontend/src/components/library/BookList.tsx frontend/src/components/library/PageList.tsx
git commit -m "feat(library): book list and page list components"
```

---

## Task 7: Library page (breadcrumb + levels) and right rail

**Files:**
- Create: `frontend/src/components/library/LibraryRail.tsx`
- Create: `frontend/src/pages/LibraryPage.tsx`

**Interfaces:**
- Consumes: `useShelf`, `useUpdateShelf`, `useBook`, `useUpdateBook`, `useDeleteBook`, `BookList`, `PageList`, `PageEditor`.
- Produces:
  - `<LibraryRail onOpen />` — vertical bar, two buttons: Shelves (`onOpen("shelves")`), Books (`onOpen("books")`).
  - `<LibraryPage projectId tab onBack />` — breadcrumb + internal nav (`shelf | book | page`), driven by initial `tab`.

- [ ] **Step 1: Implement `frontend/src/components/library/LibraryRail.tsx`**

```tsx
import { Library, BookOpen } from "lucide-react";

export function LibraryRail({ onOpen }: { onOpen: (tab: "shelves" | "books") => void }) {
  const btn = "flex flex-col items-center gap-1 w-full py-3 text-[11px] text-ink-muted hover:text-ink hover:bg-bg";
  return (
    <div className="w-16 shrink-0 border-l border-border bg-surface flex flex-col py-2">
      <button className={btn} onClick={() => onOpen("shelves")}>
        <Library className="size-5" /> Shelves
      </button>
      <button className={btn} onClick={() => onOpen("books")}>
        <BookOpen className="size-5" /> Books
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Implement `frontend/src/pages/LibraryPage.tsx`**

```tsx
import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useShelf, useUpdateShelf, useBook, useDeleteBook } from "@/hooks/useLibrary";
import { BookList } from "@/components/library/BookList";
import { PageList } from "@/components/library/PageList";
import { PageEditor } from "@/components/library/PageEditor";

type Nav = { level: "shelf" | "book" | "page"; bookId?: string; pageId?: string };

export function LibraryPage({ projectId, tab, onBack }: {
  projectId: string; tab: "shelves" | "books"; onBack: () => void;
}) {
  const { data: shelf } = useShelf(projectId);
  const updateShelf = useUpdateShelf(projectId);
  const deleteBook = useDeleteBook(projectId);
  const [nav, setNav] = useState<Nav>({ level: "shelf" });
  const [shelfName, setShelfName] = useState("");

  useEffect(() => { if (shelf) setShelfName(shelf.name); }, [shelf?.id]);
  const { data: book } = useBook(nav.bookId ?? null);

  if (!shelf) return <div className="p-6 text-sm text-ink-muted">Loading library…</div>;

  return (
    <div className="max-w-5xl p-6 flex flex-col gap-6">
      <button className="flex items-center gap-1 text-sm text-ink-muted hover:text-ink w-fit" onClick={onBack}>
        <ArrowLeft className="size-4" /> Back to board
      </button>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm flex-wrap">
        <button className="font-display font-semibold hover:underline" onClick={() => setNav({ level: "shelf" })}>{shelf.name}</button>
        {book && nav.level !== "shelf" && (
          <>
            <ChevronRight className="size-4 text-ink-muted" />
            <button className="hover:underline" onClick={() => setNav({ level: "book", bookId: book.id })}>{book.name}</button>
          </>
        )}
        {nav.level === "page" && book && (
          <>
            <ChevronRight className="size-4 text-ink-muted" />
            <span className="text-ink-muted">{book.pages.find((p) => p.id === nav.pageId)?.title}</span>
          </>
        )}
      </div>

      {nav.level === "shelf" && (
        <div className="flex flex-col gap-4">
          {tab === "shelves" && (
            <div className="flex flex-col gap-2 max-w-md">
              <span className="font-mono text-xs uppercase tracking-wide text-ink-muted">Shelf name</span>
              <Input value={shelfName} onChange={(e) => setShelfName(e.target.value)}
                onBlur={() => shelfName.trim() && shelfName.trim() !== shelf.name && updateShelf.mutate({ id: shelf.id, patch: { name: shelfName.trim() } })} />
            </div>
          )}
          <BookList projectId={projectId} shelfId={shelf.id} books={shelf.books}
            variant={tab === "shelves" ? "cards" : "list"}
            onOpenBook={(id) => setNav({ level: "book", bookId: id })} />
        </div>
      )}

      {nav.level === "book" && book && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="font-display text-lg font-bold">{book.name}</span>
            <Button variant="ghost" size="sm" className="gap-1" onClick={() => deleteBook.mutate(book.id, { onSuccess: () => setNav({ level: "shelf" }) })}>
              <Trash2 className="size-4" /> Delete book
            </Button>
          </div>
          <PageList bookId={book.id} pages={book.pages}
            onOpenPage={(pid) => setNav({ level: "page", bookId: book.id, pageId: pid })} />
        </div>
      )}

      {nav.level === "page" && nav.pageId && nav.bookId && (
        <PageEditor pageId={nav.pageId} bookId={nav.bookId}
          onDeleted={() => setNav({ level: "book", bookId: nav.bookId })} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + commit**

Run: `cd frontend && pnpm lint`
Expected: clean.
```bash
git add frontend/src/components/library/LibraryRail.tsx frontend/src/pages/LibraryPage.tsx
git commit -m "feat(library): library page with breadcrumb levels and right rail"
```

---

## Task 8: Wire the rail + library page into App

**Files:**
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `LibraryRail`, `LibraryPage`.
- Produces: a `"library"` page state + `libraryTab`; the rail renders next to the board when a project is selected; selecting a tab opens the library.

- [ ] **Step 1: Add imports in `frontend/src/App.tsx`**

```tsx
import { LibraryRail } from "@/components/library/LibraryRail";
import { LibraryPage } from "@/pages/LibraryPage";
```

- [ ] **Step 2: Extend page state**

Change the `Page` type union to include `"library"`:
```tsx
type Page = "tasks" | "my-github" | "project-settings" | "library";
```
Add state near the other `useState`s:
```tsx
const [libraryTab, setLibraryTab] = useState<"shelves" | "books">("shelves");
```

- [ ] **Step 3: Render the library page in the content switch**

In the `<section>` content conditional, add a branch (before the `view === "board"` branch), alongside the existing `project-settings` branch:
```tsx
) : page === "library" && projectId ? (
  <LibraryPage projectId={projectId} tab={libraryTab} onBack={() => setPage("tasks")} />
```

- [ ] **Step 4: Render the rail beside the board**

Wrap the `<main>`'s board area so the rail sits at the right when on the tasks page with a project selected. Find the `<main className="flex-1 h-screen flex flex-col">` … `</main>` and change the outer layout: replace the top-level `return (<div className="flex">` … Sidebar … `<main>` structure so the rail is a sibling of `<main>`:

```tsx
return (
  <div className="flex">
    <Sidebar … />
    <main className="flex-1 h-screen flex flex-col min-w-0"> … </main>
    {page === "tasks" && projectId && (
      <LibraryRail onOpen={(tab) => { setLibraryTab(tab); setPage("library"); }} />
    )}
    {/* dialogs/palette/hotcorner unchanged */}
  </div>
);
```
(Only add the `min-w-0` to `<main>` and insert the `LibraryRail` block; leave the dialogs, TaskDetailPanel, CommandPalette, HotCornerCalendar mounts as they are.)

- [ ] **Step 5: Typecheck + build**

Run: `cd frontend && pnpm lint && pnpm build`
Expected: clean typecheck; production build succeeds.

- [ ] **Step 6: Manual smoke check**

With both servers running and a project selected on the board:
1. The right rail shows **Shelves** / **Books**.
2. Click **Books** → flat book list; create a book → it appears.
3. Open the book → create a page → the page editor opens.
4. Write markdown, **Save** → it renders; **Edit** shows the raw source again.
5. **Shelves** tab shows the same books as cards + an editable shelf name.
6. Delete a page / book → returns to the parent level.
7. **Back to board** returns to the board with the rail.

Expected: all steps work against the live API.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(library): wire right rail and library page into the app"
```

---

## Self-Review Notes

- **Spec coverage:** model Shelf/Book/Page + Project back-relation + cascades (Task 1); Zod inputs (Task 2); all API endpoints incl. lazy shelf get-or-create and `pageCount`/`PageSummary` (Task 3); frontend types + hooks (Task 4); markdown page editor reusing render+edit-toggle (Task 5); book/page lists with create (Task 6); right rail (Shelves/Books) + breadcrumb Library page with shelf/book/page levels and Shelves=cards / Books=list (Task 7); App wiring with rail visible when a project is selected (Task 8); backend Vitest incl. idempotent shelf + cascades (Task 3). Out-of-scope items (chapters, drag-reorder, search, history) correctly absent. No gaps.
- **Type consistency:** `BookSummary` (with `pageCount`) used in shelf response (Task 3) and frontend type/`BookList` (Tasks 4,6); `PageSummary` (id,title,sortOrder,updatedAt) in `GET /books/:id` (Task 3) and frontend (Tasks 4,6,7); `Shelf.books: BookSummary[]`, `Book.pages: PageSummary[]` consistent; hook names (`useShelf`,`useBook`,`usePage`,`useCreateBook`,`useCreatePage`,`useUpdatePage`,`useDeleteBook`,`useDeletePage`,`useUpdateShelf`) identical across Tasks 4–8. Routes are absolute paths and mounted via `app.use(libraryRouter)`.
- **Placeholder scan:** none — every step has concrete code/commands.

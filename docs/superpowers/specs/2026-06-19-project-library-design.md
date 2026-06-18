# Project Library — Design (Shelf → Book → Page)

**Date:** 2026-06-19
**Status:** Approved
**Scope:** A per-project "data management" / documentation system inspired by BookStack: each project has one Shelf, a Shelf holds Books, a Book holds Pages, and a Page is a markdown document. Surfaced via a right-side vertical bar (Shelves / Books) on the board.

## 1. Concepts (locked in brainstorming)

- **Shelf** — one per project, auto-created on first Library access. Has a name + optional description; holds Books.
- **Book** — a named collection of Pages (like a binder). Has a name, optional description, optional color; belongs to a Shelf.
- **Page** — the actual content: a title + a markdown body. Belongs to a Book.

Hierarchy: `Project → 1 Shelf → many Books → many Pages`.

## 2. Decisions

- **One shelf per project** (auto-created lazily; not user-created).
- **Two browse entry points** in the right rail:
  - **Shelves** → the shelf overview (name/description + its Books as cards).
  - **Books** → a flat list of all the project's Books.
  - Both drill into a Book → its Pages → a Page editor.
- **Page editor** reuses the existing gist-style pattern (render markdown by default; Edit toggles a raw-markdown textarea with Save/Cancel), consistent with the task-description editor.
- **Cascade deletes:** deleting a Book deletes its Pages; deleting a project deletes its Shelf → Books → Pages.
- **Ordering:** by `sortOrder` (defaults to creation order). Drag-reordering is out of v1.

## 3. Data model (Prisma, standalone backend)

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

`Project` gains a back-relation `shelf Shelf?`.

## 4. Backend API

Validation via Zod in `backend/src/schemas.ts`; routes in a new `backend/src/routes/library.ts` mounted at root (paths below). Error shape `{ error: { message } }`.

- `GET /projects/:projectId/shelf` → `{ id, projectId, name, description, books: BookSummary[] }`. Lazily creates the shelf if absent. `BookSummary = { id, name, description, color, sortOrder, pageCount }`.
- `PATCH /shelves/:id` (body: `{ name?, description? }`) → shelf (without books).
- `POST /shelves/:shelfId/books` (body: `{ name, description?, color? }`) → Book (201).
- `GET /books/:id` → `{ ...book, pages: PageSummary[] }` where `PageSummary = { id, title, sortOrder, updatedAt }`.
- `PATCH /books/:id` (body: `{ name?, description?, color? }`) → Book.
- `DELETE /books/:id` → 204 (cascades pages).
- `POST /books/:bookId/pages` (body: `{ title }`) → Page (201, empty content).
- `GET /pages/:id` → full Page (incl. `content`).
- `PATCH /pages/:id` (body: `{ title?, content? }`) → Page.
- `DELETE /pages/:id` → 204.

Dates serialized to ISO strings (existing `ser` pattern). `pageCount` via Prisma `_count`.

## 5. Frontend

### Types (`frontend/src/types.ts`)
`Shelf`, `Book`, `BookSummary`, `Page`, `PageSummary`, and create/update inputs — kept in sync with backend schemas (standalone projects, no shared package).

### Hooks (`frontend/src/hooks/useLibrary.ts`)
- `useShelf(projectId)` → `["library","shelf",projectId]`.
- `useUpdateShelf()`, `useCreateBook()`.
- `useBook(bookId)` → `["library","book",bookId]`; `useUpdateBook()`, `useDeleteBook()`.
- `usePage(pageId)` → `["library","page",pageId]`; `useCreatePage()`, `useUpdatePage()`, `useDeletePage()`.
- Mutations invalidate the relevant parent query keys.

### Right rail (`frontend/src/components/library/LibraryRail.tsx`)
Slim vertical bar at the right edge of the board, visible only when a project is selected. Two stacked buttons (icon + label): **Shelves**, **Books**. Clicking sets the app `page` to `"library"` with a `libraryTab` of `"shelves"` or `"books"`.

### Library view (`frontend/src/pages/LibraryPage.tsx`)
A full content-area page (like Project Settings) with a **breadcrumb** (`Project › Shelf › Book › Page`) and internal navigation state (`{ level: "shelf" | "book" | "page", bookId?, pageId? }`):
- **Shelf level** — if `libraryTab === "shelves"`: shelf name (editable) + description + Books as cards (with page counts) + "New book". If `libraryTab === "books"`: the same Books as a flat list + "New book".
- **Book level** — book name (editable), description, Pages list + "New page"; rename/delete book.
- **Page level** — the Page editor: markdown rendered by default with an **Edit** toggle → raw textarea + Save/Cancel; rename/delete page.

Components: `BookCard`, `BookList`, `PageList`, `PageEditor` (reuses `react-markdown` + `remark-gfm` + `prose`).

### App wiring (`frontend/src/App.tsx`)
- Extend `Page` union with `"library"`; add `libraryTab` state.
- Render `LibraryRail` alongside the board when `page === "tasks"` and a project is selected.
- Render `LibraryPage` when `page === "library"`.

## 6. Error handling

- Unknown project/shelf/book/page → 404 via existing Prisma `P2025` → 404 mapping / explicit checks.
- Zod validation → 400 with details (existing middleware).
- Frontend: TanStack loading/error states; markdown editor saves on explicit Save (not blur) to avoid losing in-progress edits.

## 7. Testing (Vitest, backend)

- Shelf: `GET /projects/:id/shelf` creates exactly one shelf and is idempotent on repeat.
- Book: create under shelf, list via shelf with `pageCount`, patch, delete.
- Page: create under book, get full content, patch title/content, delete.
- Cascade: deleting a book removes its pages; deleting a project removes shelf+books+pages.
- Same real-DB pattern as existing route tests (`beforeEach` cleanup, `--no-file-parallelism`).

## 8. Out of scope (future)

Chapters (BookStack's 4th level), drag-reordering of books/pages, full-text search across pages, page version history, cross-project/global library, export/import, sharing/permissions, attachments inside pages.

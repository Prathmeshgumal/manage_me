# Lists — a Google Tasks–style todo board

**Date:** 2026-06-24
**Status:** Approved

## Overview

A new **Lists** feature: multiple to-do lists rendered as horizontal columns,
sitting directly below the wishlist columns on the existing Wishlists page (which
becomes a two-section board). It mirrors the Wishlist feature's architecture
end-to-end (models → migration → router → schemas → hooks → UI) to stay
consistent with the codebase. Drag-and-drop uses the `@dnd-kit` packages already
present in the app.

Named **"Lists"** to avoid clashing with the existing Linear-style "Tasks"
board.

## Data model (backend)

Two new tables, mirroring `Wishlist` / `WishlistItem`. No new Postgres enums
(`completed` is a boolean), to avoid enum-migration friction.

### `TodoList`
- `id` — pk, `new_id`
- `name` — default `"My List"`
- `color` — default `"#8A8A86"`
- `sortOrder` — float, default 0 (ordering of lists on the board)
- `workspaceId` — FK → `Workspace.id`, `ondelete=CASCADE`
- `createdAt`, `updatedAt`

### `TodoItem`
- `id` — pk, `new_id`
- `listId` — FK → `TodoList.id`, `ondelete=CASCADE`
- `title` — required
- `notes` — text, nullable
- `completed` — bool, default false
- `completedAt` — datetime, nullable
- `dueDate` — datetime, nullable
- `starred` — bool, default false
- `sortOrder` — float, default 0
- `createdAt`, `updatedAt`

Migration: `backend-py/alembic/versions/0005_todo_lists.py`
(`down_revision = "0004_task_identifiers"`).

## API (backend router `todos.py`)

Mirrors the wishlist router, with `_owned_list` / `_owned_item` helpers that
scope every query to `ctx.workspace_id`. Registered in `main.py`.

- `GET /lists` — all lists with their items, lists ordered by `sortOrder` then
  `createdAt`, items ordered by `sortOrder`.
- `POST /lists` — create list. Returns list with items.
- `PATCH /lists/{id}` — update `name`, `color`, `sortOrder`.
- `DELETE /lists/{id}` — 204.
- `POST /lists/{id}/todos` — create item (`sortOrder` defaults to current epoch
  ms, as wishlist items do).
- `PATCH /todos/{id}` — update `title`, `notes`, `completed`, `dueDate`,
  `starred`, `sortOrder`, **and `listId`** (so an item can move between lists on
  drag). Toggling `completed` true sets `completedAt = now()`; toggling false
  clears it. Done server-side.
- `DELETE /todos/{id}` — 204.

Schemas in `schemas.py`: `CreateTodoList`, `UpdateTodoList`, `CreateTodoItem`,
`UpdateTodoItem` (camelCase via the existing `CamelModel` base, same field
constraints style as the wishlist schemas).

## Frontend

### Types (`types.ts`)
`TodoList`, `TodoListDetail` (`extends TodoList { items: TodoItem[] }`),
`TodoItem`, plus `CreateTodoListInput`, `UpdateTodoListInput`,
`CreateTodoItemInput`, `UpdateTodoItemInput`.

### Hooks (`hooks/useTodos.ts`)
`useTodoLists`, `useCreateList`, `useUpdateList`, `useDeleteList`,
`useCreateTodo`, `useUpdateTodo`, `useDeleteTodo` — same react-query
query-key + invalidation pattern as `useWishlists`. `GET /lists` returns lists
with items inline, so a single `["todoLists"]` query backs the board.

### Components (`components/todo/`)
- `TodosBoard.tsx` — horizontal column board + a "Create new list" tile,
  wrapped in a `DndContext`. Handles drag end for both items and lists.
- `TodoListColumn.tsx` — header (name, `⋮` menu: rename / delete), inline
  "Add a task" input, active items, and a collapsible **Completed (N)** section
  at the bottom. Empty state shows "No tasks yet".
- `TodoRow.tsx` — circle checkbox + title + star toggle; sortable; click opens
  the detail panel.
- `TodoDetailPanel.tsx` — side panel for notes, due date, starred, and delete,
  reusing the existing panel/drawer styling.

### Placement
`WishlistsPage` renders the wishlist board, then a divider/heading "Lists", then
`<TodosBoard />` — one vertically scrolling page below the wishlist columns.

## Interactions & drag-and-drop

- **Complete**: clicking the circle toggles `completed`; the row moves into the
  collapsed "Completed (N)" section.
- **Drag**: reorder items within a list and move them between lists (dnd-kit
  `SortableContext` per column, `closestCorners`), persisting `sortOrder` /
  `listId` via `PATCH /todos/{id}` — same mechanic as the main `BoardView`.
  Lists themselves are reorderable via `sortOrder`.
- **Consistency**: rely on react-query invalidation after mutations (matching
  the wishlist hooks) rather than bespoke optimistic caches.

## Out of scope (YAGNI)

Subtasks/indentation, recurring tasks, reminders/notifications, list sharing,
and a separate "Starred"/"All tasks" aggregate view. Can follow later.

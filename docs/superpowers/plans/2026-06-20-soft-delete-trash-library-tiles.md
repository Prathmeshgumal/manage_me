# Soft Delete, Trash & Orphaned Library Tiles — Implementation Plan

> Execute with TDD; commit per task. See spec: `../specs/2026-06-20-soft-delete-trash-library-tiles-design.md`.

## Global Constraints
- Byte-for-byte API parity style: camelCase JSON, `{"error":{"message":...}}`, naive UTC + ISO "Z".
- No Claude attribution in commits/PRs.
- Work on branch `feat/soft-delete-trash-library-tiles`; PR to main.

---

### Task 1: Schema migration + models
- Models (`app/models.py`): add `deleted_at` to Project, Task, Book, Page; `deleted_with_project` to Task; `is_general` to Shelf. Change `Shelf.project_id` FK to `ondelete="SET NULL"`.
- Alembic migration `0002_soft_delete`: add columns; backfill `Shelf.isGeneral = true WHERE projectId IS NULL`; drop+recreate `Shelf_projectId_fkey` as SET NULL.
- Test: model round-trip; migration applies on test DB.

### Task 2: Soft-delete filtering on reads
- Tasks list/get, projects list/get, library shelf/book/page reads: add `deleted_at IS NULL` filters. General shelf identified by `is_general == True`. Project shelf path excludes when project deleted.
- Tests: created-then-deleted item disappears from lists/gets (404).

### Task 3: Soft-delete on DELETE endpoints
- `DELETE /tasks/{id}`, `/books/{id}`, `/pages/{id}` → set `deleted_at` instead of physical delete.
- `DELETE /projects/{id}` → set project `deleted_at`; set `deleted_at` + `deleted_with_project=true` on its non-deleted tasks.
- Tests: delete sets flag, item gone from lists, project-delete also hides its tasks; shelf/books survive.

### Task 4: Trash endpoints
- `GET /trash` → deleted projects/tasks/books/pages (serialized minimal: id, label, kind).
- `POST /trash/{kind}/{id}/restore` → clear `deleted_at`; project restore clears its `deleted_with_project` tasks' `deleted_at` + resets flag.
- `DELETE /trash/{kind}/{id}` → physical delete; project: set its shelf `project_id=null` first, hard-delete tasks, then delete project.
- Router `app/routers/trash.py`; mount in `main.py`.
- Tests: list, restore (incl project+tasks), permanent (project keeps shelf).

### Task 5: Orphaned shelves endpoints
- `GET /shelves/orphaned` → shelves where `is_general == false AND (project_id IS NULL OR project.deleted_at != null)`, with `bookCount`.
- `GET /shelves/{id}` → shelf + books (reuse `_shelf_with_books`), workspace-scoped.
- Tests: orphan appears after project delete; general shelf excluded; books reachable.

### Task 6: Frontend — types + hooks
- `types.ts`: add `TrashItem`, `OrphanShelf`; nothing else changes shape.
- Hooks: `useTrash`, `useRestore`, `usePermanentDelete`; `useDeleteTask` (if missing); `useDeleteProject` (soft); `useOrphanShelves`, `useShelfById`.

### Task 7: Frontend — delete actions
- TaskDetailPanel: Delete button (confirm).
- Book view (BookList/BookShelf): per-book delete (confirm).
- Page view (PageEditor/PageList): per-page delete (confirm).
- ProjectSettingsPage: keep delete, ensure it calls soft delete + navigates away.

### Task 8: Frontend — Trash + Labels in Settings
- `TrashSettings` component on SettingsPage: grouped lists with Restore / Delete permanently.
- `LabelsSettings` component on SettingsPage (list + create + edit via LabelDialog).
- Remove Labels block from Sidebar.

### Task 9: Frontend — General shelf orphan tiles
- In the general shelf view, render a grid of square tiles (one per orphan shelf). Click loads `GET /shelves/{id}` and shows its books using the existing book browsing.

### Task 10: Verify + migrate prod + PR
- `uv run pytest` green; `pnpm lint && pnpm build` green.
- Run migration on Supabase prod.
- PR to main.

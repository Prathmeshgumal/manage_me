# Soft Delete, Trash & Orphaned Library Tiles — Design

**Date:** 2026-06-20
**Status:** Approved

## Goal

Give the user a way to delete projects, tasks, books, and pages as **soft deletes** (recoverable via a Trash), with special handling so a project's library survives project deletion and stays accessible. Also relocate Labels management into Settings.

## Behavior

### Soft delete
- `Project`, `Task`, `Book`, `Page` gain a nullable `deletedAt` timestamp. A row with `deletedAt != null` is "deleted": hidden from all normal listings/reads, retained in the DB.
- All existing list/read endpoints filter out soft-deleted rows.

### Trash (Settings → Trash)
- Lists deleted projects, tasks, books, and pages.
- **Restore** clears `deletedAt`.
- **Delete permanently** physically removes the row (with the project special case below).

### Deleting a project
- Soft-deletes the project **and all of its (non-already-deleted) tasks** in one action. Restoring the project restores exactly those tasks (tracked: only tasks whose `deletedAt` equals the project's deletion is not feasible to match exactly, so we restore tasks that have `deletedAt` set and belong to the project — see Plan note; individually pre-deleted tasks stay in Trash because they keep their own earlier behavior via a `deletedWithProject` marker).
- The project's **shelf, books, and pages are never deleted.** The shelf becomes "orphaned" and surfaces in the General shelf as a tile.

### Orphaned shelves in the General shelf
- An **orphaned shelf** = a non-general shelf whose project is deleted (soft-deleted: project `deletedAt != null`) or gone (permanently deleted: shelf `projectId` becomes null).
- The General shelf view renders, in addition to its own books, a **grid of small square tiles** — one per orphaned shelf, labeled with the shelf name. Clicking a tile opens that shelf's books/pages (reusing the normal book/page browsing UI).
- Orphaned shelves themselves cannot be deleted. The books/pages inside them **can** still be soft-deleted individually.

### Permanent project deletion
- Removes the project row and its tasks for good, but first detaches the shelf (`projectId = null`) so it survives as a permanent orphan tile in the General shelf.

### Labels → Settings
- Remove the Labels section from the sidebar. Add a Labels management section to the Settings page (list, create, edit — reusing the existing `LabelDialog`).

## Data model changes

- Add `deletedAt TIMESTAMP NULL` to `Project`, `Task`, `Book`, `Page`.
- Add `deletedWithProject BOOLEAN NOT NULL DEFAULT false` to `Task` (so restoring a project restores only the tasks it removed, not earlier individual deletes).
- Add `isGeneral BOOLEAN NOT NULL DEFAULT false` to `Shelf`. Backfill `isGeneral = true` where `projectId IS NULL`. The General shelf is identified by `isGeneral = true` (not by null projectId), freeing null `projectId` for permanent-orphan shelves.
- Change `Shelf.projectId` FK `ON DELETE` from `CASCADE` to `SET NULL` so permanent project deletion keeps the shelf.

All applied via one Alembic migration, run on local dev and Supabase.

## API changes

Filtering: every existing list/read for tasks, projects, books, pages, and shelves excludes `deletedAt != null` rows (and orphaned shelves excluded from the project-shelf path).

New/changed endpoints:
- `DELETE /projects/{id}` → soft delete project + its tasks (mark `deletedWithProject`).
- `DELETE /tasks/{id}` → soft delete.
- `DELETE /books/{id}` → soft delete.
- `DELETE /pages/{id}` → soft delete.
- `GET /trash` → `{ projects: [...], tasks: [...], books: [...], pages: [...] }` of deleted items.
- `POST /trash/{kind}/{id}/restore` → clear `deletedAt` (project restore also restores its `deletedWithProject` tasks and re-homes its shelf).
- `DELETE /trash/{kind}/{id}` → permanent delete (project case detaches shelf first).
- `GET /shelves/orphaned` → list orphaned shelves (id, name, bookCount) for the General-shelf tile grid.
- `GET /shelves/{id}` → fetch a shelf with its books (used when opening an orphan tile).

`kind ∈ {project, task, book, page}`.

## Frontend

- **Delete buttons:** project (ProjectSettingsPage — already present, now soft), task (TaskDetailPanel), book (book view), page (page view). Each confirms before deleting.
- **Trash:** a `TrashSettings` section on the Settings page; restore / delete-permanently per row, grouped by kind.
- **General shelf tiles:** `BookShelf` (general variant) renders an orphaned-shelf tile grid; selecting a tile loads that shelf via `GET /shelves/{id}` and shows its books.
- **Labels:** `LabelsSettings` section on the Settings page; remove the sidebar Labels block.

## Testing

- Backend: pytest for soft-delete filtering, project-delete cascade to tasks, orphan shelf survival + listing, trash list/restore/permanent, isolation. Extend existing suite.
- Frontend: typecheck + build.

## Out of scope

- Auto-purge / retention policy for trash.
- Bulk trash operations.
- Drag/move of orphan books back into the General shelf proper.

# Lists (Google Tasks–style todo board) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Lists" feature — multiple Google Tasks–style to-do lists rendered as horizontal columns below the wishlist columns on the Wishlists page, with check-to-complete, a collapsible Completed section, drag-to-reorder, and a details panel.

**Architecture:** Mirror the existing Wishlist feature end-to-end. Backend: two new tables (`TodoList`, `TodoItem`), an alembic migration, a router (`todos.py`) with workspace-scoped helpers, and Pydantic schemas. Frontend: `useTodos` react-query hooks and a `components/todo/` component set, composed into `WishlistsPage` below the wishlist board. Drag-and-drop reuses `@dnd-kit`, already a dependency.

**Tech Stack:** FastAPI + SQLAlchemy (async) + Alembic + Postgres (backend); React + TypeScript + @tanstack/react-query + @dnd-kit + Tailwind (frontend). Tests: pytest (backend); `pnpm lint`/`pnpm build` (frontend type-check).

## Global Constraints

- Workspace isolation: every query MUST be scoped to `ctx.workspace_id`, using `_owned_list` / `_owned_item` helpers. No cross-workspace access.
- API responses are camelCase via the `CamelModel` base (Pydantic `alias_generator=to_camel`).
- No new Postgres enums — `completed`/`starred` are booleans.
- Branch is `feat/lists-todo-board` (already created). Commit messages: NO AI attribution (no "Co-Authored-By", no "Generated with Claude").
- Frontend column width and styling follow the wishlist board (`w-72 shrink-0`, `bg-surface border border-border rounded-lg`).
- Migration head is currently `0004_task_identifiers`; the new migration's `down_revision` MUST be `0004_task_identifiers`.

---

### Task 1: Backend models + migration + test-DB wiring

**Files:**
- Modify: `backend-py/app/models.py` (append after `WishlistItem`, line ~199)
- Create: `backend-py/alembic/versions/0005_todo_lists.py`
- Modify: `backend-py/tests/conftest.py:38-41` (the `_TABLES` list)
- Test: `backend-py/tests/test_models.py` (append)

**Interfaces:**
- Produces: SQLAlchemy models `TodoList` (table `"TodoList"`) and `TodoItem` (table `"TodoItem"`). Column → DB-column mapping:
  - `TodoList`: `id`, `name`, `color`, `sort_order`→`sortOrder`, `workspace_id`→`workspaceId`, `created_at`→`createdAt`, `updated_at`→`updatedAt`.
  - `TodoItem`: `id`, `list_id`→`listId`, `title`, `notes`, `completed`, `completed_at`→`completedAt`, `due_date`→`dueDate`, `starred`, `sort_order`→`sortOrder`, `created_at`→`createdAt`, `updated_at`→`updatedAt`.

- [ ] **Step 1: Write the failing test**

Append to `backend-py/tests/test_models.py`:

```python
def test_todo_models_tablenames():
    from app.models import TodoList, TodoItem

    assert TodoList.__tablename__ == "TodoList"
    assert TodoItem.__tablename__ == "TodoItem"
    # camelCase DB column names matter for the shared schema
    assert TodoItem.__table__.c.list_id.name == "listId"
    assert TodoItem.__table__.c.completed_at.name == "completedAt"
    assert TodoItem.__table__.c.due_date.name == "dueDate"
    assert TodoList.__table__.c.sort_order.name == "sortOrder"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend-py && python -m pytest tests/test_models.py::test_todo_models_tablenames -v`
Expected: FAIL with `ImportError: cannot import name 'TodoList'`.

- [ ] **Step 3: Add the models**

Append to `backend-py/app/models.py` (after the `WishlistItem` class):

```python
class TodoList(Base):
    __tablename__ = "TodoList"
    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(default="My List")
    color: Mapped[str] = mapped_column(default="#8A8A86")
    sort_order: Mapped[float] = mapped_column("sortOrder", Float, default=0)
    workspace_id: Mapped[str] = mapped_column("workspaceId", ForeignKey("Workspace.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column("createdAt", server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column("updatedAt", default=func.now(), onupdate=func.now())


class TodoItem(Base):
    __tablename__ = "TodoItem"
    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    list_id: Mapped[str] = mapped_column("listId", ForeignKey("TodoList.id", ondelete="CASCADE"))
    title: Mapped[str]
    notes: Mapped[str | None]
    completed: Mapped[bool] = mapped_column(default=False, server_default=sa_false())
    completed_at: Mapped[datetime | None] = mapped_column("completedAt")
    due_date: Mapped[datetime | None] = mapped_column("dueDate")
    starred: Mapped[bool] = mapped_column(default=False, server_default=sa_false())
    sort_order: Mapped[float] = mapped_column("sortOrder", Float, default=0)
    created_at: Mapped[datetime] = mapped_column("createdAt", server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column("updatedAt", default=func.now(), onupdate=func.now())
```

(`Float`, `ForeignKey`, `func`, and `sa_false` are already imported at the top of `models.py`.)

- [ ] **Step 4: Create the migration**

Create `backend-py/alembic/versions/0005_todo_lists.py`:

```python
"""add todo list tables

Revision ID: 0005_todo_lists
Revises: 0004_task_identifiers
Create Date: 2026-06-24
"""
from alembic import op
import sqlalchemy as sa

revision = "0005_todo_lists"
down_revision = "0004_task_identifiers"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "TodoList",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False, server_default="My List"),
        sa.Column("color", sa.String(), nullable=False, server_default="#8A8A86"),
        sa.Column("sortOrder", sa.Float(), nullable=False, server_default="0"),
        sa.Column("workspaceId", sa.String(), nullable=False),
        sa.Column("createdAt", sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.Column("updatedAt", sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["workspaceId"], ["Workspace.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_TodoList_workspaceId", "TodoList", ["workspaceId"])

    op.create_table(
        "TodoItem",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("listId", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("notes", sa.String(), nullable=True),
        sa.Column("completed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("completedAt", sa.DateTime(), nullable=True),
        sa.Column("dueDate", sa.DateTime(), nullable=True),
        sa.Column("starred", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("sortOrder", sa.Float(), nullable=False, server_default="0"),
        sa.Column("createdAt", sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.Column("updatedAt", sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["listId"], ["TodoList.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_TodoItem_listId", "TodoItem", ["listId"])


def downgrade() -> None:
    op.drop_index("ix_TodoItem_listId", table_name="TodoItem")
    op.drop_table("TodoItem")
    op.drop_index("ix_TodoList_workspaceId", table_name="TodoList")
    op.drop_table("TodoList")
```

- [ ] **Step 5: Add the new tables to the test truncation list**

In `backend-py/tests/conftest.py`, update `_TABLES` so the new tables are truncated between tests (order matters — children before parents). Change:

```python
_TABLES = [
    '"_LabelToTask"', '"WishlistItem"', '"Wishlist"', '"Page"', '"Book"', '"Shelf"',
    '"Task"', '"Label"', '"Project"', '"Session"', '"Membership"', '"Workspace"', '"User"',
]
```

to:

```python
_TABLES = [
    '"_LabelToTask"', '"TodoItem"', '"TodoList"', '"WishlistItem"', '"Wishlist"',
    '"Page"', '"Book"', '"Shelf"',
    '"Task"', '"Label"', '"Project"', '"Session"', '"Membership"', '"Workspace"', '"User"',
]
```

- [ ] **Step 6: Apply the migration to the test DB and run the test**

Run: `cd backend-py && alembic upgrade head && python -m pytest tests/test_models.py::test_todo_models_tablenames -v`
Expected: migration applies cleanly; test PASSES.

- [ ] **Step 7: Commit**

```bash
git add backend-py/app/models.py backend-py/alembic/versions/0005_todo_lists.py backend-py/tests/conftest.py backend-py/tests/test_models.py
git commit -m "feat(todo): add TodoList/TodoItem models and migration"
```

---

### Task 2: Backend schemas + router + registration

**Files:**
- Modify: `backend-py/app/schemas.py` (append at end)
- Create: `backend-py/app/routers/todos.py`
- Modify: `backend-py/app/main.py` (import + `include_router`)
- Test: `backend-py/tests/test_todos.py`

**Interfaces:**
- Consumes: `TodoList`, `TodoItem` from Task 1; `CamelModel`, `Field` from `schemas.py`; `AuthContext`, `require_auth`, `get_db`, `AppError`, `new_id`, `iso_z`.
- Produces HTTP API:
  - `GET /lists` → `[ListDetail]` where `ListDetail = {id, name, color, sortOrder, itemCount, createdAt, updatedAt, items: [Item]}`
  - `POST /lists` (201) → `ListDetail`; body `{name?, color?}`
  - `PATCH /lists/{id}` → `ListDetail`; body `{name?, color?, sortOrder?}`
  - `DELETE /lists/{id}` (204)
  - `POST /lists/{id}/todos` (201) → `Item`; body `{title, notes?, dueDate?}`
  - `PATCH /todos/{id}` → `Item`; body `{title?, notes?, completed?, dueDate?, starred?, sortOrder?, listId?}`
  - `DELETE /todos/{id}` (204)
  - `Item = {id, listId, title, notes, completed, completedAt, dueDate, starred, sortOrder, createdAt, updatedAt}`

- [ ] **Step 1: Write the failing test**

Create `backend-py/tests/test_todos.py`:

```python
import pytest

_LIST_KEYS = {
    "id", "name", "color", "sortOrder", "itemCount",
    "createdAt", "updatedAt", "items",
}
_ITEM_KEYS = {
    "id", "listId", "title", "notes", "completed", "completedAt",
    "dueDate", "starred", "sortOrder", "createdAt", "updatedAt",
}


@pytest.mark.asyncio
async def test_list_and_item_lifecycle(auth_client):
    client, _ = auth_client

    r = await client.post("/lists", json={"name": "Daily Essentials", "color": "#4FA3D1"})
    assert r.status_code == 201
    lst = r.json()
    assert set(lst) == _LIST_KEYS
    assert lst["name"] == "Daily Essentials" and lst["itemCount"] == 0 and lst["items"] == []
    lid = lst["id"]

    listed = (await client.get("/lists")).json()
    assert len(listed) == 1 and listed[0]["id"] == lid

    r = await client.post(f"/lists/{lid}/todos", json={"title": "Soap Stand"})
    assert r.status_code == 201
    item = r.json()
    assert set(item) == _ITEM_KEYS
    assert item["title"] == "Soap Stand" and item["completed"] is False and item["completedAt"] is None
    iid = item["id"]

    detail = (await client.get("/lists")).json()[0]
    assert detail["itemCount"] == 1 and detail["items"][0]["id"] == iid

    # Completing the item stamps completedAt server-side.
    done = (await client.patch(f"/todos/{iid}", json={"completed": True})).json()
    assert done["completed"] is True and done["completedAt"] is not None

    # Un-completing clears it.
    undone = (await client.patch(f"/todos/{iid}", json={"completed": False})).json()
    assert undone["completed"] is False and undone["completedAt"] is None

    assert (await client.delete(f"/todos/{iid}")).status_code == 204
    assert (await client.get("/lists")).json()[0]["itemCount"] == 0


@pytest.mark.asyncio
async def test_move_item_between_lists(auth_client):
    client, _ = auth_client
    a = (await client.post("/lists", json={"name": "A"})).json()["id"]
    b = (await client.post("/lists", json={"name": "B"})).json()["id"]
    iid = (await client.post(f"/lists/{a}/todos", json={"title": "x"})).json()["id"]

    moved = (await client.patch(f"/todos/{iid}", json={"listId": b, "sortOrder": 5})).json()
    assert moved["listId"] == b and moved["sortOrder"] == 5


@pytest.mark.asyncio
async def test_delete_list_cascades_items(auth_client):
    client, _ = auth_client
    lid = (await client.post("/lists", json={"name": "Trip"})).json()["id"]
    iid = (await client.post(f"/lists/{lid}/todos", json={"title": "Pack"})).json()["id"]

    assert (await client.delete(f"/lists/{lid}")).status_code == 204
    assert (await client.patch(f"/todos/{iid}", json={"title": "y"})).status_code == 404


@pytest.mark.asyncio
async def test_lists_are_workspace_isolated(auth_client, client):
    owner, _ = auth_client
    lid = (await owner.post("/lists", json={"name": "Mine"})).json()["id"]

    other = await client.post("/auth/signup", json={"email": "other-todo@test.com", "password": "password1"})
    assert other.status_code == 201
    # Same client now authenticated as the second user.
    assert (await client.get("/lists")).json() == []
    assert (await client.patch(f"/lists/{lid}", json={"name": "Hijack"})).status_code == 404
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend-py && python -m pytest tests/test_todos.py -v`
Expected: FAIL — `404` for `/lists` (route not registered) / assertion errors.

- [ ] **Step 3: Add the schemas**

Append to `backend-py/app/schemas.py`:

```python
class CreateTodoList(CamelModel):
    name: str = Field(min_length=1, max_length=200)
    color: str = Field(default="#8A8A86", pattern=HEX)


class UpdateTodoList(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    color: str | None = Field(default=None, pattern=HEX)
    sort_order: float | None = None


class CreateTodoItem(CamelModel):
    title: str = Field(min_length=1, max_length=500)
    notes: str | None = Field(default=None, max_length=20000)
    due_date: datetime | None = None


class UpdateTodoItem(CamelModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    notes: str | None = Field(default=None, max_length=20000)
    completed: bool | None = None
    due_date: datetime | None = None
    starred: bool | None = None
    sort_order: float | None = None
    list_id: str | None = None
```

- [ ] **Step 4: Create the router**

Create `backend-py/app/routers/todos.py`:

```python
import time
from datetime import datetime, timezone

import sqlalchemy as sa
from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.deps import AuthContext, require_auth
from ..db import get_db
from ..errors import AppError
from ..ids import new_id
from ..models import TodoItem, TodoList
from ..schemas import CreateTodoItem, CreateTodoList, UpdateTodoItem, UpdateTodoList
from ..timeutils import iso_z

todos_router = APIRouter(dependencies=[Depends(require_auth)])


async def _owned_list(db: AsyncSession, wsid: str, list_id: str) -> TodoList | None:
    return (
        await db.execute(sa.select(TodoList).where(TodoList.id == list_id, TodoList.workspace_id == wsid))
    ).scalar_one_or_none()


async def _owned_item(db: AsyncSession, wsid: str, item_id: str) -> TodoItem | None:
    return (
        await db.execute(
            sa.select(TodoItem)
            .join(TodoList, TodoItem.list_id == TodoList.id)
            .where(TodoItem.id == item_id, TodoList.workspace_id == wsid)
        )
    ).scalar_one_or_none()


def _item_dict(i: TodoItem) -> dict:
    return {
        "id": i.id,
        "listId": i.list_id,
        "title": i.title,
        "notes": i.notes,
        "completed": i.completed,
        "completedAt": iso_z(i.completed_at) if i.completed_at else None,
        "dueDate": iso_z(i.due_date) if i.due_date else None,
        "starred": i.starred,
        "sortOrder": i.sort_order,
        "createdAt": iso_z(i.created_at),
        "updatedAt": iso_z(i.updated_at),
    }


def _list_dict(t: TodoList, item_count: int) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "color": t.color,
        "sortOrder": t.sort_order,
        "itemCount": item_count,
        "createdAt": iso_z(t.created_at),
        "updatedAt": iso_z(t.updated_at),
    }


async def _list_with_items(db: AsyncSession, lst: TodoList) -> dict:
    items = (
        await db.execute(
            sa.select(TodoItem).where(TodoItem.list_id == lst.id).order_by(TodoItem.sort_order.asc())
        )
    ).scalars().all()
    return {**_list_dict(lst, len(items)), "items": [_item_dict(i) for i in items]}


@todos_router.get("/lists")
async def list_lists(ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    lists = (
        await db.execute(
            sa.select(TodoList)
            .where(TodoList.workspace_id == ctx.workspace_id)
            .order_by(TodoList.sort_order.asc(), TodoList.created_at.asc())
        )
    ).scalars().all()
    if not lists:
        return []
    items = (
        await db.execute(
            sa.select(TodoItem)
            .where(TodoItem.list_id.in_([t.id for t in lists]))
            .order_by(TodoItem.sort_order.asc())
        )
    ).scalars().all()
    by_list: dict[str, list[TodoItem]] = {}
    for i in items:
        by_list.setdefault(i.list_id, []).append(i)
    out = []
    for t in lists:
        group = by_list.get(t.id, [])
        out.append({**_list_dict(t, len(group)), "items": [_item_dict(i) for i in group]})
    return out


@todos_router.post("/lists", status_code=201)
async def create_list(body: CreateTodoList, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    t = TodoList(
        id=new_id(),
        name=body.name,
        color=body.color,
        sort_order=float(int(time.time() * 1000)),
        workspace_id=ctx.workspace_id,
    )
    db.add(t)
    await db.commit()
    await db.refresh(t)
    return await _list_with_items(db, t)


@todos_router.patch("/lists/{list_id}")
async def patch_list(list_id: str, body: UpdateTodoList, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    t = await _owned_list(db, ctx.workspace_id, list_id)
    if t is None:
        raise AppError(404, "List not found")
    data = body.model_dump(exclude_unset=True)
    if "name" in data:
        t.name = data["name"]
    if "color" in data:
        t.color = data["color"]
    if "sort_order" in data:
        t.sort_order = data["sort_order"]
    await db.commit()
    await db.refresh(t)
    return await _list_with_items(db, t)


@todos_router.delete("/lists/{list_id}", status_code=204)
async def delete_list(list_id: str, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    t = await _owned_list(db, ctx.workspace_id, list_id)
    if t is None:
        raise AppError(404, "List not found")
    await db.delete(t)
    await db.commit()
    return Response(status_code=204)


@todos_router.post("/lists/{list_id}/todos", status_code=201)
async def create_item(list_id: str, body: CreateTodoItem, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    if await _owned_list(db, ctx.workspace_id, list_id) is None:
        raise AppError(404, "List not found")
    i = TodoItem(
        id=new_id(),
        list_id=list_id,
        title=body.title,
        notes=body.notes,
        due_date=body.due_date,
        sort_order=float(int(time.time() * 1000)),
    )
    db.add(i)
    await db.commit()
    await db.refresh(i)
    return _item_dict(i)


@todos_router.patch("/todos/{item_id}")
async def patch_item(item_id: str, body: UpdateTodoItem, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    i = await _owned_item(db, ctx.workspace_id, item_id)
    if i is None:
        raise AppError(404, "Item not found")
    data = body.model_dump(exclude_unset=True)
    if "title" in data:
        i.title = data["title"]
    if "notes" in data:
        i.notes = data["notes"]
    if "completed" in data:
        i.completed = data["completed"]
        i.completed_at = datetime.now(timezone.utc) if data["completed"] else None
    if "due_date" in data:
        i.due_date = data["due_date"]
    if "starred" in data:
        i.starred = data["starred"]
    if "sort_order" in data:
        i.sort_order = data["sort_order"]
    if "list_id" in data and data["list_id"] is not None:
        if await _owned_list(db, ctx.workspace_id, data["list_id"]) is None:
            raise AppError(404, "List not found")
        i.list_id = data["list_id"]
    await db.commit()
    await db.refresh(i)
    return _item_dict(i)


@todos_router.delete("/todos/{item_id}", status_code=204)
async def delete_item(item_id: str, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    i = await _owned_item(db, ctx.workspace_id, item_id)
    if i is None:
        raise AppError(404, "Item not found")
    await db.delete(i)
    await db.commit()
    return Response(status_code=204)
```

- [ ] **Step 5: Register the router**

In `backend-py/app/main.py`, add the import alongside the other router imports (after line 13, `from .routers.wishlist import wishlist_router`):

```python
from .routers.todos import todos_router
```

And add the registration after line 45 (`app.include_router(wishlist_router)`):

```python
    app.include_router(todos_router)
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd backend-py && python -m pytest tests/test_todos.py -v`
Expected: all 4 tests PASS.

- [ ] **Step 7: Run the full backend suite to check for regressions**

Run: `cd backend-py && python -m pytest -q`
Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add backend-py/app/schemas.py backend-py/app/routers/todos.py backend-py/app/main.py backend-py/tests/test_todos.py
git commit -m "feat(todo): add lists/todos API routes"
```

---

### Task 3: Frontend types + react-query hooks

**Files:**
- Modify: `frontend/src/types.ts` (append at end)
- Create: `frontend/src/hooks/useTodos.ts`

**Interfaces:**
- Consumes: the `/lists` and `/todos` API from Task 2; `api` from `@/lib/api`.
- Produces:
  - Types `TodoList`, `TodoListDetail` (`extends TodoList { items: TodoItem[] }`), `TodoItem`, `CreateTodoListInput`, `UpdateTodoListInput`, `CreateTodoItemInput`, `UpdateTodoItemInput`.
  - Hooks: `useTodoLists()` → `UseQueryResult<TodoListDetail[]>`; `useCreateList()`, `useUpdateList()`, `useDeleteList()`, `useCreateTodo()`, `useUpdateTodo()`, `useDeleteTodo()`.
  - Mutation argument shapes: `useCreateList.mutate(input)`; `useUpdateList.mutate({ id, patch })`; `useDeleteList.mutate(id)`; `useCreateTodo.mutate({ listId, input })`; `useUpdateTodo.mutate({ id, patch })`; `useDeleteTodo.mutate({ id })`.
  - Query key: `todoListsKey() = ["todoLists"]`.

- [ ] **Step 1: Add the types**

Append to `frontend/src/types.ts`:

```typescript
export interface TodoList {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TodoListDetail extends TodoList {
  items: TodoItem[];
}

export interface TodoItem {
  id: string;
  listId: string;
  title: string;
  notes: string | null;
  completed: boolean;
  completedAt: string | null;
  dueDate: string | null;
  starred: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTodoListInput {
  name: string;
  color?: string;
}

export interface UpdateTodoListInput {
  name?: string;
  color?: string;
  sortOrder?: number;
}

export interface CreateTodoItemInput {
  title: string;
  notes?: string | null;
  dueDate?: string | null;
}

export interface UpdateTodoItemInput {
  title?: string;
  notes?: string | null;
  completed?: boolean;
  dueDate?: string | null;
  starred?: boolean;
  sortOrder?: number;
  listId?: string;
}
```

- [ ] **Step 2: Create the hooks**

Create `frontend/src/hooks/useTodos.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  TodoListDetail,
  TodoItem,
  CreateTodoListInput,
  UpdateTodoListInput,
  CreateTodoItemInput,
  UpdateTodoItemInput,
} from "@/types";
import { api } from "@/lib/api";

export const todoListsKey = () => ["todoLists"] as const;

export function useTodoLists() {
  return useQuery({
    queryKey: todoListsKey(),
    queryFn: () => api.get<TodoListDetail[]>("/lists"),
  });
}

export function useCreateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTodoListInput) => api.post<TodoListDetail>("/lists", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: todoListsKey() }),
  });
}

export function useUpdateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateTodoListInput }) =>
      api.patch<TodoListDetail>(`/lists/${id}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: todoListsKey() }),
  });
}

export function useDeleteList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/lists/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: todoListsKey() }),
  });
}

export function useCreateTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, input }: { listId: string; input: CreateTodoItemInput }) =>
      api.post<TodoItem>(`/lists/${listId}/todos`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: todoListsKey() }),
  });
}

export function useUpdateTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateTodoItemInput }) =>
      api.patch<TodoItem>(`/todos/${id}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: todoListsKey() }),
  });
}

export function useDeleteTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => api.del(`/todos/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: todoListsKey() }),
  });
}
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && pnpm lint`
Expected: PASS (no type errors). It is fine that the new exports are not yet used — they are exported module members.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types.ts frontend/src/hooks/useTodos.ts
git commit -m "feat(todo): add frontend types and react-query hooks"
```

---

### Task 4: TodoDetailPanel (notes / due date / star / delete)

**Files:**
- Create: `frontend/src/components/todo/TodoDetailPanel.tsx`

**Interfaces:**
- Consumes: `useUpdateTodo`, `useDeleteTodo` from Task 3; `TodoItem` type; `Sheet`/`SheetContent`/`SheetHeader`/`SheetTitle` from `@/components/ui/sheet`; `Button` from `@/components/ui/button`; `Input` from `@/components/ui/input`; `DatePicker` from `@/components/ui/date-picker`; `MarkdownEditor` from `@/components/ui/markdown-editor`.
- Produces: `TodoDetailPanel({ open, onOpenChange, item }: { open: boolean; onOpenChange: (o: boolean) => void; item: TodoItem | null })`.

- [ ] **Step 1: Create the panel**

Create `frontend/src/components/todo/TodoDetailPanel.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Star, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { useUpdateTodo, useDeleteTodo } from "@/hooks/useTodos";
import { cn } from "@/lib/utils";
import type { TodoItem } from "@/types";

export function TodoDetailPanel({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: TodoItem | null;
}) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [starred, setStarred] = useState(false);

  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();

  // The panel stays mounted and is reused; reset the form whenever it opens.
  useEffect(() => {
    if (!open || !item) return;
    setTitle(item.title);
    setNotes(item.notes ?? "");
    setDueDate(item.dueDate ? new Date(item.dueDate).toISOString().split("T")[0] : "");
    setStarred(item.starred);
  }, [open, item]);

  if (!item) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await updateTodo.mutateAsync({
      id: item.id,
      patch: {
        title: title.trim(),
        notes: notes.trim() || null,
        dueDate: dueDate || null,
        starred,
      },
    });
    onOpenChange(false);
  };

  const handleDelete = async () => {
    await deleteTodo.mutateAsync({ id: item.id });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Task details</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSave} className="flex flex-col gap-4 mt-4">
          <div>
            <label className="text-xs text-ink-muted mb-1 block">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task" autoFocus />
          </div>

          <div>
            <label className="text-xs text-ink-muted mb-1 block">Notes</label>
            <MarkdownEditor
              key={item.id}
              value={notes}
              onChange={setNotes}
              minHeight="min-h-32"
              placeholder="Add details…"
            />
          </div>

          <div>
            <label className="text-xs text-ink-muted mb-1 block">Due date</label>
            <DatePicker value={dueDate || null} onChange={(v) => setDueDate(v ?? "")} placeholder="Pick a date" />
          </div>

          <button
            type="button"
            onClick={() => setStarred((s) => !s)}
            className={cn(
              "flex items-center gap-2 text-sm w-fit px-2 py-1 rounded-md hover:bg-bg",
              starred ? "text-amber-400" : "text-ink-muted hover:text-ink",
            )}
          >
            <Star className={cn("size-4", starred && "fill-current")} />
            {starred ? "Starred" : "Star"}
          </button>

          <div className="flex justify-between items-center mt-4">
            <Button type="button" variant="ghost" onClick={handleDelete} className="text-red-500 hover:text-red-500">
              <Trash2 className="size-4 mr-1" /> Delete
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!title.trim() || updateTodo.isPending}>
                Save
              </Button>
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/todo/TodoDetailPanel.tsx
git commit -m "feat(todo): add task detail panel"
```

---

### Task 5: TodoRow, TodoListColumn, and the TodosBoard with drag-and-drop

**Files:**
- Create: `frontend/src/components/todo/TodoRow.tsx`
- Create: `frontend/src/components/todo/TodoListColumn.tsx`
- Create: `frontend/src/components/todo/TodosBoard.tsx`

**Interfaces:**
- Consumes: hooks from Task 3; `TodoDetailPanel` from Task 4; `TodoListDetail`, `TodoItem` types; `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`; `cn` from `@/lib/utils`.
- Produces:
  - `TodoRowView({ item, className })` — pure visual row (used by the drag overlay).
  - `TodoRow({ item, onToggle, onOpen })` — sortable row.
  - `TodoListColumn({ list, onAddTask, onToggle, onOpenItem, onRename, onDelete })`.
  - `TodosBoard()` — default export-free named export rendering the full board; self-contained (fetches its own data).

- [ ] **Step 1: Create the row**

Create `frontend/src/components/todo/TodoRow.tsx`:

```tsx
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Circle, CheckCircle2, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TodoItem } from "@/types";

/** Pure visual row — reused by the sortable row and the drag overlay. */
export function TodoRowView({ item, className }: { item: TodoItem; className?: string }) {
  return (
    <div className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded-md", className)}>
      {item.completed ? (
        <CheckCircle2 className="size-4 shrink-0 text-ink-muted" />
      ) : (
        <Circle className="size-4 shrink-0 text-ink-muted" />
      )}
      <span className={cn("min-w-0 flex-1 truncate text-sm", item.completed && "line-through text-ink-muted")}>
        {item.title}
      </span>
      {item.starred && <Star className="size-3.5 shrink-0 text-amber-400 fill-current" />}
    </div>
  );
}

export function TodoRow({
  item,
  onToggle,
  onOpen,
}: {
  item: TodoItem;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="group flex items-center hover:bg-bg rounded-md">
      {/* Checkbox click toggles completion and must not start a drag or open the panel. */}
      <button
        type="button"
        aria-label={item.completed ? "Mark incomplete" : "Mark complete"}
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className="pl-2 py-1.5 text-ink-muted hover:text-ink"
      >
        {item.completed ? <CheckCircle2 className="size-4" /> : <Circle className="size-4" />}
      </button>
      {/* The label area is the drag handle and opens the detail panel on click. */}
      <button
        type="button"
        ref={undefined}
        {...attributes}
        {...listeners}
        onClick={onOpen}
        className="min-w-0 flex-1 flex items-center gap-2 pr-2 py-1.5 text-left cursor-grab active:cursor-grabbing"
      >
        <span className={cn("min-w-0 flex-1 truncate text-sm", item.completed && "line-through text-ink-muted")}>
          {item.title}
        </span>
        {item.starred && <Star className="size-3.5 shrink-0 text-amber-400 fill-current" />}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create the column**

Create `frontend/src/components/todo/TodoListColumn.tsx`:

```tsx
import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus, MoreHorizontal, Trash2, Pencil, ChevronRight, ChevronDown } from "lucide-react";
import { TodoRow } from "./TodoRow";
import type { TodoListDetail, TodoItem } from "@/types";

export function TodoListColumn({
  list,
  onAddTask,
  onToggle,
  onOpenItem,
  onRename,
  onDelete,
}: {
  list: TodoListDetail;
  onAddTask: (title: string) => void;
  onToggle: (item: TodoItem) => void;
  onOpenItem: (item: TodoItem) => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const { setNodeRef } = useDroppable({ id: list.id });

  const active = list.items.filter((i) => !i.completed);
  const completed = list.items.filter((i) => i.completed);

  const submit = () => {
    const t = draft.trim();
    if (t) onAddTask(t);
    setDraft("");
    setAdding(false);
  };

  return (
    <div className="w-72 shrink-0 flex flex-col bg-surface border border-border rounded-lg">
      <div className="relative flex items-center gap-2 px-3 py-2.5 border-b border-border">
        <span className="size-2.5 shrink-0 rounded-full" style={{ background: list.color }} />
        <span className="font-display text-sm font-semibold truncate flex-1">{list.name}</span>
        <span className="font-mono text-xs text-ink-muted shrink-0">{active.length}</span>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="List options"
          className="shrink-0 p-1 rounded hover:bg-bg text-ink-muted hover:text-ink"
        >
          <MoreHorizontal className="size-4" />
        </button>
        {menuOpen && (
          <div className="absolute top-11 right-2 bg-surface border border-border rounded-md shadow-lg z-10 py-1">
            <button
              onClick={() => { setMenuOpen(false); onRename(); }}
              className="w-full px-3 py-1.5 text-sm text-left hover:bg-bg flex items-center gap-2"
            >
              <Pencil className="size-3" /> Rename list
            </button>
            <button
              onClick={() => { setMenuOpen(false); onDelete(); }}
              className="w-full px-3 py-1.5 text-sm text-left hover:bg-bg text-red-500 flex items-center gap-2"
            >
              <Trash2 className="size-3" /> Delete list
            </button>
          </div>
        )}
      </div>

      <div className="px-2 pt-2">
        {adding ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={submit}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") { setDraft(""); setAdding(false); }
            }}
            placeholder="Task title"
            className="w-full bg-bg border border-border rounded-md px-2 py-1.5 text-sm outline-none focus:border-ink/40"
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full flex items-center gap-1 px-2 py-1.5 text-sm text-ink-muted hover:text-ink"
          >
            <Plus className="size-4" /> Add a task
          </button>
        )}
      </div>

      <SortableContext items={active.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex flex-col gap-0.5 p-2 min-h-16 max-h-[50vh] overflow-y-auto">
          {active.length === 0 ? (
            <p className="px-2 py-3 text-xs text-ink-muted">No tasks yet.</p>
          ) : (
            active.map((item) => (
              <TodoRow
                key={item.id}
                item={item}
                onToggle={() => onToggle(item)}
                onOpen={() => onOpenItem(item)}
              />
            ))
          )}
        </div>
      </SortableContext>

      {completed.length > 0 && (
        <div className="border-t border-border p-2">
          <button
            onClick={() => setShowCompleted((s) => !s)}
            className="w-full flex items-center gap-1 px-2 py-1 text-xs text-ink-muted hover:text-ink"
          >
            {showCompleted ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            Completed ({completed.length})
          </button>
          {showCompleted && (
            <div className="flex flex-col gap-0.5 mt-1">
              {completed.map((item) => (
                <TodoRow
                  key={item.id}
                  item={item}
                  onToggle={() => onToggle(item)}
                  onOpen={() => onOpenItem(item)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create the board**

Create `frontend/src/components/todo/TodosBoard.tsx`:

```tsx
import { useState } from "react";
import {
  DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import {
  useTodoLists, useCreateList, useUpdateList, useDeleteList, useCreateTodo, useUpdateTodo,
} from "@/hooks/useTodos";
import { TodoListColumn } from "./TodoListColumn";
import { TodoRowView } from "./TodoRow";
import { TodoDetailPanel } from "./TodoDetailPanel";
import type { TodoItem } from "@/types";

export function TodosBoard() {
  const { data: lists = [] } = useTodoLists();
  const createList = useCreateList();
  const updateList = useUpdateList();
  const deleteList = useDeleteList();
  const createTodo = useCreateTodo();
  const updateTodo = useUpdateTodo();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openItem, setOpenItem] = useState<TodoItem | null>(null);

  // Only incomplete items participate in drag (completed ones live in a separate section).
  const allActive = lists.flatMap((l) => l.items.filter((i) => !i.completed));
  const activeItem = activeId ? allActive.find((i) => i.id === activeId) ?? null : null;

  const listOfItem = (id: string) => lists.find((l) => l.items.some((i) => i.id === id));

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const draggedId = String(e.active.id);
    if (!e.over) return;
    const overId = String(e.over.id);
    if (draggedId === overId) return;

    const sourceList = listOfItem(draggedId);
    if (!sourceList) return;
    // `over` is either another item or an empty column droppable (id === list id).
    const overItemList = listOfItem(overId);
    const targetList = overItemList ?? lists.find((l) => l.id === overId);
    if (!targetList) return;

    const targetActive = targetList.items.filter((i) => !i.completed);
    const ids = targetActive.map((i) => i.id);

    let ordered: string[];
    if (sourceList.id === targetList.id) {
      const oldIndex = ids.indexOf(draggedId);
      const newIndex = overItemList ? ids.indexOf(overId) : ids.length - 1;
      if (oldIndex === -1 || newIndex === -1) return;
      ordered = arrayMove(ids, oldIndex, newIndex);
    } else {
      const insertAt = overItemList ? ids.indexOf(overId) : ids.length;
      ordered = [...ids.slice(0, insertAt), draggedId, ...ids.slice(insertAt)];
    }

    const byId = new Map(allActive.map((i) => [i.id, i]));
    const pos = ordered.indexOf(draggedId);
    const prev = pos > 0 ? byId.get(ordered[pos - 1]) : undefined;
    const next = pos < ordered.length - 1 ? byId.get(ordered[pos + 1]) : undefined;
    const prevSort = prev?.sortOrder;
    const nextSort = next?.sortOrder;

    let sortOrder: number;
    if (prevSort === undefined && nextSort === undefined) sortOrder = 0;
    else if (prevSort === undefined) sortOrder = nextSort! - 1;
    else if (nextSort === undefined) sortOrder = prevSort + 1;
    else sortOrder = (prevSort + nextSort) / 2;

    const patch: { sortOrder: number; listId?: string } = { sortOrder };
    if (sourceList.id !== targetList.id) patch.listId = targetList.id;
    updateTodo.mutate({ id: draggedId, patch });
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="flex gap-4 items-start overflow-x-auto pb-2">
          {lists.map((list) => (
            <TodoListColumn
              key={list.id}
              list={list}
              onAddTask={(title) => createTodo.mutate({ listId: list.id, input: { title } })}
              onToggle={(item) => updateTodo.mutate({ id: item.id, patch: { completed: !item.completed } })}
              onOpenItem={(item) => setOpenItem(item)}
              onRename={() => {
                const name = window.prompt("Rename list", list.name);
                if (name && name.trim()) updateList.mutate({ id: list.id, patch: { name: name.trim() } });
              }}
              onDelete={() => {
                if (window.confirm(`Delete list "${list.name}" and all its tasks?`)) deleteList.mutate(list.id);
              }}
            />
          ))}

          <button
            onClick={() => createList.mutate({ name: "New list" })}
            className="w-72 shrink-0 flex items-center justify-center gap-1 py-3 text-sm text-ink-muted hover:text-ink border border-dashed border-border rounded-lg hover:bg-bg"
          >
            <Plus className="size-4" /> Create new list
          </button>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeItem ? (
            <TodoRowView item={activeItem} className="w-64 bg-surface border border-border shadow-xl cursor-grabbing" />
          ) : null}
        </DragOverlay>
      </DndContext>

      <TodoDetailPanel open={!!openItem} onOpenChange={(o) => !o && setOpenItem(null)} item={openItem} />
    </>
  );
}
```

- [ ] **Step 4: Type-check**

Run: `cd frontend && pnpm lint`
Expected: PASS.

Note: in `TodoRow.tsx` Step 1 the inner label button has a stray `ref={undefined}` — remove that line if `pnpm lint` flags it; it is harmless but unnecessary. (Listeners/attributes from `useSortable` already wire the handle.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/todo/TodoRow.tsx frontend/src/components/todo/TodoListColumn.tsx frontend/src/components/todo/TodosBoard.tsx
git commit -m "feat(todo): add todo board, columns, rows with drag-and-drop"
```

---

### Task 6: Compose the board below the wishlist columns

**Files:**
- Modify: `frontend/src/components/wishlist/WishlistsPage.tsx` (the `WishlistsPage` return block)

**Interfaces:**
- Consumes: `TodosBoard` from Task 5.

- [ ] **Step 1: Import the board**

In `frontend/src/components/wishlist/WishlistsPage.tsx`, add to the imports at the top:

```tsx
import { TodosBoard } from "@/components/todo/TodosBoard";
```

- [ ] **Step 2: Render it below the wishlist section**

In `WishlistsPage`'s returned JSX, immediately before the closing `</div>` that wraps the `WishlistDialog`/`WishlistItemDrawer` (i.e., after the wishlist board block and before the dialogs), insert a "Lists" section:

```tsx
      <div className="mt-10">
        <h1 className="font-display text-2xl font-bold mb-6">Lists</h1>
        <TodosBoard />
      </div>
```

The end of the component should read:

```tsx
      <div className="mt-10">
        <h1 className="font-display text-2xl font-bold mb-6">Lists</h1>
        <TodosBoard />
      </div>

      <WishlistDialog
        open={listDialog.open}
        onOpenChange={(o) => setListDialog((s) => ({ ...s, open: o }))}
        wishlist={listDialog.editing}
      />
      <WishlistItemDrawer
        open={itemDrawer.open}
        onOpenChange={(o) => setItemDrawer((s) => ({ ...s, open: o }))}
        wishlistId={itemDrawer.wishlistId}
        item={itemDrawer.item}
      />
    </div>
  );
}
```

- [ ] **Step 3: Type-check and build**

Run: `cd frontend && pnpm build`
Expected: build succeeds (tsc + vite).

- [ ] **Step 4: Manual smoke test**

Start backend (`cd backend-py && uvicorn app.main:app --reload --port 4000`) and frontend (`cd frontend && pnpm dev`). Log in, open the Wishlist view via the right rail. Below the wishlists, confirm: "Create new list" creates a column; "Add a task" adds tasks; clicking the circle completes a task and it moves to "Completed (N)"; dragging reorders within and between lists; clicking a task title opens the detail panel (notes/due date/star/delete) and saving persists after refresh.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/wishlist/WishlistsPage.tsx
git commit -m "feat(todo): render Lists board below wishlists"
```

---

## Self-Review

**Spec coverage:**
- Data model (TodoList/TodoItem, no enums, migration after 0004) → Task 1. ✓
- API (GET/POST/PATCH/DELETE lists & todos, listId move, completedAt server-side, workspace scoping) → Task 2. ✓
- Frontend types + hooks (single `["todoLists"]` query) → Task 3. ✓
- Detail panel (notes/due date/star/delete) → Task 4. ✓
- Board, columns (add/rename/delete, collapsible Completed, empty state), rows (check-to-complete, star), drag within/between lists → Task 5. ✓
- Placement below wishlist columns on the Wishlists page → Task 6. ✓
- Out-of-scope items (subtasks, recurring, reminders, sharing, aggregate views) → not implemented, per spec. ✓

**Placeholder scan:** No "TBD"/"add validation"/"similar to Task N" — all code is shown in full. The one explicit note (stray `ref={undefined}` in `TodoRow`) is flagged with how to resolve it.

**Type consistency:** Hook mutation shapes are used consistently — `useUpdateTodo.mutate({ id, patch })`, `useCreateTodo.mutate({ listId, input })`, `useDeleteTodo.mutate({ id })`, `useUpdateList.mutate({ id, patch })`, `useDeleteList.mutate(id)`, `useCreateList.mutate(input)` — matching Task 3 definitions in Tasks 5/6. Response key sets in tests (`_LIST_KEYS`, `_ITEM_KEYS`) match `_list_dict`/`_item_dict` outputs in Task 2. DB column aliases in Task 1 (`listId`, `completedAt`, `dueDate`, `sortOrder`) match the migration and the `_item_dict` reads.

import time

import sqlalchemy as sa
from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.deps import AuthContext, require_auth
from ..db import get_db
from ..errors import AppError
from ..ids import new_id
from ..models import TodoItem, TodoList
from ..schemas import CreateTodoItem, CreateTodoList, UpdateTodoItem, UpdateTodoList
from ..timeutils import iso_z, to_naive_utc, utcnow_naive

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
        due_date=to_naive_utc(body.due_date),
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
        i.completed_at = utcnow_naive() if data["completed"] else None
    if "due_date" in data:
        i.due_date = to_naive_utc(data["due_date"])
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

import sqlalchemy as sa
from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..auth.deps import AuthContext, require_auth
from ..db import get_db
from ..errors import AppError
from ..ids import new_id
from ..models import Label, Task
from ..schemas import CreateTask, TaskFilter, UpdateTask
from ..timeutils import iso_z, to_naive_utc, utcnow_naive

tasks_router = APIRouter(prefix="/tasks", dependencies=[Depends(require_auth)])


def serialize_task(t: Task) -> dict:
    return {
        "id": t.id,
        "title": t.title,
        "description": t.description,
        "status": t.status,
        "priority": t.priority,
        "dueDate": iso_z(t.due_date),
        "projectId": t.project_id,
        "sortOrder": t.sort_order,
        "labels": [{"id": lb.id, "name": lb.name, "color": lb.color} for lb in t.labels],
        "createdAt": iso_z(t.created_at),
        "updatedAt": iso_z(t.updated_at),
    }


async def _load(db: AsyncSession, task_id: str, workspace_id: str) -> Task | None:
    return (
        await db.execute(
            sa.select(Task)
            .where(Task.id == task_id, Task.workspace_id == workspace_id, Task.deleted_at.is_(None))
            .options(selectinload(Task.labels))
        )
    ).scalar_one_or_none()


async def _reload(db: AsyncSession, task_id: str) -> Task:
    return (
        await db.execute(sa.select(Task).where(Task.id == task_id).options(selectinload(Task.labels)))
    ).scalar_one()


async def _labels(db: AsyncSession, ids: list[str], workspace_id: str) -> list[Label]:
    if not ids:
        return []
    rows = (
        await db.execute(sa.select(Label).where(Label.id.in_(ids), Label.workspace_id == workspace_id))
    ).scalars().all()
    return list(rows)


@tasks_router.get("")
async def list_tasks(
    filt: TaskFilter = Depends(),
    ctx: AuthContext = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        sa.select(Task)
        .where(Task.workspace_id == ctx.workspace_id, Task.deleted_at.is_(None))
        .options(selectinload(Task.labels))
    )
    if filt.status is not None:
        stmt = stmt.where(Task.status == filt.status.value)
    if filt.priority is not None:
        stmt = stmt.where(Task.priority == filt.priority.value)
    if filt.project_id is not None:
        stmt = stmt.where(Task.project_id == filt.project_id)
    if filt.label_id is not None:
        stmt = stmt.where(Task.labels.any(Label.id == filt.label_id))
    stmt = stmt.order_by(Task.sort_order.asc())
    rows = (await db.execute(stmt)).scalars().all()
    return [serialize_task(t) for t in rows]


@tasks_router.post("", status_code=201)
async def create_task(
    body: CreateTask, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)
):
    task = Task(
        id=new_id(),
        title=body.title,
        description=body.description,
        status=body.status.value,
        priority=body.priority.value,
        due_date=to_naive_utc(body.due_date),
        project_id=body.project_id,
        workspace_id=ctx.workspace_id,
    )
    if body.label_ids is not None:
        task.labels = await _labels(db, body.label_ids, ctx.workspace_id)
    db.add(task)
    await db.commit()
    return serialize_task(await _reload(db, task.id))


@tasks_router.get("/{task_id}")
async def get_task(task_id: str, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    task = await _load(db, task_id, ctx.workspace_id)
    if task is None:
        raise AppError(404, "Not found")
    return serialize_task(task)


@tasks_router.patch("/{task_id}")
async def update_task(
    task_id: str, body: UpdateTask, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)
):
    task = await _load(db, task_id, ctx.workspace_id)
    if task is None:
        raise AppError(404, "Not found")
    data = body.model_dump(exclude_unset=True)
    if "title" in data:
        task.title = data["title"]
    if "description" in data:
        task.description = data["description"]
    if "status" in data:
        task.status = body.status.value
    if "priority" in data:
        task.priority = body.priority.value
    if "due_date" in data:
        task.due_date = to_naive_utc(body.due_date)
    if "project_id" in data:
        task.project_id = data["project_id"]
    if "sort_order" in data:
        task.sort_order = data["sort_order"]
    if "label_ids" in data:
        task.labels = await _labels(db, body.label_ids or [], ctx.workspace_id)
    await db.commit()
    return serialize_task(await _reload(db, task.id))


@tasks_router.delete("/{task_id}", status_code=204)
async def delete_task(task_id: str, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    task = await _load(db, task_id, ctx.workspace_id)
    if task is None:
        raise AppError(404, "Not found")
    task.deleted_at = utcnow_naive()
    task.deleted_with_project = False
    await db.commit()
    return Response(status_code=204)

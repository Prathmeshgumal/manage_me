import sqlalchemy as sa
from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.deps import AuthContext, require_auth
from ..db import get_db
from ..errors import AppError
from ..models import Book, Page, Project, Shelf, Task
from ..timeutils import iso_z

trash_router = APIRouter(prefix="/trash", dependencies=[Depends(require_auth)])

KINDS = {"project", "task", "book", "page"}


@trash_router.get("")
async def list_trash(ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    wsid = ctx.workspace_id

    projects = (
        await db.execute(
            sa.select(Project)
            .where(Project.workspace_id == wsid, Project.deleted_at.isnot(None))
            .order_by(Project.deleted_at.desc())
        )
    ).scalars().all()

    # Tasks removed *with* a project are represented by the project entry, not individually.
    tasks = (
        await db.execute(
            sa.select(Task)
            .where(
                Task.workspace_id == wsid,
                Task.deleted_at.isnot(None),
                Task.deleted_with_project.is_(False),
            )
            .order_by(Task.deleted_at.desc())
        )
    ).scalars().all()

    books = (
        await db.execute(
            sa.select(Book)
            .join(Shelf, Book.shelf_id == Shelf.id)
            .where(Shelf.workspace_id == wsid, Book.deleted_at.isnot(None))
            .order_by(Book.deleted_at.desc())
        )
    ).scalars().all()

    pages = (
        await db.execute(
            sa.select(Page)
            .join(Book, Page.book_id == Book.id)
            .join(Shelf, Book.shelf_id == Shelf.id)
            .where(Shelf.workspace_id == wsid, Page.deleted_at.isnot(None))
            .order_by(Page.deleted_at.desc())
        )
    ).scalars().all()

    return {
        "projects": [{"id": p.id, "name": p.name, "deletedAt": iso_z(p.deleted_at)} for p in projects],
        "tasks": [{"id": t.id, "title": t.title, "deletedAt": iso_z(t.deleted_at)} for t in tasks],
        "books": [{"id": b.id, "name": b.name, "deletedAt": iso_z(b.deleted_at)} for b in books],
        "pages": [{"id": p.id, "title": p.title, "deletedAt": iso_z(p.deleted_at)} for p in pages],
    }


async def _trashed_project(db: AsyncSession, wsid: str, pid: str) -> Project | None:
    return (
        await db.execute(
            sa.select(Project).where(
                Project.id == pid, Project.workspace_id == wsid, Project.deleted_at.isnot(None)
            )
        )
    ).scalar_one_or_none()


async def _trashed_task(db: AsyncSession, wsid: str, tid: str) -> Task | None:
    return (
        await db.execute(
            sa.select(Task).where(
                Task.id == tid, Task.workspace_id == wsid, Task.deleted_at.isnot(None)
            )
        )
    ).scalar_one_or_none()


async def _trashed_book(db: AsyncSession, wsid: str, bid: str) -> Book | None:
    return (
        await db.execute(
            sa.select(Book)
            .join(Shelf, Book.shelf_id == Shelf.id)
            .where(Book.id == bid, Shelf.workspace_id == wsid, Book.deleted_at.isnot(None))
        )
    ).scalar_one_or_none()


async def _trashed_page(db: AsyncSession, wsid: str, pid: str) -> Page | None:
    return (
        await db.execute(
            sa.select(Page)
            .join(Book, Page.book_id == Book.id)
            .join(Shelf, Book.shelf_id == Shelf.id)
            .where(Page.id == pid, Shelf.workspace_id == wsid, Page.deleted_at.isnot(None))
        )
    ).scalar_one_or_none()


@trash_router.post("/{kind}/{item_id}/restore", status_code=204)
async def restore(kind: str, item_id: str, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    if kind not in KINDS:
        raise AppError(404, "Not found")
    wsid = ctx.workspace_id

    if kind == "project":
        p = await _trashed_project(db, wsid, item_id)
        if p is None:
            raise AppError(404, "Not found")
        p.deleted_at = None
        # Bring back only the tasks removed by this project's deletion.
        await db.execute(
            sa.update(Task)
            .where(Task.project_id == item_id, Task.deleted_with_project.is_(True))
            .values(deleted_at=None, deleted_with_project=False)
        )
    elif kind == "task":
        t = await _trashed_task(db, wsid, item_id)
        if t is None:
            raise AppError(404, "Not found")
        t.deleted_at = None
        t.deleted_with_project = False
    elif kind == "book":
        b = await _trashed_book(db, wsid, item_id)
        if b is None:
            raise AppError(404, "Not found")
        b.deleted_at = None
    else:  # page
        pg = await _trashed_page(db, wsid, item_id)
        if pg is None:
            raise AppError(404, "Not found")
        pg.deleted_at = None

    await db.commit()
    return Response(status_code=204)


@trash_router.delete("/{kind}/{item_id}", status_code=204)
async def purge(kind: str, item_id: str, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    if kind not in KINDS:
        raise AppError(404, "Not found")
    wsid = ctx.workspace_id

    if kind == "project":
        p = await _trashed_project(db, wsid, item_id)
        if p is None:
            raise AppError(404, "Not found")
        # Keep the library: detach the shelf so deleting the project never removes it.
        await db.execute(
            sa.update(Shelf).where(Shelf.project_id == item_id).values(project_id=None)
        )
        # The project's tasks go for good.
        await db.execute(sa.delete(Task).where(Task.project_id == item_id))
        await db.delete(p)
    elif kind == "task":
        t = await _trashed_task(db, wsid, item_id)
        if t is None:
            raise AppError(404, "Not found")
        await db.delete(t)
    elif kind == "book":
        b = await _trashed_book(db, wsid, item_id)
        if b is None:
            raise AppError(404, "Not found")
        await db.delete(b)  # pages cascade
    else:  # page
        pg = await _trashed_page(db, wsid, item_id)
        if pg is None:
            raise AppError(404, "Not found")
        await db.delete(pg)

    await db.commit()
    return Response(status_code=204)

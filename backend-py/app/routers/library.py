import time

import sqlalchemy as sa
from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.deps import AuthContext, require_auth
from ..db import get_db
from ..errors import AppError
from ..ids import new_id
from ..models import Book, Page, Project, Shelf
from ..schemas import CreateBook, CreatePage, UpdateBook, UpdatePage, UpdateShelf
from ..timeutils import iso_z, utcnow_naive

library_router = APIRouter(dependencies=[Depends(require_auth)])


async def _shelf_with_books(db: AsyncSession, shelf: Shelf) -> dict:
    books = (
        await db.execute(
            sa.select(Book)
            .where(Book.shelf_id == shelf.id, Book.deleted_at.is_(None))
            .order_by(Book.sort_order.asc())
        )
    ).scalars().all()
    counts: dict[str, int] = {}
    if books:
        rows = (
            await db.execute(
                sa.select(Page.book_id, sa.func.count())
                .where(Page.book_id.in_([b.id for b in books]), Page.deleted_at.is_(None))
                .group_by(Page.book_id)
            )
        ).all()
        counts = {book_id: int(n) for book_id, n in rows}
    return {
        "id": shelf.id,
        "projectId": shelf.project_id,
        "name": shelf.name,
        "description": shelf.description,
        "books": [
            {
                "id": b.id, "name": b.name, "description": b.description, "color": b.color,
                "sortOrder": b.sort_order, "pageCount": counts.get(b.id, 0),
            }
            for b in books
        ],
    }


async def _owned_shelf(db: AsyncSession, wsid: str, shelf_id: str) -> Shelf | None:
    return (
        await db.execute(sa.select(Shelf).where(Shelf.id == shelf_id, Shelf.workspace_id == wsid))
    ).scalar_one_or_none()


async def _owned_book(db: AsyncSession, wsid: str, book_id: str) -> Book | None:
    return (
        await db.execute(
            sa.select(Book)
            .join(Shelf, Book.shelf_id == Shelf.id)
            .where(Book.id == book_id, Shelf.workspace_id == wsid, Book.deleted_at.is_(None))
        )
    ).scalar_one_or_none()


async def _owned_page(db: AsyncSession, wsid: str, page_id: str) -> Page | None:
    return (
        await db.execute(
            sa.select(Page)
            .join(Book, Page.book_id == Book.id)
            .join(Shelf, Book.shelf_id == Shelf.id)
            .where(
                Page.id == page_id,
                Shelf.workspace_id == wsid,
                Page.deleted_at.is_(None),
                Book.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()


@library_router.get("/shelf")
async def get_general_shelf(ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    shelf = (
        await db.execute(
            sa.select(Shelf).where(Shelf.is_general.is_(True), Shelf.workspace_id == ctx.workspace_id)
        )
    ).scalar_one_or_none()
    if shelf is None:
        shelf = Shelf(id=new_id(), project_id=None, name="General", is_general=True, workspace_id=ctx.workspace_id)
        db.add(shelf)
        await db.commit()
        await db.refresh(shelf)
    return await _shelf_with_books(db, shelf)


@library_router.get("/projects/{project_id}/shelf")
async def get_project_shelf(project_id: str, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    project = (
        await db.execute(
            sa.select(Project).where(
                Project.id == project_id,
                Project.workspace_id == ctx.workspace_id,
                Project.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if project is None:
        raise AppError(404, "Project not found")
    shelf = (await db.execute(sa.select(Shelf).where(Shelf.project_id == project_id))).scalar_one_or_none()
    if shelf is None:
        shelf = Shelf(id=new_id(), project_id=project_id, name=project.name, workspace_id=ctx.workspace_id)
        db.add(shelf)
    else:
        shelf.name = project.name
    await db.commit()
    await db.refresh(shelf)
    return await _shelf_with_books(db, shelf)


@library_router.get("/shelves/orphaned")
async def list_orphaned_shelves(ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    """Shelves whose project was deleted (soft) or removed (permanent), shown as tiles in the General shelf."""
    rows = (
        await db.execute(
            sa.select(Shelf)
            .outerjoin(Project, Shelf.project_id == Project.id)
            .where(
                Shelf.workspace_id == ctx.workspace_id,
                Shelf.is_general.is_(False),
                sa.or_(Shelf.project_id.is_(None), Project.deleted_at.isnot(None)),
            )
            .order_by(Shelf.updated_at.desc())
        )
    ).scalars().all()
    counts: dict[str, int] = {}
    if rows:
        crows = (
            await db.execute(
                sa.select(Book.shelf_id, sa.func.count())
                .where(Book.shelf_id.in_([s.id for s in rows]), Book.deleted_at.is_(None))
                .group_by(Book.shelf_id)
            )
        ).all()
        counts = {sid: int(n) for sid, n in crows}
    return [{"id": s.id, "name": s.name, "bookCount": counts.get(s.id, 0)} for s in rows]


@library_router.get("/shelves/{shelf_id}")
async def get_shelf(shelf_id: str, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    shelf = await _owned_shelf(db, ctx.workspace_id, shelf_id)
    if shelf is None:
        raise AppError(404, "Shelf not found")
    return await _shelf_with_books(db, shelf)


@library_router.patch("/shelves/{shelf_id}")
async def patch_shelf(shelf_id: str, body: UpdateShelf, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    shelf = await _owned_shelf(db, ctx.workspace_id, shelf_id)
    if shelf is None:
        raise AppError(404, "Shelf not found")
    data = body.model_dump(exclude_unset=True)
    if "name" in data: shelf.name = data["name"]
    if "description" in data: shelf.description = data["description"]
    await db.commit()
    await db.refresh(shelf)
    return {"id": shelf.id, "projectId": shelf.project_id, "name": shelf.name, "description": shelf.description}


@library_router.post("/shelves/{shelf_id}/books", status_code=201)
async def create_book(shelf_id: str, body: CreateBook, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    if await _owned_shelf(db, ctx.workspace_id, shelf_id) is None:
        raise AppError(404, "Shelf not found")
    b = Book(
        id=new_id(), shelf_id=shelf_id, name=body.name, description=body.description,
        color=body.color, sort_order=float(int(time.time() * 1000)),
    )
    db.add(b)
    await db.commit()
    await db.refresh(b)
    return {
        "id": b.id, "name": b.name, "description": b.description, "color": b.color,
        "sortOrder": b.sort_order, "createdAt": iso_z(b.created_at), "updatedAt": iso_z(b.updated_at),
    }


@library_router.get("/books/{book_id}")
async def get_book(book_id: str, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    b = await _owned_book(db, ctx.workspace_id, book_id)
    if b is None:
        raise AppError(404, "Book not found")
    pages = (
        await db.execute(
            sa.select(Page)
            .where(Page.book_id == book_id, Page.deleted_at.is_(None))
            .order_by(Page.sort_order.asc())
        )
    ).scalars().all()
    return {
        "id": b.id, "name": b.name, "description": b.description, "color": b.color, "sortOrder": b.sort_order,
        "pages": [{"id": p.id, "title": p.title, "sortOrder": p.sort_order, "updatedAt": iso_z(p.updated_at)} for p in pages],
    }


@library_router.patch("/books/{book_id}")
async def patch_book(book_id: str, body: UpdateBook, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    b = await _owned_book(db, ctx.workspace_id, book_id)
    if b is None:
        raise AppError(404, "Book not found")
    data = body.model_dump(exclude_unset=True)
    if "name" in data: b.name = data["name"]
    if "description" in data: b.description = data["description"]
    if "color" in data: b.color = data["color"]
    await db.commit()
    await db.refresh(b)
    return {"id": b.id, "name": b.name, "description": b.description, "color": b.color, "sortOrder": b.sort_order}


@library_router.delete("/books/{book_id}", status_code=204)
async def delete_book(book_id: str, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    b = await _owned_book(db, ctx.workspace_id, book_id)
    if b is None:
        raise AppError(404, "Book not found")
    b.deleted_at = utcnow_naive()
    await db.commit()
    return Response(status_code=204)


@library_router.post("/books/{book_id}/pages", status_code=201)
async def create_page(book_id: str, body: CreatePage, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    if await _owned_book(db, ctx.workspace_id, book_id) is None:
        raise AppError(404, "Book not found")
    p = Page(id=new_id(), book_id=book_id, title=body.title, sort_order=float(int(time.time() * 1000)))
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return {
        "id": p.id, "bookId": p.book_id, "title": p.title, "content": p.content,
        "sortOrder": p.sort_order, "createdAt": iso_z(p.created_at), "updatedAt": iso_z(p.updated_at),
    }


@library_router.get("/pages/{page_id}")
async def get_page(page_id: str, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    p = await _owned_page(db, ctx.workspace_id, page_id)
    if p is None:
        raise AppError(404, "Page not found")
    return {
        "id": p.id, "bookId": p.book_id, "title": p.title, "content": p.content,
        "sortOrder": p.sort_order, "createdAt": iso_z(p.created_at), "updatedAt": iso_z(p.updated_at),
    }


@library_router.patch("/pages/{page_id}")
async def patch_page(page_id: str, body: UpdatePage, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    p = await _owned_page(db, ctx.workspace_id, page_id)
    if p is None:
        raise AppError(404, "Page not found")
    data = body.model_dump(exclude_unset=True)
    if "title" in data: p.title = data["title"]
    if "content" in data: p.content = data["content"]
    await db.commit()
    await db.refresh(p)
    return {
        "id": p.id, "bookId": p.book_id, "title": p.title, "content": p.content,
        "sortOrder": p.sort_order, "createdAt": iso_z(p.created_at), "updatedAt": iso_z(p.updated_at),
    }


@library_router.delete("/pages/{page_id}", status_code=204)
async def delete_page(page_id: str, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    p = await _owned_page(db, ctx.workspace_id, page_id)
    if p is None:
        raise AppError(404, "Page not found")
    p.deleted_at = utcnow_naive()
    await db.commit()
    return Response(status_code=204)

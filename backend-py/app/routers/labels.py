import sqlalchemy as sa
from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.deps import AuthContext, require_auth
from ..db import get_db
from ..errors import AppError
from ..ids import new_id
from ..models import Label
from ..schemas import CreateLabel, UpdateLabel
from ..timeutils import iso_z

labels_router = APIRouter(prefix="/labels", dependencies=[Depends(require_auth)])


def serialize_label(l: Label) -> dict:
    return {"id": l.id, "name": l.name, "color": l.color, "createdAt": iso_z(l.created_at)}


async def _load(db: AsyncSession, lid: str, wsid: str) -> Label | None:
    return (
        await db.execute(sa.select(Label).where(Label.id == lid, Label.workspace_id == wsid))
    ).scalar_one_or_none()


@labels_router.get("")
async def list_labels(ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    rows = (
        await db.execute(
            sa.select(Label).where(Label.workspace_id == ctx.workspace_id).order_by(Label.created_at.asc())
        )
    ).scalars().all()
    return [serialize_label(l) for l in rows]


@labels_router.post("", status_code=201)
async def create_label(body: CreateLabel, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    l = Label(id=new_id(), name=body.name, color=body.color, workspace_id=ctx.workspace_id)
    db.add(l)
    await db.commit()
    await db.refresh(l)
    return serialize_label(l)


@labels_router.patch("/{lid}")
async def update_label(lid: str, body: UpdateLabel, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    l = await _load(db, lid, ctx.workspace_id)
    if l is None:
        raise AppError(404, "Not found")
    data = body.model_dump(exclude_unset=True)
    if "name" in data: l.name = data["name"]
    if "color" in data: l.color = data["color"]
    await db.commit()
    await db.refresh(l)
    return serialize_label(l)


@labels_router.delete("/{lid}", status_code=204)
async def delete_label(lid: str, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    result = await db.execute(sa.delete(Label).where(Label.id == lid, Label.workspace_id == ctx.workspace_id))
    await db.commit()
    if result.rowcount == 0:
        raise AppError(404, "Not found")
    return Response(status_code=204)

import time

import sqlalchemy as sa
from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.deps import AuthContext, require_auth
from ..db import get_db
from ..errors import AppError
from ..ids import new_id
from ..models import Wishlist, WishlistItem
from ..schemas import (
    CreateWishlist,
    CreateWishlistItem,
    UpdateWishlist,
    UpdateWishlistItem,
)
from ..timeutils import iso_z

wishlist_router = APIRouter(dependencies=[Depends(require_auth)])


async def _owned_wishlist(db: AsyncSession, wsid: str, wishlist_id: str) -> Wishlist | None:
    return (
        await db.execute(sa.select(Wishlist).where(Wishlist.id == wishlist_id, Wishlist.workspace_id == wsid))
    ).scalar_one_or_none()


async def _owned_item(db: AsyncSession, wsid: str, item_id: str) -> WishlistItem | None:
    return (
        await db.execute(
            sa.select(WishlistItem)
            .join(Wishlist, WishlistItem.wishlist_id == Wishlist.id)
            .where(WishlistItem.id == item_id, Wishlist.workspace_id == wsid)
        )
    ).scalar_one_or_none()


def _item_dict(i: WishlistItem) -> dict:
    return {
        "id": i.id,
        "wishlistId": i.wishlist_id,
        "title": i.title,
        "description": i.description,
        "price": i.price,
        "currency": i.currency,
        "status": i.status,
        "priority": i.priority,
        "targetDate": iso_z(i.target_date) if i.target_date else None,
        "sortOrder": i.sort_order,
        "createdAt": iso_z(i.created_at),
        "updatedAt": iso_z(i.updated_at),
    }


def _wishlist_dict(w: Wishlist, item_count: int) -> dict:
    return {
        "id": w.id,
        "name": w.name,
        "description": w.description,
        "category": w.category,
        "icon": w.icon,
        "color": w.color,
        "itemCount": item_count,
        "createdAt": iso_z(w.created_at),
        "updatedAt": iso_z(w.updated_at),
    }


async def _wishlist_with_items(db: AsyncSession, wishlist: Wishlist) -> dict:
    items = (
        await db.execute(
            sa.select(WishlistItem)
            .where(WishlistItem.wishlist_id == wishlist.id)
            .order_by(WishlistItem.sort_order.asc())
        )
    ).scalars().all()
    return {**_wishlist_dict(wishlist, len(items)), "items": [_item_dict(i) for i in items]}


@wishlist_router.get("/wishlists")
async def list_wishlists(ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    wishlists = (
        await db.execute(
            sa.select(Wishlist).where(Wishlist.workspace_id == ctx.workspace_id).order_by(Wishlist.updated_at.desc())
        )
    ).scalars().all()
    item_counts: dict[str, int] = {}
    if wishlists:
        rows = (
            await db.execute(
                sa.select(WishlistItem.wishlist_id, sa.func.count())
                .where(WishlistItem.wishlist_id.in_([w.id for w in wishlists]))
                .group_by(WishlistItem.wishlist_id)
            )
        ).all()
        item_counts = {wid: int(n) for wid, n in rows}
    return [_wishlist_dict(w, item_counts.get(w.id, 0)) for w in wishlists]


@wishlist_router.post("/wishlists", status_code=201)
async def create_wishlist(body: CreateWishlist, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    w = Wishlist(
        id=new_id(),
        name=body.name,
        description=body.description,
        category=body.category.value,
        icon=body.icon,
        color=body.color,
        workspace_id=ctx.workspace_id,
    )
    db.add(w)
    await db.commit()
    await db.refresh(w)
    return await _wishlist_with_items(db, w)


@wishlist_router.get("/wishlists/{wishlist_id}")
async def get_wishlist(wishlist_id: str, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    w = await _owned_wishlist(db, ctx.workspace_id, wishlist_id)
    if w is None:
        raise AppError(404, "Wishlist not found")
    return await _wishlist_with_items(db, w)


@wishlist_router.patch("/wishlists/{wishlist_id}")
async def patch_wishlist(wishlist_id: str, body: UpdateWishlist, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    w = await _owned_wishlist(db, ctx.workspace_id, wishlist_id)
    if w is None:
        raise AppError(404, "Wishlist not found")
    data = body.model_dump(exclude_unset=True)
    if "name" in data:
        w.name = data["name"]
    if "description" in data:
        w.description = data["description"]
    if "category" in data:
        w.category = data["category"].value if hasattr(data["category"], "value") else data["category"]
    if "icon" in data:
        w.icon = data["icon"]
    if "color" in data:
        w.color = data["color"]
    await db.commit()
    await db.refresh(w)
    return await _wishlist_with_items(db, w)


@wishlist_router.delete("/wishlists/{wishlist_id}", status_code=204)
async def delete_wishlist(wishlist_id: str, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    w = await _owned_wishlist(db, ctx.workspace_id, wishlist_id)
    if w is None:
        raise AppError(404, "Wishlist not found")
    await db.delete(w)
    await db.commit()
    return Response(status_code=204)


@wishlist_router.post("/wishlists/{wishlist_id}/items", status_code=201)
async def create_wishlist_item(wishlist_id: str, body: CreateWishlistItem, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    if await _owned_wishlist(db, ctx.workspace_id, wishlist_id) is None:
        raise AppError(404, "Wishlist not found")
    i = WishlistItem(
        id=new_id(),
        wishlist_id=wishlist_id,
        title=body.title,
        description=body.description,
        price=body.price,
        currency=body.currency,
        status=body.status.value,
        priority=body.priority.value,
        target_date=body.target_date,
        sort_order=float(int(time.time() * 1000)),
    )
    db.add(i)
    await db.commit()
    await db.refresh(i)
    return _item_dict(i)


@wishlist_router.get("/items/{item_id}")
async def get_wishlist_item(item_id: str, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    i = await _owned_item(db, ctx.workspace_id, item_id)
    if i is None:
        raise AppError(404, "Item not found")
    return _item_dict(i)


@wishlist_router.patch("/items/{item_id}")
async def patch_wishlist_item(item_id: str, body: UpdateWishlistItem, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    i = await _owned_item(db, ctx.workspace_id, item_id)
    if i is None:
        raise AppError(404, "Item not found")
    data = body.model_dump(exclude_unset=True)
    if "title" in data:
        i.title = data["title"]
    if "description" in data:
        i.description = data["description"]
    if "price" in data:
        i.price = data["price"]
    if "currency" in data:
        i.currency = data["currency"]
    if "status" in data:
        i.status = data["status"].value if hasattr(data["status"], "value") else data["status"]
    if "priority" in data:
        i.priority = data["priority"].value if hasattr(data["priority"], "value") else data["priority"]
    if "target_date" in data:
        i.target_date = data["target_date"]
    if "sort_order" in data:
        i.sort_order = data["sort_order"]
    await db.commit()
    await db.refresh(i)
    return _item_dict(i)


@wishlist_router.delete("/items/{item_id}", status_code=204)
async def delete_wishlist_item(item_id: str, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    i = await _owned_item(db, ctx.workspace_id, item_id)
    if i is None:
        raise AppError(404, "Item not found")
    await db.delete(i)
    await db.commit()
    return Response(status_code=204)

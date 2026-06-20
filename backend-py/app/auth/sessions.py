import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from ..ids import new_id
from ..models import Session

_THIRTY_DAYS = timedelta(days=30)


def _sha256(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()


def _utcnow() -> datetime:
    # Naive UTC: the DB columns are `timestamp without time zone` (Prisma stores UTC as naive).
    return datetime.now(timezone.utc).replace(tzinfo=None)


async def create_session(db: AsyncSession, user_id: str) -> tuple[str, datetime]:
    token = secrets.token_urlsafe(32)
    expires_at = _utcnow() + _THIRTY_DAYS
    db.add(Session(id=new_id(), token_hash=_sha256(token), user_id=user_id, expires_at=expires_at))
    await db.commit()
    return token, expires_at


async def find_session(db: AsyncSession, token: str) -> Session | None:
    row = (
        await db.execute(sa.select(Session).where(Session.token_hash == _sha256(token)))
    ).scalar_one_or_none()
    if row is None:
        return None
    if row.expires_at < _utcnow():
        await db.delete(row)
        await db.commit()
        return None
    return row


async def delete_session(db: AsyncSession, token: str) -> None:
    await db.execute(sa.delete(Session).where(Session.token_hash == _sha256(token)))
    await db.commit()


async def delete_user_sessions(db: AsyncSession, user_id: str, except_token: str | None = None) -> None:
    stmt = sa.delete(Session).where(Session.user_id == user_id)
    if except_token is not None:
        stmt = stmt.where(Session.token_hash != _sha256(except_token))
    await db.execute(stmt)
    await db.commit()

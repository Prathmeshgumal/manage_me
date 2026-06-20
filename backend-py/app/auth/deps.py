from dataclasses import dataclass

import sqlalchemy as sa
from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..errors import AppError
from ..models import Membership
from .cookies import SESSION_COOKIE
from .sessions import find_session


@dataclass
class AuthContext:
    user_id: str
    workspace_id: str


def _unauthorized() -> AppError:
    return AppError(401, "Unauthorized")


async def require_auth(request: Request, db: AsyncSession = Depends(get_db)) -> AuthContext:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise _unauthorized()
    session = await find_session(db, token)
    if session is None:
        raise _unauthorized()
    membership = (
        await db.execute(sa.select(Membership).where(Membership.user_id == session.user_id))
    ).scalars().first()
    if membership is None:
        raise _unauthorized()
    return AuthContext(user_id=session.user_id, workspace_id=membership.workspace_id)

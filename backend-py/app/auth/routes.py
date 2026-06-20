import sqlalchemy as sa
from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..errors import AppError
from ..ids import new_id
from ..models import Membership, User, Workspace
from ..schemas import ChangePasswordBody, Credentials
from .cookies import SESSION_COOKIE, clear_session_cookie, set_session_cookie
from .deps import AuthContext, require_auth
from .password import hash_password, verify_password
from .sessions import create_session, delete_session, delete_user_sessions

auth_router = APIRouter(prefix="/auth")


def _public_user(u: User) -> dict:
    return {"id": u.id, "email": u.email}


@auth_router.post("/signup", status_code=201)
async def signup(body: Credentials, response: Response, db: AsyncSession = Depends(get_db)):
    email = body.email.lower()
    exists = (await db.execute(sa.select(User).where(User.email == email))).scalar_one_or_none()
    if exists is not None:
        raise AppError(409, "Email already registered")
    user = User(id=new_id(), email=email, password_hash=hash_password(body.password))
    workspace = Workspace(id=new_id())
    db.add_all([user, workspace])
    await db.flush()  # ensure User/Workspace exist before the Membership FK
    db.add(Membership(id=new_id(), user_id=user.id, workspace_id=workspace.id, role="OWNER"))
    await db.commit()
    token, expires = await create_session(db, user.id)
    set_session_cookie(response, token, expires)
    return {"user": _public_user(user)}


@auth_router.post("/login")
async def login(body: Credentials, response: Response, db: AsyncSession = Depends(get_db)):
    user = (await db.execute(sa.select(User).where(User.email == body.email.lower()))).scalar_one_or_none()
    if user is None or not verify_password(body.password, user.password_hash):
        raise AppError(401, "Invalid email or password")
    token, expires = await create_session(db, user.id)
    set_session_cookie(response, token, expires)
    return {"user": _public_user(user)}


@auth_router.get("/me")
async def me(ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    user = (await db.execute(sa.select(User).where(User.id == ctx.user_id))).scalar_one_or_none()
    if user is None:
        raise AppError(401, "Unauthorized")
    return {"user": _public_user(user)}


@auth_router.post("/logout", status_code=204)
async def logout(request: Request, _ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        await delete_session(db, token)
    resp = Response(status_code=204)
    clear_session_cookie(resp)
    return resp


@auth_router.post("/change-password", status_code=204)
async def change_password(
    body: ChangePasswordBody,
    request: Request,
    ctx: AuthContext = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    user = (await db.execute(sa.select(User).where(User.id == ctx.user_id))).scalar_one_or_none()
    if user is None or not verify_password(body.current_password, user.password_hash):
        raise AppError(400, "Current password is incorrect")
    user.password_hash = hash_password(body.new_password)
    await db.commit()
    await delete_user_sessions(db, user.id, request.cookies.get(SESSION_COOKIE))
    return Response(status_code=204)

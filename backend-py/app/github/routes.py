from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.deps import AuthContext, require_auth
from ..db import get_db
from ..errors import AppError
from .app_auth import get_installation
from .config import github_config
from .contents import get_repo_contents
from .contributions import fetch_contributions
from .crypto import sign_state, verify_state
from .oauth import authorize_url, exchange_code, get_authed_user
from .repos import list_repositories
from .store import (
    delete_user_token, get_user_token, list_installations, save_installation, save_user_token,
)

github_router = APIRouter(prefix="/github", dependencies=[Depends(require_auth)])


@github_router.get("/status")
async def status(ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    user = await get_user_token(db, ctx.workspace_id)
    return {
        "user": {"login": user["login"], "avatarUrl": user["avatarUrl"]} if user else None,
        "installations": await list_installations(db, ctx.workspace_id),
    }


@github_router.get("/authorize")
async def authorize(_ctx: AuthContext = Depends(require_auth)):
    return RedirectResponse(authorize_url(sign_state()), status_code=302)


@github_router.get("/callback")
async def callback(
    code: str = "", state: str = "",
    ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db),
):
    back = f"{github_config().frontend_url}/settings/github"
    if not verify_state(state):
        return RedirectResponse(f"{back}?error=state", status_code=302)
    if not code:
        return RedirectResponse(f"{back}?error=code", status_code=302)
    tok = await exchange_code(code)
    user = await get_authed_user(tok["accessToken"])
    await save_user_token(
        db, workspace_id=ctx.workspace_id, github_user_id=user["id"], login=user["login"],
        avatar_url=user["avatarUrl"], access_token=tok["accessToken"], scope=tok["scope"],
    )
    return RedirectResponse(f"{back}?connected=1", status_code=302)


@github_router.get("/install")
async def install(_ctx: AuthContext = Depends(require_auth)):
    return RedirectResponse(
        f"https://github.com/apps/{github_config().slug}/installations/new", status_code=302
    )


@github_router.get("/setup")
async def setup(
    installation_id: int = Query(0, alias="installation_id"),
    ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db),
):
    back = f"{github_config().frontend_url}/settings/github"
    if not installation_id:
        return RedirectResponse(f"{back}?error=install", status_code=302)
    meta = await get_installation(installation_id)
    await save_installation(
        db, workspace_id=ctx.workspace_id, installation_id=meta["installationId"],
        account_login=meta["accountLogin"], account_type=meta["accountType"],
        repository_selection=meta["repositorySelection"],
    )
    return RedirectResponse(f"{back}?installed=1", status_code=302)


@github_router.get("/repositories")
async def repositories(ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    return await list_repositories(db, ctx.workspace_id)


@github_router.get("/repos/contents")
async def repo_contents(
    installationId: int = Query(...), owner: str = Query(..., min_length=1),
    repo: str = Query(..., min_length=1), path: str = Query(""),
    _ctx: AuthContext = Depends(require_auth),
):
    return await get_repo_contents(installationId, owner, repo, path)


@github_router.get("/contributions")
async def contributions(ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    user = await get_user_token(db, ctx.workspace_id)
    if user is None:
        raise AppError(409, "GitHub not connected")
    return await fetch_contributions(user["accessToken"])


@github_router.post("/disconnect", status_code=204)
async def disconnect(ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    await delete_user_token(db, ctx.workspace_id)
    return Response(status_code=204)

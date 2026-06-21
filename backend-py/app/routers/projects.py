import sqlalchemy as sa
from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.deps import AuthContext, require_auth
from ..db import get_db
from ..errors import AppError
from ..ids import new_id
from ..models import Project, Task
from ..projectkeys import generate_project_key, normalize_key
from ..schemas import CreateProject, UpdateProject
from ..timeutils import iso_z, utcnow_naive

projects_router = APIRouter(prefix="/projects", dependencies=[Depends(require_auth)])


async def _taken_keys(db: AsyncSession, wsid: str, exclude_id: str | None = None) -> set[str]:
    stmt = sa.select(Project.key).where(Project.workspace_id == wsid, Project.deleted_at.is_(None))
    if exclude_id is not None:
        stmt = stmt.where(Project.id != exclude_id)
    return {k for k in (await db.execute(stmt)).scalars().all()}


def serialize_project(p: Project) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "key": p.key,
        "color": p.color,
        "githubRepoId": p.github_repo_id,
        "githubRepoFullName": p.github_repo_full_name,
        "githubInstallationId": p.github_installation_id,
        "createdAt": iso_z(p.created_at),
        "updatedAt": iso_z(p.updated_at),
    }


async def _load(db: AsyncSession, pid: str, wsid: str) -> Project | None:
    return (
        await db.execute(
            sa.select(Project).where(
                Project.id == pid, Project.workspace_id == wsid, Project.deleted_at.is_(None)
            )
        )
    ).scalar_one_or_none()


@projects_router.get("")
async def list_projects(ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    rows = (
        await db.execute(
            sa.select(Project)
            .where(Project.workspace_id == ctx.workspace_id, Project.deleted_at.is_(None))
            .order_by(Project.created_at.asc())
        )
    ).scalars().all()
    return [serialize_project(p) for p in rows]


@projects_router.post("", status_code=201)
async def create_project(body: CreateProject, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    taken = await _taken_keys(db, ctx.workspace_id)
    if body.key:
        key = normalize_key(body.key)
        if key in taken:
            raise AppError(400, "Project key already in use")
    else:
        key = generate_project_key(body.name, taken)
    p = Project(
        id=new_id(), name=body.name, key=key, color=body.color,
        github_repo_id=body.github_repo_id, github_repo_full_name=body.github_repo_full_name,
        github_installation_id=body.github_installation_id, workspace_id=ctx.workspace_id,
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return serialize_project(p)


@projects_router.patch("/{pid}")
async def update_project(pid: str, body: UpdateProject, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    p = await _load(db, pid, ctx.workspace_id)
    if p is None:
        raise AppError(404, "Not found")
    data = body.model_dump(exclude_unset=True)
    if "name" in data: p.name = data["name"]
    if data.get("key"):
        key = normalize_key(data["key"])
        if key != p.key and key in await _taken_keys(db, ctx.workspace_id, exclude_id=pid):
            raise AppError(400, "Project key already in use")
        p.key = key
    if "color" in data: p.color = data["color"]
    if "github_repo_id" in data: p.github_repo_id = data["github_repo_id"]
    if "github_repo_full_name" in data: p.github_repo_full_name = data["github_repo_full_name"]
    if "github_installation_id" in data: p.github_installation_id = data["github_installation_id"]
    await db.commit()
    await db.refresh(p)
    return serialize_project(p)


@projects_router.delete("/{pid}", status_code=204)
async def delete_project(pid: str, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    p = await _load(db, pid, ctx.workspace_id)
    if p is None:
        raise AppError(404, "Not found")
    now = utcnow_naive()
    # Soft-delete the project and tag its still-active tasks so a restore brings back
    # exactly those. The shelf/books/pages are intentionally left untouched.
    await db.execute(
        sa.update(Task)
        .where(Task.project_id == pid, Task.workspace_id == ctx.workspace_id, Task.deleted_at.is_(None))
        .values(deleted_at=now, deleted_with_project=True)
    )
    p.deleted_at = now
    await db.commit()
    return Response(status_code=204)

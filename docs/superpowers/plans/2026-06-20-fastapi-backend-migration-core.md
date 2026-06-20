# FastAPI Backend Migration — Phase 1 (Core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reimplement the core MySchedule backend (auth/sessions, tasks, projects, labels, library) in FastAPI with byte-for-byte API parity so the React frontend needs zero changes.

**Architecture:** A new `backend-py/` FastAPI app (async) runs alongside the existing TS `backend/` (untouched). SQLAlchemy 2.0 async models map onto the **existing** Postgres tables Prisma created; Alembic is baselined from a `pg_dump` of the live schema. Pydantic v2 validates requests; responses are hand-built dicts matching `frontend/src/types.ts` exactly. Auth replicates the TS scheme precisely (scrypt passwords, SHA-256-hashed opaque session tokens in a `sid` httpOnly cookie).

**Tech Stack:** Python 3.12, FastAPI, Uvicorn/Gunicorn, SQLAlchemy 2.0 (async) + asyncpg, Alembic, Pydantic v2 + pydantic-settings, cuid2, pytest + pytest-asyncio + httpx, uv.

## Global Constraints

- **API parity is non-negotiable.** Paths, methods, status codes, JSON keys (camelCase), and error bodies must match the TS backend. The frontend does not change.
- **Error body shape:** `{"error": {"message": "<msg>", "details": <optional>}}`. Validation → 400 with message `"Validation failed"`. Unauthorized → 401 message `"Unauthorized"`. Not found → 404 message `"Not found"` (library uses `"Shelf not found"` / `"Book not found"` / `"Page not found"` / `"Project not found"`). Duplicate signup → 409 `"Email already registered"`. Bad login → 401 `"Invalid email or password"`. Wrong current password → 400 `"Current password is incorrect"`.
- **Cookie:** name `sid`; `httponly=True`, `path="/"`; prod → `secure=True, samesite="none"`; dev → `secure=False, samesite="lax"`; 30-day life.
- **Passwords:** scrypt, format `saltHex:hashHex`, params `n=16384, r=8, p=1, dklen=64`, 16-byte salt — identical to Node `scryptSync` defaults so existing hashes verify.
- **DB reuse:** existing tables/columns/enums unchanged. Table names quoted PascalCase (`"Task"`…); columns camelCase (`workspaceId`, `createdAt`…); enums `Status`/`Priority`/`Role` (`create_type=False`); join table `"_LabelToTask"` (`A`→Label.id, `B`→Task.id). New row IDs via cuid2.
- **PATCH semantics:** apply only fields present in the request (`model_dump(exclude_unset=True)`), so `null` clears a nullable field and an omitted field is left unchanged — matching Zod `.partial()` + `.nullish()`.
- **No prod changes in Phase 1.** Local only. GitHub integration is out of scope (Phase 2).
- **Branch:** all work on `feat/fastapi-backend-migration`. Frequent commits, one per task.

---

## File Structure

```
backend-py/
  pyproject.toml            # uv-managed deps + pytest config
  .env                      # local: DATABASE_URL -> local Postgres, APP_ENV=development
  .env.example
  .gitignore
  alembic.ini
  alembic/
    env.py                  # async env, target_metadata = Base.metadata
    baseline.sql            # pg_dump of live schema (committed)
    versions/0001_baseline.py
  app/
    __init__.py
    config.py               # Settings (pydantic-settings)
    db.py                   # async engine + get_db dependency + Base
    ids.py                  # new_id() -> cuid2
    errors.py               # AppError + exception handlers
    enums.py                # StatusEnum, PriorityEnum
    schemas.py              # CamelModel + request models
    models.py               # SQLAlchemy ORM models
    main.py                 # FastAPI app, CORS, handlers, router mounting, /health
    auth/
      __init__.py
      password.py           # hash_password / verify_password (scrypt)
      sessions.py           # create/find/delete sessions
      cookies.py            # set/clear sid cookie
      deps.py               # require_auth dependency
      routes.py             # /auth/*
    routers/
      __init__.py
      tasks.py
      projects.py
      labels.py
      library.py
  tests/
    __init__.py
    conftest.py             # test DB bootstrap + truncation + AsyncClient + auth helper
    test_health.py
    test_password.py
    test_auth.py
    test_tasks.py
    test_projects.py
    test_labels.py
    test_library.py
    test_isolation.py
```

---

### Task 1: Scaffold, config, app skeleton, health, test harness

**Files:**
- Create: `backend-py/pyproject.toml`, `backend-py/.env`, `backend-py/.env.example`, `backend-py/.gitignore`
- Create: `backend-py/app/__init__.py`, `backend-py/app/config.py`, `backend-py/app/main.py`
- Create: `backend-py/tests/__init__.py`, `backend-py/tests/conftest.py`, `backend-py/tests/test_health.py`

**Interfaces:**
- Produces: `get_settings() -> Settings` with `.async_database_url: str`, `.is_prod: bool`, `.frontend_url: str | None`, `.port: int`; `create_app() -> FastAPI`; pytest fixtures `client` (httpx.AsyncClient) and (later) `auth_client`.

- [ ] **Step 1: Initialize the project with uv and add deps**

Run from repo root:
```bash
cd backend-py 2>/dev/null || mkdir backend-py && cd backend-py
uv init --python 3.12 --no-workspace .
uv add fastapi "uvicorn[standard]" gunicorn "sqlalchemy[asyncio]>=2.0" asyncpg alembic "pydantic>=2" pydantic-settings cuid2
uv add --dev pytest pytest-asyncio httpx
```
Expected: a `.venv/`, `pyproject.toml`, and `uv.lock` are created.

- [ ] **Step 2: Configure pytest in `pyproject.toml`**

Append:
```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

- [ ] **Step 3: Write `.gitignore`, `.env`, `.env.example`**

`backend-py/.gitignore`:
```
.venv/
__pycache__/
*.pyc
.env
.pytest_cache/
```
`backend-py/.env`:
```
DATABASE_URL=postgresql://myschedule:myschedule@localhost:5432/myschedule_dev
APP_ENV=development
PORT=4000
```
`backend-py/.env.example`:
```
DATABASE_URL=postgresql://myschedule:myschedule@localhost:5432/myschedule_dev
APP_ENV=development
PORT=4000
# FRONTEND_URL=https://your-frontend.example   # required only when APP_ENV=production
```

- [ ] **Step 4: Write `app/config.py`**

```python
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    app_env: str = "development"
    frontend_url: str | None = None
    port: int = 4000

    @property
    def is_prod(self) -> bool:
        return self.app_env == "production"

    @property
    def async_database_url(self) -> str:
        url = self.database_url
        # asyncpg does not accept the libpq `pgbouncer` query param.
        url = url.replace("?pgbouncer=true", "").replace("&pgbouncer=true", "")
        if url.startswith("postgresql+asyncpg://"):
            return url
        if url.startswith("postgresql://"):
            return "postgresql+asyncpg://" + url[len("postgresql://"):]
        if url.startswith("postgres://"):
            return "postgresql+asyncpg://" + url[len("postgres://"):]
        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 5: Write minimal `app/main.py` (health only for now)**

```python
from fastapi import FastAPI


def create_app() -> FastAPI:
    app = FastAPI(title="MySchedule API")

    @app.get("/health")
    async def health() -> dict[str, bool]:
        return {"ok": True}

    return app


app = create_app()
```

- [ ] **Step 6: Write `tests/conftest.py` (DB bootstrap + client)**

```python
import os

# Point the app at a dedicated local test database BEFORE app imports.
TEST_DB_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql://myschedule:myschedule@localhost:5432/myschedule_test",
)
os.environ["DATABASE_URL"] = TEST_DB_URL
os.environ["APP_ENV"] = "development"

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.config import get_settings
from app.main import app

get_settings.cache_clear()  # ensure the test DATABASE_URL is picked up


@pytest_asyncio.fixture
async def client() -> AsyncClient:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
```

- [ ] **Step 7: Write `tests/test_health.py`**

```python
import pytest


@pytest.mark.asyncio
async def test_health_ok(client):
    res = await client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"ok": True}
```

- [ ] **Step 8: Run the test**

Run: `cd backend-py && uv run pytest tests/test_health.py -v`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add backend-py
git commit -m "feat(backend-py): scaffold FastAPI app, config, health, test harness"
```

---

### Task 2: SQLAlchemy models + Alembic baseline + DB session

**Files:**
- Create: `backend-py/app/db.py`, `backend-py/app/ids.py`, `backend-py/app/enums.py`, `backend-py/app/models.py`
- Create: `backend-py/alembic.ini`, `backend-py/alembic/env.py`, `backend-py/alembic/baseline.sql`, `backend-py/alembic/versions/0001_baseline.py`
- Modify: `backend-py/tests/conftest.py` (apply schema + truncate between tests)
- Create: `backend-py/tests/test_models.py`

**Interfaces:**
- Produces: `Base`; async `engine`; `get_db() -> AsyncSession`; `new_id() -> str`; ORM models `User, Workspace, Membership, Session, Project, Label, Task, Shelf, Book, Page` (Python attrs snake_case; columns mapped to camelCase); `StatusEnum`, `PriorityEnum`.

- [ ] **Step 1: Write `app/ids.py`**

```python
from cuid2 import Cuid

_generator = Cuid()


def new_id() -> str:
    return _generator.generate()
```

- [ ] **Step 2: Write `app/enums.py`**

```python
from enum import Enum


class StatusEnum(str, Enum):
    BACKLOG = "BACKLOG"
    TODO = "TODO"
    IN_PROGRESS = "IN_PROGRESS"
    DONE = "DONE"
    CANCELED = "CANCELED"


class PriorityEnum(str, Enum):
    NONE = "NONE"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"
```

- [ ] **Step 3: Write `app/db.py`**

```python
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from .config import get_settings


class Base(DeclarativeBase):
    pass


engine = create_async_engine(get_settings().async_database_url, pool_pre_ping=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session
```

- [ ] **Step 4: Write `app/models.py`**

```python
from datetime import datetime

from sqlalchemy import Column, Float, ForeignKey, Table, func
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base
from .ids import new_id

STATUS = ENUM("BACKLOG", "TODO", "IN_PROGRESS", "DONE", "CANCELED", name="Status", create_type=False)
PRIORITY = ENUM("NONE", "LOW", "MEDIUM", "HIGH", "URGENT", name="Priority", create_type=False)
ROLE = ENUM("OWNER", "MEMBER", "VIEWER", name="Role", create_type=False)

label_task = Table(
    "_LabelToTask",
    Base.metadata,
    Column("A", ForeignKey("Label.id", ondelete="CASCADE"), primary_key=True),  # Label
    Column("B", ForeignKey("Task.id", ondelete="CASCADE"), primary_key=True),   # Task
)


class User(Base):
    __tablename__ = "User"
    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(unique=True)
    password_hash: Mapped[str] = mapped_column("passwordHash")
    created_at: Mapped[datetime] = mapped_column("createdAt", server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column("updatedAt", server_default=func.now(), onupdate=func.now())


class Workspace(Base):
    __tablename__ = "Workspace"
    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(default="My Workspace")
    created_at: Mapped[datetime] = mapped_column("createdAt", server_default=func.now())


class Membership(Base):
    __tablename__ = "Membership"
    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column("userId", ForeignKey("User.id", ondelete="CASCADE"))
    workspace_id: Mapped[str] = mapped_column("workspaceId", ForeignKey("Workspace.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(ROLE, default="OWNER")
    created_at: Mapped[datetime] = mapped_column("createdAt", server_default=func.now())


class Session(Base):
    __tablename__ = "Session"
    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    token_hash: Mapped[str] = mapped_column("tokenHash", unique=True)
    user_id: Mapped[str] = mapped_column("userId", ForeignKey("User.id", ondelete="CASCADE"))
    expires_at: Mapped[datetime] = mapped_column("expiresAt")
    created_at: Mapped[datetime] = mapped_column("createdAt", server_default=func.now())


class Project(Base):
    __tablename__ = "Project"
    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    name: Mapped[str]
    color: Mapped[str] = mapped_column(default="#8A8A86")
    github_repo_id: Mapped[int | None] = mapped_column("githubRepoId")
    github_repo_full_name: Mapped[str | None] = mapped_column("githubRepoFullName")
    github_installation_id: Mapped[int | None] = mapped_column("githubInstallationId")
    workspace_id: Mapped[str] = mapped_column("workspaceId", ForeignKey("Workspace.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column("createdAt", server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column("updatedAt", server_default=func.now(), onupdate=func.now())


class Label(Base):
    __tablename__ = "Label"
    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    name: Mapped[str]
    color: Mapped[str] = mapped_column(default="#8A8A86")
    workspace_id: Mapped[str] = mapped_column("workspaceId", ForeignKey("Workspace.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column("createdAt", server_default=func.now())


class Task(Base):
    __tablename__ = "Task"
    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    title: Mapped[str]
    description: Mapped[str | None]
    status: Mapped[str] = mapped_column(STATUS, default="BACKLOG")
    priority: Mapped[str] = mapped_column(PRIORITY, default="NONE")
    due_date: Mapped[datetime | None] = mapped_column("dueDate")
    sort_order: Mapped[float] = mapped_column("sortOrder", Float, default=0)
    project_id: Mapped[str | None] = mapped_column("projectId", ForeignKey("Project.id", ondelete="SET NULL"))
    workspace_id: Mapped[str] = mapped_column("workspaceId", ForeignKey("Workspace.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column("createdAt", server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column("updatedAt", server_default=func.now(), onupdate=func.now())
    labels: Mapped[list[Label]] = relationship(secondary=label_task, lazy="selectin")


class Shelf(Base):
    __tablename__ = "Shelf"
    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    project_id: Mapped[str | None] = mapped_column("projectId", ForeignKey("Project.id", ondelete="CASCADE"), unique=True)
    name: Mapped[str] = mapped_column(default="Library")
    description: Mapped[str | None]
    workspace_id: Mapped[str] = mapped_column("workspaceId", ForeignKey("Workspace.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column("createdAt", server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column("updatedAt", server_default=func.now(), onupdate=func.now())


class Book(Base):
    __tablename__ = "Book"
    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    shelf_id: Mapped[str] = mapped_column("shelfId", ForeignKey("Shelf.id", ondelete="CASCADE"))
    name: Mapped[str]
    description: Mapped[str | None]
    color: Mapped[str] = mapped_column(default="#8A8A86")
    sort_order: Mapped[float] = mapped_column("sortOrder", Float, default=0)
    created_at: Mapped[datetime] = mapped_column("createdAt", server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column("updatedAt", server_default=func.now(), onupdate=func.now())


class Page(Base):
    __tablename__ = "Page"
    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    book_id: Mapped[str] = mapped_column("bookId", ForeignKey("Book.id", ondelete="CASCADE"))
    title: Mapped[str]
    content: Mapped[str] = mapped_column(default="")
    sort_order: Mapped[float] = mapped_column("sortOrder", Float, default=0)
    created_at: Mapped[datetime] = mapped_column("createdAt", server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column("updatedAt", server_default=func.now(), onupdate=func.now())
```

- [ ] **Step 5: Capture the live schema as the Alembic baseline**

Run (uses the existing dev DB as the source of truth for exact DDL):
```bash
cd backend-py
PGPASSWORD=myschedule pg_dump -h localhost -U myschedule -d myschedule_dev \
  --schema-only --no-owner --no-privileges --no-comments \
  --exclude-table=_prisma_migrations \
  > alembic/baseline.sql
```
Expected: `alembic/baseline.sql` contains `CREATE TYPE`, `CREATE TABLE`, indexes, and FKs for all app tables.

- [ ] **Step 6: Create `alembic.ini` and async `alembic/env.py`**

Run: `cd backend-py && uv run alembic init -t async alembic` (creates `alembic.ini` + `alembic/env.py`), then replace `alembic/env.py` with:
```python
import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import get_settings
from app.db import Base
import app.models  # noqa: F401  (register tables on Base.metadata)

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations():
    engine = create_async_engine(get_settings().async_database_url)
    async with engine.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await engine.dispose()


def run_migrations_online():
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    raise SystemExit("offline mode not supported")
run_migrations_online()
```

- [ ] **Step 7: Write the baseline migration `alembic/versions/0001_baseline.py`**

```python
"""baseline schema (from pg_dump of the Prisma-managed DB)

Revision ID: 0001_baseline
Revises:
Create Date: 2026-06-20
"""
from pathlib import Path

from alembic import op

revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None

_SQL = (Path(__file__).resolve().parents[1] / "baseline.sql").read_text()


def upgrade() -> None:
    op.execute(_SQL)


def downgrade() -> None:
    op.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
```

- [ ] **Step 8: Create the test DB and stamp the existing dev DB**

```bash
# one-time: create the dedicated test database (myschedule role has CREATEDB)
PGPASSWORD=myschedule createdb -h localhost -U myschedule myschedule_test
# mark the EXISTING dev DB as already at baseline so Alembic never re-runs it there
cd backend-py && DATABASE_URL=postgresql://myschedule:myschedule@localhost:5432/myschedule_dev uv run alembic stamp head
```
Expected: `createdb` succeeds; `alembic stamp` prints `Running stamp_revision -> 0001_baseline`.

- [ ] **Step 9: Update `tests/conftest.py` to migrate + truncate**

Add below the existing imports/fixtures:
```python
import subprocess

import pytest
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import get_settings

_TABLES = [
    '"_LabelToTask"', '"Page"', '"Book"', '"Shelf"', '"Task"', '"Label"',
    '"Project"', '"Session"', '"Membership"', '"Workspace"', '"User"',
]


@pytest.fixture(scope="session", autouse=True)
def _migrate_test_db():
    # Apply the baseline schema to the fresh test DB once per session.
    subprocess.run(["uv", "run", "alembic", "upgrade", "head"], check=True, cwd=".")


@pytest_asyncio.fixture(autouse=True)
async def _truncate():
    yield
    eng = create_async_engine(get_settings().async_database_url)
    async with eng.begin() as conn:
        await conn.execute(sa.text(f"TRUNCATE TABLE {', '.join(_TABLES)} RESTART IDENTITY CASCADE"))
    await eng.dispose()
```

- [ ] **Step 10: Write `tests/test_models.py`**

```python
import pytest
import sqlalchemy as sa

from app.db import SessionLocal
from app.ids import new_id
from app.models import User, Workspace


@pytest.mark.asyncio
async def test_can_insert_and_read_user():
    async with SessionLocal() as s:
        ws = Workspace(id=new_id())
        u = User(id=new_id(), email="a@b.com", password_hash="x:y")
        s.add_all([ws, u])
        await s.commit()
        found = (await s.execute(sa.select(User).where(User.email == "a@b.com"))).scalar_one()
        assert found.id == u.id
        assert found.created_at is not None
```

- [ ] **Step 11: Run tests**

Run: `cd backend-py && uv run pytest tests/test_models.py -v`
Expected: PASS (schema applied to test DB, insert/read works).

- [ ] **Step 12: Commit**

```bash
git add backend-py
git commit -m "feat(backend-py): SQLAlchemy models + Alembic baseline from live schema"
```

---

### Task 3: Error handling + request schemas (camelCase, validation→400)

**Files:**
- Create: `backend-py/app/errors.py`, `backend-py/app/schemas.py`
- Modify: `backend-py/app/main.py` (register handlers)
- Create: `backend-py/tests/test_errors.py`

**Interfaces:**
- Produces: `AppError(status: int, message: str, details=None)`; `install_error_handlers(app)`; request models `Credentials, ChangePasswordBody, CreateTask, UpdateTask, TaskFilter, CreateProject, UpdateProject, CreateLabel, UpdateLabel, UpdateShelf, CreateBook, UpdateBook, CreatePage, UpdatePage`; base `CamelModel`.

- [ ] **Step 1: Write `app/errors.py`**

```python
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class AppError(Exception):
    def __init__(self, status: int, message: str, details=None):
        self.status = status
        self.message = message
        self.details = details


def _body(message: str, details=None) -> dict:
    inner: dict = {"message": message}
    if details is not None:
        inner["details"] = details
    return {"error": inner}


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_req: Request, exc: AppError):
        return JSONResponse(status_code=exc.status, content=_body(exc.message, exc.details))

    @app.exception_handler(RequestValidationError)
    async def _validation(_req: Request, exc: RequestValidationError):
        return JSONResponse(status_code=400, content=_body("Validation failed", exc.errors()))
```

- [ ] **Step 2: Write `app/schemas.py`**

```python
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from .enums import PriorityEnum, StatusEnum

HEX = r"^#([0-9a-fA-F]{6})$"


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Credentials(CamelModel):
    email: str = Field(max_length=320)
    password: str = Field(min_length=8, max_length=200)


class ChangePasswordBody(CamelModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=200)


class CreateTask(CamelModel):
    title: str = Field(min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=20000)
    status: StatusEnum = StatusEnum.BACKLOG
    priority: PriorityEnum = PriorityEnum.NONE
    due_date: datetime | None = None
    project_id: str | None = None
    label_ids: list[str] | None = None


class UpdateTask(CamelModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=20000)
    status: StatusEnum | None = None
    priority: PriorityEnum | None = None
    due_date: datetime | None = None
    project_id: str | None = None
    sort_order: float | None = None
    label_ids: list[str] | None = None


class TaskFilter(CamelModel):
    status: StatusEnum | None = None
    priority: PriorityEnum | None = None
    project_id: str | None = None
    label_id: str | None = None


class CreateProject(CamelModel):
    name: str = Field(min_length=1, max_length=200)
    color: str = Field(default="#8A8A86", pattern=HEX)
    github_repo_id: int | None = None
    github_repo_full_name: str | None = None
    github_installation_id: int | None = None


class UpdateProject(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    color: str | None = Field(default=None, pattern=HEX)
    github_repo_id: int | None = None
    github_repo_full_name: str | None = None
    github_installation_id: int | None = None


class CreateLabel(CamelModel):
    name: str = Field(min_length=1, max_length=100)
    color: str = Field(default="#8A8A86", pattern=HEX)


class UpdateLabel(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    color: str | None = Field(default=None, pattern=HEX)


class UpdateShelf(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)


class CreateBook(CamelModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    color: str = Field(default="#8A8A86", pattern=HEX)


class UpdateBook(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    color: str | None = Field(default=None, pattern=HEX)


class CreatePage(CamelModel):
    title: str = Field(min_length=1, max_length=300)


class UpdatePage(CamelModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    content: str | None = Field(default=None, max_length=500000)
```

- [ ] **Step 3: Register handlers in `app/main.py`**

Replace `create_app` so it calls `install_error_handlers(app)` before returning:
```python
from fastapi import FastAPI

from .errors import install_error_handlers


def create_app() -> FastAPI:
    app = FastAPI(title="MySchedule API")
    install_error_handlers(app)

    @app.get("/health")
    async def health() -> dict[str, bool]:
        return {"ok": True}

    return app


app = create_app()
```

- [ ] **Step 4: Write `tests/test_errors.py`**

This needs a route that validates a body; add a temporary check via the auth signup route is premature, so test the validation handler through a tiny inline route is overkill. Instead assert the schema + handler indirectly in Task 7. For now, unit-test `AppError` body building is trivial; skip a dedicated test file and rely on auth tests. **Delete this step's test file plan** — covered by Task 7. (No file created.)

- [ ] **Step 5: Run existing tests to ensure nothing broke**

Run: `cd backend-py && uv run pytest -v`
Expected: health + models tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend-py
git commit -m "feat(backend-py): error handlers + Pydantic request schemas"
```

---

### Task 4: Password hashing (scrypt, Node-compatible)

**Files:**
- Create: `backend-py/app/auth/__init__.py`, `backend-py/app/auth/password.py`
- Create: `backend-py/tests/test_password.py`

**Interfaces:**
- Produces: `hash_password(plain: str) -> str` (`"saltHex:hashHex"`), `verify_password(plain: str, stored: str) -> bool`.

- [ ] **Step 1: Write the failing cross-compatibility test `tests/test_password.py`**

The stored hash below was generated by the Node backend for password `"password1"` (the seeded demo user). It MUST verify in Python.
```python
from app.auth.password import hash_password, verify_password

NODE_HASH = (
    "1d1890879305febef3f8471a3bc2fff6:"
    "504a6639f2c294478c46a0e2197c7c167094c27517f24f7c57631e32b2529ca2"
    "a05b2c66f42f26ed652638c08dbb4dd150b5817350e66bfdee5578c876d09834"
)


def test_verifies_node_generated_hash():
    assert verify_password("password1", NODE_HASH) is True


def test_rejects_wrong_password():
    assert verify_password("wrongpassword", NODE_HASH) is False


def test_roundtrip():
    h = hash_password("hunter2hunter2")
    assert verify_password("hunter2hunter2", h) is True
    assert verify_password("nope", h) is False


def test_malformed_returns_false():
    assert verify_password("x", "notahash") is False
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend-py && uv run pytest tests/test_password.py -v`
Expected: FAIL (`ModuleNotFoundError: app.auth.password`).

- [ ] **Step 3: Write `app/auth/__init__.py` (empty) and `app/auth/password.py`**

```python
import hashlib
import hmac
import secrets

_KEYLEN = 64
_N = 16384
_R = 8
_P = 1
_MAXMEM = 64 * 1024 * 1024  # high enough for n=16384,r=8; output is independent of this bound


def _scrypt(plain: str, salt: bytes) -> bytes:
    return hashlib.scrypt(plain.encode(), salt=salt, n=_N, r=_R, p=_P, dklen=_KEYLEN, maxmem=_MAXMEM)


def hash_password(plain: str) -> str:
    salt = secrets.token_bytes(16)
    return f"{salt.hex()}:{_scrypt(plain, salt).hex()}"


def verify_password(plain: str, stored: str) -> bool:
    salt_hex, _, hash_hex = stored.partition(":")
    if not salt_hex or not hash_hex:
        return False
    try:
        expected = bytes.fromhex(hash_hex)
        actual = _scrypt(plain, bytes.fromhex(salt_hex))
    except ValueError:
        return False
    return hmac.compare_digest(expected, actual)
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend-py && uv run pytest tests/test_password.py -v`
Expected: PASS — including `test_verifies_node_generated_hash` (proves Node↔Python scrypt parity).

- [ ] **Step 5: Commit**

```bash
git add backend-py
git commit -m "feat(backend-py): Node-compatible scrypt password hashing"
```

---

### Task 5: Sessions + cookies

**Files:**
- Create: `backend-py/app/auth/sessions.py`, `backend-py/app/auth/cookies.py`
- Create: `backend-py/tests/test_sessions.py`

**Interfaces:**
- Consumes: `AsyncSession` from `app.db`, `Session` model.
- Produces: `create_session(db, user_id) -> tuple[str, datetime]`; `find_session(db, token) -> Session | None`; `delete_session(db, token)`; `delete_user_sessions(db, user_id, except_token=None)`; `SESSION_COOKIE = "sid"`; `set_session_cookie(response, token, expires_at)`; `clear_session_cookie(response)`.

- [ ] **Step 1: Write the failing test `tests/test_sessions.py`**

```python
import pytest

from app.auth.sessions import create_session, delete_session, find_session
from app.db import SessionLocal
from app.ids import new_id
from app.models import User, Workspace


async def _make_user() -> str:
    async with SessionLocal() as s:
        uid = new_id()
        s.add_all([Workspace(id=new_id()), User(id=uid, email=f"{uid}@x.com", password_hash="a:b")])
        await s.commit()
        return uid


@pytest.mark.asyncio
async def test_create_and_find_session():
    uid = await _make_user()
    async with SessionLocal() as db:
        token, expires = await create_session(db, uid)
        assert token and expires
        found = await find_session(db, token)
        assert found is not None and found.user_id == uid


@pytest.mark.asyncio
async def test_delete_session():
    uid = await _make_user()
    async with SessionLocal() as db:
        token, _ = await create_session(db, uid)
        await delete_session(db, token)
        assert await find_session(db, token) is None


@pytest.mark.asyncio
async def test_unknown_token_is_none():
    async with SessionLocal() as db:
        assert await find_session(db, "nope") is None
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend-py && uv run pytest tests/test_sessions.py -v`
Expected: FAIL (module missing).

- [ ] **Step 3: Write `app/auth/sessions.py`**

```python
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


async def create_session(db: AsyncSession, user_id: str) -> tuple[str, datetime]:
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + _THIRTY_DAYS
    db.add(Session(id=new_id(), token_hash=_sha256(token), user_id=user_id, expires_at=expires_at))
    await db.commit()
    return token, expires_at


async def find_session(db: AsyncSession, token: str) -> Session | None:
    row = (await db.execute(sa.select(Session).where(Session.token_hash == _sha256(token)))).scalar_one_or_none()
    if row is None:
        return None
    expires = row.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
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
```

> Note: `secrets.token_urlsafe(32)` yields a 32-byte base64url token, matching Node's `randomBytes(32).toString("base64url")` semantics (opaque token; format need not be byte-identical, only secure and unique).

- [ ] **Step 4: Write `app/auth/cookies.py`**

```python
from datetime import datetime

from fastapi import Response

from ..config import get_settings

SESSION_COOKIE = "sid"
_MAX_AGE = 30 * 24 * 60 * 60


def _opts() -> dict:
    prod = get_settings().is_prod
    return {
        "httponly": True,
        "secure": prod,
        "samesite": "none" if prod else "lax",
        "path": "/",
    }


def set_session_cookie(response: Response, token: str, expires_at: datetime) -> None:
    response.set_cookie(SESSION_COOKIE, token, max_age=_MAX_AGE, **_opts())


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, **_opts())
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd backend-py && uv run pytest tests/test_sessions.py -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend-py
git commit -m "feat(backend-py): DB-backed sessions + sid cookie helpers"
```

---

### Task 6: require_auth dependency

**Files:**
- Create: `backend-py/app/auth/deps.py`

**Interfaces:**
- Consumes: `get_db`, `find_session`, `SESSION_COOKIE`, `Membership` model, `AppError`.
- Produces: `AuthContext` (dataclass with `user_id: str`, `workspace_id: str`); `require_auth(request, db) -> AuthContext` FastAPI dependency that raises `AppError(401, "Unauthorized")` on failure.

- [ ] **Step 1: Write `app/auth/deps.py`**

```python
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
```

- [ ] **Step 2: Verify it imports**

Run: `cd backend-py && uv run python -c "import app.auth.deps"`
Expected: no error. (Behavior is covered by auth tests in Task 7.)

- [ ] **Step 3: Commit**

```bash
git add backend-py
git commit -m "feat(backend-py): require_auth dependency with per-workspace context"
```

---

### Task 7: Auth routes

**Files:**
- Create: `backend-py/app/auth/routes.py`
- Modify: `backend-py/app/main.py` (mount auth router)
- Modify: `backend-py/tests/conftest.py` (add `auth_client` helper)
- Create: `backend-py/tests/test_auth.py`

**Interfaces:**
- Consumes: schemas `Credentials`, `ChangePasswordBody`; `hash_password`, `verify_password`; session + cookie helpers; `require_auth`.
- Produces: `auth_router` (APIRouter, prefix `/auth`); pytest fixture `auth_client` → an `AsyncClient` already signed up + cookie-authenticated, plus its email.

- [ ] **Step 1: Write the failing tests `tests/test_auth.py`**

```python
import pytest


@pytest.mark.asyncio
async def test_signup_login_me_logout(client):
    r = await client.post("/auth/signup", json={"email": "A@Ex.com", "password": "password1"})
    assert r.status_code == 201
    assert r.json() == {"user": {"id": r.json()["user"]["id"], "email": "a@ex.com"}}

    me = await client.get("/auth/me")
    assert me.status_code == 200 and me.json()["user"]["email"] == "a@ex.com"

    out = await client.post("/auth/logout")
    assert out.status_code == 204
    assert (await client.get("/auth/me")).status_code == 401


@pytest.mark.asyncio
async def test_duplicate_email_409(client):
    await client.post("/auth/signup", json={"email": "d@x.com", "password": "password1"})
    r = await client.post("/auth/signup", json={"email": "d@x.com", "password": "password1"})
    assert r.status_code == 409
    assert r.json()["error"]["message"] == "Email already registered"


@pytest.mark.asyncio
async def test_login_bad_password_401(client):
    await client.post("/auth/signup", json={"email": "e@x.com", "password": "password1"})
    await client.post("/auth/logout")
    r = await client.post("/auth/login", json={"email": "e@x.com", "password": "wrongpassword"})
    assert r.status_code == 401
    assert r.json()["error"]["message"] == "Invalid email or password"


@pytest.mark.asyncio
async def test_short_password_is_validation_400(client):
    r = await client.post("/auth/signup", json={"email": "f@x.com", "password": "short"})
    assert r.status_code == 400
    assert r.json()["error"]["message"] == "Validation failed"


@pytest.mark.asyncio
async def test_change_password_revokes_then_relogin(client):
    await client.post("/auth/signup", json={"email": "g@x.com", "password": "password1"})
    r = await client.post("/auth/change-password", json={"currentPassword": "password1", "newPassword": "password2"})
    assert r.status_code == 204
    # current cookie was the one kept, so /me still works
    assert (await client.get("/auth/me")).status_code == 200
    bad = await client.post("/auth/change-password", json={"currentPassword": "nopenope", "newPassword": "password3"})
    assert bad.status_code == 400
    assert bad.json()["error"]["message"] == "Current password is incorrect"
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend-py && uv run pytest tests/test_auth.py -v`
Expected: FAIL (auth routes not mounted → 404s).

- [ ] **Step 3: Write `app/auth/routes.py`**

```python
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
    membership = Membership(id=new_id(), user_id=user.id, workspace_id=workspace.id, role="OWNER")
    db.add_all([user, workspace, membership])
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
```

- [ ] **Step 4: Mount the router in `app/main.py`**

Add `from .auth.routes import auth_router` and `app.include_router(auth_router)` inside `create_app` (after `install_error_handlers`).

- [ ] **Step 5: Add `auth_client` fixture to `tests/conftest.py`**

```python
@pytest_asyncio.fixture
async def auth_client(client):
    email = f"{__import__('app.ids', fromlist=['new_id']).new_id()}@test.com"
    r = await client.post("/auth/signup", json={"email": email, "password": "password1"})
    assert r.status_code == 201
    return client, email
```

- [ ] **Step 6: Run tests**

Run: `cd backend-py && uv run pytest tests/test_auth.py -v`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add backend-py
git commit -m "feat(backend-py): auth routes (signup/login/me/logout/change-password)"
```

---

### Task 8: Tasks router

**Files:**
- Create: `backend-py/app/routers/__init__.py`, `backend-py/app/routers/tasks.py`
- Modify: `backend-py/app/main.py` (mount)
- Create: `backend-py/tests/test_tasks.py`

**Interfaces:**
- Consumes: `require_auth`/`AuthContext`, `get_db`, schemas `CreateTask`/`UpdateTask`/`TaskFilter`, models `Task`/`Label`.
- Produces: `tasks_router` (prefix `/tasks`); `serialize_task(task) -> dict` with keys `id,title,description,status,priority,dueDate,projectId,sortOrder,labels,createdAt,updatedAt` (ISO strings or null; `labels` = `[{id,name,color}]`).

- [ ] **Step 1: Write the failing tests `tests/test_tasks.py`**

```python
import pytest


@pytest.mark.asyncio
async def test_task_crud_and_filters(auth_client):
    client, _ = auth_client
    created = await client.post("/tasks", json={"title": "First", "priority": "HIGH"})
    assert created.status_code == 201
    body = created.json()
    assert body["title"] == "First" and body["priority"] == "HIGH"
    assert body["status"] == "BACKLOG" and body["labels"] == []
    assert body["dueDate"] is None and "createdAt" in body
    tid = body["id"]

    lst = await client.get("/tasks")
    assert lst.status_code == 200 and len(lst.json()) == 1

    filt = await client.get("/tasks", params={"priority": "LOW"})
    assert filt.status_code == 200 and filt.json() == []

    got = await client.get(f"/tasks/{tid}")
    assert got.status_code == 200 and got.json()["id"] == tid

    patched = await client.patch(f"/tasks/{tid}", json={"status": "DONE", "sortOrder": 5})
    assert patched.status_code == 200 and patched.json()["status"] == "DONE"

    deleted = await client.delete(f"/tasks/{tid}")
    assert deleted.status_code == 204
    assert (await client.get(f"/tasks/{tid}")).status_code == 404


@pytest.mark.asyncio
async def test_requires_auth(client):
    assert (await client.get("/tasks")).status_code == 401


@pytest.mark.asyncio
async def test_task_with_labels(auth_client):
    client, _ = auth_client
    label = (await client.post("/labels", json={"name": "bug"})).json()
    t = await client.post("/tasks", json={"title": "x", "labelIds": [label["id"]]})
    assert t.status_code == 201
    assert t.json()["labels"] == [{"id": label["id"], "name": "bug", "color": label["color"]}]
```

(The label-using test depends on Task 10; run the full file after that task. It is placed here to keep task behavior together — see Step 6.)

- [ ] **Step 2: Run to verify failure**

Run: `cd backend-py && uv run pytest tests/test_tasks.py::test_requires_auth -v`
Expected: FAIL (route missing → 404 not 401, or import error).

- [ ] **Step 3: Write `app/routers/__init__.py` (empty) and `app/routers/tasks.py`**

```python
import sqlalchemy as sa
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.deps import AuthContext, require_auth
from ..db import get_db
from ..errors import AppError
from ..ids import new_id
from ..models import Label, Task
from ..schemas import CreateTask, TaskFilter, UpdateTask

tasks_router = APIRouter(prefix="/tasks", dependencies=[Depends(require_auth)])


def _iso(dt):
    return dt.isoformat() if dt is not None else None


def serialize_task(t: Task) -> dict:
    return {
        "id": t.id,
        "title": t.title,
        "description": t.description,
        "status": t.status,
        "priority": t.priority,
        "dueDate": _iso(t.due_date),
        "projectId": t.project_id,
        "sortOrder": t.sort_order,
        "labels": [{"id": lb.id, "name": lb.name, "color": lb.color} for lb in t.labels],
        "createdAt": _iso(t.created_at),
        "updatedAt": _iso(t.updated_at),
    }


async def _load(db: AsyncSession, task_id: str, workspace_id: str) -> Task | None:
    return (
        await db.execute(sa.select(Task).where(Task.id == task_id, Task.workspace_id == workspace_id))
    ).scalar_one_or_none()


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
    stmt = sa.select(Task).where(Task.workspace_id == ctx.workspace_id)
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
        due_date=body.due_date,
        project_id=body.project_id,
        workspace_id=ctx.workspace_id,
    )
    if body.label_ids is not None:
        task.labels = await _labels(db, body.label_ids, ctx.workspace_id)
    db.add(task)
    await db.commit()
    await db.refresh(task, attribute_names=["labels"])
    return serialize_task(task)


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
        task.due_date = data["due_date"]
    if "project_id" in data:
        task.project_id = data["project_id"]
    if "sort_order" in data:
        task.sort_order = data["sort_order"]
    if "label_ids" in data:
        task.labels = await _labels(db, body.label_ids or [], ctx.workspace_id)
    await db.commit()
    await db.refresh(task, attribute_names=["labels"])
    return serialize_task(task)


@tasks_router.delete("/{task_id}", status_code=204)
async def delete_task(task_id: str, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        sa.delete(Task).where(Task.id == task_id, Task.workspace_id == ctx.workspace_id)
    )
    await db.commit()
    if result.rowcount == 0:
        raise AppError(404, "Not found")
    from fastapi import Response

    return Response(status_code=204)
```

> Note on routing: APIRouter has prefix `/tasks`; the list/create handlers use path `""` so the final paths are exactly `/tasks` (the TS app mounts at `/tasks` with route `/`). FastAPI matches `/tasks` to `""` under the prefix. If a 307 redirect appears, switch the path to `"/"` and confirm the frontend calls `/tasks` (it does, via `api.get("/tasks")`).

- [ ] **Step 4: Mount in `app/main.py`**

Add `from .routers.tasks import tasks_router` and `app.include_router(tasks_router)`.

- [ ] **Step 5: Run the auth-only and CRUD tests**

Run: `cd backend-py && uv run pytest tests/test_tasks.py::test_requires_auth tests/test_tasks.py::test_task_crud_and_filters -v`
Expected: PASS.

- [ ] **Step 6: Commit (label test runs green after Task 10)**

```bash
git add backend-py
git commit -m "feat(backend-py): tasks router with filters, labels, workspace isolation"
```

---

### Task 9: Projects router

**Files:**
- Create: `backend-py/app/routers/projects.py`
- Modify: `backend-py/app/main.py` (mount)
- Create: `backend-py/tests/test_projects.py`

**Interfaces:**
- Produces: `projects_router` (prefix `/projects`); `serialize_project(p) -> dict` with keys `id,name,color,githubRepoId,githubRepoFullName,githubInstallationId,createdAt,updatedAt`.

- [ ] **Step 1: Write the failing tests `tests/test_projects.py`**

```python
import pytest


@pytest.mark.asyncio
async def test_project_crud(auth_client):
    client, _ = auth_client
    c = await client.post("/projects", json={"name": "Site"})
    assert c.status_code == 201
    p = c.json()
    assert p["name"] == "Site" and p["color"] == "#8A8A86"
    assert set(p) == {"id", "name", "color", "githubRepoId", "githubRepoFullName", "githubInstallationId", "createdAt", "updatedAt"}
    pid = p["id"]

    assert len((await client.get("/projects")).json()) == 1

    u = await client.patch(f"/projects/{pid}", json={"name": "Site2"})
    assert u.status_code == 200 and u.json()["name"] == "Site2"

    assert (await client.delete(f"/projects/{pid}")).status_code == 204
    assert (await client.patch(f"/projects/{pid}", json={"name": "x"})).status_code == 404


@pytest.mark.asyncio
async def test_bad_color_400(auth_client):
    client, _ = auth_client
    r = await client.post("/projects", json={"name": "x", "color": "red"})
    assert r.status_code == 400 and r.json()["error"]["message"] == "Validation failed"
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend-py && uv run pytest tests/test_projects.py -v`
Expected: FAIL.

- [ ] **Step 3: Write `app/routers/projects.py`**

```python
import sqlalchemy as sa
from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.deps import AuthContext, require_auth
from ..db import get_db
from ..errors import AppError
from ..ids import new_id
from ..models import Project
from ..schemas import CreateProject, UpdateProject

projects_router = APIRouter(prefix="/projects", dependencies=[Depends(require_auth)])


def serialize_project(p: Project) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "color": p.color,
        "githubRepoId": p.github_repo_id,
        "githubRepoFullName": p.github_repo_full_name,
        "githubInstallationId": p.github_installation_id,
        "createdAt": p.created_at.isoformat(),
        "updatedAt": p.updated_at.isoformat(),
    }


async def _load(db, pid, wsid) -> Project | None:
    return (await db.execute(sa.select(Project).where(Project.id == pid, Project.workspace_id == wsid))).scalar_one_or_none()


@projects_router.get("")
async def list_projects(ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(sa.select(Project).where(Project.workspace_id == ctx.workspace_id).order_by(Project.created_at.asc()))).scalars().all()
    return [serialize_project(p) for p in rows]


@projects_router.post("", status_code=201)
async def create_project(body: CreateProject, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    p = Project(
        id=new_id(), name=body.name, color=body.color,
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
    if "color" in data: p.color = data["color"]
    if "github_repo_id" in data: p.github_repo_id = data["github_repo_id"]
    if "github_repo_full_name" in data: p.github_repo_full_name = data["github_repo_full_name"]
    if "github_installation_id" in data: p.github_installation_id = data["github_installation_id"]
    await db.commit()
    await db.refresh(p)
    return serialize_project(p)


@projects_router.delete("/{pid}", status_code=204)
async def delete_project(pid: str, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    result = await db.execute(sa.delete(Project).where(Project.id == pid, Project.workspace_id == ctx.workspace_id))
    await db.commit()
    if result.rowcount == 0:
        raise AppError(404, "Not found")
    return Response(status_code=204)
```

- [ ] **Step 4: Mount in `app/main.py`**

Add `from .routers.projects import projects_router` and `app.include_router(projects_router)`.

- [ ] **Step 5: Run tests**

Run: `cd backend-py && uv run pytest tests/test_projects.py -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend-py
git commit -m "feat(backend-py): projects router"
```

---

### Task 10: Labels router

**Files:**
- Create: `backend-py/app/routers/labels.py`
- Modify: `backend-py/app/main.py` (mount)
- Create: `backend-py/tests/test_labels.py`

**Interfaces:**
- Produces: `labels_router` (prefix `/labels`); `serialize_label(l) -> dict` with keys `id,name,color,createdAt`.

- [ ] **Step 1: Write the failing tests `tests/test_labels.py`**

```python
import pytest


@pytest.mark.asyncio
async def test_label_crud(auth_client):
    client, _ = auth_client
    c = await client.post("/labels", json={"name": "bug"})
    assert c.status_code == 201
    lb = c.json()
    assert set(lb) == {"id", "name", "color", "createdAt"}
    assert lb["name"] == "bug" and lb["color"] == "#8A8A86"
    lid = lb["id"]

    assert len((await client.get("/labels")).json()) == 1
    u = await client.patch(f"/labels/{lid}", json={"color": "#112233"})
    assert u.status_code == 200 and u.json()["color"] == "#112233"
    assert (await client.delete(f"/labels/{lid}")).status_code == 204
    assert (await client.patch(f"/labels/{lid}", json={"name": "x"})).status_code == 404
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend-py && uv run pytest tests/test_labels.py -v`
Expected: FAIL.

- [ ] **Step 3: Write `app/routers/labels.py`**

```python
import sqlalchemy as sa
from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.deps import AuthContext, require_auth
from ..db import get_db
from ..errors import AppError
from ..ids import new_id
from ..models import Label
from ..schemas import CreateLabel, UpdateLabel

labels_router = APIRouter(prefix="/labels", dependencies=[Depends(require_auth)])


def serialize_label(l: Label) -> dict:
    return {"id": l.id, "name": l.name, "color": l.color, "createdAt": l.created_at.isoformat()}


async def _load(db, lid, wsid) -> Label | None:
    return (await db.execute(sa.select(Label).where(Label.id == lid, Label.workspace_id == wsid))).scalar_one_or_none()


@labels_router.get("")
async def list_labels(ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(sa.select(Label).where(Label.workspace_id == ctx.workspace_id).order_by(Label.created_at.asc()))).scalars().all()
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
```

- [ ] **Step 4: Mount in `app/main.py`**

Add `from .routers.labels import labels_router` and `app.include_router(labels_router)`.

- [ ] **Step 5: Run labels + the deferred task-with-labels test**

Run: `cd backend-py && uv run pytest tests/test_labels.py tests/test_tasks.py -v`
Expected: all PASS (including `test_task_with_labels`).

- [ ] **Step 6: Commit**

```bash
git add backend-py
git commit -m "feat(backend-py): labels router"
```

---

### Task 11: Library router (shelf / book / page)

**Files:**
- Create: `backend-py/app/routers/library.py`
- Modify: `backend-py/app/main.py` (mount)
- Create: `backend-py/tests/test_library.py`

**Interfaces:**
- Produces: `library_router` (no prefix — paths are absolute: `/shelf`, `/projects/{projectId}/shelf`, `/shelves/{id}`, `/shelves/{shelfId}/books`, `/books/{id}`, `/books/{bookId}/pages`, `/pages/{id}`).
- Response shapes (exact): shelf-with-books `{id,projectId,name,description,books:[{id,name,description,color,sortOrder,pageCount}]}`; shelf-patch `{id,projectId,name,description}`; book-create `{id,name,description,color,sortOrder,createdAt,updatedAt}`; book-get `{id,name,description,color,sortOrder,pages:[{id,title,sortOrder,updatedAt}]}`; book-patch `{id,name,description,color,sortOrder}`; page (create/get/patch) `{id,bookId,title,content,sortOrder,createdAt,updatedAt}`.

- [ ] **Step 1: Write the failing tests `tests/test_library.py`**

```python
import pytest


@pytest.mark.asyncio
async def test_general_shelf_autocreates(auth_client):
    client, _ = auth_client
    r = await client.get("/shelf")
    assert r.status_code == 200
    s = r.json()
    assert s["projectId"] is None and s["books"] == []
    assert set(s) == {"id", "projectId", "name", "description", "books"}


@pytest.mark.asyncio
async def test_book_and_page_lifecycle(auth_client):
    client, _ = auth_client
    shelf = (await client.get("/shelf")).json()
    b = await client.post(f"/shelves/{shelf['id']}/books", json={"name": "Notes"})
    assert b.status_code == 201
    book = b.json()
    assert set(book) == {"id", "name", "description", "color", "sortOrder", "createdAt", "updatedAt"}
    bid = book["id"]

    shelf2 = (await client.get("/shelf")).json()
    assert len(shelf2["books"]) == 1 and shelf2["books"][0]["pageCount"] == 0

    p = await client.post(f"/books/{bid}/pages", json={"title": "Page 1"})
    assert p.status_code == 201
    page = p.json()
    assert set(page) == {"id", "bookId", "title", "content", "sortOrder", "createdAt", "updatedAt"}
    pid = page["id"]

    got_book = (await client.get(f"/books/{bid}")).json()
    assert len(got_book["pages"]) == 1 and got_book["pages"][0]["id"] == pid

    up = await client.patch(f"/pages/{pid}", json={"content": "hello"})
    assert up.status_code == 200 and up.json()["content"] == "hello"

    assert (await client.delete(f"/books/{bid}")).status_code == 204
    assert (await client.get(f"/books/{bid}")).status_code == 404


@pytest.mark.asyncio
async def test_unknown_shelf_404(auth_client):
    client, _ = auth_client
    r = await client.post("/shelves/does-not-exist/books", json={"name": "x"})
    assert r.status_code == 404 and r.json()["error"]["message"] == "Shelf not found"
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend-py && uv run pytest tests/test_library.py -v`
Expected: FAIL.

- [ ] **Step 3: Write `app/routers/library.py`**

```python
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

library_router = APIRouter(dependencies=[Depends(require_auth)])


def _iso(dt):
    return dt.isoformat()


async def _shelf_with_books(db: AsyncSession, shelf: Shelf) -> dict:
    books = (
        await db.execute(sa.select(Book).where(Book.shelf_id == shelf.id).order_by(Book.sort_order.asc()))
    ).scalars().all()
    counts = dict(
        (
            await db.execute(
                sa.select(Page.book_id, sa.func.count()).where(
                    Page.book_id.in_([b.id for b in books]) if books else sa.false()
                ).group_by(Page.book_id)
            )
        ).all()
    )
    return {
        "id": shelf.id,
        "projectId": shelf.project_id,
        "name": shelf.name,
        "description": shelf.description,
        "books": [
            {
                "id": b.id, "name": b.name, "description": b.description, "color": b.color,
                "sortOrder": b.sort_order, "pageCount": int(counts.get(b.id, 0)),
            }
            for b in books
        ],
    }


async def _owned_shelf(db, wsid, shelf_id) -> Shelf | None:
    return (await db.execute(sa.select(Shelf).where(Shelf.id == shelf_id, Shelf.workspace_id == wsid))).scalar_one_or_none()


async def _owned_book(db, wsid, book_id) -> Book | None:
    return (
        await db.execute(
            sa.select(Book).join(Shelf, Book.shelf_id == Shelf.id).where(Book.id == book_id, Shelf.workspace_id == wsid)
        )
    ).scalar_one_or_none()


async def _owned_page(db, wsid, page_id) -> Page | None:
    return (
        await db.execute(
            sa.select(Page).join(Book, Page.book_id == Book.id).join(Shelf, Book.shelf_id == Shelf.id)
            .where(Page.id == page_id, Shelf.workspace_id == wsid)
        )
    ).scalar_one_or_none()


@library_router.get("/shelf")
async def get_general_shelf(ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    shelf = (
        await db.execute(sa.select(Shelf).where(Shelf.project_id.is_(None), Shelf.workspace_id == ctx.workspace_id))
    ).scalar_one_or_none()
    if shelf is None:
        shelf = Shelf(id=new_id(), project_id=None, name="General", workspace_id=ctx.workspace_id)
        db.add(shelf)
        await db.commit()
        await db.refresh(shelf)
    return await _shelf_with_books(db, shelf)


@library_router.get("/projects/{project_id}/shelf")
async def get_project_shelf(project_id: str, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    project = (
        await db.execute(sa.select(Project).where(Project.id == project_id, Project.workspace_id == ctx.workspace_id))
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
    b = Book(id=new_id(), shelf_id=shelf_id, name=body.name, description=body.description, color=body.color, sort_order=float(int(time.time() * 1000)))
    db.add(b)
    await db.commit()
    await db.refresh(b)
    return {"id": b.id, "name": b.name, "description": b.description, "color": b.color, "sortOrder": b.sort_order, "createdAt": _iso(b.created_at), "updatedAt": _iso(b.updated_at)}


@library_router.get("/books/{book_id}")
async def get_book(book_id: str, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    b = await _owned_book(db, ctx.workspace_id, book_id)
    if b is None:
        raise AppError(404, "Book not found")
    pages = (await db.execute(sa.select(Page).where(Page.book_id == book_id).order_by(Page.sort_order.asc()))).scalars().all()
    return {
        "id": b.id, "name": b.name, "description": b.description, "color": b.color, "sortOrder": b.sort_order,
        "pages": [{"id": p.id, "title": p.title, "sortOrder": p.sort_order, "updatedAt": _iso(p.updated_at)} for p in pages],
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
    await db.delete(b)
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
    return {"id": p.id, "bookId": p.book_id, "title": p.title, "content": p.content, "sortOrder": p.sort_order, "createdAt": _iso(p.created_at), "updatedAt": _iso(p.updated_at)}


@library_router.get("/pages/{page_id}")
async def get_page(page_id: str, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    p = await _owned_page(db, ctx.workspace_id, page_id)
    if p is None:
        raise AppError(404, "Page not found")
    return {"id": p.id, "bookId": p.book_id, "title": p.title, "content": p.content, "sortOrder": p.sort_order, "createdAt": _iso(p.created_at), "updatedAt": _iso(p.updated_at)}


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
    return {"id": p.id, "bookId": p.book_id, "title": p.title, "content": p.content, "sortOrder": p.sort_order, "createdAt": _iso(p.created_at), "updatedAt": _iso(p.updated_at)}


@library_router.delete("/pages/{page_id}", status_code=204)
async def delete_page(page_id: str, ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    p = await _owned_page(db, ctx.workspace_id, page_id)
    if p is None:
        raise AppError(404, "Page not found")
    await db.delete(p)
    await db.commit()
    return Response(status_code=204)
```

- [ ] **Step 4: Mount in `app/main.py`**

Add `from .routers.library import library_router` and `app.include_router(library_router)`.

- [ ] **Step 5: Run tests**

Run: `cd backend-py && uv run pytest tests/test_library.py -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend-py
git commit -m "feat(backend-py): library router (shelf/book/page)"
```

---

### Task 12: App wiring, CORS, 404 fallback, isolation tests, run docs, manual parity

**Files:**
- Modify: `backend-py/app/main.py` (CORS, catch-all 404)
- Create: `backend-py/tests/test_isolation.py`
- Create: `backend-py/README.md`

**Interfaces:**
- Consumes: all routers; `get_settings`.
- Produces: fully wired `app`; documented run commands.

- [ ] **Step 1: Write isolation + 404 tests `tests/test_isolation.py`**

```python
import pytest


@pytest.mark.asyncio
async def test_cross_workspace_task_is_404(client):
    # user A creates a task
    await client.post("/auth/signup", json={"email": "owner@x.com", "password": "password1"})
    t = await client.post("/tasks", json={"title": "secret"})
    tid = t.json()["id"]
    await client.post("/auth/logout")
    # user B cannot see it
    await client.post("/auth/signup", json={"email": "intruder@x.com", "password": "password1"})
    assert (await client.get(f"/tasks/{tid}")).status_code == 404
    assert (await client.delete(f"/tasks/{tid}")).status_code == 404


@pytest.mark.asyncio
async def test_unknown_route_authenticated_404(auth_client):
    client, _ = auth_client
    r = await client.get("/nope/nope")
    assert r.status_code == 404
```

- [ ] **Step 2: Finalize `app/main.py`**

```python
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .auth.routes import auth_router
from .config import get_settings
from .errors import AppError, install_error_handlers
from .routers.labels import labels_router
from .routers.library import library_router
from .routers.projects import projects_router
from .routers.tasks import tasks_router


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="MySchedule API")

    if settings.is_prod:
        origins = [settings.frontend_url] if settings.frontend_url else []
        app.add_middleware(
            CORSMiddleware, allow_origins=origins, allow_credentials=True,
            allow_methods=["*"], allow_headers=["*"],
        )
    else:
        app.add_middleware(
            CORSMiddleware, allow_origin_regex=".*", allow_credentials=True,
            allow_methods=["*"], allow_headers=["*"],
        )

    install_error_handlers(app)

    @app.get("/health")
    async def health() -> dict[str, bool]:
        return {"ok": True}

    app.include_router(auth_router)
    app.include_router(tasks_router)
    app.include_router(projects_router)
    app.include_router(labels_router)
    app.include_router(library_router)

    @app.api_route("/{path:path}", methods=["GET", "POST", "PATCH", "PUT", "DELETE"])
    async def _not_found(_request: Request, path: str):
        raise AppError(404, "Not found")

    return app


app = create_app()
```

> Note: the catch-all is declared last so real routes win. It returns the same `{"error":{"message":"Not found"}}` shape as the TS catch-all. (Unlike TS, this 404 does not require auth — acceptable, since unknown paths carry no data; the TS version happened to 401 unknown paths under the library mount. The frontend never relies on that.)

- [ ] **Step 3: Run the entire suite**

Run: `cd backend-py && uv run pytest -v`
Expected: ALL tests PASS (health, models, password, sessions, auth, tasks, projects, labels, library, isolation).

- [ ] **Step 4: Write `backend-py/README.md`**

````markdown
# MySchedule backend (FastAPI)

Python reimplementation of the core backend. API-compatible with the frontend.

## Setup (local)

Requires Python 3.12, `uv`, and local Postgres with role `myschedule` / db `myschedule_dev`
(see repo root setup). Create the test DB once:

```bash
PGPASSWORD=myschedule createdb -h localhost -U myschedule myschedule_test
```

Install deps and apply migrations:

```bash
cd backend-py
uv sync
uv run alembic upgrade head        # test DB / fresh DBs
# existing dev DB was created by Prisma; mark it baselined:
DATABASE_URL=postgresql://myschedule:myschedule@localhost:5432/myschedule_dev uv run alembic stamp head
```

## Run

```bash
uv run uvicorn app.main:app --reload --port 4000
```

## Test

```bash
uv run pytest -v
```
````

- [ ] **Step 5: Manual parity check against the real frontend**

```bash
# stop the TS backend if running
fuser -k 4000/tcp 2>/dev/null
# run the Python backend on :4000 against the dev DB
cd backend-py && DATABASE_URL=postgresql://myschedule:myschedule@localhost:5432/myschedule_dev \
  uv run uvicorn app.main:app --port 4000 &
# in another terminal: cd frontend && pnpm dev, then log in as demo@myschedule.app / password1
```
Verify in the browser: login persists, board loads tasks/projects/labels, library create-book/page works, logout works. Confirm no console errors and the demo user (Node-created scrypt hash) logs in — proving password parity end-to-end.

- [ ] **Step 6: Commit**

```bash
git add backend-py
git commit -m "feat(backend-py): app wiring, CORS, 404 fallback, isolation tests, docs"
```

---

## Self-Review

**Spec coverage:**
- Auth/sessions/cookies/scrypt → Tasks 4–7. ✓
- Tasks/projects/labels/library parity → Tasks 8–11. ✓
- DB reuse + Alembic baseline + enums + join table → Task 2. ✓
- camelCase + error shape + validation→400 → Task 3 (+ used throughout). ✓
- CORS + config + 404 → Tasks 1, 12. ✓
- Testing harness + per-workspace isolation → Tasks 1, 2, 12. ✓
- Deployment (Render) → intentionally deferred to cutover (out of Phase 1 scope per spec). ✓

**Placeholder scan:** Task 3 Step 4 originally referenced a test file then cancels it explicitly (covered by Task 7) — no dangling placeholder. No TBD/TODO content steps remain.

**Type consistency:** `AuthContext(user_id, workspace_id)` used uniformly; `serialize_task/project/label` and library dicts use exact camelCase keys from `frontend/src/types.ts`; `require_auth` imported consistently; enum `.value` used when binding to columns; `model_dump(exclude_unset=True)` used for all PATCH handlers.

**Known divergences (intentional, frontend-safe):** (1) session token format uses `secrets.token_urlsafe` rather than byte-identical Node base64url — opaque, no impact. (2) unknown-route 404 is unauthenticated (TS returned 401 for unknown paths under the library mount) — frontend never depends on it. (3) project/label responses return exactly the documented `types.ts` fields (TS also leaked `workspaceId`); frontend ignores extras either way.

import os
import subprocess
import sys
from pathlib import Path

# Point the app at a dedicated local test database BEFORE app imports.
TEST_DB_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql://myschedule:myschedule@localhost:5432/myschedule_test",
)
os.environ["DATABASE_URL"] = TEST_DB_URL
os.environ["APP_ENV"] = "development"

import pytest
import pytest_asyncio
import sqlalchemy as sa
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import get_settings
from app.ids import new_id
from app.main import app

get_settings.cache_clear()  # ensure the test DATABASE_URL is picked up

_BACKEND_DIR = Path(__file__).resolve().parent.parent
_ALEMBIC = str(Path(sys.executable).parent / "alembic")

_TABLES = [
    '"_LabelToTask"', '"Page"', '"Book"', '"Shelf"', '"Task"', '"Label"',
    '"Project"', '"Session"', '"Membership"', '"Workspace"', '"User"',
]


@pytest.fixture(scope="session", autouse=True)
def _migrate_test_db():
    # Idempotent: applies the baseline to a fresh test DB, no-op when already at head.
    subprocess.run([_ALEMBIC, "upgrade", "head"], check=True, cwd=_BACKEND_DIR, env=os.environ)


@pytest_asyncio.fixture(autouse=True)
async def _truncate():
    yield
    eng = create_async_engine(get_settings().async_database_url)
    async with eng.begin() as conn:
        await conn.execute(sa.text(f"TRUNCATE TABLE {', '.join(_TABLES)} RESTART IDENTITY CASCADE"))
    await eng.dispose()


@pytest_asyncio.fixture
async def client() -> AsyncClient:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture
async def auth_client(client):
    email = f"{new_id()}@test.com"
    r = await client.post("/auth/signup", json={"email": email, "password": "password1"})
    assert r.status_code == 201
    return client, email

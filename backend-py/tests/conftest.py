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

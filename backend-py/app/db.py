from collections.abc import AsyncGenerator

from sqlalchemy import NullPool
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from .config import get_settings


class Base(DeclarativeBase):
    pass


# NullPool: don't reuse connections across asyncio event loops (keeps the test
# suite's per-test loops happy) and is the recommended setting when running
# behind a transaction pooler (Supabase pgbouncer) in production.
engine = create_async_engine(get_settings().async_database_url, poolclass=NullPool)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session

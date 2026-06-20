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

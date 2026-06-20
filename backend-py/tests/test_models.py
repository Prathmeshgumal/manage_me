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

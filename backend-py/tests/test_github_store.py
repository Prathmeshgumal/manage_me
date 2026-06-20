import base64

import pytest

from app.db import SessionLocal
from app.ids import new_id
from app.models import Workspace

KEY_B64 = "ASNFZ4mrze8BI0VniavN7wEjRWeJq83vASNFZ4mrze8="


@pytest.fixture
def gh_env(monkeypatch):
    env = {
        "GITHUB_APP_ID": "1", "GITHUB_APP_SLUG": "t", "GITHUB_APP_CLIENT_ID": "c",
        "GITHUB_APP_CLIENT_SECRET": "s", "GITHUB_APP_PRIVATE_KEY_BASE64": base64.b64encode(b"x").decode(),
        "GITHUB_OAUTH_REDIRECT_URI": "http://x/cb", "GITHUB_STATE_SECRET": "ss",
        "FRONTEND_URL": "http://x", "GITHUB_TOKEN_ENC_KEY": KEY_B64,
    }
    for k, v in env.items():
        monkeypatch.setenv(k, v)


async def _workspace() -> str:
    async with SessionLocal() as s:
        wid = new_id()
        s.add(Workspace(id=wid))
        await s.commit()
        return wid


@pytest.mark.asyncio
async def test_user_token_roundtrip_and_encrypted_at_rest(gh_env):
    from sqlalchemy import select
    from app.github.store import get_user_token, save_user_token
    from app.models import GithubUserToken

    wid = await _workspace()
    async with SessionLocal() as db:
        await save_user_token(db, workspace_id=wid, github_user_id=42, login="octocat",
                              avatar_url="http://a", access_token="ghp_secret", scope="repo")
        got = await get_user_token(db, wid)
        assert got == {"login": "octocat", "avatarUrl": "http://a", "accessToken": "ghp_secret"}
        row = (await db.execute(select(GithubUserToken))).scalar_one()
        assert row.access_token != "ghp_secret"  # stored encrypted


@pytest.mark.asyncio
async def test_user_token_upsert_and_delete(gh_env):
    from app.github.store import delete_user_token, get_user_token, save_user_token
    wid = await _workspace()
    async with SessionLocal() as db:
        await save_user_token(db, workspace_id=wid, github_user_id=42, login="a",
                              avatar_url="u", access_token="t1", scope="")
        await save_user_token(db, workspace_id=wid, github_user_id=42, login="b",
                              avatar_url="u2", access_token="t2", scope="")
        got = await get_user_token(db, wid)
        assert got["login"] == "b" and got["accessToken"] == "t2"
        await delete_user_token(db, wid)
        assert await get_user_token(db, wid) is None


@pytest.mark.asyncio
async def test_installation_upsert_and_list(gh_env):
    from app.github.store import list_installations, save_installation
    wid = await _workspace()
    async with SessionLocal() as db:
        await save_installation(db, workspace_id=wid, installation_id=7, account_login="org",
                                account_type="Organization", repository_selection="all")
        await save_installation(db, workspace_id=wid, installation_id=7, account_login="org2",
                                account_type="Organization", repository_selection="selected")
        rows = await list_installations(db, wid)
        assert len(rows) == 1
        assert rows[0] == {"installationId": 7, "accountLogin": "org2",
                           "accountType": "Organization", "repositorySelection": "selected"}

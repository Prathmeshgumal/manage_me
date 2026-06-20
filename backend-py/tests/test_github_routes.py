import pytest


@pytest.mark.asyncio
async def test_status_empty(auth_client, github_env):
    client, _ = auth_client
    r = await client.get("/github/status")
    assert r.status_code == 200
    assert r.json() == {"user": None, "installations": []}


@pytest.mark.asyncio
async def test_status_requires_auth(client, github_env):
    assert (await client.get("/github/status")).status_code == 401


@pytest.mark.asyncio
async def test_authorize_redirects_to_github(auth_client, github_env):
    client, _ = auth_client
    r = await client.get("/github/authorize")
    assert r.status_code in (302, 307)
    assert r.headers["location"].startswith("https://github.com/login/oauth/authorize?")


@pytest.mark.asyncio
async def test_install_redirects(auth_client, github_env):
    client, _ = auth_client
    r = await client.get("/github/install")
    assert r.status_code in (302, 307)
    assert r.headers["location"] == "https://github.com/apps/myschedule/installations/new"


@pytest.mark.asyncio
async def test_callback_connects(auth_client, github_env, monkeypatch):
    client, _ = auth_client
    from app.github import routes
    from app.github.crypto import sign_state

    async def fake_exchange(code):
        return {"accessToken": "ghp_x", "scope": "repo"}

    async def fake_user(token):
        return {"id": 7, "login": "octo", "avatarUrl": "http://a"}

    monkeypatch.setattr(routes, "exchange_code", fake_exchange)
    monkeypatch.setattr(routes, "get_authed_user", fake_user)

    r = await client.get(f"/github/callback?code=abc&state={sign_state()}")
    assert r.status_code in (302, 307)
    assert r.headers["location"] == "http://localhost:5173/settings/github?connected=1"

    status = (await client.get("/github/status")).json()
    assert status["user"] == {"login": "octo", "avatarUrl": "http://a"}


@pytest.mark.asyncio
async def test_callback_bad_state(auth_client, github_env):
    client, _ = auth_client
    r = await client.get("/github/callback?code=abc&state=garbage")
    assert r.status_code in (302, 307)
    assert r.headers["location"] == "http://localhost:5173/settings/github?error=state"


@pytest.mark.asyncio
async def test_contributions_requires_connection(auth_client, github_env):
    client, _ = auth_client
    r = await client.get("/github/contributions")
    assert r.status_code == 409
    assert r.json()["error"]["message"] == "GitHub not connected"


@pytest.mark.asyncio
async def test_disconnect(auth_client, github_env, monkeypatch):
    client, _ = auth_client
    from app.github import routes
    from app.github.crypto import sign_state

    async def fake_exchange(code):
        return {"accessToken": "ghp_x", "scope": ""}

    async def fake_user(token):
        return {"id": 1, "login": "u", "avatarUrl": "a"}

    monkeypatch.setattr(routes, "exchange_code", fake_exchange)
    monkeypatch.setattr(routes, "get_authed_user", fake_user)
    await client.get(f"/github/callback?code=c&state={sign_state()}")

    assert (await client.post("/github/disconnect")).status_code == 204
    assert (await client.get("/github/status")).json()["user"] is None

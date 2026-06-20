import pytest


@pytest.mark.asyncio
async def test_signup_login_me_logout(client):
    r = await client.post("/auth/signup", json={"email": "A@Ex.com", "password": "password1"})
    assert r.status_code == 201
    assert r.json()["user"]["email"] == "a@ex.com"

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
    assert (await client.get("/auth/me")).status_code == 200
    bad = await client.post("/auth/change-password", json={"currentPassword": "nopenope", "newPassword": "password3"})
    assert bad.status_code == 400
    assert bad.json()["error"]["message"] == "Current password is incorrect"

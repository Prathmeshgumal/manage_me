import base64
import time

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa


def _rsa_pem() -> tuple[str, str]:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    priv = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()
    pub = key.public_key().public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode()
    return priv, pub


@pytest.fixture
def gh_env(monkeypatch):
    priv, pub = _rsa_pem()
    env = {
        "GITHUB_APP_ID": "12345", "GITHUB_APP_SLUG": "myschedule",
        "GITHUB_APP_CLIENT_ID": "cid", "GITHUB_APP_CLIENT_SECRET": "csecret",
        "GITHUB_APP_PRIVATE_KEY_BASE64": base64.b64encode(priv.encode()).decode(),
        "GITHUB_OAUTH_REDIRECT_URI": "http://localhost:4000/github/callback",
        "GITHUB_TOKEN_ENC_KEY": base64.b64encode(b"0" * 32).decode(),
        "GITHUB_STATE_SECRET": "ss", "FRONTEND_URL": "http://localhost:5173",
    }
    for k, v in env.items():
        monkeypatch.setenv(k, v)
    return pub


def test_app_jwt_claims(gh_env):
    from app.github.app_auth import app_jwt
    token = jwt.decode(app_jwt(), gh_env, algorithms=["RS256"], options={"verify_aud": False})
    assert token["iss"] == "12345"
    assert token["iat"] <= int(time.time())
    assert token["exp"] > int(time.time())


def test_authorize_url(gh_env):
    from app.github.oauth import authorize_url
    url = authorize_url("STATE123")
    assert url.startswith("https://github.com/login/oauth/authorize?")
    assert "client_id=cid" in url and "state=STATE123" in url
    assert "redirect_uri=http%3A%2F%2Flocalhost%3A4000%2Fgithub%2Fcallback" in url


@pytest.mark.asyncio
async def test_exchange_code_and_user(gh_env, monkeypatch):
    from app.github import http
    from app.github.oauth import exchange_code, get_authed_user

    async def fake(method, url, **kw):
        if "access_token" in url:
            return {"access_token": "ghp_x", "scope": "repo"}
        if url.endswith("/user"):
            return {"id": 7, "login": "octo", "avatar_url": "http://a"}
        raise AssertionError(url)

    monkeypatch.setattr(http, "request_json", fake)
    assert await exchange_code("code1") == {"accessToken": "ghp_x", "scope": "repo"}
    assert await get_authed_user("ghp_x") == {"id": 7, "login": "octo", "avatarUrl": "http://a"}


@pytest.mark.asyncio
async def test_exchange_code_error(gh_env, monkeypatch):
    from app.errors import AppError
    from app.github import http
    from app.github.oauth import exchange_code

    async def fake(method, url, **kw):
        return {"error": "bad_verification_code"}

    monkeypatch.setattr(http, "request_json", fake)
    with pytest.raises(AppError):
        await exchange_code("bad")

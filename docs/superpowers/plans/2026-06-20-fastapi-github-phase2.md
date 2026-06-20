# FastAPI Migration — Phase 2 (GitHub) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the GitHub integration (OAuth, App JWT, repos, contents, contributions, encrypted token storage) into `backend-py/` with byte-for-byte API parity, so the frontend GitHub features work unchanged.

**Architecture:** A new `app/github/` package mirrors the TS `backend/src/github/`. All outbound GitHub HTTP goes through one `http.request_json` helper (centralizes timeouts; trivial to mock). Token encryption reuses the exact AES-256-GCM scheme and the same `GITHUB_TOKEN_ENC_KEY`. Two SQLAlchemy models map the existing `GithubUserToken` / `GithubInstallation` tables. Routes mount at `/github` under the Phase 1 `require_auth` dependency.

**Tech Stack:** FastAPI, httpx, PyJWT[crypto] (RS256 App JWT + cryptography for AES-GCM), SQLAlchemy 2.0 async — all on the Phase 1 foundation.

## Global Constraints

- **API parity:** paths, methods, status codes, JSON keys (camelCase), and redirect targets match the TS backend. Frontend unchanged.
- **Response shapes** match `frontend/src/types.ts` (`GithubRepo`, `RepoContents`, `RepoDirEntry`) and `frontend/src/hooks/useGithub.ts` (`GithubStatus`, `ContributionCalendar`, `ContributionDay`).
- **Token encryption:** AES-256-GCM, serialized `b64url(iv).b64url(tag).b64url(data)`, 32-byte key from base64 `GITHUB_TOKEN_ENC_KEY`. Reuse the same key so existing tokens decrypt.
- **OAuth state:** HMAC-SHA256 over base64url `{nonce, exp}`, serialized `payload.sig`; constant-time verify + expiry.
- **App JWT:** RS256, `iss=appId`, `iat=now-60`, `exp=now+540` (≤10 min).
- **Errors:** reuse Phase 1 `AppError` + `{"error":{"message":...}}`. GitHub HTTP failure → `AppError(502, "GitHub request failed (<code>)")`. Not connected (contributions) → `AppError(409, "GitHub not connected")`. Missing config → `AppError(500, ...)`.
- **Mock-not-call in tests:** no network in the suite. Unit-test pure logic; mock `http.request_json` (and route-level helpers) for everything else.
- **Branch:** continue on `feat/fastapi-backend-migration`; one commit per task.

---

## File Structure

```
backend-py/app/github/
  __init__.py
  config.py         # GithubConfig from env (reuse GITHUB_* names); 32-byte key validation
  http.py           # request_json(method, url, ...) — single httpx entry point
  crypto.py         # encrypt_token/decrypt_token (AES-GCM) + sign_state/verify_state (HMAC)
  app_auth.py       # app_jwt(), installation_token(id), get_installation(id)
  oauth.py          # authorize_url(state), exchange_code(code), get_authed_user(token)
  repos.py          # list_repositories(workspace_id)
  contents.py       # get_repo_contents(installation_id, owner, repo, path)
  contributions.py  # level_for_count, map_calendar, fetch_contributions(user_token)
  store.py          # save/get/delete user token; save/list installations (SQLAlchemy)
  routes.py         # github_router (prefix /github, require_auth)
backend-py/app/models.py        # + GithubUserToken, GithubInstallation
backend-py/tests/
  test_github_crypto.py
  test_github_store.py
  test_github_appauth.py
  test_github_data.py            # repos / contents / contributions logic
  test_github_routes.py
```

---

### Task 1: Deps, GitHub config, models, http helper

**Files:**
- Modify: `backend-py/pyproject.toml` (promote httpx to runtime, add pyjwt[crypto])
- Create: `backend-py/app/github/__init__.py`, `backend-py/app/github/config.py`, `backend-py/app/github/http.py`
- Modify: `backend-py/app/models.py` (add two models)

**Interfaces:**
- Produces: `github_config() -> GithubConfig` (attrs: `app_id, slug, client_id, client_secret, private_key, redirect_uri, enc_key: bytes, state_secret, frontend_url`); `request_json(method, url, *, headers=None, json=None, data=None, params=None, raise_for_status=True) -> Any`; models `GithubUserToken`, `GithubInstallation`.

- [ ] **Step 1: Add dependencies**

Run:
```bash
cd backend-py && export PATH="$HOME/.local/bin:$PATH"
uv add httpx "pyjwt[crypto]"
```
Expected: `httpx` moves to `[project.dependencies]`, `pyjwt` + `cryptography` added.

- [ ] **Step 2: Write `app/github/__init__.py` (empty) and `app/github/config.py`**

```python
import base64

from ..config import get_settings
from ..errors import AppError


class GithubConfig:
    def __init__(self) -> None:
        self.app_id = _need("GITHUB_APP_ID")
        self.slug = _need("GITHUB_APP_SLUG")
        self.client_id = _need("GITHUB_APP_CLIENT_ID")
        self.client_secret = _need("GITHUB_APP_CLIENT_SECRET")
        self.private_key = base64.b64decode(_need("GITHUB_APP_PRIVATE_KEY_BASE64")).decode("utf-8")
        self.redirect_uri = _need("GITHUB_OAUTH_REDIRECT_URI")
        self.enc_key = base64.b64decode(_need("GITHUB_TOKEN_ENC_KEY"))
        if len(self.enc_key) != 32:
            raise AppError(500, "GITHUB_TOKEN_ENC_KEY must be 32 bytes (base64)")
        self.state_secret = _need("GITHUB_STATE_SECRET")
        self.frontend_url = _need("FRONTEND_URL")


def _need(name: str) -> str:
    import os

    v = os.environ.get(name)
    if not v:
        raise AppError(500, f"Missing GitHub env: {name}")
    return v


def github_config() -> GithubConfig:
    # Read fresh each call (mirrors the TS behavior; keeps tests able to monkeypatch env).
    _ = get_settings  # imported to keep settings module loaded; not cached here intentionally
    return GithubConfig()
```

- [ ] **Step 3: Write `app/github/http.py`**

```python
from typing import Any

import httpx

from ..errors import AppError

GITHUB_API = "https://api.github.com"
_TIMEOUT = httpx.Timeout(15.0)


async def request_json(
    method: str,
    url: str,
    *,
    headers: dict | None = None,
    json: Any = None,
    data: dict | None = None,
    params: dict | None = None,
    raise_for_status: bool = True,
) -> Any:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.request(method, url, headers=headers, json=json, data=data, params=params)
    if raise_for_status and resp.status_code >= 400:
        raise AppError(502, f"GitHub request failed ({resp.status_code})")
    return resp.json()
```

- [ ] **Step 4: Add models to `app/models.py`**

Append (after the existing models):
```python
class GithubUserToken(Base):
    __tablename__ = "GithubUserToken"
    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    github_user_id: Mapped[int] = mapped_column("githubUserId")
    login: Mapped[str]
    avatar_url: Mapped[str] = mapped_column("avatarUrl")
    access_token: Mapped[str] = mapped_column("accessToken")
    scope: Mapped[str | None]
    workspace_id: Mapped[str] = mapped_column("workspaceId", ForeignKey("Workspace.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column("createdAt", server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column("updatedAt", default=func.now(), onupdate=func.now())


class GithubInstallation(Base):
    __tablename__ = "GithubInstallation"
    id: Mapped[str] = mapped_column(primary_key=True, default=new_id)
    installation_id: Mapped[int] = mapped_column("installationId", unique=True)
    account_login: Mapped[str] = mapped_column("accountLogin")
    account_type: Mapped[str] = mapped_column("accountType")
    repository_selection: Mapped[str] = mapped_column("repositorySelection")
    workspace_id: Mapped[str] = mapped_column("workspaceId", ForeignKey("Workspace.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column("createdAt", server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column("updatedAt", default=func.now(), onupdate=func.now())
```

- [ ] **Step 5: Verify imports + existing suite still green**

Run: `cd backend-py && uv run python -c "import app.github.config, app.github.http, app.models" && uv run pytest -q`
Expected: imports OK; 25 tests still pass.

- [ ] **Step 6: Commit**

```bash
git add backend-py
git commit -m "feat(backend-py): github config, http helper, token/installation models"
```

---

### Task 2: Crypto — token encryption + OAuth state

**Files:**
- Create: `backend-py/app/github/crypto.py`, `backend-py/tests/test_github_crypto.py`

**Interfaces:**
- Produces: `encrypt_token(plain: str) -> str`, `decrypt_token(payload: str) -> str`, `sign_state(ttl_ms: int = 600000) -> str`, `verify_state(state: str) -> bool`.

- [ ] **Step 1: Write the failing test `tests/test_github_crypto.py`**

The ciphertext below was produced by the Node backend's `aes-256-gcm` with the (throwaway) key in `KEY_B64`; Python MUST decrypt it to prove cross-compatibility.
```python
import base64
import json

import pytest

# Node-produced test vector (throwaway key, not a real secret).
KEY_B64 = "ASNFZ4mrze8BI0VniavN7wEjRWeJq83vASNFZ4mrze8="
NODE_CIPHERTEXT = "eeWHgorFs7KvCaS5.-O8Wzi92HnXxgnl_M14rbw.oFLUTkh-jQTbT0nNh8af722EiuQ"
NODE_PLAINTEXT = "ghp_testtoken_ABC123"

GH_ENV = {
    "GITHUB_APP_ID": "1", "GITHUB_APP_SLUG": "test", "GITHUB_APP_CLIENT_ID": "cid",
    "GITHUB_APP_CLIENT_SECRET": "secret",
    "GITHUB_APP_PRIVATE_KEY_BASE64": base64.b64encode(b"x").decode(),
    "GITHUB_OAUTH_REDIRECT_URI": "http://localhost:4000/github/callback",
    "GITHUB_STATE_SECRET": "state-secret", "FRONTEND_URL": "http://localhost:5173",
}


@pytest.fixture
def gh_env(monkeypatch):
    for k, v in {**GH_ENV, "GITHUB_TOKEN_ENC_KEY": KEY_B64}.items():
        monkeypatch.setenv(k, v)


def test_decrypts_node_ciphertext(gh_env):
    from app.github.crypto import decrypt_token
    assert decrypt_token(NODE_CIPHERTEXT) == NODE_PLAINTEXT


def test_encrypt_decrypt_roundtrip(gh_env):
    from app.github.crypto import decrypt_token, encrypt_token
    blob = encrypt_token("hello-token")
    assert blob.count(".") == 2
    assert decrypt_token(blob) == "hello-token"


def test_state_sign_verify(gh_env):
    from app.github.crypto import sign_state, verify_state
    s = sign_state()
    assert verify_state(s) is True
    assert verify_state(s + "x") is False
    assert verify_state("garbage") is False


def test_state_expired(gh_env):
    from app.github.crypto import sign_state, verify_state
    assert verify_state(sign_state(ttl_ms=-1)) is False
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend-py && uv run pytest tests/test_github_crypto.py -v`
Expected: FAIL (module missing).

- [ ] **Step 3: Write `app/github/crypto.py`**

```python
import base64
import hmac
import json
import os
from hashlib import sha256

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from .config import github_config


def _b64u(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _from_b64u(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def encrypt_token(plain: str) -> str:
    key = github_config().enc_key
    iv = os.urandom(12)
    ct = AESGCM(key).encrypt(iv, plain.encode(), None)  # ciphertext || 16-byte tag
    data, tag = ct[:-16], ct[-16:]
    return ".".join([_b64u(iv), _b64u(tag), _b64u(data)])


def decrypt_token(payload: str) -> str:
    key = github_config().enc_key
    iv_s, tag_s, data_s = payload.split(".")
    iv, tag, data = _from_b64u(iv_s), _from_b64u(tag_s), _from_b64u(data_s)
    return AESGCM(key).decrypt(iv, data + tag, None).decode()


def _hmac(payload: str) -> str:
    secret = github_config().state_secret.encode()
    return _b64u(hmac.new(secret, payload.encode(), sha256).digest())


def sign_state(ttl_ms: int = 10 * 60 * 1000) -> str:
    import time

    body = {"nonce": _b64u(os.urandom(8)), "exp": int(time.time() * 1000) + ttl_ms}
    payload = _b64u(json.dumps(body).encode())
    return f"{payload}.{_hmac(payload)}"


def verify_state(state: str) -> bool:
    import time

    parts = state.split(".")
    if len(parts) != 2 or not parts[0] or not parts[1]:
        return False
    payload, sig = parts
    expected = _hmac(payload)
    if not hmac.compare_digest(sig, expected):
        return False
    try:
        body = json.loads(_from_b64u(payload).decode())
        return isinstance(body.get("exp"), int) and time.time() * 1000 < body["exp"]
    except Exception:
        return False
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend-py && uv run pytest tests/test_github_crypto.py -v`
Expected: PASS — including `test_decrypts_node_ciphertext` (Node↔Python AES-GCM parity).

- [ ] **Step 5: Commit**

```bash
git add backend-py
git commit -m "feat(backend-py): github token encryption + OAuth state (Node-compatible)"
```

---

### Task 3: Store (SQLAlchemy CRUD)

**Files:**
- Create: `backend-py/app/github/store.py`, `backend-py/tests/test_github_store.py`

**Interfaces:**
- Consumes: models, `encrypt_token`/`decrypt_token`, `AsyncSession`.
- Produces: `save_user_token(db, *, workspace_id, github_user_id, login, avatar_url, access_token, scope) -> None`; `get_user_token(db, workspace_id) -> dict | None` (`{login, avatarUrl, accessToken}`); `delete_user_token(db, workspace_id) -> None`; `save_installation(db, *, workspace_id, installation_id, account_login, account_type, repository_selection) -> None`; `list_installations(db, workspace_id) -> list[dict]` (`{installationId, accountLogin, accountType, repositorySelection}`).

- [ ] **Step 1: Write the failing test `tests/test_github_store.py`**

```python
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend-py && uv run pytest tests/test_github_store.py -v`
Expected: FAIL (module missing).

- [ ] **Step 3: Write `app/github/store.py`**

```python
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from ..ids import new_id
from ..models import GithubInstallation, GithubUserToken
from .crypto import decrypt_token, encrypt_token


async def save_user_token(
    db: AsyncSession, *, workspace_id: str, github_user_id: int, login: str,
    avatar_url: str, access_token: str, scope: str,
) -> None:
    row = (
        await db.execute(
            sa.select(GithubUserToken).where(
                GithubUserToken.workspace_id == workspace_id,
                GithubUserToken.github_user_id == github_user_id,
            )
        )
    ).scalar_one_or_none()
    enc = encrypt_token(access_token)
    if row is None:
        db.add(GithubUserToken(
            id=new_id(), workspace_id=workspace_id, github_user_id=github_user_id,
            login=login, avatar_url=avatar_url, access_token=enc, scope=scope,
        ))
    else:
        row.login = login
        row.avatar_url = avatar_url
        row.access_token = enc
        row.scope = scope
    await db.commit()


async def get_user_token(db: AsyncSession, workspace_id: str) -> dict | None:
    row = (
        await db.execute(
            sa.select(GithubUserToken)
            .where(GithubUserToken.workspace_id == workspace_id)
            .order_by(GithubUserToken.created_at.asc())
        )
    ).scalars().first()
    if row is None:
        return None
    return {"login": row.login, "avatarUrl": row.avatar_url, "accessToken": decrypt_token(row.access_token)}


async def delete_user_token(db: AsyncSession, workspace_id: str) -> None:
    await db.execute(sa.delete(GithubUserToken).where(GithubUserToken.workspace_id == workspace_id))
    await db.commit()


async def save_installation(
    db: AsyncSession, *, workspace_id: str, installation_id: int, account_login: str,
    account_type: str, repository_selection: str,
) -> None:
    row = (
        await db.execute(
            sa.select(GithubInstallation).where(GithubInstallation.installation_id == installation_id)
        )
    ).scalar_one_or_none()
    if row is None:
        db.add(GithubInstallation(
            id=new_id(), installation_id=installation_id, workspace_id=workspace_id,
            account_login=account_login, account_type=account_type, repository_selection=repository_selection,
        ))
    else:
        row.workspace_id = workspace_id
        row.account_login = account_login
        row.account_type = account_type
        row.repository_selection = repository_selection
    await db.commit()


async def list_installations(db: AsyncSession, workspace_id: str) -> list[dict]:
    rows = (
        await db.execute(
            sa.select(GithubInstallation)
            .where(GithubInstallation.workspace_id == workspace_id)
            .order_by(GithubInstallation.created_at.asc())
        )
    ).scalars().all()
    return [
        {
            "installationId": r.installation_id, "accountLogin": r.account_login,
            "accountType": r.account_type, "repositorySelection": r.repository_selection,
        }
        for r in rows
    ]
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend-py && uv run pytest tests/test_github_store.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend-py
git commit -m "feat(backend-py): github token/installation store (encrypted at rest)"
```

---

### Task 4: App auth (JWT + installation token) and OAuth

**Files:**
- Create: `backend-py/app/github/app_auth.py`, `backend-py/app/github/oauth.py`, `backend-py/tests/test_github_appauth.py`

**Interfaces:**
- Consumes: `github_config`, `http` (module; call `http.request_json`).
- Produces: `app_jwt() -> str`; `installation_token(installation_id: int) -> str`; `get_installation(installation_id: int) -> dict` (`{installationId, accountLogin, accountType, repositorySelection}`); `authorize_url(state: str) -> str`; `exchange_code(code: str) -> dict` (`{accessToken, scope}`); `get_authed_user(access_token: str) -> dict` (`{id, login, avatarUrl}`).

- [ ] **Step 1: Write the failing test `tests/test_github_appauth.py`**

```python
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
    monkeypatch._pub = pub  # stash for the test
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend-py && uv run pytest tests/test_github_appauth.py -v`
Expected: FAIL (modules missing).

- [ ] **Step 3: Write `app/github/app_auth.py`**

```python
import time

import jwt

from . import http
from .config import github_config


def app_jwt() -> str:
    c = github_config()
    now = int(time.time())
    payload = {"iat": now - 60, "exp": now + 540, "iss": c.app_id}
    return jwt.encode(payload, c.private_key, algorithm="RS256")


def _app_headers() -> dict:
    return {"Authorization": f"Bearer {app_jwt()}", "Accept": "application/vnd.github+json"}


async def installation_token(installation_id: int) -> str:
    data = await http.request_json(
        "POST", f"{http.GITHUB_API}/app/installations/{installation_id}/access_tokens",
        headers=_app_headers(),
    )
    return data["token"]


async def get_installation(installation_id: int) -> dict:
    d = await http.request_json(
        "GET", f"{http.GITHUB_API}/app/installations/{installation_id}", headers=_app_headers(),
    )
    return {
        "installationId": d["id"],
        "accountLogin": d["account"]["login"],
        "accountType": d["account"]["type"],
        "repositorySelection": d["repository_selection"],
    }
```

- [ ] **Step 4: Write `app/github/oauth.py`**

```python
from urllib.parse import urlencode

from ..errors import AppError
from . import http
from .config import github_config


def authorize_url(state: str) -> str:
    c = github_config()
    qs = urlencode({"client_id": c.client_id, "redirect_uri": c.redirect_uri, "state": state})
    return f"https://github.com/login/oauth/authorize?{qs}"


async def exchange_code(code: str) -> dict:
    c = github_config()
    data = await http.request_json(
        "POST", "https://github.com/login/oauth/access_token",
        headers={"Accept": "application/json"},
        json={"client_id": c.client_id, "client_secret": c.client_secret,
              "code": code, "redirect_uri": c.redirect_uri},
    )
    if data.get("error") or not data.get("access_token"):
        raise AppError(400, f"GitHub OAuth failed: {data.get('error', 'no token')}")
    return {"accessToken": data["access_token"], "scope": data.get("scope", "")}


async def get_authed_user(access_token: str) -> dict:
    u = await http.request_json(
        "GET", f"{http.GITHUB_API}/user", headers={"Authorization": f"token {access_token}"},
    )
    return {"id": u["id"], "login": u["login"], "avatarUrl": u["avatar_url"]}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd backend-py && uv run pytest tests/test_github_appauth.py -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend-py
git commit -m "feat(backend-py): github app JWT, installation tokens, OAuth"
```

---

### Task 5: Data helpers — repos, contents, contributions

**Files:**
- Create: `backend-py/app/github/repos.py`, `backend-py/app/github/contents.py`, `backend-py/app/github/contributions.py`, `backend-py/tests/test_github_data.py`

**Interfaces:**
- Consumes: `installation_token`, `http`, `list_installations`, `AsyncSession`.
- Produces: `list_repositories(db, workspace_id) -> list[dict]` (`{id, fullName, private, installationId}`); `get_repo_contents(installation_id, owner, repo, path) -> dict`; `level_for_count(n) -> int`; `map_calendar(raw) -> dict`; `fetch_contributions(user_token) -> dict`.

- [ ] **Step 1: Write the failing test `tests/test_github_data.py`**

```python
import base64

import pytest


@pytest.fixture
def gh_env(monkeypatch):
    env = {
        "GITHUB_APP_ID": "1", "GITHUB_APP_SLUG": "t", "GITHUB_APP_CLIENT_ID": "c",
        "GITHUB_APP_CLIENT_SECRET": "s", "GITHUB_APP_PRIVATE_KEY_BASE64": base64.b64encode(b"x").decode(),
        "GITHUB_OAUTH_REDIRECT_URI": "http://x/cb", "GITHUB_STATE_SECRET": "ss",
        "FRONTEND_URL": "http://x", "GITHUB_TOKEN_ENC_KEY": base64.b64encode(b"0" * 32).decode(),
    }
    for k, v in env.items():
        monkeypatch.setenv(k, v)


def test_level_for_count():
    from app.github.contributions import level_for_count
    assert [level_for_count(n) for n in (0, 1, 3, 4, 6, 7, 9, 10, 50)] == [0, 1, 1, 2, 2, 3, 3, 4, 4]


def test_map_calendar():
    from app.github.contributions import map_calendar
    raw = {"user": {"contributionsCollection": {"contributionCalendar": {
        "totalContributions": 5,
        "weeks": [{"contributionDays": [{"date": "2026-01-01", "contributionCount": 4}]}],
    }}}}
    cal = map_calendar(raw)
    assert cal == {"totalContributions": 5,
                   "weeks": [{"days": [{"date": "2026-01-01", "count": 4, "level": 2}]}]}


@pytest.mark.asyncio
async def test_get_repo_contents_dir(gh_env, monkeypatch):
    from app.github import app_auth, http
    from app.github.contents import get_repo_contents

    async def fake_token(_id):
        return "tok"

    async def fake(method, url, **kw):
        return [
            {"name": "b.txt", "path": "b.txt", "type": "file"},
            {"name": "src", "path": "src", "type": "dir"},
        ]

    monkeypatch.setattr(app_auth, "installation_token", fake_token)
    monkeypatch.setattr(http, "request_json", fake)
    out = await get_repo_contents(1, "o", "r", "")
    assert out["type"] == "dir"
    assert [e["name"] for e in out["entries"]] == ["src", "b.txt"]  # dirs first, then name


@pytest.mark.asyncio
async def test_get_repo_contents_file(gh_env, monkeypatch):
    from app.github import app_auth, http
    from app.github.contents import get_repo_contents

    async def fake_token(_id):
        return "tok"

    async def fake(method, url, **kw):
        return {"name": "a.txt", "path": "a.txt", "size": 5,
                "encoding": "base64", "content": base64.b64encode(b"hello").decode()}

    monkeypatch.setattr(app_auth, "installation_token", fake_token)
    monkeypatch.setattr(http, "request_json", fake)
    out = await get_repo_contents(1, "o", "r", "a.txt")
    assert out == {"type": "file", "name": "a.txt", "path": "a.txt", "size": 5,
                   "content": "hello", "isBinary": False, "tooLarge": False}


@pytest.mark.asyncio
async def test_get_repo_contents_binary(gh_env, monkeypatch):
    from app.github import app_auth, http
    from app.github.contents import get_repo_contents

    async def fake_token(_id):
        return "tok"

    async def fake(method, url, **kw):
        return {"name": "x.bin", "path": "x.bin", "size": 3,
                "encoding": "base64", "content": base64.b64encode(b"\x00\x01\x02").decode()}

    monkeypatch.setattr(app_auth, "installation_token", fake_token)
    monkeypatch.setattr(http, "request_json", fake)
    out = await get_repo_contents(1, "o", "r", "x.bin")
    assert out["isBinary"] is True and out["content"] == ""
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend-py && uv run pytest tests/test_github_data.py -v`
Expected: FAIL (modules missing).

- [ ] **Step 3: Write `app/github/contributions.py`**

```python
from . import http

QUERY = """query {
  viewer { contributionsCollection { contributionCalendar {
    totalContributions
    weeks { contributionDays { date contributionCount } }
  } } }
}"""


def level_for_count(count: int) -> int:
    if count <= 0:
        return 0
    if count <= 3:
        return 1
    if count <= 6:
        return 2
    if count <= 9:
        return 3
    return 4


def map_calendar(raw: dict) -> dict:
    cal = raw["user"]["contributionsCollection"]["contributionCalendar"]
    return {
        "totalContributions": cal["totalContributions"],
        "weeks": [
            {"days": [
                {"date": d["date"], "count": d["contributionCount"], "level": level_for_count(d["contributionCount"])}
                for d in w["contributionDays"]
            ]}
            for w in cal["weeks"]
        ],
    }


async def fetch_contributions(user_token: str) -> dict:
    data = await http.request_json(
        "POST", f"{http.GITHUB_API}/graphql",
        headers={"Authorization": f"token {user_token}"},
        json={"query": QUERY},
    )
    return map_calendar({"user": data["data"]["viewer"]})
```

- [ ] **Step 4: Write `app/github/contents.py`**

```python
import base64

from . import app_auth, http

MAX_BYTES = 1_000_000


def _looks_binary(buf: bytes) -> bool:
    return b"\x00" in buf[:8000]


async def get_repo_contents(installation_id: int, owner: str, repo: str, path: str) -> dict:
    token = await app_auth.installation_token(installation_id)
    data = await http.request_json(
        "GET", f"{http.GITHUB_API}/repos/{owner}/{repo}/contents/{path}",
        headers={"Authorization": f"token {token}"},
    )
    if isinstance(data, list):
        entries = [
            {"name": e["name"], "path": e["path"], "type": "dir" if e["type"] == "dir" else "file"}
            for e in data
        ]
        entries.sort(key=lambda e: (0 if e["type"] == "dir" else 1, e["name"]))
        return {"type": "dir", "entries": entries}

    base = {"type": "file", "name": data["name"], "path": data["path"], "size": data["size"]}
    if data["size"] > MAX_BYTES or data.get("encoding") != "base64" or not data.get("content"):
        return {**base, "content": "", "isBinary": False, "tooLarge": data["size"] > MAX_BYTES}
    buf = base64.b64decode(data["content"])
    if _looks_binary(buf):
        return {**base, "content": "", "isBinary": True, "tooLarge": False}
    return {**base, "content": buf.decode("utf-8", errors="replace"), "isBinary": False, "tooLarge": False}
```

- [ ] **Step 5: Write `app/github/repos.py`**

```python
from sqlalchemy.ext.asyncio import AsyncSession

from . import app_auth, http
from .store import list_installations


async def list_repositories(db: AsyncSession, workspace_id: str) -> list[dict]:
    installations = await list_installations(db, workspace_id)
    out: list[dict] = []
    for inst in installations:
        token = await app_auth.installation_token(inst["installationId"])
        data = await http.request_json(
            "GET", f"{http.GITHUB_API}/installation/repositories",
            headers={"Authorization": f"token {token}"}, params={"per_page": 100},
        )
        for r in data["repositories"]:
            out.append({"id": r["id"], "fullName": r["full_name"],
                        "private": r["private"], "installationId": inst["installationId"]})
    out.sort(key=lambda r: r["fullName"])
    return out
```

- [ ] **Step 6: Run to verify it passes**

Run: `cd backend-py && uv run pytest tests/test_github_data.py -v`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend-py
git commit -m "feat(backend-py): github repos, repo contents, contributions"
```

---

### Task 6: Routes + mount + route tests

**Files:**
- Create: `backend-py/app/github/routes.py`, `backend-py/tests/test_github_routes.py`
- Modify: `backend-py/app/main.py` (mount), `backend-py/tests/conftest.py` (github env fixture)

**Interfaces:**
- Consumes: all github helpers, `require_auth`, `get_db`.
- Produces: `github_router` (prefix `/github`, `require_auth`); mounted in `create_app`.

- [ ] **Step 1: Add a reusable github env fixture to `tests/conftest.py`**

Append:
```python
import base64 as _b64


@pytest.fixture
def github_env(monkeypatch):
    env = {
        "GITHUB_APP_ID": "12345", "GITHUB_APP_SLUG": "myschedule",
        "GITHUB_APP_CLIENT_ID": "cid", "GITHUB_APP_CLIENT_SECRET": "csecret",
        "GITHUB_APP_PRIVATE_KEY_BASE64": _b64.b64encode(b"unused-here").decode(),
        "GITHUB_OAUTH_REDIRECT_URI": "http://localhost:4000/github/callback",
        "GITHUB_TOKEN_ENC_KEY": _b64.b64encode(b"0" * 32).decode(),
        "GITHUB_STATE_SECRET": "state-secret", "FRONTEND_URL": "http://localhost:5173",
    }
    for k, v in env.items():
        monkeypatch.setenv(k, v)
```

- [ ] **Step 2: Write the failing tests `tests/test_github_routes.py`**

```python
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
    from app.github import oauth, routes
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

    async def fake_exchange(code):
        return {"accessToken": "ghp_x", "scope": ""}

    async def fake_user(token):
        return {"id": 1, "login": "u", "avatarUrl": "a"}

    monkeypatch.setattr(routes, "exchange_code", fake_exchange)
    monkeypatch.setattr(routes, "get_authed_user", fake_user)
    from app.github.crypto import sign_state
    await client.get(f"/github/callback?code=c&state={sign_state()}")

    assert (await client.post("/github/disconnect")).status_code == 204
    assert (await client.get("/github/status")).json()["user"] is None
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd backend-py && uv run pytest tests/test_github_routes.py -v`
Expected: FAIL (router not mounted → 404/401 mismatches).

- [ ] **Step 4: Write `app/github/routes.py`**

```python
from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.deps import AuthContext, require_auth
from ..db import get_db
from ..errors import AppError
from .app_auth import get_installation
from .config import github_config
from .contents import get_repo_contents
from .contributions import fetch_contributions
from .crypto import sign_state, verify_state
from .oauth import authorize_url, exchange_code, get_authed_user
from .repos import list_repositories
from .store import (
    delete_user_token, get_user_token, list_installations, save_installation, save_user_token,
)

github_router = APIRouter(prefix="/github", dependencies=[Depends(require_auth)])


@github_router.get("/status")
async def status(ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    user = await get_user_token(db, ctx.workspace_id)
    return {
        "user": {"login": user["login"], "avatarUrl": user["avatarUrl"]} if user else None,
        "installations": await list_installations(db, ctx.workspace_id),
    }


@github_router.get("/authorize")
async def authorize(_ctx: AuthContext = Depends(require_auth)):
    return RedirectResponse(authorize_url(sign_state()), status_code=302)


@github_router.get("/callback")
async def callback(
    code: str = "", state: str = "",
    ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db),
):
    back = f"{github_config().frontend_url}/settings/github"
    if not verify_state(state):
        return RedirectResponse(f"{back}?error=state", status_code=302)
    if not code:
        return RedirectResponse(f"{back}?error=code", status_code=302)
    tok = await exchange_code(code)
    user = await get_authed_user(tok["accessToken"])
    await save_user_token(
        db, workspace_id=ctx.workspace_id, github_user_id=user["id"], login=user["login"],
        avatar_url=user["avatarUrl"], access_token=tok["accessToken"], scope=tok["scope"],
    )
    return RedirectResponse(f"{back}?connected=1", status_code=302)


@github_router.get("/install")
async def install(_ctx: AuthContext = Depends(require_auth)):
    return RedirectResponse(
        f"https://github.com/apps/{github_config().slug}/installations/new", status_code=302
    )


@github_router.get("/setup")
async def setup(
    installation_id: int = Query(0, alias="installation_id"),
    ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db),
):
    back = f"{github_config().frontend_url}/settings/github"
    if not installation_id:
        return RedirectResponse(f"{back}?error=install", status_code=302)
    meta = await get_installation(installation_id)
    await save_installation(
        db, workspace_id=ctx.workspace_id, installation_id=meta["installationId"],
        account_login=meta["accountLogin"], account_type=meta["accountType"],
        repository_selection=meta["repositorySelection"],
    )
    return RedirectResponse(f"{back}?installed=1", status_code=302)


@github_router.get("/repositories")
async def repositories(ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    return await list_repositories(db, ctx.workspace_id)


@github_router.get("/repos/contents")
async def repo_contents(
    installationId: int = Query(...), owner: str = Query(..., min_length=1),
    repo: str = Query(..., min_length=1), path: str = Query(""),
    _ctx: AuthContext = Depends(require_auth),
):
    return await get_repo_contents(installationId, owner, repo, path)


@github_router.get("/contributions")
async def contributions(ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    user = await get_user_token(db, ctx.workspace_id)
    if user is None:
        raise AppError(409, "GitHub not connected")
    return await fetch_contributions(user["accessToken"])


@github_router.post("/disconnect", status_code=204)
async def disconnect(ctx: AuthContext = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    await delete_user_token(db, ctx.workspace_id)
    return Response(status_code=204)
```

- [ ] **Step 5: Mount in `app/main.py`**

Add `from .github.routes import github_router` with the other router imports, and `app.include_router(github_router)` alongside the others (before the catch-all 404).

- [ ] **Step 6: Run github routes + full suite**

Run: `cd backend-py && uv run pytest -q`
Expected: all tests pass (Phase 1's 25 + the new GitHub tests).

- [ ] **Step 7: Commit**

```bash
git add backend-py
git commit -m "feat(backend-py): github routes (status/oauth/install/repos/contents/contributions)"
```

---

## Self-Review

**Spec coverage:**
- Deps (httpx runtime, pyjwt[crypto]) → Task 1. ✓
- GitHub config + 32-byte key validation → Task 1. ✓
- Models (GithubUserToken, GithubInstallation) → Task 1. ✓
- AES-256-GCM token crypto + Node cross-decrypt + state HMAC → Task 2. ✓
- Store (encrypted at rest, upsert, list) → Task 3. ✓
- App JWT (RS256, iss/iat/exp) + installation token + get-installation → Task 4. ✓
- OAuth (authorize/exchange/user) → Task 4. ✓
- repos / contents (binary/too-large/sort) / contributions (level/map/fetch) → Task 5. ✓
- All 9 endpoints + redirects + 409 + require_auth → Task 6. ✓
- Mock-not-call testing → all tasks (monkeypatch `http.request_json` / route helpers). ✓
- Cutover → out of scope for this plan (separate step in the spec, executed on go-ahead). ✓

**Placeholder scan:** No TBD/stubs; every code step has full content; the Node test vector is a real value.

**Type consistency:** `http.request_json` signature stable across callers; modules call `http.request_json` / `app_auth.installation_token` via module references (so monkeypatch works); store returns camelCase dicts consumed by routes; `AuthContext(user_id, workspace_id)` reused; route helper names (`exchange_code`, `get_authed_user`, `get_installation`) match the monkeypatch targets in tests.

**Known divergences (frontend-safe):** GitHub HTTP failures map to `AppError(502)` (TS bubbled to a generic 500) — frontend only reads `error.message`. `/repos/contents` validation uses FastAPI Query params (→ our 400 "Validation failed" handler) matching the TS Zod 400.

## Note on `/setup` test

`get_installation` for `/setup` requires a valid App JWT signed with a real RSA key; the `github_env` fixture uses a dummy private key, so `/setup` is covered by the unit test in Task 4 (claims) and verified live at cutover rather than via a route test here.

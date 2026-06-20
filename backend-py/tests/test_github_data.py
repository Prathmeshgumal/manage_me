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

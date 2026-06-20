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

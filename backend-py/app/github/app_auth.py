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

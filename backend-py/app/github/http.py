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

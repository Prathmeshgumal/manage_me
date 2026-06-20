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

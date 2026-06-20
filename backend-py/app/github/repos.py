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

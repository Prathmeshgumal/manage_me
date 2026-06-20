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

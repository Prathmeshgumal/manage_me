from datetime import datetime

from fastapi import Response

from ..config import get_settings

SESSION_COOKIE = "sid"
_MAX_AGE = 30 * 24 * 60 * 60


def _opts() -> dict:
    prod = get_settings().is_prod
    return {
        "httponly": True,
        "secure": prod,
        "samesite": "none" if prod else "lax",
        "path": "/",
    }


def set_session_cookie(response: Response, token: str, expires_at: datetime) -> None:
    response.set_cookie(SESSION_COOKIE, token, max_age=_MAX_AGE, **_opts())


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, **_opts())

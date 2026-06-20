import base64
import os

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
    v = os.environ.get(name)
    if not v:
        raise AppError(500, f"Missing GitHub env: {name}")
    return v


def github_config() -> GithubConfig:
    # Read env fresh each call (mirrors the TS behavior; lets tests monkeypatch env).
    return GithubConfig()

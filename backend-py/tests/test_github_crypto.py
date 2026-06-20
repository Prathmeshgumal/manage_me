import base64

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

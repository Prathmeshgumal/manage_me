import base64
import hmac
import json
import os
import time
from hashlib import sha256

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from .config import github_config


def _b64u(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _from_b64u(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def encrypt_token(plain: str) -> str:
    key = github_config().enc_key
    iv = os.urandom(12)
    ct = AESGCM(key).encrypt(iv, plain.encode(), None)  # ciphertext || 16-byte tag
    data, tag = ct[:-16], ct[-16:]
    return ".".join([_b64u(iv), _b64u(tag), _b64u(data)])


def decrypt_token(payload: str) -> str:
    key = github_config().enc_key
    iv_s, tag_s, data_s = payload.split(".")
    iv, tag, data = _from_b64u(iv_s), _from_b64u(tag_s), _from_b64u(data_s)
    return AESGCM(key).decrypt(iv, data + tag, None).decode()


def _hmac(payload: str) -> str:
    secret = github_config().state_secret.encode()
    return _b64u(hmac.new(secret, payload.encode(), sha256).digest())


def sign_state(ttl_ms: int = 10 * 60 * 1000) -> str:
    body = {"nonce": _b64u(os.urandom(8)), "exp": int(time.time() * 1000) + ttl_ms}
    payload = _b64u(json.dumps(body).encode())
    return f"{payload}.{_hmac(payload)}"


def verify_state(state: str) -> bool:
    parts = state.split(".")
    if len(parts) != 2 or not parts[0] or not parts[1]:
        return False
    payload, sig = parts
    expected = _hmac(payload)
    if not hmac.compare_digest(sig, expected):
        return False
    try:
        body = json.loads(_from_b64u(payload).decode())
        return isinstance(body.get("exp"), int) and time.time() * 1000 < body["exp"]
    except Exception:
        return False

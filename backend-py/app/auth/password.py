import hashlib
import hmac
import secrets

_KEYLEN = 64
_N = 16384
_R = 8
_P = 1
_MAXMEM = 64 * 1024 * 1024  # high enough for n=16384,r=8; output is independent of this bound


def _scrypt(plain: str, salt: bytes) -> bytes:
    return hashlib.scrypt(plain.encode(), salt=salt, n=_N, r=_R, p=_P, dklen=_KEYLEN, maxmem=_MAXMEM)


def hash_password(plain: str) -> str:
    salt = secrets.token_bytes(16)
    return f"{salt.hex()}:{_scrypt(plain, salt).hex()}"


def verify_password(plain: str, stored: str) -> bool:
    salt_hex, _, hash_hex = stored.partition(":")
    if not salt_hex or not hash_hex:
        return False
    try:
        expected = bytes.fromhex(hash_hex)
        actual = _scrypt(plain, bytes.fromhex(salt_hex))
    except ValueError:
        return False
    return hmac.compare_digest(expected, actual)

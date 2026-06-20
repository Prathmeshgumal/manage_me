from app.auth.password import hash_password, verify_password

NODE_HASH = (
    "1d1890879305febef3f8471a3bc2fff6:"
    "504a6639f2c294478c46a0e2197c7c167094c27517f24f7c57631e32b2529ca2"
    "a05b2c66f42f26ed652638c08dbb4dd150b5817350e66bfdee5578c876d09834"
)


def test_verifies_node_generated_hash():
    assert verify_password("password1", NODE_HASH) is True


def test_rejects_wrong_password():
    assert verify_password("wrongpassword", NODE_HASH) is False


def test_roundtrip():
    h = hash_password("hunter2hunter2")
    assert verify_password("hunter2hunter2", h) is True
    assert verify_password("nope", h) is False


def test_malformed_returns_false():
    assert verify_password("x", "notahash") is False

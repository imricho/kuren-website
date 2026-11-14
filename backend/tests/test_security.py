from app.core import security


def test_password_hash_roundtrip() -> None:
    hashed = security.hash_password("wedding-bells")
    assert hashed != "wedding-bells"
    assert security.verify_password("wedding-bells", hashed)
    assert not security.verify_password("wrong", hashed)


def test_verify_password_handles_garbage_hash() -> None:
    assert not security.verify_password("anything", "not-a-hash")


def test_session_tokens_are_unique_and_hashed_deterministically() -> None:
    a, b = security.generate_session_token(), security.generate_session_token()
    assert a != b and len(a) >= 43
    assert security.hash_session_token(a) == security.hash_session_token(a)
    assert security.hash_session_token(a) != a

"""Password hashing and session-token primitives."""

import hashlib
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

# Argon2id with the library's recommended (RFC 9106 low-memory) parameters.
_hasher = PasswordHasher()

# Used to keep login timing similar whether or not the email exists.
_DUMMY_HASH = _hasher.hash("timing-equalisation-only")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def password_needs_rehash(password_hash: str) -> bool:
    return _hasher.check_needs_rehash(password_hash)


def burn_password_check(password: str) -> None:
    """Spend the same time as a real verification (for unknown accounts)."""
    verify_password(password, _DUMMY_HASH)


def generate_session_token() -> str:
    """256 bits of randomness, URL-safe."""
    return secrets.token_urlsafe(32)


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

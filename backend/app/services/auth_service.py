"""Authentication business logic: accounts, credentials and sessions.

Route handlers stay thin; everything that touches users or sessions lives here.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import security
from app.core.errors import ConflictError, InvalidCredentialsError
from app.models import User, UserSession

# Avoid a DB write on every request; refresh "last seen" at most this often.
_LAST_SEEN_RESOLUTION = timedelta(minutes=5)


@dataclass(frozen=True)
class IssuedSession:
    token: str  # raw token: goes into the cookie, never stored
    expires_at: datetime


def normalise_email(email: str) -> str:
    return email.strip().lower()


def _now() -> datetime:
    return datetime.now(UTC)


def register_user(db: Session, *, email: str, password: str, full_name: str) -> User:
    email = normalise_email(email)
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        raise ConflictError("An account with this email already exists.")

    user = User(email=email, password_hash=security.hash_password(password), full_name=full_name)
    db.add(user)
    try:
        db.commit()
    except IntegrityError:  # concurrent registration with the same email
        db.rollback()
        raise ConflictError("An account with this email already exists.") from None
    db.refresh(user)
    return user


def authenticate(db: Session, *, email: str, password: str) -> User:
    user = db.scalar(select(User).where(User.email == normalise_email(email)))
    if user is None:
        security.burn_password_check(password)
        raise InvalidCredentialsError()
    if not security.verify_password(password, user.password_hash) or not user.is_active:
        raise InvalidCredentialsError()

    if security.password_needs_rehash(user.password_hash):
        user.password_hash = security.hash_password(password)
        db.commit()
    return user


def create_session(db: Session, user: User, *, ttl: timedelta) -> IssuedSession:
    now = _now()
    token = security.generate_session_token()
    expires_at = now + ttl

    # Opportunistic housekeeping: drop this user's expired sessions.
    db.execute(
        delete(UserSession).where(UserSession.user_id == user.id, UserSession.expires_at <= now)
    )
    db.add(
        UserSession(
            user_id=user.id,
            token_hash=security.hash_session_token(token),
            expires_at=expires_at,
            last_seen_at=now,
        )
    )
    db.commit()
    return IssuedSession(token=token, expires_at=expires_at)


def get_user_for_session_token(db: Session, token: str) -> User | None:
    """Resolve a raw session token to an active user, or None if invalid/expired."""
    session = db.scalar(
        select(UserSession).where(UserSession.token_hash == security.hash_session_token(token))
    )
    if session is None:
        return None

    now = _now()
    if session.expires_at <= now:
        db.delete(session)
        db.commit()
        return None

    user = session.user
    if not user.is_active:
        return None

    if now - session.last_seen_at > _LAST_SEEN_RESOLUTION:
        session.last_seen_at = now
        db.commit()
    return user


def revoke_session(db: Session, token: str) -> None:
    db.execute(
        delete(UserSession).where(UserSession.token_hash == security.hash_session_token(token))
    )
    db.commit()

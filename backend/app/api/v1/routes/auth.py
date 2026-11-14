from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Response, status

from app.api.deps import AppSettings, DbSession, get_session_token
from app.core.config import Settings
from app.schemas.auth import LoginRequest, RegisterRequest
from app.schemas.user import UserRead
from app.services import auth_service
from app.services.auth_service import IssuedSession

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_session_cookie(response: Response, settings: Settings, session: IssuedSession) -> None:
    response.set_cookie(
        key=settings.session_cookie_name,
        value=session.token,
        max_age=settings.session_ttl_hours * 3600,
        expires=session.expires_at,
        path="/",
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
    )


def _clear_session_cookie(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
    )


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest, response: Response, db: DbSession, settings: AppSettings
) -> UserRead:
    """Create an account and sign the new user in."""
    user = auth_service.register_user(
        db, email=payload.email, password=payload.password, full_name=payload.full_name
    )
    session = auth_service.create_session(db, user, ttl=timedelta(hours=settings.session_ttl_hours))
    _set_session_cookie(response, settings, session)
    return UserRead.model_validate(user)


@router.post("/login", response_model=UserRead)
def login(
    payload: LoginRequest, response: Response, db: DbSession, settings: AppSettings
) -> UserRead:
    user = auth_service.authenticate(db, email=payload.email, password=payload.password)
    session = auth_service.create_session(db, user, ttl=timedelta(hours=settings.session_ttl_hours))
    _set_session_cookie(response, settings, session)
    return UserRead.model_validate(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    db: DbSession,
    settings: AppSettings,
    token: Annotated[str | None, Depends(get_session_token)],
) -> Response:
    """Revoke the current session server-side and clear the cookie.

    Idempotent: always succeeds, so a client with an already-expired session
    can still clear its cookie.
    """
    if token:
        auth_service.revoke_session(db, token)
    response.status_code = status.HTTP_204_NO_CONTENT
    _clear_session_cookie(response, settings)
    return response

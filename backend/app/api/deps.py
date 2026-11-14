"""Shared FastAPI dependencies: database session, authentication, CSRF guard."""

from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.errors import NotAuthenticatedError, PermissionDeniedError
from app.db.session import get_db
from app.models import User
from app.services import auth_service

DbSession = Annotated[Session, Depends(get_db)]
AppSettings = Annotated[Settings, Depends(get_settings)]

_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def verify_origin(request: Request, settings: AppSettings) -> None:
    """CSRF defence-in-depth for cookie-authenticated, state-changing requests.

    Browsers always send `Origin` on cross-origin POST/PATCH/DELETE. If present,
    it must be an allowed origin or the request's own origin. Non-browser
    clients (curl, tests) that send no Origin are allowed; they carry no
    ambient cookies to abuse.
    """
    if request.method in _SAFE_METHODS:
        return
    origin = request.headers.get("origin")
    if origin is None:
        return
    origin = origin.rstrip("/")
    own_origin = f"{request.url.scheme}://{request.url.netloc}"
    if origin != own_origin and origin not in settings.cors_origins:
        raise PermissionDeniedError("Cross-origin request rejected.")


def get_session_token(request: Request, settings: AppSettings) -> str | None:
    return request.cookies.get(settings.session_cookie_name) or None


def get_current_user(
    db: DbSession, token: Annotated[str | None, Depends(get_session_token)]
) -> User:
    """Authentication: who is calling? Raises 401 if no valid session."""
    if not token:
        raise NotAuthenticatedError()
    user = auth_service.get_user_for_session_token(db, token)
    if user is None:
        raise NotAuthenticatedError("Your session has expired. Please log in again.")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]

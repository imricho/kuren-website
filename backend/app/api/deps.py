"""Shared FastAPI dependencies: database session, authentication, CSRF guard."""

import uuid
from typing import Annotated

from fastapi import Depends, Header, Request
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.errors import BadRequestError, NotAuthenticatedError, NotFoundError, PermissionDeniedError
from app.db.session import get_db
from app.models import Invitation, User
from app.services import auth_service, invitation_service

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


def get_owned_invitation(invitation_id: str, user: CurrentUser, db: DbSession) -> Invitation:
    """Authorization: resolve `{invitation_id}` to an invitation the caller owns.

    Missing, malformed and foreign ids all yield the same 404, so ids of other
    users' invitations cannot be probed.
    """
    try:
        parsed = uuid.UUID(invitation_id)
    except ValueError:
        raise NotFoundError("Invitation not found.") from None
    return invitation_service.get_owned_invitation(db, owner_id=user.id, invitation_id=parsed)


OwnedInvitation = Annotated[Invitation, Depends(get_owned_invitation)]


def parse_if_match(value: str | None) -> int | None:
    """`If-Match: "<revision>"` (weak `W/` prefix tolerated). Absent or `*` = no precondition."""
    if value is None or value.strip() in ("", "*"):
        return None
    raw = value.strip()
    if raw.startswith("W/"):
        raw = raw[2:]
    raw = raw.strip('"')
    if not raw.isdigit() or len(raw) > 12:
        raise BadRequestError("Invalid If-Match header.")
    return int(raw)


def get_writable_invitation(
    invitation: OwnedInvitation,
    db: DbSession,
    if_match: Annotated[str | None, Header(alias="If-Match")] = None,
) -> Invitation:
    """An owned invitation, locked for this request's write, whose content revision
    matches the client's `If-Match` (409 `edit_conflict` otherwise)."""
    invitation_service.lock_for_write(db, invitation, parse_if_match(if_match))
    return invitation


WritableInvitation = Annotated[Invitation, Depends(get_writable_invitation)]

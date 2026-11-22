"""Legacy `/weddings` routes that have no `/invitations` twin (contract: docs/api/invitations.md).

Every `/weddings/{id}/...` route is the invitation `item_router` mounted under this prefix
(see `app/api/v1/router.py`); only "my wedding" and the create shortcut live here.
"""

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession
from app.api.v1.routes.invitations import read_model
from app.schemas.invitation import InvitationRead, LegacyWeddingCreate
from app.services import invitation_service

router = APIRouter(prefix="/weddings", tags=["weddings (legacy)"], deprecated=True)


@router.get("/me", response_model=InvitationRead)
def read_my_wedding(user: CurrentUser, db: DbSession) -> InvitationRead:
    """The caller's most recently updated wedding-category invitation (404 if none)."""
    return read_model(db, invitation_service.get_latest_wedding(db, user))


@router.post("", response_model=InvitationRead, status_code=status.HTTP_201_CREATED)
def create_wedding(payload: LegacyWeddingCreate, user: CurrentUser, db: DbSession) -> InvitationRead:
    """Creates a `wedding_ceremony` with the pre-2.0 defaults (no seeded sessions)."""
    invitation = invitation_service.create_invitation(
        db, user, category="wedding", variant="wedding_ceremony", theme_id=payload.theme_id,
        title=None, locale=payload.locale, timezone=None, seed_sessions=False,
    )
    return read_model(db, invitation)

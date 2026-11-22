"""Invitation records: creation (with variant defaults), ownership lookup, metadata, deletion."""

import logging
import uuid
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, selectinload

from app.core import invitation_registry as registry
from app.core.errors import EditConflictError, LimitReachedError, NotFoundError, TemplateIncompatibleError
from app.models import Invitation, InvitationAsset, InvitationSession, User
from app.schemas.invitation import InvitationUpdate
from app.services import media_service

logger = logging.getLogger(__name__)

MAX_INVITATIONS_PER_USER = 50
#: Universal sections stored in `universal_content` (their `enabled` lives in the section).
_UNIVERSAL_SECTIONS = frozenset(
    {"holyRecite1", "holyRecite2", "greeting", "countdown", "wishes", "amplopDigital",
     "profiles", "milestone", "organization", "agenda", "speakers"}
)
#: Core sections with a show/hide flag in their own column.
_FLAG_COLUMNS = {"story": "story_meta", "gallery": "gallery_meta", "rsvp": "rsvp"}


def get_owned_invitation(db: Session, *, owner_id: uuid.UUID, invitation_id: uuid.UUID) -> Invitation:
    """Authorization: the invitation must exist AND belong to the caller (else 404)."""
    invitation = db.scalar(
        select(Invitation).where(Invitation.id == invitation_id, Invitation.owner_id == owner_id)
    )
    if invitation is None:
        raise NotFoundError("Invitation not found.")
    return invitation


def lock_invitation(db: Session, invitation: Invitation) -> Invitation:
    """Lock and refresh before reading JSON used by a read-modify-write.

    Ownership lookup may have loaded this instance before a concurrent writer
    committed. A lock on just its id does not refresh that stale ORM state.
    """
    locked = db.scalar(
        select(Invitation).where(Invitation.id == invitation.id).with_for_update()
        .execution_options(populate_existing=True)
    )
    if locked is None:
        raise NotFoundError("Invitation not found.")
    return invitation


def touch(invitation: Invitation, *, content: bool = True) -> None:
    """Bump `updated_at` on any change, and the content `revision` on content changes.

    The increment is a SQL expression (`revision + 1`), so concurrent writers that
    loaded the same row still produce distinct revisions under the row lock.
    """
    invitation.updated_at = func.now()
    if content:
        invitation.revision = Invitation.revision + 1


def lock_for_write(db: Session, invitation: Invitation, expected_revision: int | None) -> None:
    """Lock the invitation row and enforce `If-Match` (optimistic concurrency).

    Reads the revision under the lock, so the comparison cannot race with
    another writer. `None` means the client sent no precondition.
    """
    current = db.scalar(select(Invitation.revision).where(Invitation.id == invitation.id).with_for_update())
    if expected_revision is not None and current != expected_revision:
        raise EditConflictError(current_revision=int(current or 0))


def _newest_first(query: Any) -> Any:
    return query.order_by(Invitation.updated_at.desc(), Invitation.created_at.desc(), Invitation.id.desc())


def get_latest_wedding(db: Session, owner: User) -> Invitation:
    """Legacy `/weddings/me`: the most recently updated wedding-category invitation."""
    invitation = db.scalar(
        _newest_first(select(Invitation).where(Invitation.owner_id == owner.id, Invitation.category == "wedding"))
        .limit(1)
    )
    if invitation is None:
        raise NotFoundError("You do not have a wedding yet.")
    return invitation


def list_invitations(db: Session, owner: User) -> list[Invitation]:
    query = select(Invitation).where(Invitation.owner_id == owner.id).options(selectinload(Invitation.publication))
    return list(db.scalars(_newest_first(query)))


def summary(invitation: Invitation) -> dict[str, Any]:
    event_date = (invitation.opening or {}).get("weddingDate")
    return {
        "id": invitation.id,
        "title": invitation.title,
        "category": invitation.category,
        "variant": invitation.variant,
        "themeId": invitation.theme_id,
        "status": invitation.status,
        "slug": invitation.slug,
        "hasUnpublishedChanges": invitation.has_unpublished_changes,
        "eventDate": event_date if isinstance(event_date, str) else None,
        "updatedAt": invitation.updated_at,
        "publishedAt": invitation.published_at,
    }


def check_template(theme_id: str | None, category: str, variant: str) -> None:
    if theme_id is not None and not registry.template_supports(theme_id, category, variant):
        raise TemplateIncompatibleError()


def _localized(value: Any, locale: str) -> Any:
    if isinstance(value, dict):
        return value.get(locale) or value["en"]
    return value


def _seed(invitation: Invitation, variant: registry.VariantConfig) -> None:
    """Variant defaults: section on/off flags, milestone defaults and RSVP defaults.

    Optional universal sections that start off are left absent (= off), so a new
    wedding starts exactly like before the invitation engine.
    """
    locale = invitation.locale
    universal: dict[str, Any] = {}
    for section in variant.sections:
        if section.id in _FLAG_COLUMNS:
            setattr(invitation, _FLAG_COLUMNS[section.id], {"enabled": section.default_enabled})
        elif section.id in _UNIVERSAL_SECTIONS and section.default_enabled:
            universal[section.id] = {"enabled": True, **section.defaults}
    if "countdown" in universal:
        universal["countdown"]["addToCalendar"] = True
    invitation.universal_content = universal

    rsvp = dict(invitation.rsvp or {})
    for key, value in variant.rsvp_defaults.items():
        if key == "registrationFields":
            value = [{**f, "label": _localized(f["label"], locale)} for f in value]
        rsvp[key] = value
    invitation.rsvp = rsvp


def create_invitation(
    db: Session,
    owner: User,
    *,
    category: str,
    variant: str,
    theme_id: str | None,
    title: str | None,
    locale: str,
    timezone: str | None,
    seed_sessions: bool = True,
) -> Invitation:
    """Create and seed an invitation. `seed_sessions=False` keeps the legacy
    `POST /weddings` behaviour (an empty session list)."""
    config = registry.get_variant(variant)
    check_template(theme_id, category, variant)
    # Serialise concurrent creates by the same user so the limit cannot be overshot.
    db.scalar(select(User.id).where(User.id == owner.id).with_for_update())
    count = db.scalar(select(func.count()).select_from(Invitation).where(Invitation.owner_id == owner.id)) or 0
    if count >= MAX_INVITATIONS_PER_USER:
        db.rollback()
        raise LimitReachedError(f"You can have at most {MAX_INVITATIONS_PER_USER} invitations.")
    invitation = Invitation(
        owner_id=owner.id, category=category, variant=variant, title=title, theme_id=theme_id,
        locale=locale, timezone=timezone or registry.DEFAULT_TIMEZONE,
    )
    _seed(invitation, config)
    db.add(invitation)
    db.flush()
    if seed_sessions:
        for position, preset in enumerate(config.session_presets):
            db.add(InvitationSession(
                invitation_id=invitation.id, public_id=f"session-{position + 1}", position=position,
                type=preset.type, title=_localized(preset.title, locale),
            ))
    db.commit()
    db.refresh(invitation)
    return invitation


def update_invitation(db: Session, invitation: Invitation, changes: InvitationUpdate) -> Invitation:
    provided = changes.model_fields_set
    if "theme_id" in provided:
        check_template(changes.theme_id, invitation.category, invitation.variant)
        invitation.theme_id = changes.theme_id
    if "title" in provided:
        invitation.title = changes.title
    if "locale" in provided and changes.locale is not None:
        invitation.locale = changes.locale
    if "timezone" in provided and changes.timezone is not None:
        invitation.timezone = changes.timezone
    if provided:
        touch(invitation, content=False)
    db.commit()
    db.refresh(invitation)
    return invitation


def delete_invitation(db: Session, invitation: Invitation) -> None:
    """Delete the invitation and everything it owns (DB cascade: content, publications,
    assets, RSVP replies); uploaded files are removed best-effort afterwards."""
    filenames = list(db.scalars(select(InvitationAsset.filename).where(InvitationAsset.invitation_id == invitation.id)))
    db.execute(delete(Invitation).where(Invitation.id == invitation.id))
    db.commit()
    root = media_service.media_root()
    for name in filenames:
        try:
            (root / name).unlink(missing_ok=True)
        except OSError:
            logger.warning("Could not remove media file %s of a deleted invitation", name)

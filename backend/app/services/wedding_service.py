"""Wedding records: creation, lookup with ownership, metadata (theme/locale)."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import EditConflictError, NotFoundError, WeddingExistsError
from app.models import User, Wedding
from app.schemas.wedding import WeddingUpdate


def get_owned_wedding(db: Session, *, owner_id: uuid.UUID, wedding_id: uuid.UUID) -> Wedding:
    """Authorization: the wedding must exist AND belong to the caller (else 404)."""
    wedding = db.scalar(select(Wedding).where(Wedding.id == wedding_id, Wedding.owner_id == owner_id))
    if wedding is None:
        raise NotFoundError("Wedding not found.")
    return wedding


def lock_wedding(db: Session, wedding: Wedding) -> Wedding:
    """Take a row lock on the wedding to serialise content/collection writes."""
    db.execute(
        select(Wedding.id).where(Wedding.id == wedding.id).with_for_update()
    )
    return wedding


def touch(wedding: Wedding, *, content: bool = True) -> None:
    """Bump `updated_at` on any change, and the content `revision` on content changes.

    The increment is a SQL expression (`revision + 1`), so concurrent writers that
    loaded the same row still produce distinct revisions under the row lock.
    """
    wedding.updated_at = func.now()
    if content:
        wedding.revision = Wedding.revision + 1


def lock_for_write(db: Session, wedding: Wedding, expected_revision: int | None) -> None:
    """Lock the wedding row and enforce `If-Match` (optimistic concurrency).

    Reads the revision under the lock, so the comparison cannot race with
    another writer. `None` means the client sent no precondition.
    """
    current = db.scalar(select(Wedding.revision).where(Wedding.id == wedding.id).with_for_update())
    if expected_revision is not None and current != expected_revision:
        raise EditConflictError(current_revision=int(current or 0))


def get_my_wedding(db: Session, owner: User) -> Wedding:
    wedding = db.scalar(select(Wedding).where(Wedding.owner_id == owner.id))
    if wedding is None:
        raise NotFoundError("You do not have a wedding yet.")
    return wedding


def create_wedding(db: Session, owner: User, *, theme_id: str | None, locale: str) -> Wedding:
    if db.scalar(select(Wedding.id).where(Wedding.owner_id == owner.id)) is not None:
        raise WeddingExistsError()
    wedding = Wedding(owner_id=owner.id, theme_id=theme_id, locale=locale)
    db.add(wedding)
    try:
        db.commit()
    except IntegrityError:  # concurrent create by the same user
        db.rollback()
        raise WeddingExistsError() from None
    db.refresh(wedding)
    return wedding


def update_wedding(db: Session, wedding: Wedding, changes: WeddingUpdate) -> Wedding:
    provided = changes.model_fields_set
    if "theme_id" in provided:
        wedding.theme_id = changes.theme_id
    if "locale" in provided and changes.locale is not None:
        wedding.locale = changes.locale
    if provided:
        touch(wedding, content=False)
    db.commit()
    db.refresh(wedding)
    return wedding

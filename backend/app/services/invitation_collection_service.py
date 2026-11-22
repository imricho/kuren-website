"""Ordered invitation collections: story entries, sessions (`events`) and gallery images.

Items are addressed by (invitation_id, public_id), never by public_id alone, so an
id belonging to another invitation is simply "not found". Positions are kept
contiguous (0..n-1); every operation that changes the set or order of items
first takes a row lock on the invitation (SELECT ... FOR UPDATE).

`stories` and `gallery` writes need the variant to offer `story`/`gallery`
(422 `section_not_available` otherwise); `events` is offered by every variant.
"""

import re
import secrets
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Any, Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import invitation_registry as registry
from app.core.errors import LimitReachedError, NotFoundError, SectionNotAvailableError, ValidationFailedError
from app.models import Invitation, InvitationGalleryImage, InvitationSession, InvitationStoryEntry
from app.schemas.invitation import (
    PUBLIC_ID_CHARS,
    EventIn,
    GalleryItemIn,
    ImageAsset,
    RequestModel,
    StoryEntryIn,
    format_time,
)
from app.services import invitation_service

CollectionName = Literal["stories", "events", "gallery"]
ItemModel = InvitationStoryEntry | InvitationSession | InvitationGalleryImage

_PUBLIC_ID_RE = re.compile(PUBLIC_ID_CHARS)


# --- (de)serialisation: the only place rows become wire dicts -----------------------------


def dump_section(model: RequestModel, **kwargs: Any) -> dict[str, Any]:
    """Section/value object -> camelCase JSON dict with unset keys omitted."""
    return model.model_dump(mode="json", by_alias=True, exclude_none=True, **kwargs)


def _dump_image(image: ImageAsset | None) -> dict[str, Any] | None:
    return None if image is None else dump_section(image)


def image_out(raw: Any) -> dict[str, Any] | None:
    if not isinstance(raw, dict) or not raw.get("src") or not raw.get("alt"):
        return None
    out: dict[str, Any] = {"src": raw["src"], "alt": raw["alt"]}
    focal = raw.get("focalPoint")
    if isinstance(focal, dict) and focal.get("x") is not None and focal.get("y") is not None:
        out["focalPoint"] = {"x": focal["x"], "y": focal["y"]}
    return out


def _compact(values: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in values.items() if v is not None}


def _story_columns(item: StoryEntryIn) -> dict[str, Any]:
    return {
        "title": item.title,
        "date_label": item.date,
        "description": item.description,
        "image": _dump_image(item.image),
    }


def _story_out(row: InvitationStoryEntry) -> dict[str, Any]:
    return {
        "id": row.public_id,
        **_compact(
            {
                "title": row.title,
                "date": row.date_label,
                "description": row.description,
                "image": image_out(row.image),
            }
        ),
    }


def _event_columns(item: EventIn) -> dict[str, Any]:
    return {
        "type": item.type,
        "title": item.title,
        "date": item.date,
        "start_time": item.start_time,
        "end_time": item.end_time,
        "venue_name": item.venue_name,
        "address": item.address,
        "maps_url": item.maps_url,
        "description": item.description,
        "extras": {
            **{
                key: dump_section(value)
                for key, value in (("dressCode", item.dress_code), ("livestream", item.livestream))
                if value is not None
            },
            **({"optional": item.optional} if item.optional is not None else {}),
        },
    }


def _event_out(row: InvitationSession) -> dict[str, Any]:
    return {
        "id": row.public_id,
        "type": row.type,
        **_compact(
            {
                "title": row.title,
                "date": row.date.isoformat() if row.date else None,
                "startTime": format_time(row.start_time) if row.start_time else None,
                "endTime": format_time(row.end_time) if row.end_time else None,
                "venueName": row.venue_name,
                "address": row.address,
                "mapsUrl": row.maps_url,
                "description": row.description,
                **{k: v for k, v in (row.extras or {}).items() if k in ("dressCode", "livestream") and isinstance(v, dict)},
                "optional": row.extras.get("optional") if isinstance((row.extras or {}).get("optional"), bool) else None,
            }
        ),
    }


def _gallery_columns(item: GalleryItemIn) -> dict[str, Any]:
    focal = item.focal_point
    return {
        "src": item.src,
        "alt": item.alt,
        "caption": item.caption,
        "focal_x": focal.x if focal else None,
        "focal_y": focal.y if focal else None,
    }


def _gallery_out(row: InvitationGalleryImage) -> dict[str, Any]:
    out: dict[str, Any] = {"id": row.public_id, "src": row.src, "alt": row.alt}
    if row.caption is not None:
        out["caption"] = row.caption
    if row.focal_x is not None and row.focal_y is not None:
        out["focalPoint"] = {"x": row.focal_x, "y": row.focal_y}
    return out


@dataclass(frozen=True)
class CollectionSpec:
    model: type[ItemModel]
    limit: int
    to_columns: Callable[[Any], dict[str, Any]]
    to_out: Callable[[Any], dict[str, Any]]
    #: The section that must be offered by the variant to write this collection.
    section: str


COLLECTIONS: dict[str, CollectionSpec] = {
    "stories": CollectionSpec(InvitationStoryEntry, 20, _story_columns, _story_out, "story"),
    "events": CollectionSpec(InvitationSession, 20, _event_columns, _event_out, "events"),
    "gallery": CollectionSpec(InvitationGalleryImage, 60, _gallery_columns, _gallery_out, "gallery"),
}


def ensure_offered(invitation: Invitation, section: str) -> None:
    """422 `section_not_available` when the invitation's variant does not offer `section`."""
    if not registry.get_variant(invitation.variant).offers(section):
        raise SectionNotAvailableError(section)


# --- helpers ------------------------------------------------------------------------------


def _rows(db: Session, invitation: Invitation, spec: CollectionSpec) -> list[Any]:
    model = spec.model
    return list(
        db.scalars(
            select(model)
            .where(model.invitation_id == invitation.id)
            .order_by(model.position, model.created_at)
        )
    )


def _get_row(db: Session, invitation: Invitation, spec: CollectionSpec, item_id: str) -> Any:
    model = spec.model
    row = None
    if _PUBLIC_ID_RE.fullmatch(item_id):
        row = db.scalar(select(model).where(model.invitation_id == invitation.id, model.public_id == item_id))
    if row is None:
        raise NotFoundError("Item not found.")
    return row


def _new_public_id(taken: set[str]) -> str:
    while True:
        candidate = secrets.token_urlsafe(8)
        if candidate not in taken:
            return candidate


def _apply(row: Any, columns: dict[str, Any]) -> None:
    for key, value in columns.items():
        setattr(row, key, value)


# --- public operations --------------------------------------------------------------------


def list_items(db: Session, invitation: Invitation, collection: CollectionName) -> list[dict[str, Any]]:
    spec = COLLECTIONS[collection]
    return [spec.to_out(row) for row in _rows(db, invitation, spec)]


def create_item(
    db: Session, invitation: Invitation, collection: CollectionName, *, item: RequestModel
) -> dict[str, Any]:
    spec = COLLECTIONS[collection]
    ensure_offered(invitation, spec.section)
    invitation_service.lock_invitation(db, invitation)
    model = spec.model
    existing_ids = set(db.scalars(select(model.public_id).where(model.invitation_id == invitation.id)))
    if len(existing_ids) >= spec.limit:
        db.rollback()
        raise LimitReachedError(f"You can add at most {spec.limit} items here.")
    row = model(
        invitation_id=invitation.id,
        public_id=_new_public_id(existing_ids),
        position=len(existing_ids),
        **spec.to_columns(item),
    )
    db.add(row)
    invitation_service.touch(invitation)
    db.commit()
    return spec.to_out(row)


def update_item(
    db: Session, invitation: Invitation, collection: CollectionName, item_id: str, *, item: RequestModel
) -> dict[str, Any]:
    spec = COLLECTIONS[collection]
    ensure_offered(invitation, spec.section)
    invitation_service.lock_invitation(db, invitation)
    row = _get_row(db, invitation, spec, item_id)
    _apply(row, spec.to_columns(item))
    invitation_service.touch(invitation)
    db.commit()
    return spec.to_out(row)


def delete_item(db: Session, invitation: Invitation, collection: CollectionName, item_id: str) -> None:
    spec = COLLECTIONS[collection]
    ensure_offered(invitation, spec.section)
    invitation_service.lock_invitation(db, invitation)
    target = _get_row(db, invitation, spec, item_id)
    db.delete(target)
    db.flush()
    for position, row in enumerate(_rows(db, invitation, spec)):
        row.position = position
    invitation_service.touch(invitation)
    db.commit()


def reorder_items(
    db: Session, invitation: Invitation, collection: CollectionName, *, ids: Sequence[str]
) -> list[dict[str, Any]]:
    spec = COLLECTIONS[collection]
    ensure_offered(invitation, spec.section)
    invitation_service.lock_invitation(db, invitation)
    rows = _rows(db, invitation, spec)
    by_id = {row.public_id: row for row in rows}
    if len(ids) != len(rows) or len(set(ids)) != len(ids) or set(ids) != set(by_id):
        db.rollback()
        raise ValidationFailedError("ids", "must list every existing item id exactly once")
    for position, public_id in enumerate(ids):
        by_id[public_id].position = position
    invitation_service.touch(invitation)
    db.commit()
    return [spec.to_out(by_id[public_id]) for public_id in ids]


def check_replacement(collection: CollectionName, items: Sequence[Any], *, field: str) -> None:
    """Validate a full replacement list before anything is written."""
    spec = COLLECTIONS[collection]
    if len(items) > spec.limit:
        raise LimitReachedError(f"You can add at most {spec.limit} items to {field}.")
    seen: set[str] = set()
    for index, item in enumerate(items):
        if item.id is None:
            continue
        if item.id in seen:
            raise ValidationFailedError(f"{field}.{index}.id", "must be unique")
        seen.add(item.id)


def replace_items(db: Session, invitation: Invitation, collection: CollectionName, items: Sequence[Any]) -> None:
    """Make the collection equal to `items` (matched by id; order = list order).

    Existing ids are updated, unknown ids are created with that id, items
    without an id get a server id, and existing items not listed are deleted.
    The caller holds the invitation lock and commits.
    """
    spec = COLLECTIONS[collection]
    existing = {row.public_id: row for row in _rows(db, invitation, spec)}
    taken = set(existing) | {item.id for item in items if item.id is not None}
    kept: set[str] = set()
    for position, item in enumerate(items):
        columns = spec.to_columns(item)
        row = existing.get(item.id) if item.id is not None else None
        if row is not None:
            _apply(row, columns)
            row.position = position
            kept.add(row.public_id)
            continue
        public_id = item.id or _new_public_id(taken)
        taken.add(public_id)
        db.add(spec.model(invitation_id=invitation.id, public_id=public_id, position=position, **columns))
    for public_id, row in existing.items():
        if public_id not in kept:
            db.delete(row)


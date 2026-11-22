"""Invitation content: section storage and the assembled draft.

`assemble_draft` is the ONLY producer of the content shape returned by the API
(content, preview); it maps stored JSONB sections and collection rows 1:1 onto
docs/api/invitations.md, omitting keys that are not set.

Writes are variant-aware: a section the variant does not offer is refused with
422 `section_not_available`, a required section cannot be hidden, and profile
roles are limited to the variant's roles. Reads are not restricted.
"""

import secrets
from collections.abc import Iterable
from typing import Any, Literal

from pydantic.alias_generators import to_camel
from sqlalchemy.orm import Session

from app.core import invitation_registry as registry
from app.core.errors import NotFoundError, SectionNotAvailableError, ValidationFailedError
from app.models import Invitation
from app.schemas.invitation import (
    CONTENT_VERSION,
    SECTION_MODELS,
    UNIVERSAL_FIELDS,
    UNIVERSAL_SECTION_MODELS,
    UNIVERSAL_SECTION_OUT_MODELS,
    InvitationDraftIn,
    RequestModel,
)
from app.services import invitation_service
from app.services.invitation_collection_service import (
    check_replacement,
    dump_section,
    image_out,
    list_items,
    replace_items,
)

SectionName = Literal["opening", "couple", "story", "gallery", "rsvp", "closing"]

# section -> (Invitation column, plain keys, image keys)
_SECTIONS: dict[str, tuple[str, tuple[str, ...], tuple[str, ...]]] = {
    "opening": (
        "opening",
        ("weddingTitle", "coupleNames", "headline", "introduction", "weddingDate", "guestGreeting"),
        ("coverImage",),
    ),
    "couple": ("couple", (), ()),
    "story": ("story_meta", ("title", "introduction", "enabled"), ()),
    "gallery": ("gallery_meta", ("title", "description", "enabled"), ()),
    "rsvp": (
        "rsvp",
        ("title", "introduction", "deadline", "confirmationMessage", "maxGuestsPerResponse", "capacity",
         "collectContact", "allowSessionChoice", "registrationFields"),
        (),
    ),
    "closing": ("closing", ("message", "thankYou", "familyAcknowledgments"), ("image",)),
}
_PERSON_KEYS = ("name", "nickname", "description", "parents", "instagramUrl")
# Output key order follows the contract's interfaces.
_ORDER = {
    "opening": ("weddingTitle", "coupleNames", "headline", "introduction", "coverImage", "weddingDate", "guestGreeting"),
    "person": ("name", "nickname", "image", "description", "parents", "instagramUrl"),
    "rsvp": ("title", "introduction", "enabled", "deadline", "confirmationMessage", "maxGuestsPerResponse",
             "capacity", "collectContact", "allowSessionChoice", "registrationFields"),
    "closing": ("message", "thankYou", "image", "familyAcknowledgments"),
}
#: (section, list key, id prefix): list items that get a server id when sent without one.
_ID_LISTS = (
    ("amplopDigital", "bankAccounts", "acc"),
    ("profiles", "people", "person"),
    ("agenda", "items", "item"),
    ("speakers", "people", "speaker"),
    ("rsvp", "registrationFields", "field"),
)


def _pick(raw: Any, keys: tuple[str, ...], image_keys: tuple[str, ...] = ()) -> dict[str, Any]:
    raw = raw if isinstance(raw, dict) else {}
    out = {k: raw[k] for k in keys if raw.get(k) is not None}
    for key in image_keys:
        image = image_out(raw.get(key))
        if image is not None:
            out[key] = image
    return out


def _ordered(values: dict[str, Any], order: tuple[str, ...]) -> dict[str, Any]:
    return {k: values[k] for k in order if k in values}


def _person_out(raw: Any) -> dict[str, Any]:
    return _ordered(_pick(raw, _PERSON_KEYS, ("image",)), _ORDER["person"])


def section_out(invitation: Invitation, section: SectionName) -> dict[str, Any]:
    if section not in _SECTIONS:
        raise NotFoundError("Section not found.")
    column, keys, image_keys = _SECTIONS[section]
    raw = getattr(invitation, column) or {}
    if section == "couple":
        out = {"groom": _person_out(raw.get("groom")), "bride": _person_out(raw.get("bride"))}
        if isinstance(raw.get("enabled"), bool):
            out["enabled"] = raw["enabled"]
        return out
    out = _pick(raw, keys, image_keys)
    if section in ("rsvp", "story", "gallery"):
        enabled = raw.get("enabled")
        out["enabled"] = enabled if isinstance(enabled, bool) else True
    return _ordered(out, _ORDER[section]) if section in _ORDER else out


# --- Variant rules ------------------------------------------------------------------------


def _variant(invitation: Invitation) -> registry.VariantConfig:
    return registry.get_variant(invitation.variant)


def _ensure_offered(variant: registry.VariantConfig, section: str) -> None:
    if not variant.offers(section):
        raise SectionNotAvailableError(section)


def _check_section(variant: registry.VariantConfig, section: str, payload: RequestModel, prefix: str = "") -> None:
    """Variant rules for one section payload; `prefix` is the field path for PUT /content."""
    _ensure_offered(variant, section)
    if (
        variant.requires(section)
        and section not in registry.TOGGLE_ONLY_SECTIONS
        and getattr(payload, "enabled", None) is False
    ):
        raise ValidationFailedError(
            f"{prefix}enabled", "This section is required for this type of invitation and cannot be hidden."
        )
    if section == "profiles":
        roles = variant.section("profiles").roles  # type: ignore[union-attr]
        for index, person in enumerate(payload.people):  # type: ignore[attr-defined]
            if person.role not in roles:
                raise ValidationFailedError(f"{prefix}people.{index}.role", f"must be one of: {', '.join(roles)}")


def _new_id(prefix: str, taken: set[str]) -> str:
    while True:
        candidate = f"{prefix}-{secrets.token_hex(4)}"
        if candidate not in taken:
            return candidate


def _assign_ids(items: Iterable[dict[str, Any]], prefix: str) -> None:
    """Give list items without an id a fresh one, so editors can key rows and snapshots stay stable."""
    items = list(items)
    taken = {item["id"] for item in items if item.get("id")}
    for item in items:
        if not item.get("id"):
            item["id"] = _new_id(prefix, taken)
            taken.add(item["id"])


def _stored(section: str, payload: RequestModel, **kwargs: Any) -> dict[str, Any]:
    stored = dump_section(payload, **kwargs)
    for id_section, key, prefix in _ID_LISTS:
        if id_section == section and isinstance(stored.get(key), list):
            _assign_ids(stored[key], prefix)
    return stored


# --- Core sections (own columns) ----------------------------------------------------------


def get_section(invitation: Invitation, section: SectionName) -> dict[str, Any]:
    return section_out(invitation, section)


def put_section(db: Session, invitation: Invitation, section: SectionName, payload: RequestModel) -> dict[str, Any]:
    if section not in _SECTIONS or not isinstance(payload, SECTION_MODELS[section]):
        raise NotFoundError("Section not found.")
    _check_section(_variant(invitation), section, payload)
    invitation_service.lock_invitation(db, invitation)
    stored = _stored(section, payload)
    if section in ("story", "gallery") and "enabled" not in payload.model_fields_set:
        previous = getattr(invitation, _SECTIONS[section][0]) or {}
        if "enabled" in previous:
            stored["enabled"] = previous["enabled"]
    setattr(invitation, _SECTIONS[section][0], stored)
    invitation_service.touch(invitation)
    db.commit()
    return section_out(invitation, section)


# --- Universal sections in `invitations.universal_content` ---------------------------------


def get_universal_section(invitation: Invitation, section: str) -> dict[str, Any]:
    if section not in UNIVERSAL_SECTION_MODELS:
        raise NotFoundError("Section not found.")
    raw = (invitation.universal_content or {}).get(section)
    model = UNIVERSAL_SECTION_OUT_MODELS[section]
    return model.model_validate(raw if isinstance(raw, dict) else {}).model_dump(
        mode="json", by_alias=True, exclude_none=True, exclude_unset=True
    )


def put_universal_section(db: Session, invitation: Invitation, section: str, payload: RequestModel) -> dict[str, Any]:
    """Replace one universal section (unlike PUT /content, which merges for legacy clients).

    Replacing means a field the owner cleared is really cleared.
    """
    if section not in UNIVERSAL_SECTION_MODELS or not isinstance(payload, UNIVERSAL_SECTION_MODELS[section]):
        raise NotFoundError("Section not found.")
    _check_section(_variant(invitation), section, payload)
    invitation_service.lock_invitation(db, invitation)
    db.refresh(invitation, attribute_names=["universal_content"])
    stored = _stored(section, payload)
    # Assign a new dict: in-place JSONB mutation is not tracked by SQLAlchemy.
    invitation.universal_content = {
        **(invitation.universal_content or {}), section: stored, "contentVersion": CONTENT_VERSION,
    }
    invitation_service.touch(invitation)
    db.commit()
    return get_universal_section(invitation, section)


# --- Assembled draft ----------------------------------------------------------------------


def assemble_draft(db: Session, invitation: Invitation) -> dict[str, Any]:
    return {
        **(invitation.universal_content or {}),
        "schemaVersion": invitation.schema_version,
        "locale": invitation.locale,
        "opening": section_out(invitation, "opening"),
        "couple": section_out(invitation, "couple"),
        "story": {**section_out(invitation, "story"), "timeline": list_items(db, invitation, "stories")},
        "events": list_items(db, invitation, "events"),
        "gallery": {**section_out(invitation, "gallery"), "images": list_items(db, invitation, "gallery")},
        "rsvp": section_out(invitation, "rsvp"),
        "closing": section_out(invitation, "closing"),
    }


def build_preview(db: Session, invitation: Invitation) -> dict[str, Any]:
    return {"themeId": invitation.theme_id, "content": assemble_draft(db, invitation)}


def _merge_supplied(previous: Any, supplied: Any) -> Any:
    """Merge explicit object fields; null resets and arrays replace atomically."""
    if not isinstance(supplied, dict):
        return supplied
    merged = dict(previous) if isinstance(previous, dict) else {}
    for key, value in supplied.items():
        merged[key] = _merge_supplied(merged.get(key), value)
    return merged


#: Core sections whose presence in PUT /content depends on the variant.
_VARIANT_CORE = ("couple", "story", "gallery", "rsvp")


def _check_draft(variant: registry.VariantConfig, draft: InvitationDraftIn) -> None:
    for section in _VARIANT_CORE:
        payload = getattr(draft, section)
        if payload is None:
            if variant.offers(section):
                raise ValidationFailedError(section, "Field required")
            continue
        _check_section(variant, section, payload, prefix=f"{section}.")
    for field in UNIVERSAL_FIELDS:
        if field == "content_version":
            continue
        payload = getattr(draft, field)
        if payload is not None:
            _check_section(variant, to_camel(field), payload, prefix=f"{to_camel(field)}.")


def replace_content(db: Session, invitation: Invitation, draft: InvitationDraftIn) -> dict[str, Any]:
    """Replace every offered section and collection in one transaction."""
    variant = _variant(invitation)
    _check_draft(variant, draft)
    if draft.story is not None:
        check_replacement("stories", draft.story.timeline, field="story.timeline")
    check_replacement("events", draft.events, field="events")
    if draft.gallery is not None:
        check_replacement("gallery", draft.gallery.images, field="gallery.images")

    invitation_service.lock_invitation(db, invitation)
    if draft.locale is not None:
        invitation.locale = draft.locale
    # Legacy clients do not know extension fields. Preserve them on their PUTs;
    # explicit null is retained as a reset and disabled sections keep their data.
    extensions = dict(invitation.universal_content or {})
    supplied = draft.model_dump(mode="json", by_alias=True, exclude_unset=True)
    for field in UNIVERSAL_FIELDS:
        alias = to_camel(field)
        if field in draft.model_fields_set and alias != "contentVersion":
            extensions[alias] = _merge_supplied(extensions.get(alias), supplied[alias])
            merged = extensions[alias]
            for id_section, key, prefix in _ID_LISTS:
                # Bank accounts keep their legacy PUT /content behaviour (ids only via the section route).
                if id_section == alias != "amplopDigital" and isinstance(merged, dict) and isinstance(merged.get(key), list):
                    _assign_ids(merged[key], prefix)
    extensions["contentVersion"] = CONTENT_VERSION
    invitation.universal_content = extensions
    invitation.opening = dump_section(draft.opening)
    if draft.couple is not None:
        invitation.couple = dump_section(draft.couple)
    for section, column, collection_key in (("story", "story_meta", "timeline"), ("gallery", "gallery_meta", "images")):
        payload = getattr(draft, section)
        if payload is None:
            continue
        stored = dump_section(payload, exclude={collection_key})
        previous = getattr(invitation, column) or {}
        if "enabled" not in payload.model_fields_set and "enabled" in previous:
            stored["enabled"] = previous["enabled"]
        setattr(invitation, column, stored)
    if draft.rsvp is not None:
        invitation.rsvp = _stored("rsvp", draft.rsvp)
    invitation.closing = dump_section(draft.closing)
    if draft.story is not None:
        replace_items(db, invitation, "stories", draft.story.timeline)
    replace_items(db, invitation, "events", draft.events)
    if draft.gallery is not None:
        replace_items(db, invitation, "gallery", draft.gallery.images)
    invitation_service.touch(invitation)
    db.commit()
    return assemble_draft(db, invitation)

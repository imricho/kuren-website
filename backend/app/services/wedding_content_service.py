"""Wedding content: section storage and the assembled `WeddingDraft`.

`assemble_draft` is the ONLY producer of the content shape returned by the API
(content, preview); it maps stored JSONB sections and collection rows 1:1 onto
docs/api/weddings.md, omitting keys that are not set.
"""

from typing import Any, Literal

from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.models import Wedding
from app.schemas.wedding import SECTION_MODELS, RequestModel, WeddingDraftIn
from app.services import wedding_service
from app.services.wedding_collection_service import (
    check_replacement,
    dump_section,
    image_out,
    list_items,
    replace_items,
)

SectionName = Literal["opening", "couple", "story", "gallery", "rsvp", "closing"]

# section -> (Wedding column, plain keys, image keys)
_SECTIONS: dict[str, tuple[str, tuple[str, ...], tuple[str, ...]]] = {
    "opening": (
        "opening",
        ("weddingTitle", "coupleNames", "headline", "introduction", "weddingDate"),
        ("coverImage",),
    ),
    "couple": ("couple", (), ()),
    "story": ("story_meta", ("title", "introduction"), ()),
    "gallery": ("gallery_meta", ("title", "description"), ()),
    "rsvp": (
        "rsvp",
        ("title", "introduction", "deadline", "confirmationMessage", "maxGuestsPerResponse"),
        (),
    ),
    "closing": ("closing", ("message", "thankYou"), ("image",)),
}
_PERSON_KEYS = ("name", "nickname", "description", "parents", "instagramUrl")
# Output key order follows the contract's interfaces.
_ORDER = {
    "opening": ("weddingTitle", "coupleNames", "headline", "introduction", "coverImage", "weddingDate"),
    "person": ("name", "nickname", "image", "description", "parents", "instagramUrl"),
    "rsvp": ("title", "introduction", "enabled", "deadline", "confirmationMessage", "maxGuestsPerResponse"),
    "closing": ("message", "thankYou", "image"),
}


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


def section_out(wedding: Wedding, section: SectionName) -> dict[str, Any]:
    if section not in _SECTIONS:
        raise NotFoundError("Section not found.")
    column, keys, image_keys = _SECTIONS[section]
    raw = getattr(wedding, column) or {}
    if section == "couple":
        return {"groom": _person_out(raw.get("groom")), "bride": _person_out(raw.get("bride"))}
    out = _pick(raw, keys, image_keys)
    if section in ("rsvp", "story", "gallery"):
        enabled = raw.get("enabled")
        out["enabled"] = enabled if isinstance(enabled, bool) else True
    return _ordered(out, _ORDER[section]) if section in _ORDER else out


def get_section(wedding: Wedding, section: SectionName) -> dict[str, Any]:
    return section_out(wedding, section)


def put_section(db: Session, wedding: Wedding, section: SectionName, payload: RequestModel) -> dict[str, Any]:
    if section not in _SECTIONS or not isinstance(payload, SECTION_MODELS[section]):
        raise NotFoundError("Section not found.")
    wedding_service.lock_wedding(db, wedding)
    setattr(wedding, _SECTIONS[section][0], dump_section(payload))
    wedding_service.touch(wedding)
    db.commit()
    return section_out(wedding, section)


def assemble_draft(db: Session, wedding: Wedding) -> dict[str, Any]:
    return {
        "schemaVersion": wedding.schema_version,
        "locale": wedding.locale,
        "opening": section_out(wedding, "opening"),
        "couple": section_out(wedding, "couple"),
        "story": {**section_out(wedding, "story"), "timeline": list_items(db, wedding, "stories")},
        "events": list_items(db, wedding, "events"),
        "gallery": {**section_out(wedding, "gallery"), "images": list_items(db, wedding, "gallery")},
        "rsvp": section_out(wedding, "rsvp"),
        "closing": section_out(wedding, "closing"),
    }


def build_preview(db: Session, wedding: Wedding) -> dict[str, Any]:
    return {"themeId": wedding.theme_id, "content": assemble_draft(db, wedding)}


def replace_content(db: Session, wedding: Wedding, draft: WeddingDraftIn) -> dict[str, Any]:
    """Replace every section and collection in one transaction."""
    check_replacement("stories", draft.story.timeline, field="story.timeline")
    check_replacement("events", draft.events, field="events")
    check_replacement("gallery", draft.gallery.images, field="gallery.images")

    wedding_service.lock_wedding(db, wedding)
    if draft.locale is not None:
        wedding.locale = draft.locale
    wedding.opening = dump_section(draft.opening)
    wedding.couple = dump_section(draft.couple)
    wedding.story_meta = dump_section(draft.story, exclude={"timeline"})
    wedding.gallery_meta = dump_section(draft.gallery, exclude={"images"})
    wedding.rsvp = dump_section(draft.rsvp)
    wedding.closing = dump_section(draft.closing)
    replace_items(db, wedding, "stories", draft.story.timeline)
    replace_items(db, wedding, "events", draft.events)
    replace_items(db, wedding, "gallery", draft.gallery.images)
    wedding_service.touch(wedding)
    db.commit()
    return assemble_draft(db, wedding)

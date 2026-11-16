"""Publishing: server-side publish checks, the allow-listed snapshot, slugs and the public read.

The public page renders ONLY `wedding_publications.content`, which `build_snapshot` builds
field by field from the assembled draft. Nothing is copied wholesale, so a key that is not
listed here (owner data, internal ids, disabled features, future draft fields) can never
reach a guest.
"""

import re
import secrets
import unicodedata
import uuid
from collections.abc import Callable
from datetime import datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import NotFoundError, PublishBlockedError
from app.core.themes import is_selectable_theme
from app.models import Wedding, WeddingAsset, WeddingPublication
from app.models.wedding import SLUG_MAX_LENGTH, SLUG_REGEX
from app.schemas.wedding import MEDIA_SRC
from app.services import wedding_content_service, wedding_service

Issue = dict[str, str]

_SLUG_RE = re.compile(SLUG_REGEX)
_SLUG_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789"
_SLUG_SUFFIX_LENGTH = 6
_SLUG_PART_MAX = 30
_SLUG_ATTEMPTS = 8


# --- Small helpers ------------------------------------------------------------------------


def _obj(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _text(value: Any) -> str | None:
    """A non-empty, trimmed string, else None."""
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return None


def _flag(value: Any, default: bool = False) -> bool:
    return value if isinstance(value, bool) else default


def _pick_text(raw: dict[str, Any], keys: tuple[str, ...]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key in keys:
        text = _text(raw.get(key))
        if text is not None:
            out[key] = text
    return out


def _image(raw: Any) -> dict[str, Any] | None:
    raw = _obj(raw)
    src, alt = _text(raw.get("src")), _text(raw.get("alt"))
    if src is None or alt is None:
        return None
    out: dict[str, Any] = {"src": src, "alt": alt}
    focal = _obj(raw.get("focalPoint"))
    x, y = focal.get("x"), focal.get("y")
    if isinstance(x, int) and isinstance(y, int) and not isinstance(x, bool) and not isinstance(y, bool):
        out["focalPoint"] = {"x": x, "y": y}
    return out


def _with_image(out: dict[str, Any], key: str, raw: Any) -> dict[str, Any]:
    image = _image(raw)
    if image is not None:
        out[key] = image
    return out


# --- Publish checks -----------------------------------------------------------------------


def _issue(section: str, field: str, code: str, message: str) -> Issue:
    return {"section": section, "field": field, "code": code, "message": message}


def _owned_media_asset(db: Session, wedding: Wedding, src: str | None) -> bool:
    """True when `src` is `/media/<uuid>.<ext>` of an asset uploaded to THIS wedding."""
    if src is None:
        return False
    match = MEDIA_SRC.fullmatch(src)
    if match is None:
        return False
    filename = src.removeprefix("/media/")
    found = db.scalar(
        select(WeddingAsset.id).where(WeddingAsset.wedding_id == wedding.id, WeddingAsset.filename == filename)
    )
    return found is not None


def validate_for_publish(db: Session, wedding: Wedding, draft: dict[str, Any]) -> list[Issue]:
    """Blocking problems only; softer warnings are shown by the editor."""
    issues: list[Issue] = []
    add = issues.append

    if wedding.theme_id is None:
        add(_issue("theme", "themeId", "required", "Choose a theme."))
    elif not is_selectable_theme(wedding.theme_id):
        add(_issue("theme", "themeId", "invalid", "This theme is no longer available. Choose another one."))

    opening = _obj(draft.get("opening"))
    if _text(opening.get("weddingDate")) is None:
        add(_issue("opening", "opening.weddingDate", "required", "Add the wedding date."))

    couple = _obj(draft.get("couple"))
    for person, label in (("groom", "groom's"), ("bride", "bride's")):
        if _text(_obj(couple.get(person)).get("name")) is None:
            add(_issue("couple", f"couple.{person}.name", "required", f"Add the {label} name."))

    events = _list(draft.get("events"))
    if not events:
        add(_issue("events", "events", "required", "Add at least one event."))
    required_event_fields = (
        ("title", "a title"), ("date", "a date"), ("startTime", "a start time"),
        ("venueName", "a venue name"), ("address", "an address"),
    )
    for index, raw_event in enumerate(events):
        event = _obj(raw_event)
        for key, what in required_event_fields:
            if _text(event.get(key)) is None:
                add(_issue("events", f"events.{index}.{key}", "required", f"Event {index + 1} needs {what}."))
        livestream = _obj(event.get("livestream"))
        if _flag(livestream.get("enabled")) and _text(livestream.get("url")) is None:
            add(_issue(
                "events", f"events.{index}.livestream.url", "required",
                f"Event {index + 1} has a livestream turned on but no link.",
            ))

    if _text(_obj(draft.get("closing")).get("message")) is None:
        add(_issue("closing", "closing.message", "required", "Add a closing message."))

    # Optional sections: only checked while shown on the website.
    story = _obj(draft.get("story"))
    if _flag(story.get("enabled"), True):
        complete = [
            e for e in _list(story.get("timeline"))
            if _text(_obj(e).get("title")) and _text(_obj(e).get("description"))
        ]
        if not complete:
            add(_issue("story", "story.timeline", "incomplete",
                       "Add at least one story moment with a title and description, or hide the story."))

    gallery = _obj(draft.get("gallery"))
    if _flag(gallery.get("enabled"), True) and not _list(gallery.get("images")):
        add(_issue("gallery", "gallery.images", "incomplete", "Add at least one photo, or hide the gallery."))

    for key in ("holyRecite1", "holyRecite2"):
        recite = _obj(draft.get(key))
        if _flag(recite.get("enabled")) and not any(
            _text(recite.get(k)) for k in ("passage", "originalScript", "translation")
        ):
            add(_issue(key, f"{key}.passage", "incomplete",
                       "Add the passage, original script or translation, or hide this section."))

    greeting = _obj(draft.get("greeting"))
    if _flag(greeting.get("enabled")) and not (_text(greeting.get("title")) or _text(greeting.get("message"))):
        add(_issue("greeting", "greeting.message", "incomplete", "Add a title or message, or hide the greeting."))

    amplop = _obj(draft.get("amplopDigital"))
    if _flag(amplop.get("enabled")):
        methods = 0
        if _flag(amplop.get("bankAccountsEnabled")):
            methods += 1
            if not _list(amplop.get("bankAccounts")):
                add(_issue("amplopDigital", "amplopDigital.bankAccounts", "incomplete",
                           "Add at least one bank account, or turn bank transfers off."))
        if _flag(amplop.get("qrisEnabled")):
            methods += 1
            qris = _image(amplop.get("qrisImage"))
            if qris is None:
                add(_issue("amplopDigital", "amplopDigital.qrisImage", "required",
                           "Upload your QRIS code, or turn QRIS off."))
            elif not _owned_media_asset(db, wedding, qris["src"]):
                add(_issue("amplopDigital", "amplopDigital.qrisImage", "invalid",
                           "Upload the QRIS code image again from this editor."))
        gifts = _obj(amplop.get("physicalGifts"))
        if _flag(gifts.get("enabled")):
            methods += 1
            for key, what in (("recipient", "a recipient"), ("address", "an address")):
                if _text(gifts.get(key)) is None:
                    add(_issue("amplopDigital", f"amplopDigital.physicalGifts.{key}", "required",
                               f"Gift delivery needs {what}, or turn it off."))
        if methods == 0:
            add(_issue("amplopDigital", "amplopDigital", "incomplete",
                       "Turn on at least one gift option, or hide the digital envelope."))

    return issues


# --- Snapshot -----------------------------------------------------------------------------

_PERSON_TEXT = ("name", "nickname", "description", "parents", "instagramUrl")
_EVENT_TEXT = ("title", "date", "startTime", "endTime", "venueName", "address", "mapsUrl", "description")


def _person(raw: Any) -> dict[str, Any]:
    raw = _obj(raw)
    out = _pick_text(raw, ("name", "nickname"))
    _with_image(out, "image", raw.get("image"))
    out.update(_pick_text(raw, ("description", "parents", "instagramUrl")))
    return out


def _opening(raw: dict[str, Any]) -> dict[str, Any]:
    out = _pick_text(raw, ("weddingTitle", "coupleNames", "headline", "introduction"))
    _with_image(out, "coverImage", raw.get("coverImage"))
    out.update(_pick_text(raw, ("weddingDate",)))
    greeting = _obj(raw.get("guestGreeting"))
    if _flag(greeting.get("enabled")):
        out["guestGreeting"] = {"enabled": True, **_pick_text(greeting, ("label",))}
    return out


def _event(raw: Any) -> dict[str, Any]:
    raw = _obj(raw)
    out: dict[str, Any] = {"id": raw["id"], "type": raw.get("type") or "other"}
    out.update(_pick_text(raw, _EVENT_TEXT))
    dress = _obj(raw.get("dressCode"))
    if _flag(dress.get("enabled")) and _text(dress.get("text")):
        out["dressCode"] = {"enabled": True, **_pick_text(dress, ("text",))}
    live = _obj(raw.get("livestream"))
    if _flag(live.get("enabled")) and _text(live.get("url")):
        out["livestream"] = {"enabled": True, **_pick_text(live, ("url", "label"))}
    return out


def _story(raw: dict[str, Any]) -> dict[str, Any]:
    timeline = []
    for entry in _list(raw.get("timeline")):
        entry = _obj(entry)
        item: dict[str, Any] = {"id": entry["id"], **_pick_text(entry, ("title", "date", "description"))}
        _with_image(item, "image", entry.get("image"))
        timeline.append(item)
    return {**_pick_text(raw, ("title", "introduction")), "enabled": True, "timeline": timeline}


def _gallery(raw: dict[str, Any]) -> dict[str, Any]:
    images = []
    for entry in _list(raw.get("images")):
        image = _image(entry)
        if image is None:
            continue
        item = {"id": _obj(entry)["id"], "src": image["src"], "alt": image["alt"]}
        item.update(_pick_text(_obj(entry), ("caption",)))
        if "focalPoint" in image:
            item["focalPoint"] = image["focalPoint"]
        images.append(item)
    return {**_pick_text(raw, ("title", "description")), "enabled": True, "images": images}


def _rsvp(raw: dict[str, Any]) -> dict[str, Any]:
    out = {**_pick_text(raw, ("title", "introduction")), "enabled": True}
    out.update(_pick_text(raw, ("deadline", "confirmationMessage")))
    guests = raw.get("maxGuestsPerResponse")
    if isinstance(guests, int) and not isinstance(guests, bool):
        out["maxGuestsPerResponse"] = guests
    return out


def _closing(raw: dict[str, Any]) -> dict[str, Any]:
    out = _pick_text(raw, ("message", "thankYou"))
    _with_image(out, "image", raw.get("image"))
    out.update(_pick_text(raw, ("familyAcknowledgments",)))
    return out


def _holy_recite(raw: dict[str, Any]) -> dict[str, Any]:
    return {"enabled": True, **_pick_text(raw, (
        "title", "tradition", "book", "reference", "passage", "originalScript", "originalLanguage",
        "translation", "translationLanguage", "attribution",
    ))}


def _greeting(raw: dict[str, Any]) -> dict[str, Any]:
    return {"enabled": True, **_pick_text(raw, ("title", "message", "prayer"))}


def _countdown(raw: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {"enabled": True}
    if _flag(raw.get("addToCalendar")):
        out["addToCalendar"] = True
    return out


def _wishes(raw: dict[str, Any]) -> dict[str, Any]:
    return {"enabled": True, **_pick_text(raw, ("title", "introduction"))}


def _amplop(raw: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {"enabled": True, **_pick_text(raw, ("title", "message"))}
    # Financial data is copied only while its feature is switched on.
    banks_on = _flag(raw.get("bankAccountsEnabled"))
    out["bankAccountsEnabled"] = banks_on
    out["bankAccounts"] = [
        {"id": _text(a.get("id")) or f"acc-{index}", **_pick_text(a, ("bankName", "accountHolder", "accountNumber"))}
        for index, a in enumerate(_obj(x) for x in _list(raw.get("bankAccounts")))
        if banks_on and _text(a.get("accountNumber"))
    ]
    qris_on = _flag(raw.get("qrisEnabled")) and _image(raw.get("qrisImage")) is not None
    out["qrisEnabled"] = qris_on
    if qris_on:
        out["qrisImage"] = _image(raw.get("qrisImage"))
    gifts = _obj(raw.get("physicalGifts"))
    if _flag(gifts.get("enabled")):
        out["physicalGifts"] = {"enabled": True, **_pick_text(gifts, ("recipient", "address", "note", "phone"))}
    return out


#: Optional universal sections: included only while enabled (absent = disabled).
_UNIVERSAL_BUILDERS: dict[str, Callable[[dict[str, Any]], dict[str, Any]]] = {
    "holyRecite1": _holy_recite,
    "holyRecite2": _holy_recite,
    "greeting": _greeting,
    "countdown": _countdown,
    "wishes": _wishes,
    "amplopDigital": _amplop,
}


def build_snapshot(draft: dict[str, Any]) -> dict[str, Any]:
    """Allow-listed copy of `draft` (same shape, never wholesale-copied)."""
    snapshot: dict[str, Any] = {
        "contentVersion": "1.2",
        "schemaVersion": 1,
        "locale": draft.get("locale"),
        "opening": _opening(_obj(draft.get("opening"))),
        "couple": {
            "groom": _person(_obj(draft.get("couple")).get("groom")),
            "bride": _person(_obj(draft.get("couple")).get("bride")),
        },
        "events": [_event(e) for e in _list(draft.get("events"))],
        "closing": _closing(_obj(draft.get("closing"))),
    }
    for key, builder, default in (("story", _story, True), ("gallery", _gallery, True), ("rsvp", _rsvp, True)):
        raw = _obj(draft.get(key))
        if _flag(raw.get("enabled"), default):
            snapshot[key] = builder(raw)
    for key, builder in _UNIVERSAL_BUILDERS.items():
        if key not in draft:
            continue  # never set: renderers apply the legacy v1.1 defaults
        raw = _obj(draft.get(key))
        if _flag(raw.get("enabled")):
            snapshot[key] = builder(raw)
        else:
            # Switched off: a content-free marker, so "off" is not mistaken for "never set"
            # (legacy greeting/countdown fall back to "on"). Add to Calendar is independent.
            stub: dict[str, Any] = {"enabled": False}
            if key == "countdown" and _flag(raw.get("addToCalendar")):
                stub["addToCalendar"] = True
            snapshot[key] = stub
    return snapshot


# --- Slugs --------------------------------------------------------------------------------


def _slug_part(value: str | None) -> str:
    if not value:
        return ""
    ascii_only = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii").lower()
    part = re.sub(r"[^a-z0-9]+", "-", ascii_only).strip("-")
    return part[:_SLUG_PART_MAX].strip("-")


def _person_slug(draft: dict[str, Any], person: str) -> str:
    raw = _obj(_obj(draft.get("couple")).get(person))
    nickname = _slug_part(_text(raw.get("nickname")))
    if nickname:
        return nickname
    name = _text(raw.get("name")) or ""
    return _slug_part(name.split()[0] if name.split() else "")


def make_slug(draft: dict[str, Any]) -> str:
    groom, bride = _person_slug(draft, "groom"), _person_slug(draft, "bride")
    suffix = "".join(secrets.choice(_SLUG_ALPHABET) for _ in range(_SLUG_SUFFIX_LENGTH))
    prefix = f"{groom}-{bride}" if groom and bride else "undangan"
    slug = f"{prefix}-{suffix}"
    assert _SLUG_RE.fullmatch(slug) and len(slug) <= SLUG_MAX_LENGTH
    return slug


def _assign_slug(db: Session, wedding: Wedding, draft: dict[str, Any]) -> None:
    """Pick a free slug; a unique-constraint race is retried inside a savepoint."""
    for _ in range(_SLUG_ATTEMPTS):
        candidate = make_slug(draft)
        if db.scalar(select(Wedding.id).where(Wedding.slug == candidate)) is not None:
            continue
        try:
            with db.begin_nested():
                wedding.slug = candidate
                db.flush()
            return
        except IntegrityError:
            continue
    raise RuntimeError("Could not allocate a unique wedding slug")


# --- Publish / unpublish ------------------------------------------------------------------


def publish(db: Session, wedding: Wedding) -> Wedding:
    """Validate, snapshot and go live in ONE transaction (the caller holds the row lock).

    Any failure rolls back, so the previous publication (if any) stays live.
    """
    try:
        wedding_service.lock_wedding(db, wedding)
        db.refresh(wedding)
        draft = wedding_content_service.assemble_draft(db, wedding)
        issues = validate_for_publish(db, wedding, draft)
        if issues:
            raise PublishBlockedError(issues)
        snapshot = build_snapshot(draft)
        if wedding.slug is None:
            _assign_slug(db, wedding, draft)
        now = db.scalar(select(func.now()))
        publication = WeddingPublication(
            id=uuid.uuid4(),
            wedding_id=wedding.id,
            revision=wedding.revision,
            theme_id=wedding.theme_id,
            locale=wedding.locale,
            content=snapshot,
            published_at=now,
        )
        db.add(publication)
        db.flush()
        wedding.published_publication_id = publication.id
        wedding.status = "published"
        wedding.published_at = now
        wedding_service.touch(wedding, content=False)
        db.commit()
    except BaseException:
        db.rollback()
        raise
    db.refresh(wedding)
    return wedding


def unpublish(db: Session, wedding: Wedding) -> Wedding:
    wedding_service.lock_wedding(db, wedding)
    if wedding.published_publication_id is not None or wedding.status != "draft":
        wedding.published_publication_id = None
        wedding.status = "draft"
        wedding.published_at = None
        wedding_service.touch(wedding, content=False)
    db.commit()
    db.refresh(wedding)
    return wedding


# --- Public read --------------------------------------------------------------------------


def get_live_publication(db: Session, slug: str) -> WeddingPublication:
    """The live snapshot for `slug`; unknown, malformed and unpublished all raise the same 404."""
    if len(slug) > SLUG_MAX_LENGTH or not _SLUG_RE.fullmatch(slug):
        raise NotFoundError("Not found.")
    publication = db.scalar(
        select(WeddingPublication)
        .join(Wedding, Wedding.published_publication_id == WeddingPublication.id)
        .where(Wedding.slug == slug, Wedding.status == "published")
    )
    if publication is None:
        raise NotFoundError("Not found.")
    return publication


def public_payload(publication: WeddingPublication) -> dict[str, Any]:
    published_at: datetime = publication.published_at
    return {
        "themeId": publication.theme_id,
        "locale": publication.locale,
        "content": publication.content,
        "publishedAt": published_at.isoformat(),
    }

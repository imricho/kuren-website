"""Publishing: server-side publish checks, the allow-listed snapshot, slugs and the public read.

The public page renders ONLY `invitation_publications.content`, which `build_snapshot` builds
field by field from the assembled draft. Nothing is copied wholesale, so a key that is not
listed here (owner data, internal ids, disabled features, RSVP replies, future draft fields)
can never reach a guest. Both the checks and the snapshot are variant-aware: sections the
variant does not offer are neither checked nor published.
"""

import re
import secrets
import unicodedata
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import invitation_registry as registry
from app.core.errors import NotFoundError, PublishBlockedError
from app.core.themes import is_selectable_theme
from app.models import Invitation, InvitationAsset, InvitationPublication, InvitationRsvpResponse
from app.models.invitation import SLUG_MAX_LENGTH, SLUG_REGEX
from app.schemas.invitation import CONTENT_VERSION, MEDIA_SRC
from app.services import invitation_content_service, invitation_service

Variant = registry.VariantConfig

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


def _owned_media_asset(db: Session, invitation: Invitation, src: str | None) -> bool:
    """True when `src` is `/media/<uuid>.<ext>` of an asset uploaded to THIS invitation."""
    if src is None:
        return False
    match = MEDIA_SRC.fullmatch(src)
    if match is None:
        return False
    filename = src.removeprefix("/media/")
    found = db.scalar(
        select(InvitationAsset.id).where(
            InvitationAsset.invitation_id == invitation.id, InvitationAsset.filename == filename
        )
    )
    return found is not None


def _shown(variant: Variant, draft: dict[str, Any], section: str, default: bool) -> bool:
    """Offered by the variant and switched on (required sections are always shown)."""
    if not variant.offers(section):
        return False
    if variant.requires(section) and section not in registry.TOGGLE_ONLY_SECTIONS:
        return True
    return _flag(_obj(draft.get(section)).get("enabled"), default)


def _milestone_value(raw: dict[str, Any], key: str) -> Any:
    value = raw.get(key)
    if key in ("age", "years"):
        return value if isinstance(value, int) and not isinstance(value, bool) else None
    return _text(value)


def validate_for_publish(db: Session, invitation: Invitation, draft: dict[str, Any]) -> list[Issue]:
    """Blocking problems only; softer warnings are shown by the editor."""
    variant = registry.get_variant(invitation.variant)
    issues: list[Issue] = []
    add = issues.append

    if invitation.theme_id is None:
        add(_issue("theme", "themeId", "required", "Choose a theme."))
    elif not is_selectable_theme(invitation.theme_id):
        add(_issue("theme", "themeId", "invalid", "This theme is no longer available. Choose another one."))
    elif not registry.template_supports(invitation.theme_id, invitation.category, invitation.variant):
        add(_issue("theme", "themeId", "incompatible", "This theme does not support this type of invitation."))

    opening = _obj(draft.get("opening"))
    if _text(opening.get("weddingDate")) is None:
        what = "wedding date" if invitation.category == "wedding" else "event date"
        add(_issue("opening", "opening.weddingDate", "required", f"Add the {what}."))

    if _shown(variant, draft, "couple", True):
        couple = _obj(draft.get("couple"))
        for person, label in (("groom", "groom's"), ("bride", "bride's")):
            if _text(_obj(couple.get(person)).get("name")) is None:
                add(_issue("couple", f"couple.{person}.name", "required", f"Add the {label} name."))

    if _shown(variant, draft, "profiles", False) and not _list(_obj(draft.get("profiles")).get("people")):
        add(_issue("profiles", "profiles.people", "incomplete", "Add at least one person, or hide this section."))

    if _shown(variant, draft, "organization", False) and _text(_obj(draft.get("organization")).get("name")) is None:
        add(_issue("organization", "organization.name", "required",
                   "Add the organization name, or hide this section."))

    if _shown(variant, draft, "milestone", False):
        milestone = _obj(draft.get("milestone"))
        fields = variant.section("milestone").fields  # type: ignore[union-attr]
        if not any(_milestone_value(milestone, key) is not None for key in (*fields, "description")):
            add(_issue("milestone", "milestone", "incomplete",
                       "Add what you are celebrating, or hide this section."))

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

    # Optional sections: only checked while offered and shown on the website.
    if _shown(variant, draft, "agenda", False) and not _list(_obj(draft.get("agenda")).get("items")):
        add(_issue("agenda", "agenda.items", "incomplete", "Add at least one agenda item, or hide the agenda."))

    if _shown(variant, draft, "speakers", False) and not _list(_obj(draft.get("speakers")).get("people")):
        add(_issue("speakers", "speakers.people", "incomplete", "Add at least one speaker, or hide this section."))

    story = _obj(draft.get("story"))
    if _shown(variant, draft, "story", True):
        complete = [
            e for e in _list(story.get("timeline"))
            if _text(_obj(e).get("title")) and _text(_obj(e).get("description"))
        ]
        if not complete:
            add(_issue("story", "story.timeline", "incomplete",
                       "Add at least one story moment with a title and description, or hide the story."))

    gallery = _obj(draft.get("gallery"))
    if _shown(variant, draft, "gallery", True) and not _list(gallery.get("images")):
        add(_issue("gallery", "gallery.images", "incomplete", "Add at least one photo, or hide the gallery."))

    for key in ("holyRecite1", "holyRecite2"):
        recite = _obj(draft.get(key))
        if _shown(variant, draft, key, False) and not any(
            _text(recite.get(k)) for k in ("passage", "originalScript", "translation")
        ):
            add(_issue(key, f"{key}.passage", "incomplete",
                       "Add the passage, original script or translation, or hide this section."))

    greeting = _obj(draft.get("greeting"))
    if _shown(variant, draft, "greeting", False) and not (_text(greeting.get("title")) or _text(greeting.get("message"))):
        add(_issue("greeting", "greeting.message", "incomplete", "Add a title or message, or hide the greeting."))

    amplop = _obj(draft.get("amplopDigital"))
    if _shown(variant, draft, "amplopDigital", False):
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
            elif not _owned_media_asset(db, invitation, qris["src"]):
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

_EVENT_TEXT = ("title", "date", "startTime", "endTime", "venueName", "address", "mapsUrl", "description")


def _int(value: Any) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) else None


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
    if _flag(raw.get("optional")):
        out["optional"] = True
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


_FIELD_TYPES = ("text", "textarea", "email", "phone", "select", "checkbox")
_CONTACT_MODES = ("email", "phone", "email_or_phone")


def _registration_field(raw: Any) -> dict[str, Any] | None:
    raw = _obj(raw)
    field_id, label, kind = _text(raw.get("id")), _text(raw.get("label")), raw.get("type")
    if field_id is None or label is None or kind not in _FIELD_TYPES:
        return None
    out: dict[str, Any] = {"id": field_id, "label": label, "type": kind, "required": _flag(raw.get("required"))}
    if kind == "select":
        options = [o for o in (_text(x) for x in _list(raw.get("options"))) if o is not None]
        if not options:
            return None
        out["options"] = options
    return out


def _rsvp(raw: dict[str, Any]) -> dict[str, Any]:
    out = {**_pick_text(raw, ("title", "introduction")), "enabled": True}
    out.update(_pick_text(raw, ("deadline", "confirmationMessage")))
    for key in ("maxGuestsPerResponse", "capacity"):
        if _int(raw.get(key)) is not None:
            out[key] = raw[key]
    if raw.get("collectContact") in _CONTACT_MODES:
        out["collectContact"] = raw["collectContact"]
    if _flag(raw.get("allowSessionChoice")):
        out["allowSessionChoice"] = True
    fields = [f for f in (_registration_field(x) for x in _list(raw.get("registrationFields"))) if f is not None]
    if fields:
        out["registrationFields"] = fields
    return out


def _closing(raw: dict[str, Any]) -> dict[str, Any]:
    out = _pick_text(raw, ("message", "thankYou"))
    _with_image(out, "image", raw.get("image"))
    out.update(_pick_text(raw, ("familyAcknowledgments",)))
    return out


@dataclass(frozen=True)
class _Context:
    variant: Variant
    session_ids: frozenset[str]
    speaker_ids: frozenset[str]


def _holy_recite(raw: dict[str, Any], _: _Context) -> dict[str, Any]:
    return {"enabled": True, **_pick_text(raw, (
        "title", "tradition", "book", "reference", "passage", "originalScript", "originalLanguage",
        "translation", "translationLanguage", "attribution",
    ))}


def _greeting(raw: dict[str, Any], _: _Context) -> dict[str, Any]:
    return {"enabled": True, **_pick_text(raw, ("title", "message", "prayer"))}


def _countdown(raw: dict[str, Any], _: _Context) -> dict[str, Any]:
    out: dict[str, Any] = {"enabled": True}
    if _flag(raw.get("addToCalendar")):
        out["addToCalendar"] = True
    return out


def _wishes(raw: dict[str, Any], _: _Context) -> dict[str, Any]:
    return {"enabled": True, **_pick_text(raw, ("title", "introduction"))}


def _amplop(raw: dict[str, Any], _: _Context) -> dict[str, Any]:
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


def _profiles(raw: dict[str, Any], ctx: _Context) -> dict[str, Any]:
    roles = ctx.variant.section("profiles").roles  # type: ignore[union-attr]
    people = []
    for person in (_obj(x) for x in _list(raw.get("people"))):
        name, person_id = _text(person.get("name")), _text(person.get("id"))
        if name is None or person_id is None or person.get("role") not in roles:
            continue
        item: dict[str, Any] = {"id": person_id, "role": person["role"], "name": name}
        item.update(_pick_text(person, ("nickname",)))
        _with_image(item, "image", person.get("image"))
        item.update(_pick_text(person, ("description", "parents", "birthDate")))
        people.append(item)
    return {"enabled": True, **_pick_text(raw, ("title",)), "people": people}


def _milestone(raw: dict[str, Any], ctx: _Context) -> dict[str, Any]:
    fields = ctx.variant.section("milestone").fields  # type: ignore[union-attr]
    out: dict[str, Any] = {"enabled": True, **_pick_text(raw, ("title",))}
    for key in fields:
        value = _milestone_value(raw, key)
        if value is not None:
            out[key] = value
    out.update(_pick_text(raw, ("description",)))
    return out


def _organization(raw: dict[str, Any], _: _Context) -> dict[str, Any]:
    out: dict[str, Any] = {"enabled": True, **_pick_text(raw, ("name", "tagline", "description"))}
    _with_image(out, "logo", raw.get("logo"))
    out.update(_pick_text(raw, ("websiteUrl",)))
    return out


def _agenda(raw: dict[str, Any], ctx: _Context) -> dict[str, Any]:
    items = []
    for entry in (_obj(x) for x in _list(raw.get("items"))):
        title, item_id = _text(entry.get("title")), _text(entry.get("id"))
        if title is None or item_id is None:
            continue
        item: dict[str, Any] = {"id": item_id, **_pick_text(entry, ("time", "endTime")), "title": title}
        item.update(_pick_text(entry, ("description",)))
        # References are kept only while their target is published.
        if _text(entry.get("sessionId")) in ctx.session_ids:
            item["sessionId"] = entry["sessionId"]
        speakers = [x for x in _list(entry.get("speakerIds")) if isinstance(x, str) and x in ctx.speaker_ids]
        if speakers:
            item["speakerIds"] = speakers
        items.append(item)
    return {"enabled": True, **_pick_text(raw, ("title",)), "items": items}


def _speakers(raw: dict[str, Any], _: _Context) -> dict[str, Any]:
    people = []
    for person in (_obj(x) for x in _list(raw.get("people"))):
        name, person_id = _text(person.get("name")), _text(person.get("id"))
        if name is None or person_id is None:
            continue
        item: dict[str, Any] = {"id": person_id, "name": name, **_pick_text(person, ("role", "organization"))}
        _with_image(item, "image", person.get("image"))
        item.update(_pick_text(person, ("bio",)))
        people.append(item)
    return {"enabled": True, **_pick_text(raw, ("title",)), "people": people}


#: Universal sections: included only while offered; `{enabled: false}` marker when switched off.
_UNIVERSAL_BUILDERS: dict[str, Callable[[dict[str, Any], _Context], dict[str, Any]]] = {
    "holyRecite1": _holy_recite,
    "greeting": _greeting,
    "profiles": _profiles,
    "organization": _organization,
    "milestone": _milestone,
    "countdown": _countdown,
    "agenda": _agenda,
    "speakers": _speakers,
    "wishes": _wishes,
    "amplopDigital": _amplop,
    "holyRecite2": _holy_recite,
}


def build_snapshot(draft: dict[str, Any], variant: Variant, *, schema_version: int = 1) -> dict[str, Any]:
    """Allow-listed copy of `draft` (same shape, never wholesale-copied), limited to the
    sections `variant` offers. A pre-2.0 wedding produces exactly its v1.2 snapshot."""
    events = [_event(e) for e in _list(draft.get("events"))]
    speakers = _obj(draft.get("speakers"))
    speakers_shown = variant.offers("speakers") and _flag(speakers.get("enabled"))
    ctx = _Context(
        variant=variant,
        session_ids=frozenset(e["id"] for e in events),
        speaker_ids=frozenset(
            p["id"] for p in (_obj(x) for x in _list(speakers.get("people"))) if speakers_shown and _text(p.get("id"))
        ),
    )
    snapshot: dict[str, Any] = {
        # 2.0 once written by (or created with) the invitation engine; legacy weddings stay 1.2.
        "contentVersion": (
            CONTENT_VERSION if draft.get("contentVersion") == CONTENT_VERSION or schema_version >= 2 else "1.2"
        ),
        "schemaVersion": schema_version,
        "locale": draft.get("locale"),
        "opening": _opening(_obj(draft.get("opening"))),
    }
    if variant.offers("couple"):
        couple = _obj(draft.get("couple"))
        if variant.requires("couple") or _flag(couple.get("enabled"), True):
            snapshot["couple"] = {"groom": _person(couple.get("groom")), "bride": _person(couple.get("bride"))}
        else:
            snapshot["couple"] = {"enabled": False}
    snapshot["events"] = events
    snapshot["closing"] = _closing(_obj(draft.get("closing")))
    for key, builder in (("story", _story), ("gallery", _gallery), ("rsvp", _rsvp)):
        raw = _obj(draft.get(key))
        if variant.offers(key) and _flag(raw.get("enabled"), True):
            snapshot[key] = builder(raw)
    for key, universal_builder in _UNIVERSAL_BUILDERS.items():
        if key not in draft or not variant.offers(key):
            continue  # never set (renderers apply the legacy v1.1 defaults) or not offered
        raw = _obj(draft.get(key))
        if _flag(raw.get("enabled")):
            snapshot[key] = universal_builder(raw, ctx)
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


def _short_name(raw: dict[str, Any]) -> str:
    nickname = _slug_part(_text(raw.get("nickname")))
    if nickname:
        return nickname
    name = _text(raw.get("name")) or ""
    return _slug_part(name.split()[0] if name.split() else "")


def _slug_prefix(draft: dict[str, Any], variant: Variant) -> str:
    """`{groom}-{bride}` for couples; else up to two profile names; else the organization."""
    if variant.offers("couple"):
        couple = _obj(draft.get("couple"))
        groom, bride = _short_name(_obj(couple.get("groom"))), _short_name(_obj(couple.get("bride")))
        if groom and bride:
            return f"{groom}-{bride}"
    if variant.offers("profiles"):
        names = [n for n in (_short_name(_obj(p)) for p in _list(_obj(draft.get("profiles")).get("people"))) if n]
        if names:
            return "-".join(names[:2])
    if variant.offers("organization"):
        org = _slug_part(_text(_obj(draft.get("organization")).get("name")))
        if org:
            return org
    return "undangan"


def make_slug(draft: dict[str, Any], variant: Variant) -> str:
    suffix = "".join(secrets.choice(_SLUG_ALPHABET) for _ in range(_SLUG_SUFFIX_LENGTH))
    slug = f"{_slug_prefix(draft, variant)}-{suffix}"
    assert _SLUG_RE.fullmatch(slug) and len(slug) <= SLUG_MAX_LENGTH
    return slug


def _assign_slug(db: Session, invitation: Invitation, draft: dict[str, Any], variant: Variant) -> None:
    """Pick a free slug; a unique-constraint race is retried inside a savepoint."""
    for _ in range(_SLUG_ATTEMPTS):
        candidate = make_slug(draft, variant)
        if db.scalar(select(Invitation.id).where(Invitation.slug == candidate)) is not None:
            continue
        try:
            with db.begin_nested():
                invitation.slug = candidate
                db.flush()
            return
        except IntegrityError:
            continue
    raise RuntimeError("Could not allocate a unique invitation slug")


# --- Publish / unpublish ------------------------------------------------------------------


def publish(db: Session, invitation: Invitation) -> Invitation:
    """Validate, snapshot and go live in ONE transaction (the caller holds the row lock).

    Any failure rolls back, so the previous publication (if any) stays live.
    """
    try:
        invitation_service.lock_invitation(db, invitation)
        db.refresh(invitation)
        variant = registry.get_variant(invitation.variant)
        draft = invitation_content_service.assemble_draft(db, invitation)
        issues = validate_for_publish(db, invitation, draft)
        if issues:
            raise PublishBlockedError(issues)
        snapshot = build_snapshot(draft, variant, schema_version=invitation.schema_version)
        if invitation.slug is None:
            _assign_slug(db, invitation, draft, variant)
        now = db.scalar(select(func.now()))
        publication = InvitationPublication(
            id=uuid.uuid4(),
            invitation_id=invitation.id,
            revision=invitation.revision,
            theme_id=invitation.theme_id,
            locale=invitation.locale,
            category=invitation.category,
            variant=invitation.variant,
            content=snapshot,
            published_at=now,
        )
        db.add(publication)
        db.flush()
        invitation.published_publication_id = publication.id
        invitation.status = "published"
        invitation.published_at = now
        invitation_service.touch(invitation, content=False)
        db.commit()
    except BaseException:
        db.rollback()
        raise
    db.refresh(invitation)
    return invitation


def unpublish(db: Session, invitation: Invitation) -> Invitation:
    invitation_service.lock_invitation(db, invitation)
    if invitation.published_publication_id is not None or invitation.status != "draft":
        invitation.published_publication_id = None
        invitation.status = "draft"
        invitation.published_at = None
        invitation_service.touch(invitation, content=False)
    db.commit()
    db.refresh(invitation)
    return invitation


# --- Public read --------------------------------------------------------------------------


def get_live(db: Session, slug: str, *, lock: bool = False) -> tuple[Invitation, InvitationPublication]:
    """The invitation and live snapshot for `slug`; unknown, malformed and unpublished all
    raise the same 404. `lock=True` locks the invitation row (RSVP capacity checks)."""
    if len(slug) > SLUG_MAX_LENGTH or not _SLUG_RE.fullmatch(slug):
        raise NotFoundError("Not found.")
    query = select(Invitation).where(Invitation.slug == slug, Invitation.status == "published")
    if lock:
        query = query.with_for_update().execution_options(populate_existing=True)
    invitation = db.scalar(query)
    if invitation is None or invitation.published_publication_id is None:
        raise NotFoundError("Not found.")
    publication = db.get(InvitationPublication, invitation.published_publication_id)
    if publication is None:
        raise NotFoundError("Not found.")
    return invitation, publication


def attending_people(db: Session, invitation_id: uuid.UUID) -> int:
    return int(db.scalar(
        select(func.coalesce(func.sum(InvitationRsvpResponse.party_size), 0)).where(
            InvitationRsvpResponse.invitation_id == invitation_id,
            InvitationRsvpResponse.attendance == "attending",
        )
    ) or 0)


def public_payload(db: Session, invitation: Invitation, publication: InvitationPublication) -> tuple[dict[str, Any], str]:
    """The guest payload and its ETag. Never includes replies or counts; only `rsvp.full`
    when a capacity is set (it changes without a republish, so it is part of the ETag)."""
    content = publication.content
    etag = f'"{publication.id}"'
    rsvp = _obj(content.get("rsvp"))
    capacity = _int(rsvp.get("capacity"))
    if capacity is not None:
        full = attending_people(db, invitation.id) >= capacity
        content = {**content, "rsvp": {**rsvp, "full": full}}
        if full:
            etag = f'"{publication.id}-full"'
    published_at: datetime = publication.published_at
    payload = {
        "category": publication.category,
        "variant": publication.variant,
        "themeId": publication.theme_id,
        "locale": publication.locale,
        "timezone": invitation.timezone,
        "content": content,
        "publishedAt": published_at.isoformat(),
    }
    return payload, etag

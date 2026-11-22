"""RSVP replies: public submission (validated against the PUBLISHED config) and owner views.

Guest data (names, contacts, answers, messages) is owner-only: it is never copied into a
snapshot and never logged. Capacity and the per-invitation reply limit are checked while
holding a row lock on the invitation, so concurrent submissions cannot overshoot them.
"""

import csv
import hashlib
import io
import re
import secrets
import uuid
import zoneinfo
from datetime import date, datetime
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.errors import (
    CapacityReachedError,
    LimitReachedError,
    NotFoundError,
    RsvpClosedError,
    RsvpLinkInvalidError,
    ValidationFailedError,
)
from app.models import Invitation, InvitationPublication, InvitationRsvpResponse
from app.schemas.rsvp import RsvpSubmission
from app.services.invitation_publish_service import attending_people, get_live

MAX_RESPONSES_PER_INVITATION = 5000
_EMAIL = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")
_PHONE = re.compile(r"\+?[0-9]+(?:[ -][0-9]+)*")
_TEXT_LIMITS = {"text": 200, "textarea": 1000, "email": 254, "phone": 40, "select": 80}


def _obj(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _today_in(timezone: str) -> date:
    try:
        zone = zoneinfo.ZoneInfo(timezone)
    except (zoneinfo.ZoneInfoNotFoundError, ValueError):
        zone = zoneinfo.ZoneInfo("UTC")
    return datetime.now(zone).date()


def _check_open(config: dict[str, Any], timezone: str) -> None:
    """`timezone` is the PUBLISHED time zone (the one guests see)."""
    if config.get("enabled") is not True:
        raise RsvpClosedError()
    deadline = config.get("deadline")
    if deadline is None:
        return
    try:
        last_day = date.fromisoformat(deadline) if isinstance(deadline, str) else None
    except ValueError:
        last_day = None
    if last_day is None:
        raise RsvpClosedError()  # unreadable deadline in the snapshot: fail closed
    # Replies are accepted through the whole deadline day, in the invitation's time zone.
    if _today_in(timezone) > last_day:
        raise RsvpClosedError("The RSVP deadline has passed.")


def _check_contact(config: dict[str, Any], payload: RsvpSubmission) -> tuple[str | None, str | None]:
    """Contact details the invitation asks for; anything else is dropped (never stored)."""
    mode = config.get("collectContact") or "none"
    email = payload.email if mode in ("email", "email_or_phone") else None
    phone = payload.phone if mode in ("phone", "email_or_phone") else None
    if mode == "email" and email is None:
        raise ValidationFailedError("email", "Field required")
    if mode == "phone" and phone is None:
        raise ValidationFailedError("phone", "Field required")
    if mode == "email_or_phone" and email is None and phone is None:
        raise ValidationFailedError("email", "Add an email address or a phone number.")
    return email, phone


def _check_answers(config: dict[str, Any], answers: dict[str, Any]) -> dict[str, Any]:
    fields = {f["id"]: f for f in (_obj(x) for x in config.get("registrationFields") or []) if f.get("id")}
    for key in answers:
        if key not in fields:
            raise ValidationFailedError(f"answers.{key}", "is not a question on this form")
    clean: dict[str, Any] = {}
    for field_id, field in fields.items():
        kind = field.get("type")
        value = answers.get(field_id)
        path = f"answers.{field_id}"
        if kind == "checkbox":
            if value is not None and not isinstance(value, bool):
                raise ValidationFailedError(path, "must be true or false")
            if field.get("required") and value is not True:
                raise ValidationFailedError(path, "Field required")
            if value is not None:
                clean[field_id] = value
            continue
        if isinstance(value, bool):
            raise ValidationFailedError(path, "must be text")
        text = value.strip() if isinstance(value, str) else ""
        if not text:
            if field.get("required"):
                raise ValidationFailedError(path, "Field required")
            continue
        if len(text) > _TEXT_LIMITS.get(str(kind), 200):
            raise ValidationFailedError(path, f"must be at most {_TEXT_LIMITS.get(str(kind), 200)} characters")
        if kind == "email" and not _EMAIL.fullmatch(text):
            raise ValidationFailedError(path, "must be an email address")
        if kind == "phone" and not _PHONE.fullmatch(text):
            raise ValidationFailedError(path, "use digits, spaces, hyphens and an optional leading +")
        if kind == "select" and text not in (field.get("options") or []):
            raise ValidationFailedError(path, "must be one of the listed options")
        clean[field_id] = text
    return clean


def _check_sessions(config: dict[str, Any], content: dict[str, Any], session_ids: list[str]) -> list[str]:
    if not session_ids:
        return []
    if config.get("allowSessionChoice") is not True:
        raise ValidationFailedError("sessionIds", "This invitation does not offer a choice of sessions.")
    optional = {
        e.get("id") for e in (_obj(x) for x in content.get("events") or []) if e.get("optional") is True
    }
    if len(set(session_ids)) != len(session_ids):
        raise ValidationFailedError("sessionIds", "must be unique")
    for index, session_id in enumerate(session_ids):
        if session_id not in optional:
            raise ValidationFailedError(f"sessionIds.{index}", "is not an optional session of this invitation")
    return session_ids


MAX_EDITS_PER_RESPONSE = 50
_TOKEN_RE = re.compile(r"[A-Za-z0-9_-]{32,100}")


def hash_edit_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _validated(
    db: Session,
    invitation: Invitation,
    publication: InvitationPublication,
    payload: RsvpSubmission,
    *,
    replacing: InvitationRsvpResponse | None = None,
) -> dict[str, Any]:
    """Check `payload` against the PUBLISHED config; return the values to store.

    The caller holds the invitation row lock, so the capacity check cannot race. When
    `replacing` a reply, its current party no longer counts against capacity (the reply is
    replaced, not added), so changing your own answer never double-counts."""
    content = publication.content
    config = _obj(content.get("rsvp"))
    _check_open(config, publication.timezone)

    attending = payload.attendance == "attending"
    party_size = payload.party_size if attending else 0
    if attending:
        limit = config.get("maxGuestsPerResponse")
        limit = limit if isinstance(limit, int) and not isinstance(limit, bool) else 20
        if party_size < 1:
            raise ValidationFailedError("partySize", "must be at least 1")
        if party_size > limit:
            raise ValidationFailedError("partySize", f"must be at most {limit}")
    email, phone = _check_contact(config, payload)
    answers = _check_answers(config, payload.answers)
    session_ids = _check_sessions(config, content, payload.session_ids) if attending else []

    if replacing is None:
        count = db.scalar(
            select(func.count()).select_from(InvitationRsvpResponse)
            .where(InvitationRsvpResponse.invitation_id == invitation.id)
        ) or 0
        if count >= MAX_RESPONSES_PER_INVITATION:
            raise LimitReachedError("This invitation cannot accept more replies.")
    capacity = config.get("capacity")
    if attending and isinstance(capacity, int) and not isinstance(capacity, bool):
        taken = attending_people(db, invitation.id, exclude=replacing.id if replacing else None)
        if taken + party_size > capacity:
            raise CapacityReachedError()
    return {
        "name": payload.name, "attendance": payload.attendance, "party_size": party_size,
        "email": email, "phone": phone, "session_ids": session_ids, "answers": answers,
        "message": payload.message, "config": config,
    }


def submit(db: Session, slug: str, payload: RsvpSubmission) -> dict[str, Any]:
    """Store one NEW reply and return its private edit token. Raises 404 / 422 `rsvp_closed` /
    422 `validation_error` / 409 `capacity_reached` / 409 `limit_reached`.

    A filled honeypot (`website`) goes through exactly the same checks, so a bot learns
    nothing from the answer, but gets a decoy success and nothing is stored."""
    try:
        invitation, publication = get_live(db, slug, lock=True)
        values = _validated(db, invitation, publication, payload)
        config = values.pop("config")
        if payload.website:
            db.rollback()
            return _decoy(payload)
        token = secrets.token_urlsafe(32)
        response = InvitationRsvpResponse(
            id=uuid.uuid4(), invitation_id=invitation.id, publication_id=publication.id,
            guest_label=payload.guest_label, edit_token_hash=hash_edit_token(token), **values,
        )
        db.add(response)
        db.commit()
    except BaseException:
        db.rollback()
        raise
    return {
        "id": response.id,
        "attendance": response.attendance,
        "partySize": response.party_size,
        "confirmationMessage": config.get("confirmationMessage"),
        "editToken": token,
    }


def _own(db: Session, invitation: Invitation, token: str | None, *, lock: bool = False) -> InvitationRsvpResponse:
    if not token or not _TOKEN_RE.fullmatch(token):
        raise RsvpLinkInvalidError()
    query = select(InvitationRsvpResponse).where(
        InvitationRsvpResponse.invitation_id == invitation.id,
        InvitationRsvpResponse.edit_token_hash == hash_edit_token(token),
    )
    if lock:
        query = query.with_for_update()
    row = db.scalar(query)
    if row is None:
        raise RsvpLinkInvalidError()
    return row


def own_reply_out(row: InvitationRsvpResponse) -> dict[str, Any]:
    out: dict[str, Any] = {
        "id": row.id, "name": row.name, "attendance": row.attendance, "partySize": row.party_size,
        "sessionIds": list(row.session_ids or []), "answers": dict(row.answers or {}),
        "createdAt": row.created_at, "updatedAt": row.updated_at,
    }
    for key, value in (("email", row.email), ("phone", row.phone), ("message", row.message)):
        if value is not None:
            out[key] = value
    return out


def get_own(db: Session, slug: str, token: str | None) -> dict[str, Any]:
    """The guest's own reply, for prefilling the change form (edit token required)."""
    invitation, _ = get_live(db, slug)
    return own_reply_out(_own(db, invitation, token))


def update(db: Session, slug: str, token: str | None, payload: RsvpSubmission) -> dict[str, Any]:
    """Replace the guest's own reply (same row: totals and capacity reflect only the latest
    answer). Same validation as a new reply, against the CURRENT publication."""
    try:
        invitation, publication = get_live(db, slug, lock=True)
        row = _own(db, invitation, token, lock=True)
        if row.edit_count >= MAX_EDITS_PER_RESPONSE:
            raise LimitReachedError("This reply cannot be changed again. Contact the host.")
        values = _validated(db, invitation, publication, payload, replacing=row)
        config = values.pop("config")
        if payload.website:
            db.rollback()
            return {**_decoy(payload), "id": row.id}
        for key, value in values.items():
            setattr(row, key, value)
        row.publication_id = publication.id
        row.edit_count = row.edit_count + 1
        row.updated_at = func.now()
        db.commit()
        db.refresh(row)
    except BaseException:
        db.rollback()
        raise
    return {
        "id": row.id,
        "attendance": row.attendance,
        "partySize": row.party_size,
        "confirmationMessage": config.get("confirmationMessage"),
        "updatedAt": row.updated_at,
    }


def _decoy(payload: RsvpSubmission) -> dict[str, Any]:
    """What a bot that filled the honeypot sees: a plausible success, nothing stored."""
    return {
        "id": uuid.uuid4(),
        "attendance": payload.attendance,
        "partySize": payload.party_size if payload.attendance == "attending" else 0,
        "confirmationMessage": None,
        "editToken": secrets.token_urlsafe(32),
    }


# --- Owner views --------------------------------------------------------------------------


def _out(row: InvitationRsvpResponse, duplicates: set[uuid.UUID]) -> dict[str, Any]:
    out: dict[str, Any] = {
        "id": row.id, "name": row.name, "attendance": row.attendance, "partySize": row.party_size,
        "sessionIds": list(row.session_ids or []), "answers": dict(row.answers or {}), "createdAt": row.created_at,
        "updatedAt": row.updated_at, "editCount": row.edit_count, "possibleDuplicate": row.id in duplicates,
    }
    for key, value in (("email", row.email), ("phone", row.phone), ("message", row.message),
                       ("guestLabel", row.guest_label)):
        if value is not None:
            out[key] = value
    return out


def _capacity(invitation: Invitation) -> int | None:
    """The live capacity while published, else the draft's."""
    pub = invitation.publication
    config = _obj(pub.content.get("rsvp")) if pub is not None else _obj(invitation.rsvp)
    capacity = config.get("capacity")
    return capacity if isinstance(capacity, int) and not isinstance(capacity, bool) else None


def _newest_first(query: Any) -> Any:
    return query.order_by(InvitationRsvpResponse.created_at.desc(), InvitationRsvpResponse.id.desc())


def _norm_name(name: str | None) -> str:
    return " ".join((name or "").casefold().split())


def possible_duplicates(db: Session, invitation_id: uuid.UUID) -> set[uuid.UUID]:
    """Replies sharing a name (case/spacing-insensitive), an email or a phone number with
    another reply of the same invitation. Flagged for the organizer only; never merged."""
    rows = db.execute(
        select(InvitationRsvpResponse.id, InvitationRsvpResponse.name, InvitationRsvpResponse.email,
               InvitationRsvpResponse.phone)
        .where(InvitationRsvpResponse.invitation_id == invitation_id)
    ).all()
    groups: dict[tuple[str, str], list[uuid.UUID]] = {}
    for row_id, name, email, phone in rows:
        keys = [("name", _norm_name(name))]
        if email:
            keys.append(("email", email.strip().casefold()))
        if phone:
            keys.append(("phone", re.sub(r"\D", "", phone)))
        for key in keys:
            if key[1]:
                groups.setdefault(key, []).append(row_id)
    return {row_id for ids in groups.values() if len(ids) > 1 for row_id in ids}


def list_responses(db: Session, invitation: Invitation, *, limit: int, offset: int) -> dict[str, Any]:
    where = InvitationRsvpResponse.invitation_id == invitation.id
    rows = db.scalars(_newest_first(select(InvitationRsvpResponse).where(where)).limit(limit).offset(offset))
    stats = db.execute(
        select(
            func.count(),
            func.count().filter(InvitationRsvpResponse.attendance == "attending"),
            func.coalesce(
                func.sum(InvitationRsvpResponse.party_size).filter(InvitationRsvpResponse.attendance == "attending"), 0
            ),
        ).where(where)
    ).one()
    total, attending, people = int(stats[0]), int(stats[1]), int(stats[2])
    duplicates = possible_duplicates(db, invitation.id)
    return {
        "items": [_out(row, duplicates) for row in rows],
        "total": total,
        "summary": {
            "responses": total, "attending": attending, "notAttending": total - attending,
            "attendingPeople": people, "capacity": _capacity(invitation),
            "possibleDuplicates": len(duplicates),
        },
    }


def delete_response(db: Session, invitation: Invitation, response_id: str) -> None:
    try:
        parsed = uuid.UUID(response_id)
    except ValueError:
        raise NotFoundError("Reply not found.") from None
    result = db.execute(
        delete(InvitationRsvpResponse).where(
            InvitationRsvpResponse.id == parsed, InvitationRsvpResponse.invitation_id == invitation.id
        )
    )
    if result.rowcount == 0:  # type: ignore[attr-defined]
        db.rollback()
        raise NotFoundError("Reply not found.")
    db.commit()


_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def csv_safe(value: Any) -> str:
    """A cell that spreadsheet apps will not evaluate as a formula (OWASP CSV injection)."""
    text = "" if value is None else str(value)
    return f"'{text}" if text.startswith(_FORMULA_PREFIXES) else text


def export_csv(db: Session, invitation: Invitation) -> str:
    """All replies, newest first, as CSV text with a UTF-8 BOM (so Excel detects UTF-8)."""
    rows = list(db.scalars(_newest_first(
        select(InvitationRsvpResponse).where(InvitationRsvpResponse.invitation_id == invitation.id)
    )))
    duplicates = possible_duplicates(db, invitation.id)
    fields = [f for f in (_obj(x) for x in _obj(invitation.rsvp).get("registrationFields") or []) if f.get("id")]
    known = {f["id"] for f in fields}
    extra = sorted({key for row in rows for key in (row.answers or {}) if key not in known})
    answer_columns = [(f["id"], str(f.get("label") or f["id"])) for f in fields] + [(key, key) for key in extra]

    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow([csv_safe(h) for h in (
        "Submitted at", "Updated at", "Possible duplicate", "Name", "Attendance", "Party size", "Email", "Phone",
        "Sessions", "Guest label", "Message",
        *(label for _, label in answer_columns),
    )])
    for row in rows:
        answers = row.answers or {}
        values: list[Any] = [
            row.created_at.isoformat(), row.updated_at.isoformat() if row.updated_at else None,
            "yes" if row.id in duplicates else "no", row.name, row.attendance, row.party_size, row.email, row.phone,
            " ".join(row.session_ids or []), row.guest_label, row.message,
        ]
        for key, _ in answer_columns:
            value = answers.get(key)
            values.append({True: "yes", False: "no"}.get(value, value) if isinstance(value, bool) else value)
        writer.writerow([csv_safe(v) for v in values])
    return "﻿" + out.getvalue()

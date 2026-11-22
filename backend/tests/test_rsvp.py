"""Public RSVP submission and the owner's replies (list, summary, CSV, delete)."""

import csv
import io
import re
import threading
from datetime import datetime, timezone
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.core.errors import CapacityReachedError
from app.models import InvitationRsvpResponse
from app.schemas.rsvp import RsvpSubmission
from app.services import rsvp_service
from tests.invitation_helpers import INV, PUBLIC_INV, create_invitation, error_code, make_publishable, publish, put

GUEST = {"name": "Rina Wulandari", "attendance": "attending", "partySize": 2}


def _published(client: TestClient, variant: str = "birthday", *, rsvp: dict | None = None,
               timezone_name: str | None = None, events: list[dict] | None = None) -> dict[str, str]:
    body: dict[str, Any] = {"themeId": "temuvibe-elegant"}
    if timezone_name:
        body["timezone"] = timezone_name
    iid = create_invitation(client, variant, **body)["id"]
    make_publishable(client, iid)
    for event in events or []:
        assert client.post(f"{INV}/{iid}/events", json=event).status_code == 201
    if rsvp is not None:
        put(client, f"{INV}/{iid}/sections/rsvp", {"enabled": True, **rsvp})
    return {"id": iid, "slug": publish(client, iid)["slug"]}


def rsvp(client: TestClient, slug: str, body: dict[str, Any], **kwargs: Any) -> Any:
    return client.post(f"{PUBLIC_INV}/{slug}/rsvp", json=body, **kwargs)


def _fields(response: Any) -> list[str]:
    assert error_code(response, 422) == "validation_error", response.text
    return [d["field"] for d in response.json()["error"]["details"]]


# --- Submission ---------------------------------------------------------------------------


def test_successful_reply(auth_client: TestClient, client: TestClient, db: Session) -> None:
    inv = _published(auth_client, rsvp={"confirmationMessage": "Sampai jumpa!", "maxGuestsPerResponse": 4})
    client.cookies.clear()
    response = rsvp(client, inv["slug"], {**GUEST, "message": "Selamat!", "guestLabel": "Keluarga Rina"})
    assert response.status_code == 201, response.text
    body = response.json()
    assert set(body) == {"id", "attendance", "partySize", "confirmationMessage", "editToken", "updatedAt"}
    assert re.fullmatch(r"[A-Za-z0-9_-]{43}", body["editToken"]) and body["updatedAt"] is None
    assert (body["attendance"], body["partySize"], body["confirmationMessage"]) == ("attending", 2, "Sampai jumpa!")
    assert "set-cookie" not in response.headers
    assert response.headers["cache-control"] == "no-store"
    row = db.scalar(select(InvitationRsvpResponse))
    assert (row.name, row.party_size, row.message, row.guest_label) == ("Rina Wulandari", 2, "Selamat!", "Keluarga Rina")
    assert str(row.invitation_id) == inv["id"] and row.publication_id is not None


def test_not_attending_stores_party_size_zero(auth_client: TestClient) -> None:
    inv = _published(auth_client)
    response = rsvp(auth_client, inv["slug"], {"name": "Budi", "attendance": "not_attending", "partySize": 3})
    assert response.json()["partySize"] == 0


def test_honeypot_gets_a_decoy_and_nothing_is_stored(auth_client: TestClient, db: Session) -> None:
    inv = _published(auth_client)
    response = rsvp(auth_client, inv["slug"], {**GUEST, "website": "http://spam.example"})
    assert response.status_code == 201
    assert db.scalar(select(func.count()).select_from(InvitationRsvpResponse)) == 0


@pytest.mark.parametrize(
    ("body", "field"),
    [
        ({"attendance": "attending"}, "name"),
        ({"name": "  ", "attendance": "attending"}, "name"),
        ({"name": "x" * 121, "attendance": "attending"}, "name"),
        ({"name": "A", "attendance": "maybe"}, "attendance"),
        ({"name": "A", "attendance": "attending", "partySize": 21}, "partySize"),
        ({"name": "A", "attendance": "attending", "partySize": "2"}, "partySize"),
        ({"name": "A", "attendance": "attending", "message": "x" * 1001}, "message"),
        ({"name": "A", "attendance": "attending", "guestLabel": "x" * 121}, "guestLabel"),
        ({"name": "A", "attendance": "attending", "email": "not-an-email"}, "email"),
        ({"name": "A", "attendance": "attending", "phone": "call me"}, "phone"),
        ({"name": "A", "attendance": "attending", "isAdmin": True}, "isAdmin"),
        ({"name": "A", "attendance": "attending", "answers": {"bad key": "x"}}, "answers.bad key.[key]"),
    ],
)
def test_shape_validation(auth_client: TestClient, body: dict, field: str) -> None:
    inv = _published(auth_client)
    assert _fields(rsvp(auth_client, inv["slug"], body)) == [field]


def test_party_size_limit_comes_from_the_published_config(auth_client: TestClient) -> None:
    inv = _published(auth_client, rsvp={"maxGuestsPerResponse": 2})
    assert _fields(rsvp(auth_client, inv["slug"], {**GUEST, "partySize": 3})) == ["partySize"]
    assert _fields(rsvp(auth_client, inv["slug"], {**GUEST, "partySize": 0})) == ["partySize"]
    assert rsvp(auth_client, inv["slug"], {**GUEST, "partySize": 2}).status_code == 201
    # Draft changes do not apply until republished.
    put(auth_client, f"{INV}/{inv['id']}/sections/rsvp", {"enabled": True, "maxGuestsPerResponse": 5})
    assert _fields(rsvp(auth_client, inv["slug"], {**GUEST, "partySize": 5})) == ["partySize"]
    publish(auth_client, inv["id"])
    assert rsvp(auth_client, inv["slug"], {**GUEST, "partySize": 5}).status_code == 201


def test_gathering_default_party_size_is_ten(auth_client: TestClient) -> None:
    inv = _published(auth_client, "family_reunion")
    assert rsvp(auth_client, inv["slug"], {**GUEST, "partySize": 10}).status_code == 201
    assert _fields(rsvp(auth_client, inv["slug"], {**GUEST, "partySize": 11})) == ["partySize"]


def test_closed_when_rsvp_is_off_or_not_offered(auth_client: TestClient) -> None:
    inv = _published(auth_client, "wedding_ceremony")  # RSVP starts off for weddings
    assert error_code(rsvp(auth_client, inv["slug"], GUEST), 422) == "rsvp_closed"
    assert error_code(rsvp(auth_client, "nobody-abc123", GUEST), 404) == "not_found"
    auth_client.post(f"{INV}/{inv['id']}/unpublish")
    assert error_code(rsvp(auth_client, inv["slug"], GUEST), 404) == "not_found"


class _FrozenDatetime(datetime):
    """`now()` = 2030-01-01T12:00Z: already Jan 2 in Kiritimati (UTC+14), still Jan 1 in Pago Pago (UTC-11)."""

    @classmethod
    def now(cls, tz=None):  # type: ignore[no-untyped-def, override]
        return datetime(2030, 1, 1, 12, 0, tzinfo=timezone.utc).astimezone(tz)


@pytest.mark.parametrize(("zone", "open_"), [("Pacific/Kiritimati", False), ("Pacific/Pago_Pago", True),
                                              ("Asia/Jakarta", True)])
def test_deadline_is_the_end_of_the_day_in_the_invitation_timezone(
    auth_client: TestClient, monkeypatch: pytest.MonkeyPatch, zone: str, open_: bool
) -> None:
    inv = _published(auth_client, rsvp={"deadline": "2030-01-01"}, timezone_name=zone)
    monkeypatch.setattr(rsvp_service, "datetime", _FrozenDatetime)
    response = rsvp(auth_client, inv["slug"], GUEST)
    if open_:
        assert response.status_code == 201, response.text
    else:
        assert error_code(response, 422) == "rsvp_closed"


def test_contact_requirements(auth_client: TestClient, db: Session) -> None:
    email_only = _published(auth_client, rsvp={"collectContact": "email"})
    assert _fields(rsvp(auth_client, email_only["slug"], {**GUEST, "phone": "0812"})) == ["email"]
    assert rsvp(auth_client, email_only["slug"], {**GUEST, "email": "rina@example.com", "phone": "0812"}).status_code == 201
    assert db.scalar(select(InvitationRsvpResponse.phone)) is None  # not asked for: never stored

    phone_only = _published(auth_client, rsvp={"collectContact": "phone"})
    assert _fields(rsvp(auth_client, phone_only["slug"], GUEST)) == ["phone"]
    either = _published(auth_client, rsvp={"collectContact": "email_or_phone"})
    assert _fields(rsvp(auth_client, either["slug"], GUEST)) == ["email"]
    assert rsvp(auth_client, either["slug"], {**GUEST, "phone": "+62 812-3456"}).status_code == 201


FIELDS = [
    {"id": "company", "label": "Company", "type": "text", "required": True},
    {"id": "size", "label": "T-shirt", "type": "select", "options": ["S", "M", "L"]},
    {"id": "veg", "label": "Vegetarian", "type": "checkbox"},
    {"id": "terms", "label": "I agree", "type": "checkbox", "required": True},
    {"id": "work_email", "label": "Work email", "type": "email"},
]


@pytest.mark.parametrize(
    ("answers", "field"),
    [
        ({"terms": True}, "answers.company"),
        ({"company": "   ", "terms": True}, "answers.company"),
        ({"company": "ACME"}, "answers.terms"),
        ({"company": "ACME", "terms": False}, "answers.terms"),
        ({"company": "ACME", "terms": True, "size": "XL"}, "answers.size"),
        ({"company": "ACME", "terms": True, "veg": "yes"}, "answers.veg"),
        ({"company": True, "terms": True}, "answers.company"),
        ({"company": "ACME", "terms": True, "work_email": "nope"}, "answers.work_email"),
        ({"company": "x" * 201, "terms": True}, "answers.company"),
        ({"company": "ACME", "terms": True, "unknown": "x"}, "answers.unknown"),
    ],
)
def test_registration_field_rules(auth_client: TestClient, answers: dict, field: str) -> None:
    inv = _published(auth_client, "seminar", rsvp={"registrationFields": FIELDS})
    assert _fields(rsvp(auth_client, inv["slug"], {**GUEST, "partySize": 1, "answers": answers})) == [field]


def test_registration_answers_are_stored_cleanly(auth_client: TestClient, db: Session) -> None:
    inv = _published(auth_client, "seminar", rsvp={"registrationFields": FIELDS, "collectContact": "none"})
    answers = {"company": "  ACME ", "terms": True, "size": "M", "veg": False}
    assert rsvp(auth_client, inv["slug"], {**GUEST, "partySize": 1, "answers": answers}).status_code == 201
    assert db.scalar(select(InvitationRsvpResponse.answers)) == {"company": "ACME", "terms": True, "size": "M", "veg": False}


def test_session_choice(auth_client: TestClient, db: Session) -> None:
    events = [{"type": "workshop", "title": "Workshop A", "date": "2099-06-01", "startTime": "13:00",
               "venueName": "Room A", "address": "Jl. A", "optional": True}]
    closed = _published(auth_client, "corporate_event", events=events)
    assert _fields(rsvp(auth_client, closed["slug"], {**GUEST, "sessionIds": ["x"]})) == ["sessionIds"]
    inv = _published(auth_client, "corporate_event", rsvp={"allowSessionChoice": True}, events=events)
    main, workshop = (e["id"] for e in auth_client.get(f"{INV}/{inv['id']}/events").json())
    assert _fields(rsvp(auth_client, inv["slug"], {**GUEST, "sessionIds": [main]})) == ["sessionIds.0"]
    assert _fields(rsvp(auth_client, inv["slug"], {**GUEST, "sessionIds": ["nope"]})) == ["sessionIds.0"]
    assert _fields(rsvp(auth_client, inv["slug"], {**GUEST, "sessionIds": [workshop, workshop]})) == ["sessionIds"]
    assert rsvp(auth_client, inv["slug"], {**GUEST, "sessionIds": [workshop]}).status_code == 201
    assert db.scalar(select(InvitationRsvpResponse.session_ids)) == [workshop]
    published = auth_client.get(f"{PUBLIC_INV}/{inv['slug']}").json()["content"]
    assert [e.get("optional") for e in published["events"]] == [None, True]


def test_capacity_and_full_flag(auth_client: TestClient) -> None:
    inv = _published(auth_client, rsvp={"capacity": 3})
    page = auth_client.get(f"{PUBLIC_INV}/{inv['slug']}")
    assert page.json()["content"]["rsvp"]["full"] is False
    assert rsvp(auth_client, inv["slug"], {**GUEST, "partySize": 2}).status_code == 201
    assert error_code(rsvp(auth_client, inv["slug"], {**GUEST, "partySize": 2}), 409) == "capacity_reached"
    assert rsvp(auth_client, inv["slug"], {"name": "No", "attendance": "not_attending"}).status_code == 201
    assert rsvp(auth_client, inv["slug"], {**GUEST, "partySize": 1}).status_code == 201
    full = auth_client.get(f"{PUBLIC_INV}/{inv['slug']}", headers={"If-None-Match": page.headers["etag"]})
    assert full.status_code == 200  # the ETag changes when the RSVP fills up
    assert full.json()["content"]["rsvp"]["full"] is True
    assert error_code(rsvp(auth_client, inv["slug"], {**GUEST, "partySize": 1}), 409) == "capacity_reached"


def test_capacity_race_admits_exactly_one(
    auth_client: TestClient, engine: Engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Two concurrent replies for the last seat, on two DB connections: one 201, one 409."""
    inv = _published(auth_client, rsvp={"capacity": 3})
    assert rsvp(auth_client, inv["slug"], {**GUEST, "partySize": 2}).status_code == 201

    real_count = rsvp_service.attending_people

    def slow_count(db: Session, invitation_id: Any, *, exclude: Any = None) -> int:
        count = real_count(db, invitation_id, exclude=exclude)
        threading.Event().wait(0.3)  # widen the window between the check and the insert
        return count

    monkeypatch.setattr(rsvp_service, "attending_people", slow_count)
    make_session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    barrier = threading.Barrier(2)
    results: list[str] = []

    def submit(name: str) -> None:
        session = make_session()
        try:
            barrier.wait()
            rsvp_service.submit(session, inv["slug"], RsvpSubmission.model_validate(
                {"name": name, "attendance": "attending", "partySize": 1}))
            results.append("ok")
        except CapacityReachedError:
            results.append("full")
        finally:
            session.close()

    threads = [threading.Thread(target=submit, args=(n,)) for n in ("Guest A", "Guest B")]
    for t in threads:
        t.start()
    for t in threads:
        t.join(10)
    assert sorted(results) == ["full", "ok"]
    summary = auth_client.get(f"{INV}/{inv['id']}/rsvp-responses").json()["summary"]
    assert summary["attendingPeople"] == 3


def test_reply_limit_per_invitation(auth_client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    inv = _published(auth_client)
    monkeypatch.setattr(rsvp_service, "MAX_RESPONSES_PER_INVITATION", 2)
    for _ in range(2):
        assert rsvp(auth_client, inv["slug"], GUEST).status_code == 201
    assert error_code(rsvp(auth_client, inv["slug"], GUEST), 409) == "limit_reached"


def test_rsvp_has_its_own_rate_limit_bucket(auth_client: TestClient) -> None:
    inv = _published(auth_client)
    assert get_settings().rsvp_rate_limit_per_minute == 10
    for _ in range(10):
        assert rsvp(auth_client, inv["slug"], GUEST).status_code == 201
    assert error_code(rsvp(auth_client, inv["slug"], GUEST), 429) == "too_many_requests"
    assert auth_client.get(f"{PUBLIC_INV}/{inv['slug']}").status_code == 200  # page views are a separate bucket


def test_rsvp_body_is_capped_at_16_kb(auth_client: TestClient) -> None:
    inv = _published(auth_client)
    response = auth_client.post(f"{PUBLIC_INV}/{inv['slug']}/rsvp", json={**GUEST, "message": "y" * 17_000})
    assert error_code(response, 413) == "payload_too_large"
    # The largest valid reply (10 answers x 1000 chars + a 1000-char message) still fits.
    fields = [{"id": f"q{i}", "label": f"Q{i}", "type": "textarea"} for i in range(10)]
    put(auth_client, f"{INV}/{inv['id']}/sections/rsvp", {"enabled": True, "registrationFields": fields})
    publish(auth_client, inv["id"])
    largest = {**GUEST, "name": "x" * 120, "message": "y" * 1000, "answers": {f"q{i}": "z" * 1000 for i in range(10)}}
    assert rsvp(auth_client, inv["slug"], largest).status_code == 201


def test_foreign_origin_cannot_post_replies(auth_client: TestClient) -> None:
    inv = _published(auth_client)
    response = rsvp(auth_client, inv["slug"], GUEST, headers={"Origin": "https://evil.example"})
    assert response.status_code == 403


# --- Owner views --------------------------------------------------------------------------


def test_list_summary_pagination_and_delete(auth_client: TestClient) -> None:
    inv = _published(auth_client, rsvp={"capacity": 50, "collectContact": "email_or_phone"})
    for i in range(3):
        rsvp(auth_client, inv["slug"], {**GUEST, "name": f"Guest {i}", "email": f"g{i}@example.com"})
    rsvp(auth_client, inv["slug"], {"name": "Absent", "attendance": "not_attending", "phone": "0812"})
    base = f"{INV}/{inv['id']}/rsvp-responses"
    page = auth_client.get(base, params={"limit": 2})
    assert page.headers["cache-control"] == "no-store"
    body = page.json()
    assert body["total"] == 4 and len(body["items"]) == 2
    assert body["summary"] == {
        "responses": 4, "attending": 3, "notAttending": 1, "attendingPeople": 6, "capacity": 50, "possibleDuplicates": 0,
    }
    assert body["items"][0]["name"] == "Absent"  # newest first
    assert set(body["items"][1]) >= {"id", "name", "attendance", "partySize", "email", "sessionIds", "answers", "createdAt"}
    rest = auth_client.get(base, params={"limit": 2, "offset": 2}).json()["items"]
    assert [i["name"] for i in rest] == ["Guest 1", "Guest 0"]
    for bad in ({"limit": 0}, {"limit": 201}, {"offset": -1}):
        assert auth_client.get(base, params=bad).status_code == 422
    assert auth_client.delete(f"{base}/{rest[0]['id']}").status_code == 204
    assert auth_client.delete(f"{base}/{rest[0]['id']}").status_code == 404
    assert auth_client.get(base).json()["summary"]["attendingPeople"] == 4


def test_csv_export_is_formula_safe(auth_client: TestClient) -> None:
    inv = _published(auth_client, "seminar", rsvp={"registrationFields": [
        {"id": "company", "label": "=Company", "type": "text"}], "collectContact": "email_or_phone"})
    rsvp(auth_client, inv["slug"], {"name": "=HYPERLINK(\"http://evil\",\"x\")", "attendance": "attending",
                                    "partySize": 1, "phone": "+62 812", "answers": {"company": "@SUM(A1)"},
                                    "message": "-2+3", "guestLabel": "@home"})
    rsvp(auth_client, inv["slug"], {"name": "Dewi, \"Sari\"", "attendance": "not_attending", "email": "d@example.com",
                                    "message": "Baris 1\nBaris 2"})
    response = auth_client.get(f"{INV}/{inv['id']}/rsvp-responses.csv")
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/csv; charset=utf-8"
    assert response.headers["content-disposition"] == f'attachment; filename="rsvp-{inv["slug"]}.csv"'
    assert response.headers["cache-control"] == "no-store"
    raw = response.content.decode("utf-8")
    assert raw.startswith("﻿")
    rows = list(csv.reader(io.StringIO(raw.removeprefix("﻿"))))
    assert rows[0] == ["Submitted at", "Updated at", "Possible duplicate", "Name", "Attendance", "Party size",
                       "Email", "Phone", "Sessions", "Guest label", "Message", "'=Company"]
    # The rest of this test indexes the original columns: drop the two new ones.
    rows = [row[:1] + row[3:] for row in rows]
    newest, oldest = rows[1], rows[2]
    assert newest[1:4] == ['Dewi, "Sari"', "not_attending", "0"] and newest[8] == "Baris 1\nBaris 2"
    assert oldest[1] == "'=HYPERLINK(\"http://evil\",\"x\")"
    assert oldest[5] == "'+62 812" and oldest[7] == "'@home" and oldest[8] == "'-2+3" and oldest[9] == "'@SUM(A1)"
    for row in rows:
        for cell in row:
            assert not cell.startswith(("=", "+", "-", "@", "\t", "\r")), cell


def test_csv_safe_helper() -> None:
    assert [rsvp_service.csv_safe(v) for v in ("=1", "+1", "-1", "@a", "\tx", "\rx", "ok", None, 3)] == [
        "'=1", "'+1", "'-1", "'@a", "'\tx", "'\rx", "ok", "", "3",
    ]

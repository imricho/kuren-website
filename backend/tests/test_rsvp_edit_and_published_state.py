"""Guests changing their own reply (private edit token), the published time zone and ETag,
online/hybrid/multi-day sessions, the publish dry run, and the wizard's session choices."""

import threading
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, update
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.errors import CapacityReachedError
from app.core.rate_limit import DatabaseRateLimiter, rsvp_limiter
from app.models import InvitationRsvpResponse
from app.models.rate_limit import RateLimitHit
from app.schemas.rsvp import RsvpSubmission
from app.services import rsvp_service
from tests.invitation_helpers import (
    FUTURE,
    INV,
    PUBLIC_INV,
    blocked,
    create_invitation,
    error_code,
    make_publishable,
    publish,
    put,
)
from tests.test_rsvp import _FrozenDatetime, _published, rsvp

GUEST = {"name": "Rina Wulandari", "attendance": "attending", "partySize": 2, "email": "rina@example.com"}


def mine(client: TestClient, slug: str, token: str | None, body: dict[str, Any] | None = None) -> Any:
    headers = {"X-RSVP-Token": token} if token is not None else {}
    if body is None:
        return client.get(f"{PUBLIC_INV}/{slug}/rsvp/mine", headers=headers)
    return client.put(f"{PUBLIC_INV}/{slug}/rsvp/mine", json=body, headers=headers)


def summary(client: TestClient, iid: str) -> dict[str, Any]:
    return client.get(f"{INV}/{iid}/rsvp-responses").json()["summary"]


# --- Changing a reply ---------------------------------------------------------------------


def test_guest_changes_attendance_and_totals_follow(auth_client: TestClient, client: TestClient, db: Session) -> None:
    """The reproduced bug: attending -> not attending must REPLACE the reply, not add one."""
    inv = _published(auth_client, rsvp={"capacity": 10})
    created = rsvp(client, inv["slug"], GUEST).json()
    token = created["editToken"]
    assert summary(auth_client, inv["id"])["attendingPeople"] == 2

    own = mine(client, inv["slug"], token)
    assert own.status_code == 200 and own.headers["cache-control"] == "no-store"
    assert (own.json()["name"], own.json()["partySize"], own.json()["updatedAt"]) == ("Rina Wulandari", 2, None)

    changed = mine(client, inv["slug"], token, {**GUEST, "attendance": "not_attending"})
    assert changed.status_code == 200, changed.text
    assert changed.json()["id"] == created["id"] and changed.json()["partySize"] == 0
    assert changed.json()["updatedAt"] is not None and "editToken" not in changed.json() or not changed.json()["editToken"]

    s = summary(auth_client, inv["id"])
    assert (s["responses"], s["attending"], s["notAttending"], s["attendingPeople"]) == (1, 0, 1, 0)
    row = db.scalar(select(InvitationRsvpResponse))
    assert row.edit_count == 1 and row.updated_at is not None
    items = auth_client.get(f"{INV}/{inv['id']}/rsvp-responses").json()["items"]
    assert items[0]["editCount"] == 1 and items[0]["updatedAt"] and items[0]["possibleDuplicate"] is False


def test_changing_party_size_respects_capacity_without_double_counting(auth_client: TestClient) -> None:
    inv = _published(auth_client, rsvp={"capacity": 5})
    token = rsvp(auth_client, inv["slug"], {**GUEST, "partySize": 3}).json()["editToken"]
    assert rsvp(auth_client, inv["slug"], {**GUEST, "name": "Other", "email": "o@example.com", "partySize": 2}).status_code == 201
    # 5/5 taken. Going 3 -> 3 is fine (own seats are not counted twice), 3 -> 4 is not.
    assert mine(auth_client, inv["slug"], token, {**GUEST, "partySize": 3}).status_code == 200
    assert error_code(mine(auth_client, inv["slug"], token, {**GUEST, "partySize": 4}), 409) == "capacity_reached"
    # Freeing seats lets someone else in.
    assert mine(auth_client, inv["slug"], token, {**GUEST, "partySize": 1}).status_code == 200
    assert summary(auth_client, inv["id"])["attendingPeople"] == 3
    page = auth_client.get(f"{PUBLIC_INV}/{inv['slug']}").json()
    assert page["content"]["rsvp"]["full"] is False


def test_invalid_missing_and_foreign_tokens(auth_client: TestClient, client: TestClient) -> None:
    a = _published(auth_client)
    b = _published(auth_client)
    token = rsvp(client, a["slug"], GUEST).json()["editToken"]
    for bad in (None, "", "short", "x" * 43, token[:-1] + ("A" if token[-1] != "A" else "B")):
        rsvp_limiter.reset()
        assert error_code(mine(client, a["slug"], bad), 404) == "rsvp_link_invalid"
        assert error_code(mine(client, a["slug"], bad, GUEST), 404) == "rsvp_link_invalid"
    # A token only works on its own invitation.
    assert error_code(mine(client, b["slug"], token), 404) == "rsvp_link_invalid"
    # Unpublished: the whole invitation is gone for guests.
    auth_client.post(f"{INV}/{a['id']}/unpublish")
    assert error_code(mine(client, a["slug"], token), 404) == "not_found"


def test_replies_made_before_edit_links_cannot_be_edited(auth_client: TestClient, db: Session) -> None:
    inv = _published(auth_client)
    token = rsvp(auth_client, inv["slug"], GUEST).json()["editToken"]
    db.execute(update(InvitationRsvpResponse).values(edit_token_hash=None))
    db.commit()
    assert error_code(mine(auth_client, inv["slug"], token), 404) == "rsvp_link_invalid"


def test_update_is_validated_like_a_new_reply(auth_client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    inv = _published(auth_client, rsvp={"maxGuestsPerResponse": 3, "collectContact": "email", "deadline": "2030-01-01"},
                     timezone_name="Asia/Jakarta")
    token = rsvp(auth_client, inv["slug"], GUEST).json()["editToken"]
    assert error_code(mine(auth_client, inv["slug"], token, {**GUEST, "partySize": 4}), 422) == "validation_error"
    assert error_code(mine(auth_client, inv["slug"], token, {**GUEST, "email": None}), 422) == "validation_error"
    assert error_code(mine(auth_client, inv["slug"], token, {**GUEST, "name": "a\x00b"}), 422) == "validation_error"
    monkeypatch.setattr(rsvp_service, "datetime", _FrozenDatetime)  # 2030-01-01 12:00Z: Jan 1 in Jakarta
    assert mine(auth_client, inv["slug"], token, {**GUEST, "partySize": 1}).status_code == 200


def test_update_after_deadline_is_closed(auth_client: TestClient) -> None:
    inv = _published(auth_client, rsvp={"deadline": "2099-01-01"})
    token = rsvp(auth_client, inv["slug"], GUEST).json()["editToken"]
    put(auth_client, f"{INV}/{inv['id']}/sections/rsvp", {"enabled": True, "deadline": "2000-01-01"})
    publish(auth_client, inv["id"])
    assert error_code(mine(auth_client, inv["slug"], token, GUEST), 422) == "rsvp_closed"
    assert mine(auth_client, inv["slug"], token).status_code == 200  # still readable


def test_honeypot_on_update_changes_nothing(auth_client: TestClient, db: Session) -> None:
    inv = _published(auth_client)
    token = rsvp(auth_client, inv["slug"], GUEST).json()["editToken"]
    response = mine(auth_client, inv["slug"], token, {**GUEST, "attendance": "not_attending", "website": "x"})
    assert response.status_code == 200
    row = db.scalar(select(InvitationRsvpResponse))
    db.refresh(row)
    assert (row.attendance, row.edit_count) == ("attending", 0)


def test_concurrent_update_and_new_reply_cannot_overshoot_capacity(
    auth_client: TestClient, engine: Engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Last seat: guest A grows their party while guest B replies. Exactly one wins."""
    inv = _published(auth_client, rsvp={"capacity": 3})
    token = rsvp(auth_client, inv["slug"], {**GUEST, "partySize": 2}).json()["editToken"]
    real = rsvp_service.attending_people

    def slow(db: Session, invitation_id: Any, *, exclude: Any = None) -> int:
        count = real(db, invitation_id, exclude=exclude)
        threading.Event().wait(0.3)
        return count

    monkeypatch.setattr(rsvp_service, "attending_people", slow)
    make = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    barrier = threading.Barrier(2)
    results: list[str] = []

    def run(kind: str) -> None:
        session = make()
        try:
            barrier.wait()
            if kind == "update":
                rsvp_service.update(session, inv["slug"], token,
                                    RsvpSubmission.model_validate({**GUEST, "partySize": 3}))
            else:
                rsvp_service.submit(session, inv["slug"], RsvpSubmission.model_validate(
                    {"name": "Budi", "attendance": "attending", "partySize": 1}))
            results.append("ok")
        except CapacityReachedError:
            results.append("full")
        finally:
            session.close()

    threads = [threading.Thread(target=run, args=(k,)) for k in ("update", "new")]
    for t in threads:
        t.start()
    for t in threads:
        t.join(10)
    assert sorted(results) == ["full", "ok"]
    assert summary(auth_client, inv["id"])["attendingPeople"] == 3


def test_duplicates_are_flagged_not_merged(auth_client: TestClient, client: TestClient) -> None:
    """Two separate replies from the same person (the audit seminar's case) stay two rows,
    both counted, and are flagged for the organizer."""
    inv = _published(auth_client)
    rsvp(client, inv["slug"], GUEST)
    rsvp(client, inv["slug"], {**GUEST, "name": "  rina   WULANDARI ", "attendance": "not_attending"})
    rsvp(client, inv["slug"], {"name": "Someone Else", "attendance": "attending", "partySize": 1})
    body = auth_client.get(f"{INV}/{inv['id']}/rsvp-responses").json()
    s = body["summary"]
    assert (s["responses"], s["attending"], s["notAttending"], s["possibleDuplicates"]) == (3, 2, 1, 2)
    flags = {item["name"].strip(): item["possibleDuplicate"] for item in body["items"]}
    assert flags == {"rina   WULANDARI": True, "Rina Wulandari": True, "Someone Else": False}
    csv_text = auth_client.get(f"{INV}/{inv['id']}/rsvp-responses.csv").text
    assert csv_text.count(",yes,") == 2


def test_edit_limit(auth_client: TestClient, db: Session) -> None:
    inv = _published(auth_client)
    token = rsvp(auth_client, inv["slug"], GUEST).json()["editToken"]
    db.execute(update(InvitationRsvpResponse).values(edit_count=rsvp_service.MAX_EDITS_PER_RESPONSE))
    db.commit()
    assert error_code(mine(auth_client, inv["slug"], token, GUEST), 409) == "limit_reached"


# --- Published time zone and ETag ---------------------------------------------------------


def test_draft_timezone_change_does_not_reach_guests_until_republished(auth_client: TestClient) -> None:
    inv = _published(auth_client, timezone_name="Asia/Jakarta")
    first = auth_client.get(f"{PUBLIC_INV}/{inv['slug']}")
    assert first.json()["timezone"] == "Asia/Jakarta"

    assert auth_client.patch(f"{INV}/{inv['id']}", json={"timezone": "Asia/Makassar"}).status_code == 200
    record = auth_client.get(f"{INV}/{inv['id']}").json()
    assert record["hasUnpublishedChanges"] is True
    again = auth_client.get(f"{PUBLIC_INV}/{inv['slug']}", headers={"If-None-Match": first.headers["etag"]})
    assert again.status_code == 304  # guests still get the published representation

    publish(auth_client, inv["id"])
    after = auth_client.get(f"{PUBLIC_INV}/{inv['slug']}", headers={"If-None-Match": first.headers["etag"]})
    assert after.status_code == 200 and after.json()["timezone"] == "Asia/Makassar"
    assert after.headers["etag"] != first.headers["etag"]
    assert auth_client.get(f"{INV}/{inv['id']}").json()["hasUnpublishedChanges"] is False


def test_rsvp_deadline_uses_the_published_timezone(auth_client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """At 2030-01-01 12:00Z it is already Jan 2 in Kiritimati. Publishing in Pago Pago (open)
    and then switching the DRAFT to Kiritimati must not close the RSVP until republished."""
    inv = _published(auth_client, rsvp={"deadline": "2030-01-01"}, timezone_name="Pacific/Pago_Pago")
    monkeypatch.setattr(rsvp_service, "datetime", _FrozenDatetime)
    auth_client.patch(f"{INV}/{inv['id']}", json={"timezone": "Pacific/Kiritimati"})
    assert rsvp(auth_client, inv["slug"], GUEST).status_code == 201
    publish(auth_client, inv["id"])
    assert error_code(rsvp(auth_client, inv["slug"], {**GUEST, "name": "Late"}), 422) == "rsvp_closed"


def test_etag_changes_when_capacity_fills_and_frees(auth_client: TestClient) -> None:
    inv = _published(auth_client, rsvp={"capacity": 2})
    open_tag = auth_client.get(f"{PUBLIC_INV}/{inv['slug']}").headers["etag"]
    token = rsvp(auth_client, inv["slug"], GUEST).json()["editToken"]
    full = auth_client.get(f"{PUBLIC_INV}/{inv['slug']}", headers={"If-None-Match": open_tag})
    assert full.status_code == 200 and full.json()["content"]["rsvp"]["full"] is True
    mine(auth_client, inv["slug"], token, {**GUEST, "attendance": "not_attending"})
    freed = auth_client.get(f"{PUBLIC_INV}/{inv['slug']}", headers={"If-None-Match": full.headers["etag"]})
    assert freed.status_code == 200 and freed.json()["content"]["rsvp"]["full"] is False
    assert freed.headers["etag"] == open_tag  # same representation, same tag


# --- Session formats and multi-day sessions -----------------------------------------------


def _first_event(client: TestClient, iid: str) -> dict[str, Any]:
    return client.get(f"{INV}/{iid}/events").json()[0]


def test_online_session_needs_access_not_a_venue(auth_client: TestClient) -> None:
    iid = create_invitation(auth_client, "seminar", themeId="temuvibe-corporate")["id"]
    make_publishable(auth_client, iid)
    event = _first_event(auth_client, iid)
    base = {"type": "session", "title": "Webinar", "date": FUTURE, "startTime": "10:00", "format": "online"}
    put(auth_client, f"{INV}/{iid}/events/{event['id']}", base)
    response = auth_client.post(f"{INV}/{iid}/publish")
    assert blocked(response) == [("events", "events.0.onlineUrl", "required")]
    check = auth_client.get(f"{INV}/{iid}/publish-check").json()
    assert check["ready"] is False and [(i["section"], i["field"]) for i in check["issues"]] == [("events", "events.0.onlineUrl")]

    put(auth_client, f"{INV}/{iid}/events/{event['id']}", {**base, "onlineInstructions": "Link dikirim lewat email."})
    assert auth_client.get(f"{INV}/{iid}/publish-check").json() == {
        "revision": auth_client.get(f"{INV}/{iid}").json()["revision"], "ready": True, "issues": [],
    }
    put(auth_client, f"{INV}/{iid}/events/{event['id']}", {
        **base, "onlineUrl": "https://zoom.us/j/123", "onlineLabel": "Zoom", "venueName": "Leftover",
    })
    slug = publish(auth_client, iid)["slug"]
    published = auth_client.get(f"{PUBLIC_INV}/{slug}").json()["content"]["events"][0]
    assert published["format"] == "online" and published["onlineUrl"] == "https://zoom.us/j/123"


def test_hybrid_session_needs_venue_and_access(auth_client: TestClient) -> None:
    iid = create_invitation(auth_client, "workshop", themeId="temuvibe-corporate")["id"]
    make_publishable(auth_client, iid)
    event = _first_event(auth_client, iid)
    put(auth_client, f"{INV}/{iid}/events/{event['id']}", {
        "type": "workshop", "title": "Hands-on", "date": FUTURE, "startTime": "09:00", "format": "hybrid",
    })
    fields = sorted(f for _, f, _ in blocked(auth_client.post(f"{INV}/{iid}/publish")))
    assert fields == ["events.0.address", "events.0.onlineUrl", "events.0.venueName"]


def test_in_person_sessions_are_unchanged_and_publish_no_online_details(auth_client: TestClient) -> None:
    iid = create_invitation(auth_client, "seminar", themeId="temuvibe-corporate")["id"]
    make_publishable(auth_client, iid)
    event = _first_event(auth_client, iid)
    assert "format" not in event
    put(auth_client, f"{INV}/{iid}/events/{event['id']}", {
        "type": "session", "title": "Main", "date": FUTURE, "startTime": "10:00", "venueName": "Hall",
        "address": "Jl. A", "onlineUrl": "https://example.com/stale",
    })
    slug = publish(auth_client, iid)["slug"]
    published = auth_client.get(f"{PUBLIC_INV}/{slug}").json()["content"]["events"][0]
    assert "format" not in published and "onlineUrl" not in published


def test_multi_day_sessions(auth_client: TestClient) -> None:
    iid = create_invitation(auth_client, "workshop", themeId="temuvibe-corporate")["id"]
    event = _first_event(auth_client, iid)
    url = f"{INV}/{iid}/events/{event['id']}"
    ok = {"type": "workshop", "title": "Bootcamp", "date": "2099-06-01", "endDate": "2099-06-03",
          "startTime": "16:00", "endTime": "12:00"}
    assert auth_client.put(url, json=ok).json()["endDate"] == "2099-06-03"  # ends earlier in the day: fine
    before = auth_client.put(url, json={**ok, "endDate": "2099-05-31"})
    assert [d["field"] for d in before.json()["error"]["details"]] == ["endDate"]
    same_day = auth_client.put(url, json={**ok, "endDate": "2099-06-01"})
    assert [d["field"] for d in same_day.json()["error"]["details"]] == ["endTime"]


# --- Publish dry run, wizard session choices, shared rate limits ----------------------------


def test_publish_check_matches_publish_for_the_audited_seminar(auth_client: TestClient) -> None:
    """Organization, agenda and speakers shown but empty: the dry run reports exactly what
    publishing would block on (the editor uses it to state the real outcome)."""
    iid = create_invitation(auth_client, "seminar", themeId="temuvibe-corporate")["id"]
    make_publishable(auth_client, iid)
    for section in ("organization", "agenda", "speakers"):
        put(auth_client, f"{INV}/{iid}/sections/{section}", {"enabled": True})
    check = auth_client.get(f"{INV}/{iid}/publish-check").json()
    expected = blocked(auth_client.post(f"{INV}/{iid}/publish"))
    assert sorted((i["section"], i["field"], i["code"]) for i in check["issues"]) == sorted(expected)
    assert {s for s, _, _ in expected} == {"organization", "agenda", "speakers"}


def test_publish_check_is_owner_only(auth_client: TestClient, client: TestClient) -> None:
    iid = create_invitation(auth_client, "birthday")["id"]
    client.cookies.clear()
    assert client.get(f"{INV}/{iid}/publish-check").status_code == 401


@pytest.mark.parametrize(("sessions", "expected"), [
    (None, [("ceremony", "Upacara Pernikahan")]),
    ([{"type": "akad", "title": "Akad Nikah"}], [("akad", "Akad Nikah")]),
    ([{"type": "holy_matrimony", "title": "Pemberkatan Nikah"}, {"type": "reception", "title": "Resepsi"}],
     [("holy_matrimony", "Pemberkatan Nikah"), ("reception", "Resepsi")]),
    ([], []),
])
def test_wedding_wizard_session_choices(auth_client: TestClient, sessions: Any, expected: list[tuple[str, str]]) -> None:
    body: dict[str, Any] = {"locale": "id"}
    if sessions is not None:
        body["sessions"] = sessions
    iid = create_invitation(auth_client, "wedding_ceremony", **body)["id"]
    events = auth_client.get(f"{INV}/{iid}/events").json()
    assert [(e["type"], e["title"]) for e in events] == expected


def test_reception_only_wedding(auth_client: TestClient) -> None:
    iid = create_invitation(auth_client, "wedding_reception", locale="id")["id"]
    assert [(e["type"], e["title"]) for e in auth_client.get(f"{INV}/{iid}/events").json()] == [("reception", "Resepsi")]


def test_database_rate_limiter_is_shared_and_stores_no_raw_keys(engine: Engine, db: Session) -> None:
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    worker_a = DatabaseRateLimiter("test", session_factory=factory)
    worker_b = DatabaseRateLimiter("test", session_factory=factory)  # another process, same table
    assert [worker_a.hit("203.0.113.9", 3), worker_b.hit("203.0.113.9", 3), worker_a.hit("203.0.113.9", 3)] == [True] * 3
    assert worker_b.hit("203.0.113.9", 3) is False
    assert worker_a.hit("198.51.100.1", 3) is True  # other clients are unaffected
    buckets = db.scalars(select(RateLimitHit.bucket)).all()
    assert buckets and not any("203.0.113.9" in b for b in buckets)
    worker_a.reset()
    assert db.scalar(select(func.count()).select_from(RateLimitHit)) == 0

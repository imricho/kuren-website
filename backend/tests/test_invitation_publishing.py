"""Variant-aware publishing: checks, snapshot limited to offered sections, public payload."""

import json
import uuid
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Invitation

from app.core.invitation_registry import get_variant
from tests.invitation_helpers import (
    ALL_VARIANTS, FUTURE, INV, PER_CATEGORY, PUBLIC_INV, blocked, create_invitation, make_publishable, publish, put,
)
from tests.wedding_helpers import PUBLIC

SNAPSHOT_META = {"contentVersion", "schemaVersion", "locale"}


@pytest.mark.parametrize("variant", ALL_VARIANTS)
def test_every_variant_publishes_once_filled(auth_client: TestClient, variant: str) -> None:
    iid = create_invitation(auth_client, variant, themeId="temuvibe-minimal")["id"]
    make_publishable(auth_client, iid)
    record = publish(auth_client, iid)
    assert record["status"] == "published" and record["slug"]
    body = auth_client.get(f"{PUBLIC_INV}/{record['slug']}").json()
    assert (body["category"], body["variant"]) == (get_variant(variant).category, variant)
    # Only offered sections are published.
    offered = {s.id for s in get_variant(variant).sections}
    assert set(body["content"]) - SNAPSHOT_META <= offered
    assert body["content"]["contentVersion"] == "2.0" and body["content"]["schemaVersion"] == 2


@pytest.mark.parametrize("variant", PER_CATEGORY)
def test_publish_lifecycle_per_category(auth_client: TestClient, variant: str) -> None:
    iid = create_invitation(auth_client, variant, themeId="temuvibe-elegant")["id"]
    make_publishable(auth_client, iid)
    first = publish(auth_client, iid)
    slug = first["slug"]
    assert first["hasUnpublishedChanges"] is False
    put(auth_client, f"{INV}/{iid}/sections/closing", {"message": "Changed"})
    assert auth_client.get(f"{INV}/{iid}").json()["hasUnpublishedChanges"] is True
    assert auth_client.get(f"{PUBLIC_INV}/{slug}").json()["content"]["closing"] == {"message": "See you there."}
    second = publish(auth_client, iid)
    assert second["slug"] == slug and second["hasUnpublishedChanges"] is False
    assert auth_client.get(f"{PUBLIC_INV}/{slug}").json()["content"]["closing"] == {"message": "Changed"}
    assert auth_client.post(f"{INV}/{iid}/unpublish").json()["status"] == "draft"
    assert auth_client.get(f"{PUBLIC_INV}/{slug}").status_code == 404
    assert publish(auth_client, iid)["slug"] == slug  # never changes
    listed = auth_client.get(INV).json()["items"][0]
    assert (listed["status"], listed["slug"], listed["eventDate"]) == ("published", slug, FUTURE)


def test_empty_birthday_lists_its_own_requirements(auth_client: TestClient) -> None:
    iid = create_invitation(auth_client, "birthday")["id"]
    assert blocked(auth_client.post(f"{INV}/{iid}/publish")) == [
        ("theme", "themeId", "required"),
        ("opening", "opening.weddingDate", "required"),
        ("profiles", "profiles.people", "incomplete"),
        ("milestone", "milestone", "incomplete"),
        ("events", "events.0.date", "required"),
        ("events", "events.0.startTime", "required"),
        ("events", "events.0.venueName", "required"),
        ("events", "events.0.address", "required"),
        ("closing", "closing.message", "required"),
    ]  # no couple: a birthday does not offer it


def test_empty_seminar_lists_its_own_requirements(auth_client: TestClient) -> None:
    iid = create_invitation(auth_client, "seminar", themeId="temuvibe-corporate")["id"]
    issues = blocked(auth_client.post(f"{INV}/{iid}/publish"))
    assert ("organization", "organization.name", "required") in issues
    assert ("agenda", "agenda.items", "incomplete") in issues
    assert ("speakers", "speakers.people", "incomplete") in issues
    assert all(section != "couple" for section, _, _ in issues)
    issue = auth_client.post(f"{INV}/{iid}/publish").json()["error"]["details"][0]
    assert set(issue) == {"section", "field", "code", "message"}


def test_hidden_new_sections_do_not_block(auth_client: TestClient) -> None:
    iid = create_invitation(auth_client, "seminar", themeId="temuvibe-corporate")["id"]
    make_publishable(auth_client, iid)
    for section in ("organization", "agenda", "speakers"):
        put(auth_client, f"{INV}/{iid}/sections/{section}", {"enabled": False})
    content = auth_client.get(f"{PUBLIC_INV}/{publish(auth_client, iid)['slug']}").json()["content"]
    assert content["organization"] == content["agenda"] == content["speakers"] == {"enabled": False}


def test_optional_couple_and_profiles_in_anniversary(auth_client: TestClient) -> None:
    iid = create_invitation(auth_client, "anniversary", themeId="afterglow")["id"]
    make_publishable(auth_client, iid)
    put(auth_client, f"{INV}/{iid}/sections/couple", {"enabled": False})  # names cleared and hidden
    put(auth_client, f"{INV}/{iid}/sections/profiles",
        {"enabled": True, "people": [{"role": "host", "name": "Keluarga Besar"}]})
    content = auth_client.get(f"{PUBLIC_INV}/{publish(auth_client, iid)['slug']}").json()["content"]
    assert content["couple"] == {"enabled": False}
    assert content["milestone"] == {"enabled": True, "years": 10}
    assert content["profiles"]["people"][0]["role"] == "host"


def test_snapshot_is_allow_listed_for_new_sections(auth_client: TestClient) -> None:
    iid = create_invitation(auth_client, "seminar", themeId="temuvibe-corporate")["id"]
    make_publishable(auth_client, iid)
    session_id = auth_client.get(f"{INV}/{iid}/events").json()[0]["id"]
    put(auth_client, f"{INV}/{iid}/sections/speakers",
        {"enabled": True, "people": [{"id": "s1", "name": "Dr. Sari", "bio": "Researcher"}]})
    put(auth_client, f"{INV}/{iid}/sections/agenda", {"enabled": True, "items": [
        {"id": "a", "time": "09:00", "title": "Keynote", "sessionId": session_id, "speakerIds": ["s1", "gone"]},
        {"id": "b", "title": "Lunch", "sessionId": "deleted-session"},
    ]})
    put(auth_client, f"{INV}/{iid}/sections/rsvp", {"enabled": True, "capacity": 100, "collectContact": "email",
                                                    "registrationFields": [{"id": "co", "label": "Company", "type": "text"}]})
    content = auth_client.get(f"{PUBLIC_INV}/{publish(auth_client, iid)['slug']}").json()["content"]
    assert content["agenda"]["items"] == [
        {"id": "a", "time": "09:00", "title": "Keynote", "sessionId": session_id, "speakerIds": ["s1"]},
        {"id": "b", "title": "Lunch"},
    ]
    assert content["rsvp"] == {
        "enabled": True, "capacity": 100, "collectContact": "email",
        "registrationFields": [{"id": "co", "label": "Company", "type": "text", "required": False}], "full": False,
    }


def test_milestone_publishes_only_the_variant_fields(auth_client: TestClient) -> None:
    iid = create_invitation(auth_client, "sweet_17", themeId="temuvibe-festive")["id"]
    make_publishable(auth_client, iid)
    put(auth_client, f"{INV}/{iid}/sections/milestone",
        {"enabled": True, "age": 17, "partyTheme": "Neon", "years": 3, "institution": "SMA 1"})
    content = auth_client.get(f"{PUBLIC_INV}/{publish(auth_client, iid)['slug']}").json()["content"]
    assert content["milestone"] == {"enabled": True, "age": 17, "partyTheme": "Neon"}


def test_slug_for_non_couple_variants(auth_client: TestClient) -> None:
    iid = create_invitation(auth_client, "birthday", themeId="temuvibe-festive")["id"]
    make_publishable(auth_client, iid)
    put(auth_client, f"{INV}/{iid}/sections/profiles",
        {"enabled": True, "people": [{"role": "celebrant", "name": "Raka Pratama", "nickname": "Raka"}]})
    assert publish(auth_client, iid)["slug"].startswith("raka-")
    iid = create_invitation(auth_client, "workshop", themeId="temuvibe-corporate")["id"]
    make_publishable(auth_client, iid)
    assert publish(auth_client, iid)["slug"].startswith("pt-contoh-jaya-")


def test_incompatible_theme_blocks_publish(auth_client: TestClient, db: Session) -> None:
    iid = create_invitation(auth_client, "birthday")["id"]
    make_publishable(auth_client, iid)
    row = db.get(Invitation, uuid.UUID(iid))
    row.theme_id = "afterglow"  # selectable, but not for birthdays (bypassing the API check)
    db.commit()
    assert ("theme", "themeId", "incompatible") in blocked(auth_client.post(f"{INV}/{iid}/publish"))


def test_public_payload_shape_and_legacy_path(auth_client: TestClient, client: TestClient) -> None:
    iid = create_invitation(auth_client, "family_reunion", themeId="temuvibe-festive", timezone="Asia/Makassar")["id"]
    make_publishable(auth_client, iid)
    slug = publish(auth_client, iid)["slug"]
    response = auth_client.get(f"{PUBLIC_INV}/{slug}")
    body = response.json()
    assert set(body) == {"category", "variant", "themeId", "locale", "timezone", "content", "publishedAt"}
    assert (body["category"], body["variant"], body["timezone"]) == ("gathering", "family_reunion", "Asia/Makassar")
    assert response.headers["x-robots-tag"] == "noindex, nofollow"
    assert response.headers["cache-control"] == "no-cache"
    assert auth_client.get(f"{PUBLIC_INV}/{slug}", headers={"If-None-Match": response.headers["etag"]}).status_code == 304
    legacy = auth_client.get(f"{PUBLIC}/{slug}")
    assert legacy.json() == body and legacy.headers["etag"] == response.headers["etag"]
    # No owner/database ids or guest data in the snapshot.
    text = json.dumps(body)
    for forbidden in (iid, "responses", "attendingPeople", "ownerId"):
        assert forbidden not in text


def _all_keys(value: Any) -> set[str]:
    if isinstance(value, dict):
        return set(value) | {k for v in value.values() for k in _all_keys(v)}
    if isinstance(value, list):
        return {k for v in value for k in _all_keys(v)}
    return set()


def test_public_payload_never_contains_rsvp_replies(auth_client: TestClient) -> None:
    iid = create_invitation(auth_client, "birthday", themeId="temuvibe-festive")["id"]
    make_publishable(auth_client, iid)
    slug = publish(auth_client, iid)["slug"]
    reply = {"name": "Secret Guest", "attendance": "attending", "partySize": 2, "message": "PRIVATE-NOTE"}
    assert auth_client.post(f"{PUBLIC_INV}/{slug}/rsvp", json=reply).status_code == 201
    text = auth_client.get(f"{PUBLIC_INV}/{slug}").text
    assert "Secret Guest" not in text and "PRIVATE-NOTE" not in text
    keys = _all_keys(auth_client.get(f"{PUBLIC_INV}/{slug}").json())
    assert not keys & {"responses", "attending", "attendingPeople", "partySize", "full"}  # no capacity set

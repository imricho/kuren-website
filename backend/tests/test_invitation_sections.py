"""Variant-aware sections: availability, required sections, new v2.0 sections and validation."""

from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.core.invitation_registry import REGISTRY, SECTION_IDS, get_variant
from tests.invitation_helpers import ALL_VARIANTS, INV, create_invitation, error_code, put
from tests.wedding_helpers import fields

#: A minimal valid body for each section route (collections are tested separately).
VALID: dict[str, Any] = {
    "opening": {"weddingTitle": "Hello"},
    "holyRecite1": {"enabled": True, "passage": "Verse"},
    "greeting": {"enabled": True, "message": "Welcome"},
    "couple": {"groom": {"name": "A"}, "bride": {"name": "B"}},
    "profiles": {"enabled": True, "people": []},
    "organization": {"enabled": True, "name": "PT Contoh"},
    "milestone": {"enabled": True},
    "countdown": {"enabled": True},
    "agenda": {"enabled": True, "items": []},
    "speakers": {"enabled": True, "people": []},
    "story": {"title": "Our story"},
    "gallery": {"title": "Photos"},
    "rsvp": {"enabled": True},
    "wishes": {"enabled": True},
    "amplopDigital": {"enabled": False},
    "holyRecite2": {"enabled": False},
    "closing": {"message": "Thanks"},
}
assert set(VALID) | {"events"} == set(SECTION_IDS)


@pytest.fixture
def by_variant(auth_client: TestClient) -> dict[str, str]:
    return {v: create_invitation(auth_client, v)["id"] for v in ALL_VARIANTS}


def test_section_availability_follows_the_registry(auth_client: TestClient, by_variant: dict[str, str]) -> None:
    for variant, iid in by_variant.items():
        config = get_variant(variant)
        for section, body in VALID.items():
            response = auth_client.put(f"{INV}/{iid}/sections/{section}", json=body)
            if config.offers(section):
                assert response.status_code == 200, (variant, section, response.text)
            else:
                assert error_code(response, 422) == "section_not_available", (variant, section)
                assert response.json()["error"]["details"] == {"section": section}
        # Collections behind optional sections
        for collection, section, item in (("stories", "story", {"title": "x"}),
                                          ("gallery", "gallery", {"src": "/sample-wedding/a.jpg", "alt": "a"})):
            response = auth_client.post(f"{INV}/{iid}/{collection}", json=item)
            expected = 201 if config.offers(section) else 422
            assert response.status_code == expected, (variant, collection)
        # Reads are never restricted.
        assert auth_client.get(f"{INV}/{iid}/sections/speakers").status_code == 200


def test_unavailable_write_changes_nothing(auth_client: TestClient) -> None:
    iid = create_invitation(auth_client, "birthday")["id"]
    before = auth_client.get(f"{INV}/{iid}/content")
    response = auth_client.put(f"{INV}/{iid}/sections/couple", json=VALID["couple"])
    assert error_code(response, 422) == "section_not_available"
    after = auth_client.get(f"{INV}/{iid}/content")
    assert after.json() == before.json() and after.headers["etag"] == before.headers["etag"]


def test_required_couple_cannot_be_hidden_but_optional_couple_can(auth_client: TestClient) -> None:
    wedding = create_invitation(auth_client, "wedding_ceremony")["id"]
    response = auth_client.put(f"{INV}/{wedding}/sections/couple", json={"enabled": False})
    assert fields(response) == ["enabled"]
    anniversary = create_invitation(auth_client, "anniversary")["id"]
    assert put(auth_client, f"{INV}/{anniversary}/sections/couple", {"enabled": False})["enabled"] is False


def test_countdown_toggle_stays_available_although_required(auth_client: TestClient) -> None:
    """`countdown.enabled` toggles the timer only; the date lives in opening.weddingDate."""
    iid = create_invitation(auth_client, "seminar")["id"]
    assert put(auth_client, f"{INV}/{iid}/sections/countdown", {"enabled": False})["enabled"] is False


# --- New sections: good and bad input -----------------------------------------------------

IMAGE = {"src": "https://cdn.example.com/p.jpg", "alt": "Portrait"}


def test_profiles_round_trip_and_ids(auth_client: TestClient) -> None:
    iid = create_invitation(auth_client, "aqiqah")["id"]
    body = {"enabled": True, "title": "  Si Kecil ", "people": [
        {"role": "child", "name": "Aisyah", "nickname": "Ica", "image": IMAGE, "parents": "Bpk. A & Ibu B",
         "birthDate": "2026-10-01", "description": "Our daughter"},
        {"id": "twin", "role": "child", "name": "Fatimah"},
    ]}
    out = put(auth_client, f"{INV}/{iid}/sections/profiles", body)
    assert out["title"] == "Si Kecil"
    assert out["people"][0]["id"].startswith("person-") and out["people"][1]["id"] == "twin"
    assert out["people"][0]["birthDate"] == "2026-10-01" and out["people"][0]["image"] == IMAGE
    assert auth_client.get(f"{INV}/{iid}/content").json()["profiles"] == out
    # PUT replaces: ids sent back are kept.
    again = put(auth_client, f"{INV}/{iid}/sections/profiles", out)
    assert again == out


@pytest.mark.parametrize(
    ("variant", "body", "field"),
    [
        ("birthday", {"people": [{"role": "graduate", "name": "X"}]}, "people.0.role"),
        ("aqiqah", {"people": [{"role": "celebrant", "name": "X"}]}, "people.0.role"),
        ("graduation", {"people": [{"role": "graduate", "name": "X"}, {"role": "host", "name": "Y"}]}, "people.1.role"),
        ("birthday", {"people": [{"role": "boss", "name": "X"}]}, "people.0.role"),
        ("birthday", {"people": [{"role": "celebrant"}]}, "people.0.name"),
        ("birthday", {"people": [{"role": "celebrant", "name": "  "}]}, "people.0.name"),
        ("birthday", {"people": [{"role": "celebrant", "name": "x" * 121}]}, "people.0.name"),
        ("birthday", {"people": [{"role": "celebrant", "name": "X", "birthDate": "2026-02-30"}]}, "people.0.birthDate"),
        ("birthday", {"people": [{"role": "celebrant", "name": "X", "id": "bad id"}]}, "people.0.id"),
        ("birthday", {"people": [{"role": "celebrant", "name": "X", "id": "a"}, {"role": "celebrant", "name": "Y", "id": "a"}]}, "people"),
        ("birthday", {"people": [{"role": "celebrant", "name": str(i)} for i in range(21)]}, "people"),
        ("birthday", {"people": [{"role": "celebrant", "name": "X", "image": {"src": "javascript:alert(1)", "alt": "x"}}]}, "people.0.image.src"),
        ("birthday", {"people": [], "extra": 1}, "extra"),
    ],
)
def test_profiles_validation(auth_client: TestClient, variant: str, body: dict, field: str) -> None:
    iid = create_invitation(auth_client, variant)["id"]
    assert fields(auth_client.put(f"{INV}/{iid}/sections/profiles", json={"enabled": True, **body})) == [field]


def test_milestone_round_trip(auth_client: TestClient) -> None:
    iid = create_invitation(auth_client, "graduation")["id"]
    body = {"enabled": True, "title": "Wisuda", "institution": "Universitas Indonesia", "program": "Ilmu Komputer",
            "degree": "S.Kom.", "description": "Alhamdulillah"}
    assert put(auth_client, f"{INV}/{iid}/sections/milestone", body) == body


@pytest.mark.parametrize(
    ("body", "field"),
    [
        ({"age": 0}, "age"), ({"age": 151}, "age"), ({"age": "17"}, "age"), ({"age": 17.5}, "age"),
        ({"years": 0}, "years"), ({"years": 101}, "years"), ({"occasion": "x" * 121}, "occasion"),
        ({"institution": "x" * 161}, "institution"), ({"partyTheme": "x" * 201}, "partyTheme"),
        ({"description": "x" * 2001}, "description"), ({"enabled": "yes"}, "enabled"),
    ],
)
def test_milestone_validation(auth_client: TestClient, body: dict, field: str) -> None:
    iid = create_invitation(auth_client, "birthday")["id"]
    assert fields(auth_client.put(f"{INV}/{iid}/sections/milestone", json=body)) == [field]


def test_organization_round_trip_and_validation(auth_client: TestClient) -> None:
    iid = create_invitation(auth_client, "corporate_event")["id"]
    body = {"enabled": True, "name": "PT Contoh Jaya", "tagline": "Bersama", "description": "Since 1990",
            "logo": IMAGE, "websiteUrl": "https://contoh.co.id"}
    assert put(auth_client, f"{INV}/{iid}/sections/organization", body) == body
    for bad, field in (({"websiteUrl": "http://contoh.co.id"}, "websiteUrl"),
                       ({"websiteUrl": "javascript:alert(1)"}, "websiteUrl"),
                       ({"name": "x" * 161}, "name"), ({"tagline": "x" * 201}, "tagline")):
        assert fields(auth_client.put(f"{INV}/{iid}/sections/organization", json=bad)) == [field]


def test_agenda_round_trip(auth_client: TestClient) -> None:
    iid = create_invitation(auth_client, "seminar")["id"]
    body = {"enabled": True, "title": "Rundown", "items": [
        {"id": "a1", "time": "09:00", "endTime": "09:30", "title": "Registration", "sessionId": "session-1",
         "speakerIds": ["s1", "s2"], "description": "At the lobby"},
        {"title": "Coffee"},
    ]}
    out = put(auth_client, f"{INV}/{iid}/sections/agenda", body)
    assert out["items"][0] == body["items"][0]
    assert out["items"][1]["id"].startswith("item-") and out["items"][1]["speakerIds"] == []


@pytest.mark.parametrize(
    ("item", "field"),
    [
        ({"title": "x", "time": "9:00"}, "items.0.time"),
        ({"title": "x", "time": "24:00"}, "items.0.time"),
        ({"title": "x", "time": "10:00", "endTime": "09:00"}, "items.0.endTime"),
        ({"title": "x", "time": "10:00", "endTime": "10:00"}, "items.0.endTime"),
        ({"time": "10:00"}, "items.0.title"),
        ({"title": "x", "speakerIds": ["a", "a"]}, "items.0.speakerIds"),
        ({"title": "x", "speakerIds": ["bad id"]}, "items.0.speakerIds.0"),
        ({"title": "x", "sessionId": "../x"}, "items.0.sessionId"),
    ],
)
def test_agenda_validation(auth_client: TestClient, item: dict, field: str) -> None:
    iid = create_invitation(auth_client, "workshop")["id"]
    assert fields(auth_client.put(f"{INV}/{iid}/sections/agenda", json={"enabled": True, "items": [item]})) == [field]


def test_agenda_and_speaker_list_caps(auth_client: TestClient) -> None:
    iid = create_invitation(auth_client, "seminar")["id"]
    items = [{"title": str(i)} for i in range(51)]
    assert fields(auth_client.put(f"{INV}/{iid}/sections/agenda", json={"items": items})) == ["items"]
    people = [{"name": str(i)} for i in range(31)]
    assert fields(auth_client.put(f"{INV}/{iid}/sections/speakers", json={"people": people})) == ["people"]


def test_speakers_round_trip_and_validation(auth_client: TestClient) -> None:
    iid = create_invitation(auth_client, "seminar")["id"]
    body = {"enabled": True, "title": "Pembicara", "people": [
        {"id": "s1", "name": "Dr. Sari", "role": "Keynote", "organization": "ITB", "image": IMAGE, "bio": "Researcher"},
    ]}
    assert put(auth_client, f"{INV}/{iid}/sections/speakers", body) == body
    for bad, field in (({"people": [{"role": "x"}]}, "people.0.name"),
                       ({"people": [{"name": "x", "bio": "y" * 2001}]}, "people.0.bio"),
                       ({"people": [{"name": "x", "id": "s"}, {"name": "y", "id": "s"}]}, "people")):
        assert fields(auth_client.put(f"{INV}/{iid}/sections/speakers", json=bad)) == [field]


# --- RSVP and session extensions ----------------------------------------------------------


def test_rsvp_extensions_round_trip(auth_client: TestClient) -> None:
    iid = create_invitation(auth_client, "workshop")["id"]
    body = {"enabled": True, "maxGuestsPerResponse": 1, "capacity": 40, "collectContact": "email_or_phone",
            "allowSessionChoice": True, "registrationFields": [
                {"id": "company", "label": "Company", "type": "text", "required": True},
                {"id": "size", "label": "T-shirt", "type": "select", "required": False, "options": ["S", "M", "L"]},
                {"label": "Vegetarian", "type": "checkbox"},
            ]}
    out = put(auth_client, f"{INV}/{iid}/sections/rsvp", body)
    assert out["capacity"] == 40 and out["collectContact"] == "email_or_phone" and out["allowSessionChoice"] is True
    assert out["registrationFields"][2]["id"].startswith("field-")
    assert out["registrationFields"][2]["required"] is False
    assert out["registrationFields"][1]["options"] == ["S", "M", "L"]


@pytest.mark.parametrize(
    ("body", "field"),
    [
        ({"capacity": 0}, "capacity"), ({"capacity": 100_001}, "capacity"), ({"capacity": "5"}, "capacity"),
        ({"collectContact": "fax"}, "collectContact"), ({"allowSessionChoice": "yes"}, "allowSessionChoice"),
        ({"maxGuestsPerResponse": 21}, "maxGuestsPerResponse"),
        ({"registrationFields": [{"label": "A", "type": "select"}]}, "registrationFields.0"),
        ({"registrationFields": [{"label": "A", "type": "select", "options": ["x", "x"]}]}, "registrationFields.0"),
        ({"registrationFields": [{"label": "A", "type": "text", "options": ["x"]}]}, "registrationFields.0"),
        ({"registrationFields": [{"label": "A", "type": "select", "options": [str(i) for i in range(21)]}]},
         "registrationFields.0.options"),
        ({"registrationFields": [{"label": "A", "type": "select", "options": ["x" * 81]}]},
         "registrationFields.0.options.0"),
        ({"registrationFields": [{"label": "x" * 81, "type": "text"}]}, "registrationFields.0.label"),
        ({"registrationFields": [{"label": "A", "type": "file"}]}, "registrationFields.0.type"),
        ({"registrationFields": [{"type": "text"}]}, "registrationFields.0.label"),
        ({"registrationFields": [{"id": "a", "label": "A", "type": "text"}, {"id": "a", "label": "B", "type": "text"}]},
         "registrationFields"),
        ({"registrationFields": [{"label": str(i), "type": "text"} for i in range(11)]}, "registrationFields"),
    ],
)
def test_rsvp_extension_validation(auth_client: TestClient, body: dict, field: str) -> None:
    iid = create_invitation(auth_client, "seminar")["id"]
    assert fields(auth_client.put(f"{INV}/{iid}/sections/rsvp", json=body)) == [field]


@pytest.mark.parametrize("session_type", ["party", "celebration", "session", "talk", "workshop", "gathering",
                                          "prayer", "dinner"])
def test_generic_session_types_and_optional_flag(auth_client: TestClient, session_type: str) -> None:
    iid = create_invitation(auth_client, "corporate_event")["id"]
    response = auth_client.post(f"{INV}/{iid}/events", json={"type": session_type, "title": "T", "optional": True})
    assert response.status_code == 201, response.text
    assert response.json()["type"] == session_type and response.json()["optional"] is True
    assert fields(auth_client.post(f"{INV}/{iid}/events", json={"optional": "yes"})) == ["optional"]


# --- PUT /content is variant-aware --------------------------------------------------------


def _birthday_content(**extra: Any) -> dict[str, Any]:
    return {
        "opening": {"weddingTitle": "Ulang Tahun Raka", "weddingDate": "2030-01-05"},
        "events": [{"id": "party", "type": "party", "title": "Pesta"}],
        "gallery": {"enabled": False, "images": []},
        "rsvp": {"enabled": True},
        "closing": {"message": "Terima kasih"},
        "profiles": {"enabled": True, "people": [{"role": "celebrant", "name": "Raka"}]},
        "milestone": {"enabled": True, "age": 7},
        **extra,
    }


def test_put_content_for_a_birthday(auth_client: TestClient) -> None:
    iid = create_invitation(auth_client, "birthday")["id"]
    out = put(auth_client, f"{INV}/{iid}/content", _birthday_content())
    assert out["contentVersion"] == "2.0"
    assert out["profiles"]["people"][0]["name"] == "Raka" and out["profiles"]["people"][0]["id"]
    assert out["milestone"] == {"enabled": True, "age": 7}
    assert [e["id"] for e in out["events"]] == ["party"]  # seeded sessions replaced


@pytest.mark.parametrize(
    ("extra", "expected"),
    [
        ({"couple": {"groom": {}, "bride": {}}}, ("section_not_available", {"section": "couple"})),
        ({"story": {"timeline": []}}, ("section_not_available", {"section": "story"})),
        ({"organization": {"enabled": True}}, ("section_not_available", {"section": "organization"})),
        ({"profiles": {"enabled": True, "people": [{"role": "host", "name": "X"}]}},
         ("validation_error", [{"field": "profiles.people.0.role", "message": "must be one of: celebrant"}])),
    ],
)
def test_put_content_rejects_what_the_variant_does_not_offer(
    auth_client: TestClient, extra: dict, expected: tuple[str, Any]
) -> None:
    iid = create_invitation(auth_client, "birthday")["id"]
    response = auth_client.put(f"{INV}/{iid}/content", json=_birthday_content(**extra))
    assert response.status_code == 422
    assert (response.json()["error"]["code"], response.json()["error"]["details"]) == expected


def test_put_content_requires_offered_core_sections(auth_client: TestClient) -> None:
    iid = create_invitation(auth_client, "birthday")["id"]
    body = _birthday_content()
    del body["rsvp"]
    assert fields(auth_client.put(f"{INV}/{iid}/content", json=body)) == ["rsvp"]
    wedding = create_invitation(auth_client, "wedding_reception")["id"]
    assert fields(auth_client.put(f"{INV}/{wedding}/content", json=_birthday_content(profiles=None, milestone=None))) == ["couple"]


def test_every_variant_offers_exactly_the_registry_sections() -> None:
    for variant in REGISTRY.variants.values():
        offered = [s.id for s in variant.sections]
        assert offered == [s for s in SECTION_IDS if s in offered]

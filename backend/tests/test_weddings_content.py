import copy
from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.wedding_helpers import API, create_wedding, fields
from tests.wedding_samples import EMPTY_DRAFT, SAMPLE_WEDDING


@pytest.fixture
def wid(auth_client: TestClient) -> str:
    return create_wedding(auth_client)["id"]


def _put_body(draft: dict[str, Any]) -> dict[str, Any]:
    return copy.deepcopy(draft)


# --- Assembled content --------------------------------------------------------------------


def test_new_wedding_has_empty_draft(auth_client: TestClient, wid: str) -> None:
    response = auth_client.get(f"{API}/{wid}/content")
    assert response.status_code == 200
    assert response.json() == EMPTY_DRAFT


def test_sample_wedding_round_trips_exactly(auth_client: TestClient, wid: str) -> None:
    response = auth_client.put(f"{API}/{wid}/content", json=_put_body(SAMPLE_WEDDING))
    assert response.status_code == 200, response.text
    assert response.json() == SAMPLE_WEDDING
    assert auth_client.get(f"{API}/{wid}/content").json() == SAMPLE_WEDDING
    # key order of a section follows the contract
    assert list(response.json()["events"][1]) == [
        "id", "type", "title", "date", "startTime", "endTime", "venueName", "address", "mapsUrl", "description",
    ]


def test_preview_returns_theme_and_content(auth_client: TestClient, wid: str) -> None:
    response = auth_client.get(f"{API}/{wid}/preview")
    assert response.json() == {"themeId": None, "content": EMPTY_DRAFT}

    auth_client.patch(f"{API}/{wid}", json={"themeId": "afterglow", "locale": "id"})
    auth_client.put(f"{API}/{wid}/content", json=_put_body(SAMPLE_WEDDING) | {"locale": "id"})
    response = auth_client.get(f"{API}/{wid}/preview")
    assert response.status_code == 200
    assert response.json() == {"themeId": "afterglow", "content": SAMPLE_WEDDING | {"locale": "id"}}


def test_empty_optionals_are_omitted(auth_client: TestClient, wid: str) -> None:
    body = _put_body(EMPTY_DRAFT)
    body["opening"] = {"weddingTitle": "  Our Wedding  ", "headline": "", "introduction": "   ", "coverImage": None}
    body["couple"] = {"groom": {"name": "Dimas", "nickname": ""}, "bride": {}}
    body["events"] = [{"title": "Wedding", "venueName": "", "mapsUrl": ""}]
    body["rsvp"] = {"title": "RSVP", "enabled": False, "deadline": ""}
    body["closing"] = {"message": "Thanks", "image": None}
    response = auth_client.put(f"{API}/{wid}/content", json=body)
    assert response.status_code == 200, response.text
    content = response.json()
    assert content["opening"] == {"weddingTitle": "Our Wedding"}
    assert content["couple"] == {"groom": {"name": "Dimas"}, "bride": {}}
    assert len(content["events"]) == 1
    event = content["events"][0]
    assert set(event) == {"id", "type", "title"} and event["type"] == "other"
    assert content["rsvp"] == {"title": "RSVP", "enabled": False}
    assert content["closing"] == {"message": "Thanks"}


def test_full_put_matches_items_by_id(auth_client: TestClient, wid: str) -> None:
    auth_client.put(f"{API}/{wid}/content", json=_put_body(SAMPLE_WEDDING))
    body = _put_body(SAMPLE_WEDDING)
    # reorder + update existing, create with client id, create without id, delete "akad"
    reception = body["events"][1] | {"title": "Evening Reception"}
    body["events"] = [
        {"id": "new-one", "type": "ceremony", "title": "Blessing"},
        reception,
        {"type": "engagement", "title": "Lamaran"},
    ]
    body["gallery"]["images"] = list(reversed(body["gallery"]["images"]))[:2]
    body["story"]["timeline"] = []

    response = auth_client.put(f"{API}/{wid}/content", json=body)
    assert response.status_code == 200, response.text
    events = response.json()["events"]
    assert [e["id"] for e in events][:2] == ["new-one", "reception"]
    assert events[1]["title"] == "Evening Reception"
    assert events[2]["title"] == "Lamaran" and events[2]["id"] not in {"new-one", "reception", "akad"}
    assert [g["id"] for g in response.json()["gallery"]["images"]] == ["g6", "g5"]
    assert response.json()["story"]["timeline"] == []
    assert auth_client.get(f"{API}/{wid}/events").json() == events


def test_full_put_validation(auth_client: TestClient, wid: str) -> None:
    body = _put_body(SAMPLE_WEDDING)
    body["events"][1]["id"] = "akad"
    assert fields(auth_client.put(f"{API}/{wid}/content", json=body)) == ["events.1.id"]

    body = _put_body(SAMPLE_WEDDING)
    body["gallery"]["images"][0]["id"] = "bad id!"
    assert fields(auth_client.put(f"{API}/{wid}/content", json=body)) == ["gallery.images.0.id"]

    body = _put_body(SAMPLE_WEDDING)
    body["gallery"]["images"][2]["alt"] = ""
    assert fields(auth_client.put(f"{API}/{wid}/content", json=body)) == ["gallery.images.2.alt"]

    body = _put_body(SAMPLE_WEDDING)
    del body["events"]
    assert fields(auth_client.put(f"{API}/{wid}/content", json=body)) == ["events"]

    body = _put_body(SAMPLE_WEDDING) | {"schemaVersion": 2}
    assert fields(auth_client.put(f"{API}/{wid}/content", json=body)) == ["schemaVersion"]

    body = _put_body(SAMPLE_WEDDING)
    body["events"] = [{"title": f"E{i}"} for i in range(21)]
    response = auth_client.put(f"{API}/{wid}/content", json=body)
    assert response.status_code == 409 and response.json()["error"]["code"] == "limit_reached"

    # nothing was written by the rejected requests
    assert auth_client.get(f"{API}/{wid}/content").json() == EMPTY_DRAFT


def test_full_put_without_schema_version_and_locale(auth_client: TestClient, wid: str) -> None:
    body = _put_body(SAMPLE_WEDDING)
    del body["schemaVersion"], body["locale"]
    response = auth_client.put(f"{API}/{wid}/content", json=body)
    assert response.status_code == 200
    assert response.json() == SAMPLE_WEDDING


def test_content_change_bumps_updated_at(auth_client: TestClient, wid: str) -> None:
    before = auth_client.get(f"{API}/me").json()["updatedAt"]
    auth_client.put(f"{API}/{wid}/sections/opening", json={"weddingTitle": "T"})
    after = auth_client.get(f"{API}/me").json()["updatedAt"]
    assert after > before


# --- Sections -----------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("section", "body", "expected"),
    [
        ("opening", {}, {}),
        ("opening", {"coupleNames": "A & B", "weddingDate": "2027-01-02"},
         {"coupleNames": "A & B", "weddingDate": "2027-01-02"}),
        ("opening", SAMPLE_WEDDING["opening"], SAMPLE_WEDDING["opening"]),
        ("couple", {}, {"groom": {}, "bride": {}}),
        ("couple", {"bride": {"name": "Ayu", "nickname": "Ayu", "parents": "Putri dari Bapak Hadi & Ibu Sri",
                              "instagramUrl": "https://www.instagram.com/ayu"}},
         {"groom": {}, "bride": {"name": "Ayu", "nickname": "Ayu", "parents": "Putri dari Bapak Hadi & Ibu Sri",
                                 "instagramUrl": "https://www.instagram.com/ayu"}}),
        ("couple", SAMPLE_WEDDING["couple"], SAMPLE_WEDDING["couple"]),
        ("story", {"title": "Our Story"}, {"title": "Our Story", "enabled": True}),
        ("story", {"enabled": False}, {"enabled": False}),
        ("gallery", {"description": "Pics"}, {"description": "Pics", "enabled": True}),
        ("gallery", {"enabled": False}, {"enabled": False}),
        ("rsvp", {}, {"enabled": True}),
        ("rsvp", {"enabled": False, "confirmationMessage": "See you!", "maxGuestsPerResponse": 4},
         {"enabled": False, "confirmationMessage": "See you!", "maxGuestsPerResponse": 4}),
        ("closing", {"thankYou": "Love"}, {"thankYou": "Love"}),
    ],
)
def test_section_round_trip(auth_client: TestClient, wid: str, section: str, body: dict, expected: dict) -> None:
    url = f"{API}/{wid}/sections/{section}"
    response = auth_client.put(url, json=body)
    assert response.status_code == 200, response.text
    assert response.json() == expected
    assert auth_client.get(url).json() == expected


def test_section_put_is_full_replace(auth_client: TestClient, wid: str) -> None:
    url = f"{API}/{wid}/sections/opening"
    auth_client.put(url, json={"weddingTitle": "A", "headline": "B"})
    assert auth_client.put(url, json={"headline": "C"}).json() == {"headline": "C"}
    content = auth_client.get(f"{API}/{wid}/content").json()
    assert content["opening"] == {"headline": "C"}


def test_story_and_gallery_sections_are_meta_only(auth_client: TestClient, wid: str) -> None:
    assert fields(auth_client.put(f"{API}/{wid}/sections/story", json={"timeline": []})) == ["timeline"]
    assert fields(auth_client.put(f"{API}/{wid}/sections/gallery", json={"images": []})) == ["images"]


# --- Validation table ---------------------------------------------------------------------

LONG = "x" * 2001


@pytest.mark.parametrize(
    ("path", "body", "expected_field"),
    [
        # unknown keys (incl. snake_case spellings)
        ("sections/opening", {"foo": 1}, "foo"),
        ("sections/opening", {"wedding_title": "x"}, "wedding_title"),
        ("sections/couple", {"groom": {"age": 30}}, "groom.age"),
        ("sections/opening", {"coverImage": {"src": "/sample-wedding/a.jpg", "alt": "a", "extra": 1}}, "coverImage.extra"),
        # lengths
        ("sections/opening", {"weddingTitle": "x" * 121}, "weddingTitle"),
        ("sections/opening", {"coupleNames": "x" * 121}, "coupleNames"),
        ("sections/opening", {"headline": "x" * 201}, "headline"),
        ("sections/opening", {"introduction": LONG}, "introduction"),
        ("sections/couple", {"groom": {"name": "x" * 121}}, "groom.name"),
        ("sections/couple", {"bride": {"nickname": "x" * 41}}, "bride.nickname"),
        ("sections/couple", {"bride": {"description": LONG}}, "bride.description"),
        ("sections/story", {"title": "x" * 121}, "title"),
        ("sections/gallery", {"description": LONG}, "description"),
        ("sections/rsvp", {"title": "x" * 121}, "title"),
        ("sections/rsvp", {"confirmationMessage": "x" * 501}, "confirmationMessage"),
        ("sections/closing", {"message": LONG}, "message"),
        ("sections/closing", {"thankYou": "x" * 201}, "thankYou"),
        ("stories", {"date": "x" * 61}, "date"),
        ("stories", {"title": "x" * 121}, "title"),
        ("events", {"venueName": "x" * 161}, "venueName"),
        ("events", {"address": "x" * 501}, "address"),
        ("events", {"description": LONG}, "description"),
        ("gallery", {"src": "/sample-wedding/a.jpg", "alt": "a", "caption": "x" * 201}, "caption"),
        ("gallery", {"src": "/sample-wedding/a.jpg", "alt": "x" * 301}, "alt"),
        # dates and times
        ("sections/opening", {"weddingDate": "12/06/2027"}, "weddingDate"),
        ("sections/opening", {"weddingDate": "2027-02-30"}, "weddingDate"),
        ("sections/opening", {"weddingDate": "2027-06-12T10:00:00"}, "weddingDate"),
        ("sections/rsvp", {"deadline": 20270525}, "deadline"),
        ("events", {"date": "2027-6-1"}, "date"),
        ("events", {"startTime": "8:00"}, "startTime"),
        ("events", {"startTime": "24:00"}, "startTime"),
        ("events", {"endTime": "10:00:00"}, "endTime"),
        ("events", {"startTime": "10:00", "endTime": "10:00"}, "endTime"),
        ("events", {"startTime": "18:00", "endTime": "09:00"}, "endTime"),
        # URLs
        ("events", {"mapsUrl": "javascript:alert(1)"}, "mapsUrl"),
        ("events", {"mapsUrl": "data:text/html,hi"}, "mapsUrl"),
        ("events", {"mapsUrl": "//evil.example/x"}, "mapsUrl"),
        ("events", {"mapsUrl": "ftp://maps.example"}, "mapsUrl"),
        ("events", {"mapsUrl": "https://" + "a" * 2048}, "mapsUrl"),
        ("sections/couple", {"groom": {"instagramUrl": "https://evil.example/alex"}}, "groom.instagramUrl"),
        ("sections/couple", {"groom": {"parents": "x" * 201}}, "groom.parents"),
        ("sections/couple", {"groom": {"instagramUrl": "http://instagram.com/alex"}}, "groom.instagramUrl"),
        ("sections/couple", {"groom": {"instagramUrl": "https://instagram.com.evil.example/a"}},
         "groom.instagramUrl"),
        ("sections/couple", {"groom": {"instagramUrl": "https://user@evil.example/a"}}, "groom.instagramUrl"),
        ("sections/opening", {"coverImage": {"src": "javascript:alert(1)", "alt": "a"}}, "coverImage.src"),
        ("sections/opening", {"coverImage": {"src": "data:image/png;base64,AAAA", "alt": "a"}}, "coverImage.src"),
        ("sections/opening", {"coverImage": {"src": "//evil.example/a.jpg", "alt": "a"}}, "coverImage.src"),
        ("sections/opening", {"coverImage": {"src": "/../etc/passwd", "alt": "a"}}, "coverImage.src"),
        ("sections/opening", {"coverImage": {"src": "/a b.jpg", "alt": "a"}}, "coverImage.src"),
        ("gallery", {"src": "javascript:alert(1)", "alt": "a"}, "src"),
        ("stories", {"image": {"src": "data:,x", "alt": "a"}}, "image.src"),
        # images: alt required, focal point ints 0..100
        ("sections/closing", {"image": {"src": "/sample-wedding/a.jpg"}}, "image.alt"),
        ("sections/closing", {"image": {"src": "/sample-wedding/a.jpg", "alt": "  "}}, "image.alt"),
        ("gallery", {"src": "/sample-wedding/a.jpg"}, "alt"),
        ("gallery", {"alt": "a"}, "src"),
        ("sections/closing", {"image": {"src": "/sample-wedding/a.jpg", "alt": "a", "focalPoint": {"x": 101, "y": 0}}},
         "image.focalPoint.x"),
        ("sections/closing", {"image": {"src": "/sample-wedding/a.jpg", "alt": "a", "focalPoint": {"x": 1, "y": 2.5}}},
         "image.focalPoint.y"),
        ("gallery", {"src": "/sample-wedding/a.jpg", "alt": "a", "focalPoint": {"x": -1, "y": 0}}, "focalPoint.x"),
        # enums and numbers
        ("events", {"type": "party"}, "type"),
        ("sections/rsvp", {"maxGuestsPerResponse": 0}, "maxGuestsPerResponse"),
        ("sections/rsvp", {"maxGuestsPerResponse": 21}, "maxGuestsPerResponse"),
        ("sections/rsvp", {"maxGuestsPerResponse": "3"}, "maxGuestsPerResponse"),
        ("sections/rsvp", {"enabled": "maybe"}, "enabled"),
        # strict booleans
        ("sections/rsvp", {"enabled": "yes"}, "enabled"),
        ("sections/rsvp", {"enabled": 1}, "enabled"),
        ("sections/rsvp", {"enabled": "true"}, "enabled"),
        # same-origin images only under /sample-wedding/
        ("sections/opening", {"coverImage": {"src": "/api/v1/auth/logout", "alt": "a"}}, "coverImage.src"),
        ("sections/opening", {"coverImage": {"src": "/other/a.jpg", "alt": "a"}}, "coverImage.src"),
        ("sections/opening", {"coverImage": {"src": "/sample-wedding/../x.jpg", "alt": "a"}}, "coverImage.src"),
        ("sections/opening", {"coverImage": {"src": "/sample-wedding/sub/a.jpg", "alt": "a"}}, "coverImage.src"),
        ("sections/opening", {"coverImage": {"src": "/sample-wedding/", "alt": "a"}}, "coverImage.src"),
        ("gallery", {"src": "/api/v1/weddings/me", "alt": "a"}, "src"),
    ],
)
def test_validation_rules(auth_client: TestClient, wid: str, path: str, body: dict, expected_field: str) -> None:
    method = auth_client.put if path.startswith("sections/") else auth_client.post
    response = method(f"{API}/{wid}/{path}", json=body)
    assert fields(response) == [expected_field]


@pytest.mark.parametrize(
    ("path", "body"),
    [
        ("events", {"mapsUrl": "http://maps.example/x?y=1", "startTime": "23:00", "endTime": "23:59"}),
        ("events", {"startTime": "10:00"}),
        ("events", {"endTime": "10:00"}),
        ("sections/couple", {"groom": {"instagramUrl": "https://instagram.com/alex"}}),
        ("sections/opening", {"coverImage": {"src": "https://cdn.example/a.jpg", "alt": "a",
                                             "focalPoint": {"x": 0, "y": 100}}}),
        ("sections/opening", {"coverImage": {"src": "/sample-wedding/cover-photo.jpg", "alt": "a"}}),
        ("sections/rsvp", {"maxGuestsPerResponse": 20}),
        ("sections/rsvp", {"maxGuestsPerResponse": 1}),
    ],
)
def test_valid_values_are_accepted(auth_client: TestClient, wid: str, path: str, body: dict) -> None:
    method = auth_client.put if path.startswith("sections/") else auth_client.post
    response = method(f"{API}/{wid}/{path}", json=body)
    assert response.status_code in (200, 201), response.text


def test_trailing_newline_is_rejected_in_image_src_and_ids(auth_client: TestClient, wid: str) -> None:
    # Text fields are trimmed (so a trailing "\n" on a date/src is simply removed); ids are not
    # trimmed and must match the whole string. An embedded newline in a src is always rejected.
    body = {"coverImage": {"src": "/sample-wedding/a.jpg\nx", "alt": "a"}}
    assert fields(auth_client.put(f"{API}/{wid}/sections/opening", json=body)) == ["coverImage.src"]

    draft = _put_body(SAMPLE_WEDDING)
    draft["events"][0]["id"] = "akad\n"
    assert fields(auth_client.put(f"{API}/{wid}/content", json=draft)) == ["events.0.id"]


def test_rsvp_enabled_accepts_real_booleans(auth_client: TestClient, wid: str) -> None:
    url = f"{API}/{wid}/sections/rsvp"
    assert auth_client.put(url, json={"enabled": False}).json() == {"enabled": False}
    assert auth_client.put(url, json={"enabled": True}).json() == {"enabled": True}


def test_validation_error_shape(auth_client: TestClient, wid: str) -> None:
    response = auth_client.put(f"{API}/{wid}/sections/couple", json={"groom": {"name": "x" * 121}})
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert error["details"] == [{"field": "groom.name", "message": error["details"][0]["message"]}]

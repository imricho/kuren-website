"""Optimistic concurrency for autosave: content revision, ETag and If-Match."""

from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.wedding_helpers import API, create_wedding

EVENT = {"title": "Akad Nikah", "type": "akad", "date": "2027-06-12", "startTime": "08:00",
         "venueName": "Masjid", "address": "Jl. Melati 1"}


def etag(response: Any) -> int:
    assert response.status_code < 300, response.text
    return int(response.headers["etag"].strip('"'))


@pytest.fixture
def wid(auth_client: TestClient) -> str:
    return str(create_wedding(auth_client)["id"])


def test_new_wedding_starts_at_revision_zero(auth_client: TestClient) -> None:
    created = create_wedding(auth_client)
    assert created["revision"] == 0
    assert etag(auth_client.get(f"{API}/{created['id']}/content")) == 0


def test_every_content_write_bumps_the_revision_and_returns_it(auth_client: TestClient, wid: str) -> None:
    base = f"{API}/{wid}"
    r1 = etag(auth_client.put(f"{base}/sections/opening", json={"weddingTitle": "A"}))
    assert r1 == 1
    created = auth_client.post(f"{base}/events", json=EVENT)
    assert etag(created) == 2
    item = created.json()["id"]
    assert etag(auth_client.put(f"{base}/events/{item}", json={**EVENT, "title": "Akad"})) == 3
    assert etag(auth_client.put(f"{base}/events/order", json={"ids": [item]})) == 4
    assert etag(auth_client.delete(f"{base}/events/{item}")) == 5
    assert auth_client.get(f"{API}/me").json()["revision"] == 5
    assert etag(auth_client.get(f"{base}/sections/opening")) == 5


def test_theme_and_locale_changes_do_not_bump_the_content_revision(auth_client: TestClient, wid: str) -> None:
    before = auth_client.get(f"{API}/me").json()["revision"]
    updated = auth_client.patch(f"{API}/{wid}", json={"locale": "id"})
    assert updated.status_code == 200
    assert updated.json()["revision"] == before


def test_matching_if_match_is_accepted(auth_client: TestClient, wid: str) -> None:
    base = f"{API}/{wid}"
    rev = etag(auth_client.get(f"{base}/content"))
    for fmt in ('"{}"', 'W/"{}"', "{}"):
        header = fmt.format(rev)
        response = auth_client.put(f"{base}/sections/closing", json={"message": header},
                                   headers={"If-Match": header})
        assert response.status_code == 200, (header, response.text)
        rev = etag(response)


def test_stale_if_match_is_rejected_and_nothing_is_written(auth_client: TestClient, wid: str) -> None:
    base = f"{API}/{wid}"
    first = auth_client.put(f"{base}/sections/opening", json={"weddingTitle": "Newer"}, headers={"If-Match": '"0"'})
    assert etag(first) == 1

    # A second tab still holding revision 0 must not overwrite the newer content.
    stale = auth_client.put(f"{base}/sections/opening", json={"weddingTitle": "Older"}, headers={"If-Match": '"0"'})
    assert stale.status_code == 409
    error = stale.json()["error"]
    assert error["code"] == "edit_conflict"
    assert error["details"] == {"currentRevision": 1}
    assert auth_client.get(f"{base}/sections/opening").json()["weddingTitle"] == "Newer"

    # Collections are protected the same way (no duplicate created).
    stale_create = auth_client.post(f"{base}/events", json=EVENT, headers={"If-Match": '"0"'})
    assert stale_create.status_code == 409
    assert auth_client.get(f"{base}/events").json() == []
    stale_replace = auth_client.put(f"{base}/content", json={"opening": {}}, headers={"If-Match": '"0"'})
    assert stale_replace.status_code == 409


@pytest.mark.parametrize("header", ['"abc"', '"-1"', "1.5", '"99999999999999"'])
def test_malformed_if_match_is_a_bad_request(auth_client: TestClient, wid: str, header: str) -> None:
    response = auth_client.put(f"{API}/{wid}/sections/closing", json={}, headers={"If-Match": header})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "bad_request"


def test_if_match_star_or_absent_means_no_precondition(auth_client: TestClient, wid: str) -> None:
    assert auth_client.put(f"{API}/{wid}/sections/closing", json={}, headers={"If-Match": "*"}).status_code == 200
    assert auth_client.put(f"{API}/{wid}/sections/closing", json={}).status_code == 200


def test_ownership_is_checked_before_the_revision(auth_client: TestClient, other_client: TestClient, wid: str) -> None:
    # A foreign wedding is 404 whether or not the revision would match: no revision leak.
    for header in ('"0"', '"5"'):
        response = other_client.put(f"{API}/{wid}/sections/opening", json={}, headers={"If-Match": header})
        assert response.status_code == 404


def test_story_and_gallery_can_be_hidden_without_losing_content(auth_client: TestClient, wid: str) -> None:
    base = f"{API}/{wid}"
    auth_client.put(f"{base}/sections/story", json={"title": "Kisah Kami", "introduction": "Dulu…"})
    hidden = auth_client.put(f"{base}/sections/story", json={"title": "Kisah Kami", "introduction": "Dulu…",
                                                            "enabled": False})
    assert hidden.json() == {"title": "Kisah Kami", "introduction": "Dulu…", "enabled": False}
    content = auth_client.get(f"{base}/content").json()
    assert content["story"]["enabled"] is False
    assert content["gallery"]["enabled"] is False  # new weddings start with the gallery off
    # Strict booleans, as for RSVP.
    assert auth_client.put(f"{base}/sections/gallery", json={"enabled": "no"}).status_code == 422

import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.themes import SELECTABLE_THEME_IDS
from tests.wedding_helpers import API, create_wedding, fields

WID = str(uuid.uuid4())
EVERY_ROUTE = [
    ("GET", f"{API}/me"),
    ("POST", API),
    ("PATCH", f"{API}/{WID}"),
    ("GET", f"{API}/{WID}/content"),
    ("PUT", f"{API}/{WID}/content"),
    ("GET", f"{API}/{WID}/preview"),
    *[(m, f"{API}/{WID}/sections/{s}") for s in ("opening", "couple", "story", "gallery", "rsvp", "closing")
      for m in ("GET", "PUT")],
    *[
        route
        for c in ("stories", "events", "gallery")
        for route in (
            ("GET", f"{API}/{WID}/{c}"),
            ("POST", f"{API}/{WID}/{c}"),
            ("PUT", f"{API}/{WID}/{c}/order"),
            ("PUT", f"{API}/{WID}/{c}/abc"),
            ("DELETE", f"{API}/{WID}/{c}/abc"),
        )
    ],
]


@pytest.mark.parametrize(("method", "path"), EVERY_ROUTE)
def test_every_route_requires_authentication(client: TestClient, method: str, path: str) -> None:
    response = client.request(method, path, json={} if method in {"POST", "PUT", "PATCH"} else None)
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "not_authenticated"


def test_foreign_origin_is_rejected_on_write(auth_client: TestClient) -> None:
    response = auth_client.post(API, json={}, headers={"Origin": "https://evil.example"})
    assert response.status_code == 403
    assert auth_client.get(f"{API}/me").status_code == 404  # nothing was created


def test_me_is_404_before_create(auth_client: TestClient) -> None:
    response = auth_client.get(f"{API}/me")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_create_and_read_wedding(auth_client: TestClient) -> None:
    created = create_wedding(auth_client)
    assert set(created) == {
        "id", "themeId", "locale", "status", "publishedAt", "revision", "createdAt", "updatedAt",
        "slug", "hasUnpublishedChanges", "publication", "category", "variant", "title", "timezone",
    }
    assert (created["category"], created["variant"]) == ("wedding", "wedding_ceremony")
    assert created["title"] is None and created["timezone"] == "Asia/Jakarta"
    assert created["slug"] is None and created["publication"] is None
    assert created["hasUnpublishedChanges"] is False
    assert created["themeId"] is None
    assert created["locale"] == "en"
    assert created["status"] == "draft"
    assert created["publishedAt"] is None
    assert auth_client.get(f"{API}/me").json() == created


def test_create_with_theme_and_locale(auth_client: TestClient) -> None:
    created = create_wedding(auth_client, themeId="afterglow", locale="id")
    assert (created["themeId"], created["locale"]) == ("afterglow", "id")


def test_second_create_makes_another_wedding_and_me_is_the_latest(auth_client: TestClient) -> None:
    first = create_wedding(auth_client)
    second = create_wedding(auth_client, locale="id")
    assert second["id"] != first["id"]
    assert auth_client.get(f"{API}/me").json()["id"] == second["id"]
    # Touching the first one makes it the most recently updated again.
    assert auth_client.patch(f"{API}/{first['id']}", json={"locale": "id"}).status_code == 200
    assert auth_client.get(f"{API}/me").json()["id"] == first["id"]


@pytest.mark.parametrize("body", [{"themeId": "nope"}, {"locale": "fr"}, {"theme_id": "afterglow"}, {"x": 1}])
def test_create_validation(auth_client: TestClient, body: dict) -> None:
    assert auth_client.post(API, json=body).status_code == 422


def test_patch_theme_and_locale(auth_client: TestClient) -> None:
    wedding = create_wedding(auth_client)
    url = f"{API}/{wedding['id']}"

    response = auth_client.patch(url, json={"themeId": "rosewater"})
    assert response.status_code == 200
    assert response.json()["themeId"] == "rosewater"
    assert response.json()["locale"] == "en"
    assert response.json()["updatedAt"] >= wedding["updatedAt"]

    response = auth_client.patch(url, json={"locale": "id"})
    assert response.json()["themeId"] == "rosewater"  # untouched
    assert response.json()["locale"] == "id"

    response = auth_client.patch(url, json={"themeId": None})
    assert response.json()["themeId"] is None
    assert auth_client.patch(url, json={"themeId": "  "}).json()["themeId"] is None


@pytest.mark.parametrize("theme_id", ["unknown-theme", "batak-toba", "solo-basahan", 7])
def test_patch_rejects_non_selectable_theme(auth_client: TestClient, theme_id: object) -> None:
    wedding = create_wedding(auth_client)
    response = auth_client.patch(f"{API}/{wedding['id']}", json={"themeId": theme_id})
    assert fields(response) == ["themeId"]


def test_draft_themes_are_not_in_allowlist() -> None:
    assert "batak-toba" not in SELECTABLE_THEME_IDS
    assert "solo-basahan" not in SELECTABLE_THEME_IDS
    assert "afterglow" in SELECTABLE_THEME_IDS


@pytest.mark.parametrize("body", [{"locale": "fr"}, {"locale": None}, {"status": "published"}])
def test_patch_rejects_invalid_fields(auth_client: TestClient, body: dict) -> None:
    wedding = create_wedding(auth_client)
    assert auth_client.patch(f"{API}/{wedding['id']}", json=body).status_code == 422


@pytest.mark.parametrize("wedding_id", [str(uuid.uuid4()), "not-a-uuid", "me"])
def test_unknown_or_malformed_wedding_id_is_404(auth_client: TestClient, wedding_id: str) -> None:
    create_wedding(auth_client)
    assert auth_client.patch(f"{API}/{wedding_id}", json={}).status_code == 404
    assert auth_client.get(f"{API}/{wedding_id}/content").status_code == 404


def test_unknown_section_is_404(auth_client: TestClient) -> None:
    wedding = create_wedding(auth_client)
    assert auth_client.get(f"{API}/{wedding['id']}/sections/events").status_code == 404
    assert auth_client.put(f"{API}/{wedding['id']}/sections/nope", json={}).status_code == 404

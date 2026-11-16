import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.models import Wedding, WeddingEvent, WeddingGalleryImage, WeddingStoryEntry
from tests.wedding_helpers import API, create_wedding
from tests.wedding_samples import SAMPLE_WEDDING, SAVED_SAMPLE

SECTIONS = ("opening", "couple", "story", "gallery", "rsvp", "closing")
COLLECTIONS = {"stories": ("met", {"title": "x"}), "events": ("akad", {"title": "x"}),
               "gallery": ("g1", {"src": "/sample-wedding/a.jpg", "alt": "a"})}


@pytest.fixture
def a_wedding(auth_client: TestClient) -> str:
    wid = create_wedding(auth_client)["id"]
    assert auth_client.put(f"{API}/{wid}/content", json=SAMPLE_WEDDING).status_code == 200
    return wid


def _routes(wid: str) -> list[tuple[str, str, dict | None]]:
    routes: list[tuple[str, str, dict | None]] = [
        ("PATCH", f"{API}/{wid}", {"locale": "id"}),
        ("GET", f"{API}/{wid}/content", None),
        ("PUT", f"{API}/{wid}/content", SAMPLE_WEDDING),
        ("GET", f"{API}/{wid}/preview", None),
    ]
    for s in SECTIONS:
        routes += [("GET", f"{API}/{wid}/sections/{s}", None), ("PUT", f"{API}/{wid}/sections/{s}", {})]
    for c, (item_id, body) in COLLECTIONS.items():
        routes += [
            ("GET", f"{API}/{wid}/{c}", None),
            ("POST", f"{API}/{wid}/{c}", body),
            ("PUT", f"{API}/{wid}/{c}/order", {"ids": []}),
            ("PUT", f"{API}/{wid}/{c}/{item_id}", body),
            ("DELETE", f"{API}/{wid}/{c}/{item_id}", None),
        ]
    return routes


def test_other_user_gets_404_on_every_route(
    auth_client: TestClient, other_client: TestClient, a_wedding: str
) -> None:
    before = auth_client.get(f"{API}/{a_wedding}/content").json()
    for method, path, body in _routes(a_wedding):
        response = other_client.request(method, path, json=body)
        assert response.status_code == 404, (method, path, response.text)
        assert response.json()["error"]["code"] == "not_found"
    assert other_client.get(f"{API}/me").status_code == 404
    # A's data is untouched
    assert auth_client.get(f"{API}/{a_wedding}/content").json() == before
    assert auth_client.get(f"{API}/me").json()["locale"] == "en"


def test_foreign_item_ids_are_404_under_own_wedding(
    auth_client: TestClient, other_client: TestClient, a_wedding: str
) -> None:
    b_wedding = create_wedding(other_client)["id"]
    for collection, (a_item_id, body) in COLLECTIONS.items():
        base = f"{API}/{b_wedding}/{collection}"
        assert other_client.put(f"{base}/{a_item_id}", json=body).status_code == 404
        assert other_client.delete(f"{base}/{a_item_id}").status_code == 404
        response = other_client.put(f"{base}/order", json={"ids": [a_item_id]})
        assert response.status_code == 422
    # A's items survived
    content = auth_client.get(f"{API}/{a_wedding}/content").json()
    assert content == SAVED_SAMPLE


def test_same_client_ids_in_two_weddings_stay_separate(
    auth_client: TestClient, other_client: TestClient, a_wedding: str
) -> None:
    b_wedding = create_wedding(other_client)["id"]
    response = other_client.put(f"{API}/{b_wedding}/content", json=SAMPLE_WEDDING | {
        "events": [{"id": "akad", "title": "B's akad"}],
    })
    assert response.status_code == 200
    assert other_client.get(f"{API}/{b_wedding}/events").json() == [
        {"id": "akad", "type": "other", "title": "B's akad"}
    ]
    assert auth_client.get(f"{API}/{a_wedding}/events").json() == SAMPLE_WEDDING["events"]


def test_deleting_user_cascades(auth_client: TestClient, a_wedding: str, db: Session) -> None:
    def total() -> int:
        return sum(
            db.scalar(select(func.count()).select_from(m)) or 0
            for m in (Wedding, WeddingStoryEntry, WeddingEvent, WeddingGalleryImage)
        )

    assert total() == 1 + 3 + 2 + 6
    db.execute(text("DELETE FROM users WHERE email = 'couple-a@example.com'"))
    db.commit()
    assert total() == 0

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import InvitationSession
from tests.wedding_helpers import API, create_wedding, fields

ITEMS = {
    "stories": ({"title": "First Hello", "date": "March 2018"}, {"title": "Proposal"}),
    "events": ({"title": "Akad", "type": "akad", "date": "2027-06-12", "startTime": "08:00"}, {"title": "Party"}),
    "gallery": ({"src": "/sample-wedding/a.jpg", "alt": "A", "focalPoint": {"x": 10, "y": 20}},
                {"src": "https://cdn.example/b.jpg", "alt": "B", "caption": "Bee"}),
}


@pytest.fixture
def wid(auth_client: TestClient) -> str:
    return create_wedding(auth_client)["id"]


@pytest.mark.parametrize("collection", list(ITEMS))
def test_collection_crud(auth_client: TestClient, wid: str, collection: str) -> None:
    base = f"{API}/{wid}/{collection}"
    first_body, second_body = ITEMS[collection]
    assert auth_client.get(base).json() == []

    first = auth_client.post(base, json=first_body)
    assert first.status_code == 201, first.text
    first = first.json()
    assert first["id"] and first == {"id": first["id"], **first_body} | (
        {"type": first_body.get("type", "other")} if collection == "events" else {}
    )
    second = auth_client.post(base, json=second_body).json()
    assert [i["id"] for i in auth_client.get(base).json()] == [first["id"], second["id"]]

    # PUT is a full replace of the item (fields left out are cleared)
    updated = auth_client.put(f"{base}/{first['id']}", json=second_body)
    assert updated.status_code == 200
    assert updated.json()["id"] == first["id"]
    assert {k: v for k, v in updated.json().items() if k != "id"} == {
        k: v for k, v in second.items() if k != "id"
    }

    assert auth_client.delete(f"{base}/{first['id']}").status_code == 204
    assert [i["id"] for i in auth_client.get(base).json()] == [second["id"]]
    assert auth_client.delete(f"{base}/{first['id']}").status_code == 404
    assert auth_client.put(f"{base}/missing", json=second_body).status_code == 404


def test_event_type_defaults_to_other(auth_client: TestClient, wid: str) -> None:
    created = auth_client.post(f"{API}/{wid}/events", json={}).json()
    assert created == {"id": created["id"], "type": "other"}
    updated = auth_client.put(f"{API}/{wid}/events/{created['id']}", json={"type": "reception"}).json()
    assert updated["type"] == "reception"
    assert auth_client.put(f"{API}/{wid}/events/{created['id']}", json={}).json()["type"] == "other"


def test_item_body_must_not_carry_id(auth_client: TestClient, wid: str) -> None:
    assert fields(auth_client.post(f"{API}/{wid}/events", json={"id": "x"})) == ["id"]


def _ids(client: TestClient, url: str) -> list[str]:
    return [i["id"] for i in client.get(url).json()]


def test_reorder(auth_client: TestClient, wid: str) -> None:
    base = f"{API}/{wid}/events"
    ids = [auth_client.post(base, json={"title": f"E{i}"}).json()["id"] for i in range(3)]
    new_order = [ids[2], ids[0], ids[1]]
    response = auth_client.put(f"{base}/order", json={"ids": new_order})
    assert response.status_code == 200
    assert [i["id"] for i in response.json()] == new_order
    assert _ids(auth_client, base) == new_order
    content = auth_client.get(f"{API}/{wid}/content").json()
    assert [e["id"] for e in content["events"]] == new_order


@pytest.mark.parametrize(
    "make_ids",
    [
        lambda ids: ids[:2],  # missing
        lambda ids: [*ids, ids[0]],  # duplicate (and too long)
        lambda ids: [ids[0], ids[0], ids[1]],  # duplicate, same length
        lambda ids: [*ids[:2], "not-mine"],  # foreign / unknown id
        lambda ids: [],
    ],
)
def test_reorder_requires_exact_permutation(auth_client: TestClient, wid: str, make_ids) -> None:
    base = f"{API}/{wid}/gallery"
    ids = [auth_client.post(base, json={"src": "/sample-wedding/a.jpg", "alt": str(i)}).json()["id"] for i in range(3)]
    response = auth_client.put(f"{base}/order", json={"ids": make_ids(ids)})
    assert fields(response) == ["ids"]
    assert _ids(auth_client, base) == ids


def test_reorder_rejects_overlong_ids(auth_client: TestClient, wid: str) -> None:
    assert fields(auth_client.put(f"{API}/{wid}/events/order", json={"ids": ["x" * 65]})) == ["ids.0"]


def test_item_id_with_trailing_newline_is_404(auth_client: TestClient, wid: str) -> None:
    item_id = auth_client.post(f"{API}/{wid}/events", json={"title": "E"}).json()["id"]
    assert auth_client.put(f"{API}/{wid}/events/{item_id}%0A", json={}).status_code == 404
    assert auth_client.delete(f"{API}/{wid}/events/{item_id}%0A").status_code == 404


def test_reorder_rejects_bad_body(auth_client: TestClient, wid: str) -> None:
    assert fields(auth_client.put(f"{API}/{wid}/stories/order", json={"order": []})) == ["ids", "order"]


@pytest.mark.parametrize(("collection", "limit"), [("stories", 20), ("events", 20), ("gallery", 60)])
def test_collection_limits(auth_client: TestClient, wid: str, collection: str, limit: int) -> None:
    base = f"{API}/{wid}/{collection}"
    body = ITEMS[collection][1]
    for _ in range(limit):
        assert auth_client.post(base, json=body).status_code == 201
    response = auth_client.post(base, json=body)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "limit_reached"
    assert len(auth_client.get(base).json()) == limit


def test_delete_compacts_positions(auth_client: TestClient, wid: str, db: Session) -> None:
    base = f"{API}/{wid}/events"
    ids = [auth_client.post(base, json={"title": f"E{i}"}).json()["id"] for i in range(4)]
    assert auth_client.delete(f"{base}/{ids[1]}").status_code == 204
    rows = db.execute(
        select(InvitationSession.public_id, InvitationSession.position).order_by(InvitationSession.position)
    ).all()
    assert [tuple(r) for r in rows] == [(ids[0], 0), (ids[2], 1), (ids[3], 2)]
    # appending after a delete continues the contiguous sequence
    new_id = auth_client.post(base, json={"title": "E4"}).json()["id"]
    assert db.scalar(select(InvitationSession.position).where(InvitationSession.public_id == new_id)) == 3


def test_collection_change_bumps_updated_at(auth_client: TestClient, wid: str) -> None:
    before = auth_client.get(f"{API}/me").json()["updatedAt"]
    auth_client.post(f"{API}/{wid}/stories", json={"title": "Hi"})
    assert auth_client.get(f"{API}/me").json()["updatedAt"] > before

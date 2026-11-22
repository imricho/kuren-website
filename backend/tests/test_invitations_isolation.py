"""Multi-invitation ownership isolation: another user gets 404 on every per-invitation route."""

from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.invitation_registry import SECTION_IDS
from app.models import Invitation, InvitationRsvpResponse
from tests.invitation_helpers import INV, PUBLIC_INV, create_invitation, make_publishable, publish
from tests.wedding_helpers import API, png_bytes, upload

SECTIONS = [s for s in SECTION_IDS if s != "events"]


@pytest.fixture
def a_invitations(auth_client: TestClient) -> dict[str, Any]:
    """User A owns two published invitations, each with one RSVP reply and one upload."""
    out: dict[str, Any] = {}
    for variant in ("seminar", "wedding_reception"):
        iid = create_invitation(auth_client, variant, themeId="temuvibe-elegant")["id"]
        make_publishable(auth_client, iid)
        if variant == "wedding_reception":  # RSVP starts switched off for weddings
            assert auth_client.put(f"{INV}/{iid}/sections/rsvp", json={"enabled": True}).status_code == 200
        slug = publish(auth_client, iid)["slug"]
        reply = {"name": "Guest", "attendance": "attending", "partySize": 1, "email": "guest@example.com",
                 "answers": {"company": "ACME"}} if variant == "seminar" else {"name": "Guest", "attendance": "attending"}
        response = auth_client.post(f"{PUBLIC_INV}/{slug}/rsvp", json=reply)
        assert response.status_code == 201, response.text
        asset = upload(auth_client, iid, png_bytes()).json()
        event = auth_client.get(f"{INV}/{iid}/events").json()[0]["id"]
        out[variant] = {"id": iid, "reply": response.json()["id"], "asset": asset["id"], "event": event}
    return out


def _routes(prefix: str, info: dict[str, Any]) -> list[tuple[str, str, Any]]:
    iid = info["id"]
    base = f"{prefix}/{iid}"
    routes: list[tuple[str, str, Any]] = [
        ("GET", base, None), ("PATCH", base, {"title": "hijack"}), ("DELETE", base, None),
        ("GET", f"{base}/content", None), ("PUT", f"{base}/content", {"opening": {}, "events": [], "closing": {}}),
        ("GET", f"{base}/preview", None), ("POST", f"{base}/publish", None), ("POST", f"{base}/unpublish", None),
        ("DELETE", f"{base}/assets/{info['asset']}", None),
        ("GET", f"{base}/rsvp-responses", None), ("GET", f"{base}/rsvp-responses.csv", None),
        ("DELETE", f"{base}/rsvp-responses/{info['reply']}", None),
        ("GET", f"{base}/events", None), ("POST", f"{base}/events", {"title": "x"}),
        ("PUT", f"{base}/events/order", {"ids": [info["event"]]}),
        ("PUT", f"{base}/events/{info['event']}", {"title": "x"}), ("DELETE", f"{base}/events/{info['event']}", None),
    ]
    for section in SECTIONS:
        routes += [("GET", f"{base}/sections/{section}", None), ("PUT", f"{base}/sections/{section}", {})]
    return routes


def test_other_user_gets_404_on_every_route_of_every_invitation(
    auth_client: TestClient, other_client: TestClient, a_invitations: dict[str, Any], db: Session
) -> None:
    before = {v: auth_client.get(f"{INV}/{i['id']}/content").json() for v, i in a_invitations.items()}
    for info in a_invitations.values():
        for prefix in (INV, API):
            for method, path, body in _routes(prefix, info):
                response = other_client.request(method, path, json=body)
                assert response.status_code == 404, (method, path, response.text)
                assert response.json()["error"]["code"] == "not_found"
        upload_response = upload(other_client, info["id"], png_bytes())
        assert upload_response.status_code == 404
    assert other_client.get(INV).json() == {"items": []}
    assert other_client.get(f"{API}/me").status_code == 404
    # A's data is untouched: content, replies, publications.
    assert {v: auth_client.get(f"{INV}/{i['id']}/content").json() for v, i in a_invitations.items()} == before
    assert db.scalar(select(func.count()).select_from(InvitationRsvpResponse)) == 2
    assert db.scalar(select(func.count()).select_from(Invitation).where(Invitation.status == "published")) == 2
    for info in a_invitations.values():
        listing = auth_client.get(f"{INV}/{info['id']}/rsvp-responses").json()
        assert listing["total"] == 1


def test_reply_ids_are_scoped_to_their_invitation(
    auth_client: TestClient, a_invitations: dict[str, Any]
) -> None:
    seminar, wedding = a_invitations["seminar"], a_invitations["wedding_reception"]
    response = auth_client.delete(f"{INV}/{wedding['id']}/rsvp-responses/{seminar['reply']}")
    assert response.status_code == 404
    assert auth_client.delete(f"{INV}/{seminar['id']}/rsvp-responses/not-a-uuid").status_code == 404
    assert auth_client.delete(f"{INV}/{seminar['id']}/rsvp-responses/{seminar['reply']}").status_code == 204
    assert auth_client.get(f"{INV}/{seminar['id']}/rsvp-responses").json()["total"] == 0
    assert auth_client.get(f"{INV}/{wedding['id']}/rsvp-responses").json()["total"] == 1


def test_deleting_an_invitation_deletes_its_replies(
    auth_client: TestClient, a_invitations: dict[str, Any], db: Session
) -> None:
    assert auth_client.delete(f"{INV}/{a_invitations['seminar']['id']}").status_code == 204
    assert db.scalar(select(func.count()).select_from(InvitationRsvpResponse)) == 1

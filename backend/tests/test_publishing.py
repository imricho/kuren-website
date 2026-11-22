"""CMS v2.0 publishing: checks, allow-listed snapshot, slugs, public endpoint."""

import copy
import json
import re
import uuid
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Invitation, InvitationPublication
from app.core.invitation_registry import get_variant
from app.services import invitation_publish_service, invitation_service
from tests.wedding_helpers import API, PUBLIC, create_wedding, png_bytes, upload
from tests.wedding_samples import SAMPLE_WEDDING

SLUG = re.compile(r"[a-z0-9]+(-[a-z0-9]+)*-[a-z0-9]{6}")
SECRET_ACCOUNT = "0098765432101"


def _body(**overrides: Any) -> dict[str, Any]:
    body = copy.deepcopy(SAMPLE_WEDDING)
    body.update(overrides)
    return body


@pytest.fixture
def wid(auth_client: TestClient) -> str:
    return create_wedding(auth_client, themeId="afterglow")["id"]


@pytest.fixture
def ready(auth_client: TestClient, wid: str) -> str:
    """A wedding whose draft passes every publish check."""
    assert auth_client.put(f"{API}/{wid}/content", json=_body()).status_code == 200
    return wid


def publish(client: TestClient, wid: str, **headers: str) -> Any:
    return client.post(f"{API}/{wid}/publish", headers=headers)


def published(client: TestClient, wid: str) -> dict[str, Any]:
    response = publish(client, wid)
    assert response.status_code == 200, response.text
    return response.json()


def blocked(response: Any) -> list[tuple[str, str, str]]:
    body = response.json()
    assert response.status_code == 422, body
    assert body["error"]["code"] == "publish_blocked"
    for d in body["error"]["details"]:
        assert set(d) == {"section", "field", "code", "message"} and d["message"]
    return [(d["section"], d["field"], d["code"]) for d in body["error"]["details"]]


def public(client: TestClient, slug: str, **headers: str) -> Any:
    return client.get(f"{PUBLIC}/{slug}", headers=headers)


# --- Blocking rules -----------------------------------------------------------------------


def test_empty_wedding_lists_every_required_field(auth_client: TestClient) -> None:
    wid = create_wedding(auth_client)["id"]
    issues = blocked(publish(auth_client, wid))
    assert issues == [
        ("theme", "themeId", "required"),
        ("opening", "opening.weddingDate", "required"),
        ("couple", "couple.groom.name", "required"),
        ("couple", "couple.bride.name", "required"),
        ("events", "events", "required"),
        ("closing", "closing.message", "required"),
    ]  # story, gallery and RSVP start switched off for new weddings, so they never block
    assert auth_client.get(f"{API}/me").json()["status"] == "draft"


def test_sample_wedding_is_publishable(auth_client: TestClient, ready: str) -> None:
    wedding = published(auth_client, ready)
    assert wedding["status"] == "published"
    assert wedding["publishedAt"] == wedding["publication"]["publishedAt"]
    assert wedding["publication"]["revision"] == wedding["revision"]
    assert wedding["publication"]["themeId"] == "afterglow"
    assert wedding["hasUnpublishedChanges"] is False


def test_unselectable_theme_blocks(auth_client: TestClient, ready: str, db: Session) -> None:
    wedding = db.get(Invitation, uuid.UUID(ready))
    wedding.theme_id = "retired-theme"
    db.commit()
    assert blocked(publish(auth_client, ready)) == [("theme", "themeId", "invalid")]


def test_every_event_needs_its_details(auth_client: TestClient, wid: str) -> None:
    body = _body(events=[
        {"id": "e1", "title": "Akad", "date": "2027-06-12", "startTime": "08:00",
         "venueName": "Home", "address": "Jl. Melati 1",
         "livestream": {"enabled": True, "label": "Watch"}},
        {"id": "e2", "type": "reception"},
    ])
    auth_client.put(f"{API}/{wid}/content", json=body)
    assert blocked(publish(auth_client, wid)) == [
        ("events", "events.0.livestream.url", "required"),
        ("events", "events.1.title", "required"),
        ("events", "events.1.date", "required"),
        ("events", "events.1.startTime", "required"),
        ("events", "events.1.venueName", "required"),
        ("events", "events.1.address", "required"),
    ]


def test_story_needs_one_complete_entry(auth_client: TestClient, wid: str) -> None:
    body = _body()
    body["story"]["timeline"] = [{"id": "s1", "title": "Only a title"}]
    auth_client.put(f"{API}/{wid}/content", json=body)
    assert blocked(publish(auth_client, wid)) == [("story", "story.timeline", "incomplete")]


@pytest.mark.parametrize(
    ("section", "body", "expected"),
    [
        ("holyRecite1", {"enabled": True, "reference": "QS 30:21"}, [("holyRecite1", "holyRecite1.passage", "incomplete")]),
        ("holyRecite2", {"enabled": True, "title": "Ayat"}, [("holyRecite2", "holyRecite2.passage", "incomplete")]),
        ("greeting", {"enabled": True, "prayer": "Doa"}, [("greeting", "greeting.message", "incomplete")]),
        ("amplopDigital", {"enabled": True, "bankAccountsEnabled": False, "qrisEnabled": False},
         [("amplopDigital", "amplopDigital", "incomplete")]),
        ("amplopDigital", {"enabled": True, "bankAccountsEnabled": True, "qrisEnabled": False, "bankAccounts": []},
         [("amplopDigital", "amplopDigital.bankAccounts", "incomplete")]),
        ("amplopDigital", {"enabled": True, "bankAccountsEnabled": False, "qrisEnabled": True},
         [("amplopDigital", "amplopDigital.qrisImage", "required")]),
        ("amplopDigital", {"enabled": True, "bankAccountsEnabled": False, "qrisEnabled": True,
                           "qrisImage": {"src": "https://cdn.example.com/qris.png", "alt": "QRIS"}},
         [("amplopDigital", "amplopDigital.qrisImage", "invalid")]),
        ("amplopDigital", {"enabled": True, "bankAccountsEnabled": False, "qrisEnabled": False,
                           "physicalGifts": {"enabled": True, "recipient": "Ayu"}},
         [("amplopDigital", "amplopDigital.physicalGifts.address", "required")]),
    ],
)
def test_enabled_optional_sections_need_minimum_content(
    auth_client: TestClient, ready: str, section: str, body: dict[str, Any], expected: list[Any]
) -> None:
    assert auth_client.put(f"{API}/{ready}/sections/{section}", json=body).status_code == 200
    assert blocked(publish(auth_client, ready)) == expected


def test_disabled_optional_sections_do_not_block(auth_client: TestClient, wid: str) -> None:
    body = _body()
    body["story"] = {"enabled": False, "timeline": []}
    body["gallery"] = {"enabled": False, "images": []}
    auth_client.put(f"{API}/{wid}/content", json=body)
    for section, payload in (
        ("holyRecite1", {"enabled": False, "reference": "x"}),
        ("greeting", {"enabled": False}),
        ("wishes", {"enabled": True}),  # wishes needs nothing
        ("amplopDigital", {"enabled": False, "bankAccountsEnabled": True, "qrisEnabled": True}),
    ):
        assert auth_client.put(f"{API}/{wid}/sections/{section}", json=payload).status_code == 200
    published(auth_client, wid)


def test_qris_must_be_an_upload_of_this_wedding(
    auth_client: TestClient, other_client: TestClient, ready: str
) -> None:
    other_wid = create_wedding(other_client)["id"]
    foreign = upload(other_client, other_wid, png_bytes(), kind="qris").json()["src"]
    amplop = {"enabled": True, "bankAccountsEnabled": False, "qrisEnabled": True,
              "qrisImage": {"src": foreign, "alt": "QRIS"}}
    auth_client.put(f"{API}/{ready}/sections/amplopDigital", json=amplop)
    assert blocked(publish(auth_client, ready)) == [("amplopDigital", "amplopDigital.qrisImage", "invalid")]

    own = upload(auth_client, ready, png_bytes(), kind="qris").json()["src"]
    auth_client.put(f"{API}/{ready}/sections/amplopDigital", json={**amplop, "qrisImage": {"src": own, "alt": "QRIS"}})
    slug = published(auth_client, ready)["slug"]
    assert public(auth_client, slug).json()["content"]["amplopDigital"]["qrisImage"]["src"] == own


# --- Snapshot -----------------------------------------------------------------------------


def _keys(value: Any, prefix: str = "") -> set[str]:
    """Dotted key paths, with list indices collapsed to `[]`."""
    out: set[str] = set()
    if isinstance(value, dict):
        for key, child in value.items():
            path = f"{prefix}.{key}" if prefix else key
            out.add(path)
            out |= _keys(child, path)
    elif isinstance(value, list):
        for child in value:
            out |= _keys(child, f"{prefix}[]")
    return out


def test_snapshot_drops_disabled_sections_children_and_financial_data(
    auth_client: TestClient, ready: str
) -> None:
    auth_client.put(f"{API}/{ready}/sections/holyRecite1", json={"enabled": False, "passage": "Hidden passage"})
    auth_client.put(f"{API}/{ready}/sections/greeting", json={"enabled": True, "title": "Salam", "message": "Halo"})
    auth_client.put(f"{API}/{ready}/sections/countdown", json={"enabled": True, "addToCalendar": False})
    auth_client.put(f"{API}/{ready}/sections/amplopDigital", json={
        "enabled": True, "title": "Amplop", "bankAccountsEnabled": False,
        "bankAccounts": [{"id": "a1", "bankName": "BCA", "accountHolder": "Ayu", "accountNumber": SECRET_ACCOUNT}],
        "qrisEnabled": False, "qrisImage": {"src": "https://cdn.example.com/q.png", "alt": "QRIS"},
        "physicalGifts": {"enabled": True, "recipient": "Ayu", "address": "Jl. Melati 1", "phone": "+62 812"},
    })
    content = auth_client.get(f"{API}/{ready}/content").json()
    content["opening"]["guestGreeting"] = {"enabled": False, "label": "Kepada Yth."}
    content["events"][0]["dressCode"] = {"enabled": False, "text": "Batik"}
    content["events"][1]["livestream"] = {"enabled": False, "url": "https://live.example.com/x"}
    content["rsvp"]["enabled"] = False
    content["story"]["enabled"] = False
    auth_client.put(f"{API}/{ready}/content", json=content)

    slug = published(auth_client, ready)["slug"]
    response = public(auth_client, slug)
    raw = response.text
    snapshot = response.json()["content"]

    for absent in (SECRET_ACCOUNT, "Hidden passage", "Kepada Yth.", "Batik", "live.example.com", "q.png",
                   "Will You Join Us?", "The First Hello"):
        assert absent not in raw
    for key in ("rsvp", "story"):
        assert key not in snapshot
    # Switched-off universal sections leave only a content-free marker, so the public page can
    # tell "off" from "never set" (legacy greeting/countdown default to on).
    for key in ("holyRecite1", "holyRecite2", "wishes"):
        if key in snapshot:
            assert snapshot[key] == {"enabled": False}
    assert snapshot["greeting"] == {"enabled": True, "title": "Salam", "message": "Halo"}
    assert snapshot["countdown"] == {"enabled": True}
    assert snapshot["amplopDigital"] == {
        "enabled": True, "title": "Amplop", "bankAccountsEnabled": False, "bankAccounts": [],
        "qrisEnabled": False,
        "physicalGifts": {"enabled": True, "recipient": "Ayu", "address": "Jl. Melati 1", "phone": "+62 812"},
    }
    assert "guestGreeting" not in snapshot["opening"]
    assert "dressCode" not in snapshot["events"][0] and "livestream" not in snapshot["events"][1]
    # Render keys are kept; nothing internal (owner, db ids) is.
    assert [e["id"] for e in snapshot["events"]] == ["akad", "reception"]
    assert [g["id"] for g in snapshot["gallery"]["images"]] == ["g1", "g2", "g3", "g4", "g5", "g6"]
    wedding = auth_client.get(f"{API}/me").json()
    assert wedding["id"] not in raw and "couple-a@example.com" not in raw


def test_enabled_financial_data_is_published(auth_client: TestClient, ready: str) -> None:
    auth_client.put(f"{API}/{ready}/sections/amplopDigital", json={
        "enabled": True, "bankAccountsEnabled": True, "qrisEnabled": False,
        "bankAccounts": [{"id": "a1", "bankName": "BCA", "accountHolder": "Ayu", "accountNumber": SECRET_ACCOUNT}],
    })
    slug = published(auth_client, ready)["slug"]
    accounts = public(auth_client, slug).json()["content"]["amplopDigital"]["bankAccounts"]
    assert accounts == [{"id": "a1", "bankName": "BCA", "accountHolder": "Ayu", "accountNumber": SECRET_ACCOUNT}]


def test_snapshot_never_has_keys_the_draft_lacks(auth_client: TestClient, ready: str) -> None:
    """No placeholders: every key path in the snapshot exists in the draft."""
    auth_client.put(f"{API}/{ready}/sections/wishes", json={"enabled": True, "title": "Doa"})
    draft = auth_client.get(f"{API}/{ready}/content").json()
    slug = published(auth_client, ready)["slug"]
    snapshot = public(auth_client, slug).json()["content"]
    assert _keys(snapshot) <= _keys(draft)

    def strings(value: Any) -> list[str]:
        if isinstance(value, str):
            return [value]
        if isinstance(value, dict):
            return [s for v in value.values() for s in strings(v)]
        if isinstance(value, list):
            return [s for v in value for s in strings(v)]
        return []

    assert all(s.strip() for s in strings(snapshot))


def test_build_snapshot_ignores_unknown_draft_keys() -> None:
    draft = copy.deepcopy(SAMPLE_WEDDING)
    draft["ownerEmail"] = "x@example.com"
    draft["opening"]["internal"] = "secret"
    draft["events"][0]["dbId"] = "123"
    draft["greeting"] = {"enabled": True, "message": "Hi", "futureField": "secret"}
    draft["couple"]["groom"]["name"] = "   "
    snapshot = invitation_publish_service.build_snapshot(draft, get_variant("wedding_ceremony"))
    raw = json.dumps(snapshot)
    assert "secret" not in raw and "x@example.com" not in raw and "dbId" not in raw
    assert "name" not in snapshot["couple"]["groom"]


# --- Transactions, revisions, unpublish ----------------------------------------------------


def test_failed_publish_keeps_previous_publication_live(
    auth_client: TestClient, ready: str, db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    first = published(auth_client, ready)
    slug = first["slug"]
    before = public(auth_client, slug).json()
    auth_client.put(f"{API}/{ready}/sections/greeting", json={"enabled": True, "message": "New text"})

    def boom(*_: Any, **__: Any) -> None:
        raise RuntimeError("simulated failure after the snapshot row was written")

    monkeypatch.setattr(invitation_service, "touch", boom)
    response = publish(auth_client, ready)
    assert response.status_code == 500 and response.json()["error"]["code"] == "internal_error"
    monkeypatch.undo()

    assert public(auth_client, slug).json() == before
    assert db.scalar(select(func.count()).select_from(InvitationPublication)) == 1
    wedding = auth_client.get(f"{API}/me").json()
    assert wedding["publication"] == first["publication"]
    assert wedding["hasUnpublishedChanges"] is True


def test_has_unpublished_changes_transitions(auth_client: TestClient, ready: str) -> None:
    first = published(auth_client, ready)
    assert first["hasUnpublishedChanges"] is False

    auth_client.put(f"{API}/{ready}/sections/closing", json={"message": "Updated closing"})
    me = auth_client.get(f"{API}/me").json()
    assert me["hasUnpublishedChanges"] is True and me["revision"] == first["revision"] + 1

    again = published(auth_client, ready)
    assert again["hasUnpublishedChanges"] is False
    assert again["revision"] == me["revision"]  # publishing does not bump the content revision
    assert again["slug"] == first["slug"]
    assert public(auth_client, again["slug"]).json()["content"]["closing"]["message"] == "Updated closing"

    themed = auth_client.patch(f"{API}/{ready}", json={"themeId": "atelier"}).json()
    assert themed["hasUnpublishedChanges"] is True
    assert public(auth_client, again["slug"]).json()["themeId"] == "afterglow"
    assert published(auth_client, ready)["hasUnpublishedChanges"] is False


def test_publish_honours_if_match(auth_client: TestClient, ready: str) -> None:
    revision = auth_client.get(f"{API}/me").json()["revision"]
    stale = publish(auth_client, ready, **{"If-Match": f'"{revision - 1}"'})
    assert stale.status_code == 409 and stale.json()["error"]["code"] == "edit_conflict"
    ok = publish(auth_client, ready, **{"If-Match": f'"{revision}"'})
    assert ok.status_code == 200 and ok.headers["etag"] == f'"{revision}"'


def test_unpublish_hides_the_public_page_and_keeps_history(
    auth_client: TestClient, ready: str, db: Session
) -> None:
    slug = published(auth_client, ready)["slug"]
    off = auth_client.post(f"{API}/{ready}/unpublish")
    assert off.status_code == 200
    body = off.json()
    assert body["status"] == "draft" and body["publication"] is None and body["publishedAt"] is None
    assert body["slug"] == slug and body["hasUnpublishedChanges"] is False
    assert public(auth_client, slug).status_code == 404
    assert db.scalar(select(func.count()).select_from(InvitationPublication)) == 1
    # Republishing reuses the slug.
    assert published(auth_client, ready)["slug"] == slug


# --- Slugs --------------------------------------------------------------------------------


def test_slug_uses_nicknames_or_first_names(auth_client: TestClient, wid: str) -> None:
    body = _body()
    body["couple"]["groom"]["nickname"] = "Àlex!"
    body["couple"]["bride"]["name"] = "Sarah Putri"
    auth_client.put(f"{API}/{wid}/content", json=body)
    slug = published(auth_client, wid)["slug"]
    assert SLUG.fullmatch(slug) and slug.startswith("alex-sarah-") and len(slug) == len("alex-sarah-") + 6


def test_slug_falls_back_when_names_have_no_ascii() -> None:
    draft = {"couple": {"groom": {"name": "مرحبا"}, "bride": {"name": "Ayu"}}}
    slug = invitation_publish_service.make_slug(draft, get_variant("wedding_ceremony"))
    assert re.fullmatch(r"undangan-[a-z0-9]{6}", slug)


def test_slug_collision_is_retried(
    auth_client: TestClient, other_client: TestClient, ready: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    taken = published(auth_client, ready)["slug"]
    other = create_wedding(other_client, themeId="afterglow")["id"]
    other_client.put(f"{API}/{other}/content", json=_body())
    candidates = iter([taken, "alex-sarah-zzzzzz"])
    monkeypatch.setattr(invitation_publish_service, "make_slug", lambda _draft, _variant: next(candidates))
    assert published(other_client, other)["slug"] == "alex-sarah-zzzzzz"


# --- Ownership ----------------------------------------------------------------------------


def test_other_users_get_404(auth_client: TestClient, other_client: TestClient, ready: str) -> None:
    for path in ("publish", "unpublish"):
        response = other_client.post(f"{API}/{ready}/{path}")
        assert response.status_code == 404 and response.json()["error"]["code"] == "not_found"
    assert auth_client.get(f"{API}/me").json()["status"] == "draft"


def test_publish_requires_login(client: TestClient) -> None:
    assert client.post(f"{API}/00000000-0000-0000-0000-000000000000/publish").status_code == 401


# --- Public endpoint ----------------------------------------------------------------------


def test_public_endpoint_works_without_auth_and_sets_no_cookies(
    auth_client: TestClient, ready: str, client: TestClient
) -> None:
    slug = published(auth_client, ready)["slug"]
    from app.main import app

    with TestClient(app, base_url="http://testserver") as anonymous:
        response = anonymous.get(f"{PUBLIC}/{slug}")
    assert response.status_code == 200
    assert "set-cookie" not in response.headers
    body = response.json()
    assert set(body) == {"category", "variant", "themeId", "locale", "timezone", "content", "publishedAt"}
    assert body["themeId"] == "afterglow" and body["locale"] == "en"
    assert (body["category"], body["variant"], body["timezone"]) == ("wedding", "wedding_ceremony", "Asia/Jakarta")
    assert body["content"]["couple"]["groom"]["name"] == "Alex Wijaya"
    etag = response.headers["etag"].strip('"')
    assert response.headers["x-robots-tag"] == "noindex, nofollow"
    assert response.headers["cache-control"] == "no-cache"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert re.fullmatch(r"[0-9a-f]{32}", etag)  # a digest of the exact public representation


def test_public_etag_304(auth_client: TestClient, ready: str) -> None:
    slug = published(auth_client, ready)["slug"]
    etag = public(auth_client, slug).headers["etag"]
    cached = public(auth_client, slug, **{"If-None-Match": etag})
    assert cached.status_code == 304 and cached.content == b"" and cached.headers["etag"] == etag
    assert public(auth_client, slug, **{"If-None-Match": '"other"'}).status_code == 200
    # Republishing makes a new publication, so a new ETag.
    published(auth_client, ready)
    assert public(auth_client, slug, **{"If-None-Match": etag}).status_code == 200


@pytest.mark.parametrize("slug", ["no-such-wedding-abc123", "UPPER-Case", "a..b", "x" * 200, "%2e%2e", "-bad-"])
def test_public_404_is_identical(client: TestClient, slug: str) -> None:
    response = client.get(f"{PUBLIC}/{slug}")
    assert response.status_code == 404
    assert response.json() == {"error": {"code": "not_found", "message": "Not found."}}


def test_unpublished_slug_404_matches_unknown(auth_client: TestClient, ready: str) -> None:
    slug = published(auth_client, ready)["slug"]
    auth_client.post(f"{API}/{ready}/unpublish")
    assert public(auth_client, slug).json() == public(auth_client, "unknown-slug-aaaaaa").json()


def test_public_rate_limit(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "public_rate_limit_per_minute", 3)
    statuses = [client.get(f"{PUBLIC}/unknown-slug-aaaaaa").status_code for _ in range(4)]
    assert statuses == [404, 404, 404, 429]
    assert client.get(f"{PUBLIC}/unknown-slug-aaaaaa").json()["error"]["code"] == "too_many_requests"


def test_switched_off_greeting_and_countdown_stay_off_publicly(auth_client: TestClient, ready: str) -> None:
    """Regression: an explicit "off" must survive into the snapshot (absent would mean legacy "on")."""
    base = f"{API}/{ready}"
    auth_client.put(f"{base}/sections/greeting", json={"enabled": False, "title": "Secret greeting"})
    auth_client.put(f"{base}/sections/countdown", json={"enabled": False, "addToCalendar": True})
    info = published(auth_client, ready)
    response = public(auth_client, info["slug"])
    content = response.json()["content"]
    assert content["greeting"] == {"enabled": False}
    assert content["countdown"] == {"enabled": False, "addToCalendar": True}
    assert "Secret greeting" not in response.text


def test_new_weddings_start_with_story_gallery_and_rsvp_off(auth_client: TestClient) -> None:
    content = auth_client.get(f"{API}/{create_wedding(auth_client)['id']}/content").json()
    assert (content["story"]["enabled"], content["gallery"]["enabled"], content["rsvp"]["enabled"]) == (False, False, False)
    assert content["countdown"] == {"enabled": True, "addToCalendar": True}

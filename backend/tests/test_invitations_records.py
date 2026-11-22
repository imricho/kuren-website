"""`/invitations` records: create + seed per variant, list, read, patch, delete, limits."""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.invitation_registry import get_variant
from app.models import Invitation, InvitationAsset
from app.services import invitation_service
from tests.invitation_helpers import ALL_VARIANTS, INV, category_of, create_invitation, error_code
from tests.wedding_helpers import API, create_wedding, fields, png_bytes, upload

IID = str(uuid.uuid4())
NEW_ROUTES = [
    ("GET", INV), ("POST", INV), ("GET", f"{INV}/{IID}"), ("PATCH", f"{INV}/{IID}"), ("DELETE", f"{INV}/{IID}"),
    ("GET", f"{INV}/{IID}/content"), ("PUT", f"{INV}/{IID}/sections/profiles"),
    ("GET", f"{INV}/{IID}/rsvp-responses"), ("GET", f"{INV}/{IID}/rsvp-responses.csv"),
    ("DELETE", f"{INV}/{IID}/rsvp-responses/{IID}"),
]


@pytest.mark.parametrize(("method", "path"), NEW_ROUTES)
def test_routes_require_authentication(client: TestClient, method: str, path: str) -> None:
    response = client.request(method, path, json={} if method in {"POST", "PUT", "PATCH"} else None)
    assert error_code(response, 401) == "not_authenticated"


@pytest.mark.parametrize("variant", ALL_VARIANTS)
def test_every_variant_creates_and_seeds_its_defaults(auth_client: TestClient, variant: str) -> None:
    config = get_variant(variant)
    created = create_invitation(auth_client, variant, title=f"My {variant}", locale="id")
    assert (created["category"], created["variant"]) == (config.category, variant)
    assert created["title"] == f"My {variant}" and created["timezone"] == "Asia/Jakarta"
    assert created["status"] == "draft" and created["revision"] == 0
    content = auth_client.get(f"{INV}/{created['id']}/content").json()
    assert content["schemaVersion"] == 2 and content["locale"] == "id"

    # Sessions: the variant's presets, in order, titled in the invitation's locale.
    assert [(e["type"], e["title"]) for e in content["events"]] == [
        (p.type, p.title["id"]) for p in config.session_presets
    ]
    # Section on/off flags follow the registry; optional universal sections that start off are absent.
    for section in config.sections:
        if section.id in ("story", "gallery", "rsvp"):
            assert content[section.id]["enabled"] is section.default_enabled, section.id
        elif section.id in ("profiles", "milestone", "organization", "agenda", "speakers",
                            "greeting", "holyRecite1", "holyRecite2", "wishes", "amplopDigital"):
            assert content.get(section.id, {}).get("enabled", False) is section.default_enabled, section.id
    assert content["countdown"] == {"enabled": True, "addToCalendar": True}
    for key, value in config.rsvp_defaults.items():
        if key != "registrationFields":
            assert content["rsvp"][key] == value
    milestone = config.section("milestone")
    if milestone is not None and milestone.defaults:
        assert {k: content["milestone"][k] for k in milestone.defaults} == milestone.defaults


def test_seminar_seeds_registration_fields(auth_client: TestClient) -> None:
    created = create_invitation(auth_client, "seminar")
    rsvp = auth_client.get(f"{INV}/{created['id']}/sections/rsvp").json()
    assert rsvp["collectContact"] == "email"
    assert rsvp["registrationFields"] == [{"id": "company", "label": "Company", "type": "text", "required": False}]
    assert auth_client.get(f"{INV}/{created['id']}/content").json()["speakers"] == {"enabled": True}


def test_family_gathering_party_size_default(auth_client: TestClient) -> None:
    created = create_invitation(auth_client, "family_gathering")
    assert auth_client.get(f"{INV}/{created['id']}/sections/rsvp").json()["maxGuestsPerResponse"] == 10


@pytest.mark.parametrize(
    "body",
    [
        {"category": "wedding", "variant": "birthday"},
        {"category": "party", "variant": "birthday"},
        {"category": "celebration", "variant": "bar_mitzvah"},
        {"category": "celebration"},
        {"category": "celebration", "variant": "birthday", "timezone": "Mars/Olympus"},
        {"category": "celebration", "variant": "birthday", "timezone": "../../etc/passwd"},
        {"category": "celebration", "variant": "birthday", "title": "x" * 121},
        {"category": "celebration", "variant": "birthday", "themeId": "nope"},
        {"category": "celebration", "variant": "birthday", "status": "published"},
    ],
)
def test_create_validation(auth_client: TestClient, body: dict) -> None:
    assert error_code(auth_client.post(INV, json=body), 422) == "validation_error"


def test_create_accepts_a_timezone(auth_client: TestClient) -> None:
    created = create_invitation(auth_client, "birthday", timezone="Asia/Makassar")
    assert created["timezone"] == "Asia/Makassar"


@pytest.mark.parametrize(
    ("variant", "theme", "ok"),
    [
        ("birthday", "afterglow", False),
        ("anniversary", "afterglow", True),
        ("engagement", "rosewater", True),
        ("wedding_reception", "temuvibe-corporate", False),
        ("seminar", "temuvibe-festive", False),
        ("seminar", "temuvibe-corporate", True),
        ("family_reunion", "temuvibe-festive", True),
        ("community_gathering", "temuvibe-corporate", True),
        ("aqiqah", "temuvibe-minimal", True),
    ],
)
def test_template_compatibility_on_create_and_patch(
    auth_client: TestClient, variant: str, theme: str, ok: bool
) -> None:
    body = {"category": category_of(variant), "variant": variant, "themeId": theme}
    response = auth_client.post(INV, json=body)
    if ok:
        assert response.status_code == 201
        assert response.json()["themeId"] == theme
    else:
        assert error_code(response, 422) == "template_incompatible"
        assert response.json()["error"]["details"] == [{"field": "themeId", "message": response.json()["error"]["message"]}]
    created = create_invitation(auth_client, variant)
    response = auth_client.patch(f"{INV}/{created['id']}", json={"themeId": theme})
    if ok:
        assert response.json()["themeId"] == theme
    else:
        assert error_code(response, 422) == "template_incompatible"
        assert auth_client.get(f"{INV}/{created['id']}").json()["themeId"] is None


def test_patch_record_fields_and_immutable_variant(auth_client: TestClient) -> None:
    created = create_invitation(auth_client, "graduation")
    url = f"{INV}/{created['id']}"
    body = auth_client.patch(url, json={"title": "  Wisuda Citra ", "timezone": "Asia/Jayapura", "locale": "id"}).json()
    assert (body["title"], body["timezone"], body["locale"]) == ("Wisuda Citra", "Asia/Jayapura", "id")
    assert body["revision"] == 0  # record changes are not content writes
    assert auth_client.patch(url, json={"title": None}).json()["title"] is None
    for bad in ({"variant": "birthday"}, {"category": "corporate"}, {"timezone": None}, {"timezone": "UTC+7"}):
        assert error_code(auth_client.patch(url, json=bad), 422) == "validation_error"
    assert auth_client.get(url).json()["variant"] == "graduation"


def test_list_is_newest_updated_first_with_summaries(auth_client: TestClient) -> None:
    first = create_invitation(auth_client, "birthday", title="Ultah Raka")
    second = create_invitation(auth_client, "seminar", title="Tech Talk")
    auth_client.put(f"{INV}/{first['id']}/sections/opening", json={"weddingDate": "2030-01-05"})
    items = auth_client.get(INV).json()["items"]
    assert [i["id"] for i in items] == [first["id"], second["id"]]
    assert set(items[0]) == {
        "id", "title", "category", "variant", "themeId", "status", "slug", "hasUnpublishedChanges",
        "eventDate", "updatedAt", "publishedAt",
    }
    assert (items[0]["title"], items[0]["eventDate"], items[1]["eventDate"]) == ("Ultah Raka", "2030-01-05", None)


def test_limit_of_invitations_per_user(auth_client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(invitation_service, "MAX_INVITATIONS_PER_USER", 2)
    create_invitation(auth_client, "birthday")
    create_wedding(auth_client)
    assert error_code(auth_client.post(INV, json={"category": "corporate", "variant": "seminar"}), 409) == "limit_reached"
    assert error_code(auth_client.post(API, json={}), 409) == "limit_reached"
    assert len(auth_client.get(INV).json()["items"]) == 2


def test_default_limit_is_fifty() -> None:
    assert invitation_service.MAX_INVITATIONS_PER_USER == 50


def test_delete_cascades_and_removes_media(auth_client: TestClient, db: Session, media_root) -> None:  # type: ignore[no-untyped-def]
    created = create_invitation(auth_client, "birthday")
    keep = create_invitation(auth_client, "birthday")
    asset = upload(auth_client, created["id"], png_bytes()).json()
    kept_asset = upload(auth_client, keep["id"], png_bytes()).json()
    path = media_root / asset["src"].removeprefix("/media/")
    assert path.is_file()
    response = auth_client.delete(f"{INV}/{created['id']}")
    assert response.status_code == 204
    assert not path.exists()
    assert (media_root / kept_asset["src"].removeprefix("/media/")).is_file()
    assert error_code(auth_client.get(f"{INV}/{created['id']}"), 404) == "not_found"
    assert db.scalar(select(func.count()).select_from(Invitation)) == 1
    assert db.scalar(select(func.count()).select_from(InvitationAsset)) == 1


def test_legacy_me_only_considers_wedding_category(auth_client: TestClient) -> None:
    create_invitation(auth_client, "birthday")
    assert error_code(auth_client.get(f"{API}/me"), 404) == "not_found"
    reception = create_invitation(auth_client, "wedding_reception")
    create_invitation(auth_client, "seminar")  # newer, but not a wedding
    assert auth_client.get(f"{API}/me").json()["id"] == reception["id"]


def test_legacy_create_is_a_wedding_ceremony_without_seeded_sessions(auth_client: TestClient) -> None:
    wedding = create_wedding(auth_client, themeId="afterglow")
    assert (wedding["category"], wedding["variant"]) == ("wedding", "wedding_ceremony")
    assert auth_client.get(f"{API}/{wedding['id']}/events").json() == []
    # The same record is reachable on both prefixes.
    assert auth_client.get(f"{INV}/{wedding['id']}").json() == auth_client.get(f"{API}/{wedding['id']}").json()
    assert fields(auth_client.post(API, json={"category": "wedding"})) == ["category"]

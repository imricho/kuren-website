"""Media lifecycle after publishing (security review M1/M2): an image deleted while the live
page shows it disappears once the live page stops using it, and another account's (or a
deleted) upload can never be published."""

from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import InvitationAsset
from tests.invitation_helpers import INV, blocked, create_invitation, make_publishable, publish
from tests.wedding_helpers import png_bytes, upload


def _published_with_photo(client: TestClient) -> tuple[str, dict[str, Any]]:
    iid = create_invitation(client, "birthday", themeId="temuvibe-elegant")["id"]
    make_publishable(client, iid)
    asset = upload(client, iid, png_bytes()).json()
    item = client.post(f"{INV}/{iid}/gallery", json={"src": asset["src"], "alt": "Party"})
    assert item.status_code == 201, item.text
    client.put(f"{INV}/{iid}/sections/gallery", json={"enabled": True})
    publish(client, iid)
    return iid, {**asset, "item": item.json()["id"]}


def test_image_deleted_while_live_is_removed_once_the_live_page_stops_using_it(
    auth_client: TestClient, media_root: Path, db: Session
) -> None:
    iid, asset = _published_with_photo(auth_client)
    file = media_root / asset["src"].removeprefix("/media/")
    auth_client.delete(f"{INV}/{iid}/gallery/{asset['item']}")
    assert auth_client.delete(f"{INV}/{iid}/assets/{asset['id']}").status_code == 204
    # Guests still see the published page, so the file stays for now (tombstoned row).
    assert file.exists() and auth_client.get(asset["src"]).status_code == 200
    row = db.scalar(select(InvitationAsset).where(InvitationAsset.filename == file.name))
    assert row is not None and row.deleted_at is not None
    # Deleting it again is a 404: it is gone for the owner.
    assert auth_client.delete(f"{INV}/{iid}/assets/{asset['id']}").status_code == 404
    # Unpublish: nothing live uses it any more, so file and row are removed.
    assert auth_client.post(f"{INV}/{iid}/unpublish").status_code == 200
    assert not file.exists() and auth_client.get(asset["src"]).status_code == 404
    db.expire_all()
    assert db.scalar(select(InvitationAsset).where(InvitationAsset.filename == file.name)) is None


def test_republishing_without_the_image_removes_it(auth_client: TestClient, media_root: Path) -> None:
    iid, asset = _published_with_photo(auth_client)
    file = media_root / asset["src"].removeprefix("/media/")
    auth_client.delete(f"{INV}/{iid}/gallery/{asset['item']}")
    auth_client.put(f"{INV}/{iid}/sections/gallery", json={"enabled": False})
    auth_client.delete(f"{INV}/{iid}/assets/{asset['id']}")
    assert file.exists()
    publish(auth_client, iid)
    assert not file.exists()


def test_deleting_the_invitation_removes_tombstoned_files(auth_client: TestClient, media_root: Path) -> None:
    iid, asset = _published_with_photo(auth_client)
    file = media_root / asset["src"].removeprefix("/media/")
    auth_client.delete(f"{INV}/{iid}/assets/{asset['id']}")
    assert file.exists()
    assert auth_client.delete(f"{INV}/{iid}").status_code == 204
    assert not file.exists() and auth_client.get(asset["src"]).status_code == 404


def test_a_deleted_image_cannot_be_published_again(auth_client: TestClient, media_root: Path) -> None:
    iid, asset = _published_with_photo(auth_client)
    auth_client.delete(f"{INV}/{iid}/assets/{asset['id']}")  # still in the gallery draft
    assert ("gallery", "gallery", "foreign_image") in blocked(auth_client.post(f"{INV}/{iid}/publish"))


def test_another_accounts_upload_cannot_be_published(auth_client: TestClient, client: TestClient, media_root: Path) -> None:
    _, theirs = _published_with_photo(auth_client)
    # A second account.
    client.cookies.clear()
    assert client.post("/api/v1/auth/register", json={
        "email": "other-media@example.com", "password": "other-pass-1234", "full_name": "Other",
    }).status_code == 201
    mine = create_invitation(client, "birthday", themeId="temuvibe-elegant")["id"]
    make_publishable(client, mine)
    assert client.post(f"{INV}/{mine}/gallery", json={"src": theirs["src"], "alt": "Not mine"}).status_code == 201
    client.put(f"{INV}/{mine}/sections/gallery", json={"enabled": True})
    issues = blocked(client.post(f"{INV}/{mine}/publish"))
    assert ("gallery", "gallery", "foreign_image") in issues
    check = client.get(f"{INV}/{mine}/publish-check").json()
    assert any(i["code"] == "foreign_image" for i in check["issues"])
    # Their own upload publishes fine.
    own = upload(client, mine, png_bytes(color=(1, 2, 3))).json()
    gallery = client.get(f"{INV}/{mine}/gallery").json()
    client.put(f"{INV}/{mine}/gallery/{gallery[0]['id']}", json={"src": own["src"], "alt": "Mine"})
    assert client.post(f"{INV}/{mine}/publish").status_code == 200

"""Migration 0008: an existing (v1.2) wedding is backfilled and keeps reading/publishing
identically; the downgrade restores the old schema and refuses multi-invitation owners."""

import json
import uuid
from typing import Any

import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from alembic import command
from tests.invitation_helpers import INV, PUBLIC_INV, create_invitation
from tests.wedding_helpers import API, PUBLIC

LEGACY_UNIVERSAL = {
    "contentVersion": "1.2",
    "countdown": {"enabled": False, "addToCalendar": True},
    "greeting": {"enabled": True, "title": "Salam", "message": "Halo"},
    "amplopDigital": {"enabled": False},
}
LEGACY_SNAPSHOT: dict[str, Any] = {
    "contentVersion": "1.2",
    "schemaVersion": 1,
    "locale": "id",
    "opening": {"weddingTitle": "Pernikahan Adi & Bunga", "weddingDate": "2099-01-02"},
    "couple": {"groom": {"name": "Adi Nugroho"}, "bride": {"name": "Bunga Citra", "nickname": "Bunga"}},
    "events": [{"id": "akad", "type": "akad", "title": "Akad", "date": "2099-01-02", "startTime": "08:00",
                "venueName": "Masjid Agung", "address": "Jl. Merdeka 1", "dressCode": {"enabled": True, "text": "Putih"}}],
    "closing": {"message": "Terima kasih"},
    "rsvp": {"enabled": True, "deadline": "2098-12-20", "maxGuestsPerResponse": 2},
    "greeting": {"enabled": True, "title": "Salam", "message": "Halo"},
    "countdown": {"enabled": False, "addToCalendar": True},
    "amplopDigital": {"enabled": False},
}
LEGACY_DRAFT: dict[str, Any] = {
    **LEGACY_UNIVERSAL,
    "schemaVersion": 1,
    "locale": "id",
    "opening": LEGACY_SNAPSHOT["opening"],
    "couple": LEGACY_SNAPSHOT["couple"],
    "story": {"enabled": False, "timeline": []},
    "events": LEGACY_SNAPSHOT["events"],
    "gallery": {"enabled": False, "images": []},
    "rsvp": LEGACY_SNAPSHOT["rsvp"],
    "closing": LEGACY_SNAPSHOT["closing"],
}


def _alembic(engine: Engine, action: str, target: str) -> None:
    cfg = Config("alembic.ini")
    with engine.begin() as conn:
        cfg.attributes["connection"] = conn
        getattr(command, action)(cfg, target)


def _insert_legacy_wedding(engine: Engine, owner_email: str) -> tuple[uuid.UUID, str]:
    wid, pid = uuid.uuid4(), uuid.uuid4()
    slug = "adi-bunga-abc123"

    with engine.begin() as conn:
        owner = conn.scalar(text("SELECT id FROM users WHERE email = :e"), {"e": owner_email})
        conn.execute(text(
            "INSERT INTO weddings (id, owner_id, theme_id, status, locale, revision, schema_version, "
            "universal_content, opening, couple, story_meta, gallery_meta, rsvp, closing) VALUES "
            "(:id, :owner, 'afterglow', 'draft', 'id', 5, 1, CAST(:u AS jsonb), CAST(:o AS jsonb), CAST(:c AS jsonb), "
            "'{\"enabled\": false}', '{\"enabled\": false}', CAST(:r AS jsonb), CAST(:cl AS jsonb))"
        ), {
            "id": wid, "owner": owner, "u": json.dumps(LEGACY_UNIVERSAL), "o": json.dumps(LEGACY_SNAPSHOT["opening"]),
            "c": json.dumps(LEGACY_SNAPSHOT["couple"]), "r": json.dumps(LEGACY_SNAPSHOT["rsvp"]),
            "cl": json.dumps(LEGACY_SNAPSHOT["closing"]),
        })
        conn.execute(text(
            "INSERT INTO wedding_events (id, wedding_id, public_id, position, type, title, date, start_time, "
            "venue_name, address, extras) VALUES (:id, :w, 'akad', 0, 'akad', 'Akad', '2099-01-02', '08:00', "
            "'Masjid Agung', 'Jl. Merdeka 1', '{\"dressCode\": {\"enabled\": true, \"text\": \"Putih\"}}')"
        ), {"id": uuid.uuid4(), "w": wid})
        conn.execute(text(
            "INSERT INTO wedding_publications (id, wedding_id, revision, theme_id, locale, content) "
            "VALUES (:id, :w, 5, 'afterglow', 'id', CAST(:content AS jsonb))"
        ), {"id": pid, "w": wid, "content": json.dumps(LEGACY_SNAPSHOT)})
        conn.execute(text(
            "UPDATE weddings SET status = 'published', slug = :s, published_publication_id = :p, "
            "published_at = now() WHERE id = :w"
        ), {"s": slug, "p": pid, "w": wid})
    return wid, slug


def test_existing_wedding_survives_and_publishes_identically(
    auth_client: TestClient, engine: Engine, db: Session
) -> None:
    db.rollback()
    db.close()
    _alembic(engine, "downgrade", "0007")
    try:
        wid, slug = _insert_legacy_wedding(engine, "couple-a@example.com")
    finally:
        _alembic(engine, "upgrade", "head")

    record = auth_client.get(f"{API}/me").json()
    assert record["id"] == str(wid)
    assert (record["category"], record["variant"], record["title"], record["timezone"]) == (
        "wedding", "wedding_ceremony", None, "Asia/Jakarta")
    assert (record["status"], record["slug"], record["revision"], record["hasUnpublishedChanges"]) == (
        "published", slug, 5, False)
    assert auth_client.get(f"{INV}/{wid}/content").json() == LEGACY_DRAFT
    assert auth_client.get(f"{API}/{wid}/content").json() == LEGACY_DRAFT

    # The live publication was backfilled and is served unchanged on both public paths.
    for path in (f"{PUBLIC_INV}/{slug}", f"{PUBLIC}/{slug}"):
        body = auth_client.get(path).json()
        assert (body["category"], body["variant"]) == ("wedding", "wedding_ceremony")
        assert body["content"] == LEGACY_SNAPSHOT

    # Republishing the untouched draft produces exactly the same snapshot.
    response = auth_client.post(f"{API}/{wid}/publish")
    assert response.status_code == 200, response.text
    assert response.json()["slug"] == slug
    assert auth_client.get(f"{PUBLIC_INV}/{slug}").json()["content"] == LEGACY_SNAPSHOT

    # The old wedding accepts RSVP replies and can be edited like any invitation.
    reply = auth_client.post(f"{PUBLIC_INV}/{slug}/rsvp", json={"name": "Tamu", "attendance": "attending", "partySize": 2})
    assert reply.status_code == 201, reply.text
    assert auth_client.put(f"{INV}/{wid}/sections/wishes", json={"enabled": True}).json() == {"enabled": True}
    assert auth_client.get(f"{INV}/{wid}/content").json()["contentVersion"] == "2.0"


def test_migrated_columns_and_constraints(auth_client: TestClient, engine: Engine) -> None:
    with engine.connect() as conn:
        tables = set(conn.scalars(text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")))
        assert {"invitations", "invitation_publications", "invitation_assets", "invitation_sessions",
                "invitation_story_entries", "invitation_gallery_images", "invitation_rsvp_responses"} <= tables
        assert not {t for t in tables if t.startswith("wedding")}
        names = set(conn.scalars(text(
            "SELECT conname FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid WHERE t.relname LIKE 'invitation%'"
        )))
        assert not {n for n in names if "wedding" in n}
        assert {"ck_invitations_category_variant", "ck_invitation_sessions_type",
                "fk_invitation_sessions_invitation_id_invitations"} <= names
        assert "uq_weddings_owner_id" not in names and "uq_invitations_owner_id" not in names
    # Two invitations per user are allowed now; a bad pair is refused by the database.
    create_invitation(auth_client, "birthday")
    create_invitation(auth_client, "birthday")
    with engine.connect() as conn, pytest.raises(Exception, match="ck_invitations_category_variant"):
        conn.execute(text("UPDATE invitations SET category = 'wedding' WHERE variant = 'birthday'"))


def test_downgrade_refuses_owners_of_several_invitations(auth_client: TestClient, engine: Engine, db: Session) -> None:
    create_invitation(auth_client, "birthday")
    create_invitation(auth_client, "seminar")
    db.rollback()
    db.close()
    with pytest.raises(RuntimeError, match="own more than one invitation"):
        _alembic(engine, "downgrade", "0007")
    with engine.connect() as conn:
        assert conn.scalar(text("SELECT version_num FROM alembic_version")) == "0009"  # head: nothing ran
    assert len(auth_client.get(INV).json()["items"]) == 2


def test_downgrade_refuses_non_wedding_invitations(auth_client: TestClient, engine: Engine, db: Session) -> None:
    create_invitation(auth_client, "seminar")
    db.rollback()
    db.close()
    with pytest.raises(RuntimeError, match="not weddings"):
        _alembic(engine, "downgrade", "0007")
    with engine.connect() as conn:
        assert conn.scalar(text("SELECT version_num FROM alembic_version")) == "0009"  # head: nothing ran
    assert auth_client.get(INV).json()["items"][0]["variant"] == "seminar"


def test_downgrade_round_trip_keeps_a_single_wedding(auth_client: TestClient, engine: Engine, db: Session) -> None:
    iid = create_invitation(auth_client, "wedding_reception", title="Resepsi")["id"]
    auth_client.post(f"{INV}/{iid}/events", json={"type": "dinner", "title": "Gala dinner"})
    db.rollback()
    db.close()
    _alembic(engine, "downgrade", "0007")
    try:
        with engine.connect() as conn:
            types = set(conn.scalars(text("SELECT type FROM wedding_events")))
            assert types == {"reception", "other"}  # dinner did not exist before 0008
            assert conn.scalar(text("SELECT count(*) FROM weddings")) == 1
    finally:
        _alembic(engine, "upgrade", "head")
    record = auth_client.get(f"{INV}/{iid}").json()
    # Documented losses: the variant falls back to the backfill default, the title is dropped.
    assert (record["category"], record["variant"], record["title"]) == ("wedding", "wedding_ceremony", None)

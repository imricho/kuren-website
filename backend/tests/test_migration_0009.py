"""Migration 0009: publications get the time zone guests were already seeing; the downgrade
keeps replies, and refuses while a multi-day session would violate the old time check."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from tests.invitation_helpers import INV, PUBLIC_INV, create_invitation, make_publishable, publish
from tests.test_migration_0008 import _alembic


def test_backfill_keeps_the_public_timezone_and_replies(auth_client: TestClient, engine: Engine, db: Session) -> None:
    iid = create_invitation(auth_client, "birthday", themeId="temuvibe-elegant", timezone="Asia/Jayapura")["id"]
    make_publishable(auth_client, iid)
    slug = publish(auth_client, iid)["slug"]
    reply = auth_client.post(f"{PUBLIC_INV}/{slug}/rsvp", json={"name": "Rina", "attendance": "attending"})
    assert reply.status_code == 201
    before = auth_client.get(f"{PUBLIC_INV}/{slug}").json()
    db.rollback()
    db.close()
    _alembic(engine, "downgrade", "0008")
    try:
        with engine.connect() as conn:
            assert conn.scalar(text("SELECT count(*) FROM invitation_rsvp_responses")) == 1  # replies kept
    finally:
        _alembic(engine, "upgrade", "head")
    with engine.connect() as conn:
        assert conn.scalar(text("SELECT timezone FROM invitation_publications")) == "Asia/Jayapura"
        assert conn.scalar(text("SELECT edit_token_hash FROM invitation_rsvp_responses")) is None
    after = auth_client.get(f"{PUBLIC_INV}/{slug}").json()
    assert after == before


def test_downgrade_refuses_multi_day_sessions_ending_earlier_in_the_day(
    auth_client: TestClient, engine: Engine, db: Session
) -> None:
    iid = create_invitation(auth_client, "workshop")["id"]
    event = auth_client.get(f"{INV}/{iid}/events").json()[0]
    assert auth_client.put(f"{INV}/{iid}/events/{event['id']}", json={
        "type": "workshop", "date": "2099-06-01", "endDate": "2099-06-03", "startTime": "16:00", "endTime": "12:00",
    }).status_code == 200
    db.rollback()
    db.close()
    with pytest.raises(RuntimeError, match="multi-day"):
        _alembic(engine, "downgrade", "0008")
    with engine.connect() as conn:
        assert conn.scalar(text("SELECT version_num FROM alembic_version")) == "0009"

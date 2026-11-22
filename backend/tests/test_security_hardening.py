"""Security review follow-ups: control characters, log hygiene, proxy/rate limits,
honeypot consistency, owner cache headers, fail-closed RSVP deadline."""

import logging
import os
import subprocess
import uuid
from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.models import InvitationPublication, InvitationRsvpResponse
from app.services import invitation_service
from tests.invitation_helpers import INV, PUBLIC_INV, create_invitation, error_code, make_publishable, publish, put

GUEST = {"name": "Rina", "attendance": "attending", "partySize": 1}


def _published(client: TestClient, variant: str = "birthday", rsvp: dict | None = None) -> dict[str, str]:
    iid = create_invitation(client, variant, themeId="temuvibe-elegant")["id"]
    make_publishable(client, iid)
    if rsvp is not None:
        put(client, f"{INV}/{iid}/sections/rsvp", {"enabled": True, **rsvp})
    return {"id": iid, "slug": publish(client, iid)["slug"]}


def _fields(response: Any) -> list[str]:
    assert error_code(response, 422) == "validation_error", response.text
    return [d["field"] for d in response.json()["error"]["details"]]


# --- M1: NUL / control characters are 422, never a database error -----------------------


@pytest.mark.parametrize(
    ("body", "field"),
    [
        ({**GUEST, "name": "Ri\x00na"}, "name"),
        ({**GUEST, "message": "hi\x00"}, "message"),
        ({**GUEST, "guestLabel": "\x00"}, "guestLabel"),
        ({**GUEST, "answers": {"company": "AC\x00ME"}}, "answers"),
        ({**GUEST, "answers": {"comp\x00any": "ACME"}}, "answers"),
        ({**GUEST, "email": "a\x00@example.com"}, "email"),
        ({**GUEST, "name": "Ri\x85na"}, "name"),  # C1 control
        ({**GUEST, "website": "\x00"}, "website"),
    ],
)
def test_control_characters_in_rsvp_are_rejected(auth_client: TestClient, body: dict, field: str) -> None:
    inv = _published(auth_client, "seminar")
    assert _fields(auth_client.post(f"{PUBLIC_INV}/{inv['slug']}/rsvp", json=body)) == [field]


def test_control_characters_in_owner_content_are_rejected(auth_client: TestClient) -> None:
    iid = create_invitation(auth_client, "birthday")["id"]
    base = f"{INV}/{iid}"
    cases = [
        ("PUT", f"{base}/sections/opening", {"weddingTitle": "A\x00"}, "weddingTitle"),
        ("PUT", f"{base}/sections/closing", {"message": "bell\x07"}, "message"),
        ("PUT", f"{base}/sections/profiles", {"people": [{"role": "celebrant", "name": "\x00"}]}, "people"),
        ("POST", f"{base}/events", {"title": "x\x1b[31m"}, "title"),
        ("PATCH", base, {"title": "t\x00"}, "title"),
        ("PUT", f"{base}/content", {"opening": {"headline": "\x00"}, "events": [], "closing": {},
                                    "gallery": {"images": []}, "rsvp": {}}, "opening"),
    ]
    for method, path, body, field in cases:
        assert _fields(auth_client.request(method, path, json=body)) == [field], path
    # Line breaks and tabs in owner text are fine.
    assert put(auth_client, f"{base}/sections/closing", {"message": "Line 1\nLine 2\tend"})["message"] == "Line 1\nLine 2\tend"


def test_control_characters_in_account_names_are_rejected(client: TestClient) -> None:
    body = {"email": "nul@example.com", "password": "correct-horse-1", "full_name": "Nu\x00l"}
    assert client.post("/api/v1/auth/register", json=body).status_code == 422


def test_unhandled_db_errors_log_no_bind_parameters(
    auth_client: TestClient, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    marker = "guest-pii-7f3a@example.com"

    def failing_update(db: Session, invitation: Any, changes: Any) -> Any:
        db.execute(text("SELECT CAST(:v AS integer)"), {"v": marker})  # DataError with a bind parameter

    iid = create_invitation(auth_client, "birthday")["id"]
    monkeypatch.setattr(invitation_service, "update_invitation", failing_update)
    caplog.set_level(logging.DEBUG)
    # The shared client re-raises server exceptions: getting a response proves the error is
    # handled without propagating (no second traceback from the server).
    response = auth_client.patch(f"{INV}/{iid}", json={"title": "x"})
    assert error_code(response, 500) == "internal_error"
    assert marker not in response.text
    assert marker not in caplog.text
    assert any("Unhandled DataError" in r.getMessage() and f"/invitations/{iid}" in r.getMessage()
               for r in caplog.records)
    assert all(r.exc_info is None for r in caplog.records if "Unhandled" in r.getMessage())


def test_sqlalchemy_errors_hide_parameters(db: Session) -> None:
    """The engine never appends bind parameters to error messages. (Postgres may still quote
    an offending value in its own error text, which is why the 500 handler logs the type only.)"""
    from app.db.session import engine

    assert engine.hide_parameters is True
    with pytest.raises(Exception) as caught:
        db.execute(text("SELECT CAST(:a AS integer), CAST(:b AS text)"), {"a": "1x", "b": "never-in-message"})
    db.rollback()
    assert "never-in-message" not in str(caught.value)
    assert "[SQL parameters hidden due to hide_parameters=True]" in str(caught.value)


# --- L1: guest text hygiene -----------------------------------------------------------


def test_guest_text_is_normalised_and_invisible_characters_stripped(auth_client: TestClient, db: Session) -> None:
    inv = _published(auth_client)
    body = {**GUEST, "name": "‮Réna​⁦", "guestLabel": "Bpk.‍ Andi",
            "message": "Baris 1\nBaris 2‬"}
    assert auth_client.post(f"{PUBLIC_INV}/{inv['slug']}/rsvp", json=body).status_code == 201
    row = db.scalar(select(InvitationRsvpResponse))
    assert (row.name, row.guest_label, row.message) == ("Réna", "Bpk. Andi", "Baris 1\nBaris 2")


@pytest.mark.parametrize(
    ("body", "field"),
    [
        ({**GUEST, "name": "Rina\nFake line"}, "name"),
        ({**GUEST, "name": "Rina\tTab"}, "name"),
        ({**GUEST, "guestLabel": "a\nb"}, "guestLabel"),
        ({**GUEST, "message": "tab\there"}, "message"),
        ({**GUEST, "name": "​‮"}, "name"),  # nothing left after stripping
    ],
)
def test_guest_text_rejects_controls(auth_client: TestClient, body: dict, field: str) -> None:
    inv = _published(auth_client)
    assert _fields(auth_client.post(f"{PUBLIC_INV}/{inv['slug']}/rsvp", json=body)) == [field]


def test_guest_answers_are_cleaned(auth_client: TestClient, db: Session) -> None:
    inv = _published(auth_client, "seminar", rsvp={"registrationFields": [
        {"id": "company", "label": "Company", "type": "text"}, {"id": "notes", "label": "Notes", "type": "textarea"}]})
    body = {**GUEST, "answers": {"company": "‮ACME‏", "notes": "a\nb"}}
    assert auth_client.post(f"{PUBLIC_INV}/{inv['slug']}/rsvp", json=body).status_code == 201
    assert db.scalar(select(InvitationRsvpResponse.answers)) == {"company": "ACME", "notes": "a\nb"}


# --- M2: proxies and rate limits --------------------------------------------------------


def test_wildcard_forwarded_allow_ips_is_refused() -> None:
    with pytest.raises(ValidationError):
        Settings(forwarded_allow_ips="*")  # type: ignore[call-arg]
    assert get_settings().forwarded_allow_ips != "*"


def test_production_requires_secure_session_cookies() -> None:
    with pytest.raises(ValidationError, match="SESSION_COOKIE_SECURE"):
        Settings(environment="production", session_cookie_secure=False)  # type: ignore[call-arg]
    assert Settings(environment="production", session_cookie_secure=True).session_cookie_secure  # type: ignore[call-arg]
    assert not Settings(environment="development", session_cookie_secure=False).session_cookie_secure  # type: ignore[call-arg]


@pytest.mark.parametrize(("value", "code"), [("*", 1), ("10.0.0.0/8,*", 1), ("172.18.0.0/16", 0)])
def test_entrypoint_refuses_wildcard_proxy_trust(value: str, code: int) -> None:
    env = {**os.environ, "FORWARDED_ALLOW_IPS": value, "RUN_MIGRATIONS": "false"}
    result = subprocess.run(["sh", "entrypoint.sh", "true"], env=env, capture_output=True, text=True, timeout=10)
    assert result.returncode == code, result.stderr


def test_rsvp_per_slug_bucket(auth_client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "rsvp_slug_rate_limit_per_minute", 3)
    assert get_settings().model_fields["rsvp_slug_rate_limit_per_minute"].default == 60
    first, second = _published(auth_client), _published(auth_client)
    for _ in range(3):
        assert auth_client.post(f"{PUBLIC_INV}/{first['slug']}/rsvp", json=GUEST).status_code == 201
    response = auth_client.post(f"{PUBLIC_INV}/{first['slug']}/rsvp", json=GUEST)
    assert error_code(response, 429) == "too_many_requests"
    assert auth_client.post(f"{PUBLIC_INV}/{second['slug']}/rsvp", json=GUEST).status_code == 201


def test_rate_limits_use_the_forwarded_client_address_from_trusted_proxies() -> None:
    """uvicorn's ProxyHeadersMiddleware (enabled with --proxy-headers) rewrites `client`
    only for trusted peers; this is what our limiter keys on."""
    import asyncio

    from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

    seen: list[Any] = []

    async def app(scope: Any, receive: Any, send: Any) -> None:
        seen.append(scope["client"][0])

    async def run(peer: str) -> None:
        scope = {"type": "http", "client": (peer, 1234), "scheme": "http",
                 "headers": [(b"x-forwarded-for", b"203.0.113.9")]}
        await ProxyHeadersMiddleware(app, trusted_hosts="127.0.0.1")(scope, None, None)  # type: ignore[arg-type]

    asyncio.run(run("127.0.0.1"))
    asyncio.run(run("198.51.100.7"))
    assert seen == ["203.0.113.9", "198.51.100.7"]  # spoofed header from an untrusted peer is ignored


# --- L2: honeypot answers like a real submission ---------------------------------------


def test_honeypot_on_unknown_or_closed_invitation_answers_consistently(auth_client: TestClient, db: Session) -> None:
    bot = {**GUEST, "website": "http://spam.example"}
    assert error_code(auth_client.post(f"{PUBLIC_INV}/nobody-abc123/rsvp", json=bot), 404) == "not_found"
    closed = _published(auth_client, "wedding_ceremony")  # RSVP off
    assert error_code(auth_client.post(f"{PUBLIC_INV}/{closed['slug']}/rsvp", json=bot), 422) == "rsvp_closed"
    limited = _published(auth_client, rsvp={"maxGuestsPerResponse": 1})
    assert _fields(auth_client.post(f"{PUBLIC_INV}/{limited['slug']}/rsvp", json={**bot, "partySize": 2})) == ["partySize"]
    assert auth_client.post(f"{PUBLIC_INV}/{limited['slug']}/rsvp", json=bot).status_code == 201
    assert db.scalar(select(InvitationRsvpResponse.id)) is None


# --- L4: owner responses are never cached ----------------------------------------------


def test_owner_routes_are_no_store_and_vary_on_cookie(auth_client: TestClient, client: TestClient) -> None:
    iid = create_invitation(auth_client, "birthday")["id"]
    responses = [
        auth_client.get(INV), auth_client.get(f"{INV}/{iid}"), auth_client.get(f"{INV}/{iid}/content"),
        auth_client.get(f"{INV}/{uuid.uuid4()}"),  # 404 too
        auth_client.get(f"{INV}/{iid}/rsvp-responses"), auth_client.get(f"{INV}/{iid}/rsvp-responses.csv"),
        auth_client.get("/api/v1/users/me"), auth_client.get("/api/v1/weddings/me"),
        auth_client.put(f"{INV}/{iid}/sections/closing", json={"message": "x"}),
    ]
    for response in responses:
        assert response.headers["cache-control"] == "no-store", response.request.url
        assert "Cookie" in response.headers["vary"], response.request.url
    client.cookies.clear()
    unauthenticated = client.get(INV)
    assert unauthenticated.status_code == 401 and unauthenticated.headers["cache-control"] == "no-store"
    # Public routes keep their own policy.
    assert client.get("/api/v1/invitation-types").headers["cache-control"] == "public, max-age=300"
    assert client.get("/api/v1/health").headers.get("cache-control") != "no-store"


# --- Info: an unreadable stored deadline fails closed -----------------------------------


def test_invalid_stored_deadline_fails_closed(auth_client: TestClient, db: Session) -> None:
    inv = _published(auth_client)
    publication = db.scalar(select(InvitationPublication))
    publication.content = {**publication.content, "rsvp": {**publication.content["rsvp"], "deadline": "soon"}}
    db.commit()
    response = auth_client.post(f"{PUBLIC_INV}/{inv['slug']}/rsvp", json=GUEST)
    assert error_code(response, 422) == "rsvp_closed"

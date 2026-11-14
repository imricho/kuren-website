from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_session_token
from app.models import User, UserSession

COOKIE = get_settings().session_cookie_name


# --- Registration -------------------------------------------------------------


def test_register_creates_user_and_signs_in(client: TestClient, db: Session) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "Noah@Example.com", "password": "s3cure-pass", "full_name": "  Noah   Reyes "},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "noah@example.com"
    assert body["full_name"] == "Noah Reyes"
    assert "password" not in body and "password_hash" not in body

    set_cookie = response.headers["set-cookie"].lower()
    assert COOKIE in set_cookie and "httponly" in set_cookie and "samesite=lax" in set_cookie

    user = db.scalar(select(User).where(User.email == "noah@example.com"))
    assert user is not None
    assert user.password_hash.startswith("$argon2id$")
    assert "s3cure-pass" not in user.password_hash


def test_register_duplicate_email_is_case_insensitive(client: TestClient, registered_user) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "AMELIA@example.com", "password": "another-pass", "full_name": "Other"},
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "conflict"


def test_register_validation_errors(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "not-an-email", "password": "short", "full_name": "   "},
    )
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    fields = {d["field"] for d in error["details"]}
    assert {"email", "password", "full_name"} <= fields
    assert "short" not in response.text  # submitted values are not echoed back


def test_register_rejects_unknown_fields(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "a@example.com", "password": "long-enough", "full_name": "A", "is_active": False},
    )
    assert response.status_code == 422


# --- Login / logout -----------------------------------------------------------


def test_login_success_sets_session(client: TestClient, registered_user, db: Session) -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "amelia@example.com", "password": registered_user["password"]},
    )
    assert response.status_code == 200
    assert response.json()["email"] == "amelia@example.com"
    assert client.cookies.get(COOKIE)

    stored = db.scalars(select(UserSession)).all()
    # Raw token is never stored, only its hash.
    assert all(s.token_hash != client.cookies.get(COOKIE) for s in stored)


def test_login_wrong_password_and_unknown_email_look_identical(client: TestClient, registered_user) -> None:
    wrong_pw = client.post("/api/v1/auth/login", json={"email": "amelia@example.com", "password": "nope-nope"})
    unknown = client.post("/api/v1/auth/login", json={"email": "ghost@example.com", "password": "nope-nope"})
    assert wrong_pw.status_code == unknown.status_code == 401
    assert wrong_pw.json() == unknown.json()
    assert COOKIE not in client.cookies


def test_logout_revokes_session(client: TestClient, registered_user, db: Session) -> None:
    client.post("/api/v1/auth/login", json={"email": "amelia@example.com", "password": registered_user["password"]})
    token = client.cookies.get(COOKIE)
    assert client.get("/api/v1/users/me").status_code == 200

    response = client.post("/api/v1/auth/logout")
    assert response.status_code == 204
    assert db.scalar(select(UserSession).where(UserSession.token_hash == hash_session_token(token))) is None

    # Even replaying the old cookie must now fail.
    client.cookies.set(COOKIE, token)
    assert client.get("/api/v1/users/me").status_code == 401


def test_logout_without_session_is_idempotent(client: TestClient) -> None:
    assert client.post("/api/v1/auth/logout").status_code == 204


# --- CSRF origin check --------------------------------------------------------


def test_cross_origin_post_is_rejected(client: TestClient, registered_user) -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "amelia@example.com", "password": registered_user["password"]},
        headers={"Origin": "https://evil.example"},
    )
    assert response.status_code == 403


def test_allowed_origin_post_is_accepted(client: TestClient, registered_user) -> None:
    allowed = get_settings().cors_origins[0]
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "amelia@example.com", "password": registered_user["password"]},
        headers={"Origin": allowed},
    )
    assert response.status_code == 200

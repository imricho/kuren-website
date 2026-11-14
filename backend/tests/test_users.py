from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_session_token
from app.models import User, UserSession


def _login(client: TestClient, user: dict[str, str]) -> None:
    response = client.post("/api/v1/auth/login", json={"email": user["email"], "password": user["password"]})
    assert response.status_code == 200


def test_me_requires_authentication(client: TestClient) -> None:
    response = client.get("/api/v1/users/me")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "not_authenticated"


def test_me_rejects_forged_token(client: TestClient) -> None:
    client.cookies.set("wp_session", "forged-token")
    assert client.get("/api/v1/users/me").status_code == 401


def test_me_returns_profile(client: TestClient, registered_user) -> None:
    _login(client, registered_user)
    response = client.get("/api/v1/users/me")
    assert response.status_code == 200
    assert response.json()["full_name"] == "Amelia Hart"


def test_update_me(client: TestClient, registered_user) -> None:
    _login(client, registered_user)
    response = client.patch("/api/v1/users/me", json={"full_name": "Amelia Hart-Reyes"})
    assert response.status_code == 200
    assert response.json()["full_name"] == "Amelia Hart-Reyes"


def test_update_me_cannot_change_protected_fields(client: TestClient, registered_user) -> None:
    _login(client, registered_user)
    assert client.patch("/api/v1/users/me", json={"email": "x@example.com"}).status_code == 422


def test_expired_session_is_rejected_and_removed(client: TestClient, registered_user, db: Session) -> None:
    _login(client, registered_user)
    token = client.cookies.get(get_settings().session_cookie_name)
    db.execute(update(UserSession).values(expires_at=datetime.now(UTC) - timedelta(seconds=1)))
    db.commit()
    assert client.get("/api/v1/users/me").status_code == 401
    assert db.scalar(select(UserSession).where(UserSession.token_hash == hash_session_token(token))) is None


def test_deactivated_user_is_rejected(client: TestClient, registered_user, db: Session) -> None:
    _login(client, registered_user)
    db.execute(update(User).values(is_active=False))
    db.commit()
    assert client.get("/api/v1/users/me").status_code == 401

from fastapi.testclient import TestClient

from app.db import session as db_session
from app.main import app


def test_health_ok(client: TestClient) -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_health_reports_database_outage(client: TestClient, monkeypatch) -> None:
    monkeypatch.setattr("app.api.v1.routes.health.check_database", lambda _db: False)
    response = client.get("/api/v1/health")
    assert response.status_code == 503
    assert response.json() == {"status": "degraded", "database": "unavailable"}


def test_unknown_route_uses_error_shape(client: TestClient) -> None:
    response = client.get("/api/v1/does-not-exist")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_unhandled_errors_do_not_leak_details(db, monkeypatch) -> None:
    def boom(_db):
        raise RuntimeError("secret internal detail")

    monkeypatch.setattr("app.api.v1.routes.health.check_database", boom)
    app.dependency_overrides[db_session.get_db] = lambda: db
    try:
        with TestClient(app, raise_server_exceptions=False) as c:
            response = c.get("/api/v1/health")
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 500
    assert "secret" not in response.text
    assert response.json()["error"]["code"] == "internal_error"

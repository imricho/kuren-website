"""Test fixtures.

Tests run against a dedicated PostgreSQL database (`<POSTGRES_DB>_test` by
default) that is created automatically, migrated with Alembic (so migrations
are exercised too), and truncated between tests.
"""

from collections.abc import Iterator

import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from alembic import command
from app.core.config import get_settings
from app.db.base import Base
from app.db.session import get_db
from app.main import app

settings = get_settings()


def _ensure_database_exists() -> None:
    url = settings.test_database_url
    admin = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        exists = conn.scalar(text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": url.database})
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{url.database}"'))
    admin.dispose()


@pytest.fixture(scope="session")
def engine() -> Iterator[Engine]:
    _ensure_database_exists()
    test_engine = create_engine(settings.test_database_url)
    alembic_cfg = Config("alembic.ini")
    with test_engine.begin() as conn:
        alembic_cfg.attributes["connection"] = conn
        command.downgrade(alembic_cfg, "base")
        command.upgrade(alembic_cfg, "head")
    yield test_engine
    test_engine.dispose()


@pytest.fixture
def db(engine: Engine) -> Iterator[Session]:
    session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)()
    try:
        yield session
    finally:
        session.close()
        tables = ", ".join(t.name for t in reversed(Base.metadata.sorted_tables))
        with engine.begin() as conn:
            conn.execute(text(f"TRUNCATE {tables} CASCADE"))


@pytest.fixture
def client(db: Session) -> Iterator[TestClient]:
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app, base_url="http://testserver") as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def registered_user(client: TestClient) -> dict[str, str]:
    payload = {"email": "Amelia@Example.com", "password": "correct-horse-1", "full_name": "Amelia Hart"}
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201, response.text
    client.cookies.clear()  # start each test logged out
    return payload

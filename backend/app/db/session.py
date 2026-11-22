from collections.abc import Iterator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

#: Bind parameters can hold guest PII (RSVP names, contacts): never put them in
#: exception messages, logs or tracebacks.
ENGINE_OPTIONS = {"hide_parameters": True}

engine = create_engine(
    get_settings().database_url,
    pool_pre_ping=True,  # transparently replace connections dropped by Postgres
    pool_size=5,
    max_overflow=10,
    **ENGINE_OPTIONS,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """FastAPI dependency yielding a request-scoped database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_database(db: Session) -> bool:
    try:
        db.execute(text("SELECT 1"))
        return True
    except Exception:
        return False

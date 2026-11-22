"""Fixed-window rate limiters for the public endpoints.

Two stores, chosen by RATE_LIMIT_BACKEND:
- `memory` (default for development and tests): PER PROCESS. Each worker keeps its own
  counters, so N workers allow up to N x the limit, and counters reset on restart.
- `database` (REQUIRED in production, see config.py): counters live in the
  `rate_limit_hits` table, shared by every worker and replica. One upsert per request;
  keys are hashed (client addresses are never stored) and old windows are pruned.

Keyed by the client address. uvicorn runs with `--proxy-headers`, so behind a trusted
proxy (FORWARDED_ALLOW_IPS) that is the address from X-Forwarded-For; otherwise the socket peer.
"""

import hashlib
import random
import threading
import time
from typing import Any

from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert

_MAX_KEYS = 50_000


class FixedWindowRateLimiter:
    def __init__(self, window_seconds: float = 60.0) -> None:
        self.window_seconds = window_seconds
        self._lock = threading.Lock()
        self._counts: dict[str, tuple[int, int]] = {}  # key -> (window index, count)

    def hit(self, key: str, limit: int) -> bool:
        """Count one request; False when `key` is over `limit` in the current window."""
        window = int(time.monotonic() // self.window_seconds)
        with self._lock:
            if len(self._counts) >= _MAX_KEYS:
                # Drop stale windows; if still full, start over rather than grow unbounded.
                self._counts = {k: v for k, v in self._counts.items() if v[0] == window}
                if len(self._counts) >= _MAX_KEYS:
                    self._counts.clear()
            seen_window, count = self._counts.get(key, (window, 0))
            if seen_window != window:
                count = 0
            count += 1
            self._counts[key] = (window, count)
            return count <= limit

    def reset(self) -> None:
        with self._lock:
            self._counts.clear()


class DatabaseRateLimiter:
    """Shared fixed-window counters in Postgres (works across workers and replicas)."""

    def __init__(self, name: str, window_seconds: int = 60, session_factory: Any = None) -> None:
        self.name = name
        self.window_seconds = window_seconds
        self.session_factory = session_factory

    def _session(self) -> Any:
        if self.session_factory is not None:
            return self.session_factory()
        from app.db.session import SessionLocal  # late import: avoids an import cycle

        return SessionLocal()

    def hit(self, key: str, limit: int) -> bool:
        from app.models.rate_limit import RateLimitHit

        window = int(time.time() // self.window_seconds)
        bucket = f"{self.name}:{hashlib.sha256(key.encode('utf-8')).hexdigest()[:64]}"[:80]
        stmt = (
            insert(RateLimitHit)
            .values(bucket=bucket, window_start=window, count=1)
            .on_conflict_do_update(
                index_elements=["bucket", "window_start"], set_={"count": RateLimitHit.count + 1}
            )
            .returning(RateLimitHit.count)
        )
        with self._session() as db:
            count = int(db.scalar(stmt) or 0)
            if random.random() < 0.01:  # occasional pruning keeps the table small
                db.execute(delete(RateLimitHit).where(RateLimitHit.window_start < window - 5))
            db.commit()
        return count <= limit

    def reset(self) -> None:
        from app.models.rate_limit import RateLimitHit

        with self._session() as db:
            db.execute(delete(RateLimitHit).where(RateLimitHit.bucket.startswith(f"{self.name}:")))
            db.commit()


class RateLimiter:
    """Delegates to the store selected by RATE_LIMIT_BACKEND (read on each call)."""

    def __init__(self, name: str) -> None:
        self.memory = FixedWindowRateLimiter()
        self.database = DatabaseRateLimiter(name)

    def _store(self) -> FixedWindowRateLimiter | DatabaseRateLimiter:
        from app.core.config import get_settings

        return self.database if get_settings().rate_limit_backend == "database" else self.memory

    def hit(self, key: str, limit: int) -> bool:
        return self._store().hit(key, limit)

    def reset(self) -> None:
        self.memory.reset()
        from app.core.config import get_settings

        if get_settings().rate_limit_backend == "database":
            self.database.reset()


#: GET /public/... (invitation pages).
public_limiter = RateLimiter("public")
#: POST /public/invitations/{slug}/rsvp (and the guest's own reply): a stricter bucket per client IP ...
rsvp_limiter = RateLimiter("rsvp")
#: ... and one per invitation slug (all clients together).
rsvp_slug_limiter = RateLimiter("rsvp_slug")

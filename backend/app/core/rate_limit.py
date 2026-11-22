"""A tiny fixed-window, in-memory rate limiter.

PER PROCESS: each worker keeps its own counters, so N workers allow up to N x the
limit, and counters reset on restart. Good enough to blunt scraping of public
invitations and RSVP spam in a single-node deployment; use a shared store (e.g. Redis) or the
reverse proxy's limiter when scaling out.

Keyed by the client address. uvicorn runs with `--proxy-headers`, so behind a trusted
proxy (FORWARDED_ALLOW_IPS) that is the address from X-Forwarded-For; otherwise the socket peer.
"""

import threading
import time

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


#: GET /public/... (invitation pages).
public_limiter = FixedWindowRateLimiter()
#: POST /public/invitations/{slug}/rsvp: a separate, stricter bucket per client IP ...
rsvp_limiter = FixedWindowRateLimiter()
#: ... and one per invitation slug (all clients together).
rsvp_slug_limiter = FixedWindowRateLimiter()

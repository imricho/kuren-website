"""`Cache-Control: no-store` + `Vary: Cookie` on every owner (session-authenticated) API response.

Owner responses (drafts, RSVP replies with guest PII, account data) must never be stored by a
browser or shared cache, error responses included. Applied by path, as pure ASGI middleware,
so it also covers responses returned directly and errors raised before a handler runs.
Guest-facing routes (`/public/...`), the public registry and health check keep their own policy.
"""

from collections.abc import Sequence

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send


class OwnerNoStoreMiddleware:
    def __init__(self, app: ASGIApp, *, prefix: str, public_paths: Sequence[str]) -> None:
        self.app = app
        self.prefix = prefix
        self.public_paths = tuple(prefix + p for p in public_paths)

    def _applies(self, path: str) -> bool:
        return path.startswith(self.prefix + "/") and not path.startswith(self.public_paths)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or not self._applies(scope.get("path", "")):
            await self.app(scope, receive, send)
            return

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers["Cache-Control"] = "no-store"
                vary = headers.get("Vary")
                if vary is None:
                    headers["Vary"] = "Cookie"
                elif "cookie" not in vary.lower():
                    headers["Vary"] = f"{vary}, Cookie"
            await send(message)

        await self.app(scope, receive, send_with_headers)

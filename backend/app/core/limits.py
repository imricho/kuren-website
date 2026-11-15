"""Request body size limit (pure ASGI middleware).

Rejects a declared `Content-Length` above the limit before the app runs, and
counts the bytes of chunked/streamed bodies as they arrive, aborting with 413
as soon as the limit is crossed. Either way the body is never fully buffered
or parsed.
"""

from fastapi import HTTPException, status
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

_MESSAGE = "The request body is too large."


def _too_large_response() -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
        content={"error": {"code": "payload_too_large", "message": _MESSAGE}},
    )


class BodySizeLimitMiddleware:
    def __init__(self, app: ASGIApp, *, max_body_bytes: int) -> None:
        self.app = app
        self.max_body_bytes = max_body_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        limit = self.max_body_bytes
        for name, value in scope["headers"]:
            if name == b"content-length":
                try:
                    declared = int(value)
                except ValueError:
                    declared = limit + 1  # malformed length: refuse rather than guess
                if declared > limit:
                    await _too_large_response()(scope, receive, send)
                    return

        received = 0

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
                    # Raised inside the app's body read; FastAPI re-raises HTTPException
                    # and the app's handler renders the standard error shape (413).
                    raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, _MESSAGE)
            return message

        await self.app(scope, limited_receive, send)

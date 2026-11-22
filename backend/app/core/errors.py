"""Consistent, security-conscious API error handling.

Every error response has the shape:
    {"error": {"code": "<machine_code>", "message": "<human message>", "details": ...}}

Unexpected exceptions are logged server-side (type and path only) and returned as a
generic 500, so stack traces, internals and request data never leak to clients or logs.
"""

import logging
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send

logger = logging.getLogger(__name__)


class AppError(Exception):
    """Base class for expected, client-facing errors raised by services."""

    status_code: int = status.HTTP_400_BAD_REQUEST
    code: str = "bad_request"
    message: str = "The request could not be processed."

    def __init__(self, message: str | None = None, *, details: Any = None) -> None:
        self.message = message or self.message
        self.details = details
        super().__init__(self.message)


class NotAuthenticatedError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "not_authenticated"
    message = "Authentication required."


class InvalidCredentialsError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "invalid_credentials"
    message = "Invalid email or password."


class PermissionDeniedError(AppError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "permission_denied"
    message = "You do not have permission to perform this action."


class ConflictError(AppError):
    status_code = status.HTTP_409_CONFLICT
    code = "conflict"
    message = "The resource already exists."


class NotFoundError(AppError):
    """Missing resource, or one owned by someone else (never 403, to hide ids)."""

    status_code = status.HTTP_404_NOT_FOUND
    code = "not_found"
    message = "The requested resource was not found."


class LimitReachedError(ConflictError):
    code = "limit_reached"
    message = "The maximum number of items has been reached."


class EditConflictError(ConflictError):
    """The client edited an older revision of the content (If-Match mismatch)."""

    code = "edit_conflict"
    message = "This invitation was changed somewhere else. Reload to see the latest version."

    def __init__(self, *, current_revision: int) -> None:
        super().__init__(details={"currentRevision": current_revision})


class PublishBlockedError(AppError):
    """Publishing refused: `details` = [{"section", "field", "code", "message"}]."""

    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    code = "publish_blocked"
    message = "Some required content is missing. Complete it before publishing."

    def __init__(self, issues: list[dict[str, str]]) -> None:
        super().__init__(details=issues)


class SectionNotAvailableError(AppError):
    """The invitation's variant does not offer this section."""

    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    code = "section_not_available"
    message = "This section is not available for this type of invitation."

    def __init__(self, section: str) -> None:
        super().__init__(details={"section": section})


class TemplateIncompatibleError(AppError):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    code = "template_incompatible"
    message = "This template does not support this type of invitation. Choose another template."

    def __init__(self) -> None:
        super().__init__(details=[{"field": "themeId", "message": self.message}])


class RsvpClosedError(AppError):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    code = "rsvp_closed"
    message = "RSVP is closed for this invitation."


class RsvpLinkInvalidError(AppError):
    """Unknown, malformed or revoked RSVP edit link (also for replies made before edit links)."""

    status_code = status.HTTP_404_NOT_FOUND
    code = "rsvp_link_invalid"
    message = "This RSVP link is not valid. Ask the host, or send a new reply."


class CapacityReachedError(ConflictError):
    code = "capacity_reached"
    message = "Sorry, this event is fully booked."


class UnsupportedImageError(AppError):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    code = "unsupported_image"
    message = "Upload a JPEG, PNG or WebP image."


class PayloadTooLargeError(AppError):
    status_code = status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
    code = "payload_too_large"
    message = "The request body is too large."


class RateLimitedError(AppError):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    code = "too_many_requests"
    message = "Too many requests. Please try again shortly."


class BadRequestError(AppError):
    code = "bad_request"
    message = "The request could not be understood."


class ValidationFailedError(AppError):
    """Service-level validation failure, shaped like request validation errors.

    `details` is a list of `{"field": "<camelCase path>", "message": "..."}`.
    """

    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    code = "validation_error"
    message = "Some fields are invalid."

    def __init__(self, field: str, field_message: str) -> None:
        super().__init__(details=[{"field": field, "message": field_message}])


def _error_body(code: str, message: str, details: Any = None) -> dict[str, Any]:
    body: dict[str, Any] = {"code": code, "message": message}
    if details is not None:
        body["details"] = details
    return {"error": body}


_HTTP_CODES = {
    400: "bad_request",
    401: "not_authenticated",
    403: "permission_denied",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    413: "payload_too_large",
    422: "validation_error",
    429: "too_many_requests",
}


async def _app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_body(exc.code, exc.message, exc.details),
    )


async def _http_exception_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    message = exc.detail if isinstance(exc.detail, str) else "Request failed."
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_body(_HTTP_CODES.get(exc.status_code, "error"), message),
        headers=getattr(exc, "headers", None),
    )


async def _validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    # Strip submitted values ("input") so passwords are never echoed back.
    details = [
        {"field": ".".join(str(p) for p in err["loc"] if p != "body"), "message": err["msg"]}
        for err in exc.errors()
    ]
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=jsonable_encoder(
            _error_body("validation_error", "Some fields are invalid.", details)
        ),
    )


class UnhandledErrorMiddleware:
    """Outermost catch-all: unexpected exceptions become a generic 500 JSON response.

    Only the exception TYPE and the request path are logged: exception messages and
    tracebacks can carry request data (e.g. SQL bind parameters with guest PII). The
    exception is NOT re-raised, so the server does not print a second traceback.
    (Starlette's own `ServerErrorMiddleware` re-raises after responding; this runs inside it.)
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        started = False

        async def tracking_send(message: Message) -> None:
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, receive, tracking_send)
        except Exception as exc:  # noqa: BLE001 - this is the last line of defence
            logger.error(
                "Unhandled %s on %s %s", type(exc).__name__, scope.get("method", ""), scope.get("path", "")
            )
            if started:
                return  # too late for an error body; the connection is closed as-is
            response = JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=_error_body("internal_error", "An unexpected error occurred."),
            )
            await response(scope, receive, send)


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _app_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(StarletteHTTPException, _http_exception_handler)  # type: ignore[arg-type]
    app.add_exception_handler(RequestValidationError, _validation_error_handler)  # type: ignore[arg-type]
    # Added last = outermost of the user middleware stack.
    app.add_middleware(UnhandledErrorMiddleware)

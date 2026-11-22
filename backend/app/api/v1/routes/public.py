"""Public (guest-facing) routes. NO authentication; no cookies are read or set here.

Only the published, allow-listed snapshot is ever returned; drafts and RSVP replies
are unreachable. RSVP submissions have their own rate-limit bucket and body cap.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Header, Request, Response, status
from fastapi.responses import JSONResponse

from app.api.deps import AppSettings, DbSession
from app.core.errors import RateLimitedError
from app.core.rate_limit import public_limiter, rsvp_limiter, rsvp_slug_limiter
from app.schemas.invitation import PublicInvitationOut
from app.schemas.rsvp import RsvpOwnReply, RsvpSubmission, RsvpSubmitted
from app.services import invitation_publish_service, rsvp_service

router = APIRouter(prefix="/public", tags=["public"])

_PUBLIC_HEADERS = {
    "X-Robots-Tag": "noindex, nofollow",
    "Cache-Control": "no-cache",  # revalidate each visit: republish/unpublish must show at once
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
}
_RSVP_HEADERS = {**_PUBLIC_HEADERS, "Cache-Control": "no-store"}


def _client_key(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def rate_limit(request: Request, settings: AppSettings) -> None:
    if not public_limiter.hit(_client_key(request), settings.public_rate_limit_per_minute):
        raise RateLimitedError()


def rsvp_rate_limit(slug: str, request: Request, settings: AppSettings) -> None:
    """Per client IP first (a blocked client does not use up the invitation's budget),
    then per invitation slug."""
    if not rsvp_limiter.hit(_client_key(request), settings.rsvp_rate_limit_per_minute):
        raise RateLimitedError()
    if not rsvp_slug_limiter.hit(slug[:100], settings.rsvp_slug_rate_limit_per_minute):
        raise RateLimitedError()


def _etag_matches(if_none_match: str | None, etag: str) -> bool:
    if not if_none_match:
        return False
    for candidate in if_none_match.split(","):
        candidate = candidate.strip()
        if candidate == "*" or candidate.removeprefix("W/") == etag:
            return True
    return False


def read_public_invitation(
    slug: str,
    db: DbSession,
    if_none_match: Annotated[str | None, Header(alias="If-None-Match")] = None,
) -> Response:
    invitation, publication = invitation_publish_service.get_live(db, slug)
    payload, etag = invitation_publish_service.public_payload(db, invitation, publication)
    headers = {**_PUBLIC_HEADERS, "ETag": etag}
    if _etag_matches(if_none_match, etag):
        return Response(status_code=status.HTTP_304_NOT_MODIFIED, headers=headers)
    return JSONResponse(payload, headers=headers)


for _path in ("/invitations/{slug}", "/weddings/{slug}"):
    router.add_api_route(
        _path,
        read_public_invitation,
        methods=["GET"],
        response_model=PublicInvitationOut,
        dependencies=[Depends(rate_limit)],
        responses={304: {"description": "Not modified"}, 404: {"description": "Not found"}},
        name="read_public_invitation" if _path.startswith("/invitations") else "read_public_wedding",
        deprecated=_path.startswith("/weddings"),
    )


@router.post(
    "/invitations/{slug}/rsvp",
    response_model=RsvpSubmitted,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rsvp_rate_limit)],
)
def submit_rsvp(slug: str, payload: RsvpSubmission, db: DbSession) -> JSONResponse:
    """Validated against the PUBLISHED RSVP config. A filled honeypot gets a decoy 201."""
    body = rsvp_service.submit(db, slug, payload)
    return JSONResponse(
        RsvpSubmitted.model_validate(body).model_dump(mode="json", by_alias=True),
        status_code=status.HTTP_201_CREATED,
        headers=_RSVP_HEADERS,
    )


# --- Guest's own reply (private edit token; no name/email matching) ----------------------
# The token travels in a header, never in the URL, so it is not written to access logs.
# The guest page keeps it on the device and offers it as a personal link in the URL
# FRAGMENT (`#rsvp=...`), which browsers never send to the server either.

RsvpToken = Annotated[str | None, Header(alias="X-RSVP-Token", max_length=200)]


@router.get(
    "/invitations/{slug}/rsvp/mine",
    response_model=RsvpOwnReply,
    # A read (the token is 256 bits, so guessing is not a concern): the public-page budget,
    # not the strict RSVP-write one, so opening the page never uses up the guest's replies.
    dependencies=[Depends(rate_limit)],
    responses={404: {"description": "`not_found` or `rsvp_link_invalid`"}},
)
def read_own_rsvp(slug: str, db: DbSession, token: RsvpToken = None) -> JSONResponse:
    body = rsvp_service.get_own(db, slug, token)
    return JSONResponse(
        RsvpOwnReply.model_validate(body).model_dump(mode="json", by_alias=True), headers=_RSVP_HEADERS
    )


@router.put(
    "/invitations/{slug}/rsvp/mine",
    response_model=RsvpSubmitted,
    dependencies=[Depends(rsvp_rate_limit)],
    responses={404: {"description": "`not_found` or `rsvp_link_invalid`"}},
)
def update_own_rsvp(slug: str, payload: RsvpSubmission, db: DbSession, token: RsvpToken = None) -> JSONResponse:
    """Replace the guest's own reply; validated like a new one against the PUBLISHED config."""
    body = rsvp_service.update(db, slug, token, payload)
    return JSONResponse(
        RsvpSubmitted.model_validate(body).model_dump(mode="json", by_alias=True), headers=_RSVP_HEADERS
    )

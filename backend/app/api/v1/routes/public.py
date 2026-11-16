"""Public (guest-facing) routes. NO authentication and no cookies are read here.

Only the published, allow-listed snapshot is ever returned; drafts are unreachable.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Header, Request, Response, status
from fastapi.responses import JSONResponse

from app.api.deps import AppSettings, DbSession
from app.core.errors import RateLimitedError
from app.core.rate_limit import public_limiter
from app.schemas.wedding import PublicWeddingOut
from app.services import wedding_publish_service

router = APIRouter(prefix="/public", tags=["public"])

_PUBLIC_HEADERS = {
    "X-Robots-Tag": "noindex, nofollow",
    "Cache-Control": "no-cache",  # revalidate each visit: republish/unpublish must show at once
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
}


def rate_limit(request: Request, settings: AppSettings) -> None:
    key = request.client.host if request.client else "unknown"
    if not public_limiter.hit(key, settings.public_rate_limit_per_minute):
        raise RateLimitedError()


def _etag_matches(if_none_match: str | None, etag: str) -> bool:
    if not if_none_match:
        return False
    for candidate in if_none_match.split(","):
        candidate = candidate.strip()
        if candidate == "*" or candidate.removeprefix("W/") == etag:
            return True
    return False


@router.get(
    "/weddings/{slug}",
    response_model=PublicWeddingOut,
    dependencies=[Depends(rate_limit)],
    responses={304: {"description": "Not modified"}, 404: {"description": "Not found"}},
)
def read_public_wedding(
    slug: str,
    db: DbSession,
    if_none_match: Annotated[str | None, Header(alias="If-None-Match")] = None,
) -> Response:
    publication = wedding_publish_service.get_live_publication(db, slug)
    etag = f'"{publication.id}"'
    headers = {**_PUBLIC_HEADERS, "ETag": etag}
    if _etag_matches(if_none_match, etag):
        return Response(status_code=status.HTTP_304_NOT_MODIFIED, headers=headers)
    return JSONResponse(wedding_publish_service.public_payload(publication), headers=headers)

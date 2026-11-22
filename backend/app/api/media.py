r"""`GET /media/<uuid>.<ext>`: uploaded images, mounted at the app root (not under /api).

Only names matching `^[0-9a-f-]{36}\.(png|jpg|webp)$` are looked up, so a path can
never escape the media root. A file's bytes never change (new upload = new name), but a file
can be DELETED, so caches keep it for a day rather than a year.
"""

from fastapi import APIRouter
from fastapi.responses import FileResponse

from app.core.errors import NotFoundError
from app.services import media_service

router = APIRouter(tags=["media"])

_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'",
    "Cache-Control": "public, max-age=86400",
    "Cross-Origin-Resource-Policy": "same-site",
}


@router.get("/media/{name}", include_in_schema=False)
def read_media(name: str) -> FileResponse:
    found = media_service.media_path(name)
    if found is None:
        raise NotFoundError("Not found.")
    path, content_type = found
    return FileResponse(path, media_type=content_type, headers=_HEADERS)

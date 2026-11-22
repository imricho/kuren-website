"""Image uploads: decode, sanitise, re-encode and store; serve by strict filename.

Security model:
- The format is decided by DECODING (Pillow, restricted to JPEG/PNG/WebP plugins),
  never by the filename or the client's Content-Type. SVG, GIF, HEIC, animations and
  anything else are rejected.
- Decompression bombs are refused from the header (pixel cap) before pixels are decoded.
- Every image is re-encoded from pixels only: EXIF (GPS, camera, timestamps), XMP and
  comments are dropped; EXIF orientation is applied first.
- Stored under a random UUID name in `settings.media_root`; user input never touches a path.
"""

import io
import json
import logging
import os
import re
import uuid
import warnings
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO, Literal

from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import LimitReachedError, NotFoundError, PayloadTooLargeError, UnsupportedImageError
from app.models import Invitation, InvitationAsset, InvitationPublication

logger = logging.getLogger(__name__)

AssetKind = Literal["image", "qris"]

#: Names served at /media/<name>; anything else is a 404 without touching the disk.
MEDIA_NAME = re.compile(r"[0-9a-f-]{36}\.(png|jpg|webp)")
CONTENT_TYPES = {"png": "image/png", "jpg": "image/jpeg", "webp": "image/webp"}

_DECODERS = ("JPEG", "PNG", "WEBP")
_PHOTO_MAX_EDGE = 2560
_PHOTO_QUALITY = 85

# Pillow's own guard: raise (not warn) on anything past the cap.
Image.MAX_IMAGE_PIXELS = get_settings().max_image_pixels
warnings.simplefilter("error", Image.DecompressionBombWarning)


@dataclass(frozen=True)
class EncodedImage:
    data: bytes
    ext: str
    width: int
    height: int


def media_root() -> Path:
    return Path(get_settings().media_root)


def read_limited(stream: BinaryIO, limit: int) -> bytes:
    """Read at most `limit` bytes; one byte more means the upload is too large."""
    data = stream.read(limit + 1)
    if len(data) > limit:
        raise PayloadTooLargeError("Images must be 5 MB or smaller.")
    return data


def _decode(data: bytes) -> Image.Image:
    max_pixels = get_settings().max_image_pixels
    try:
        with Image.open(io.BytesIO(data), formats=_DECODERS) as probe:
            if probe.format not in _DECODERS:
                raise UnsupportedImageError()
            width, height = probe.size
            if width < 1 or height < 1 or width * height > max_pixels:
                raise UnsupportedImageError("This image is too large in pixels. Use a smaller image.")
            if getattr(probe, "is_animated", False) or getattr(probe, "n_frames", 1) != 1:
                raise UnsupportedImageError("Animated images are not supported.")
            probe.verify()  # structural check; the probe is unusable afterwards
        image = Image.open(io.BytesIO(data), formats=_DECODERS)
        image.load()
    except UnsupportedImageError:
        raise
    except (
        UnidentifiedImageError, Image.DecompressionBombError, Image.DecompressionBombWarning,
        OSError, SyntaxError, ValueError, EOFError,
    ):
        raise UnsupportedImageError() from None
    return image


def _normalise_mode(image: Image.Image) -> Image.Image:
    has_alpha = image.mode in ("RGBA", "LA", "PA") or (
        image.mode == "P" and "transparency" in image.info
    )
    if has_alpha:
        return image.convert("RGBA")
    if image.mode in ("RGB", "L"):
        return image
    return image.convert("RGB")


def encode(data: bytes, kind: AssetKind) -> EncodedImage:
    """Decoded, orientation-corrected, metadata-free re-encode of `data`."""
    source = _decode(data)
    try:
        image = ImageOps.exif_transpose(source) or source
        image = _normalise_mode(image)
        # Pixels only from here on: nothing from the original `info` is written out.
        image.info = {}
        out = io.BytesIO()
        if kind == "qris":
            # Lossless and never resampled: a QR code must stay scannable.
            image.save(out, format="PNG", optimize=True)
            ext = "png"
        else:
            if max(image.size) > _PHOTO_MAX_EDGE:
                image = image.copy()
                image.thumbnail((_PHOTO_MAX_EDGE, _PHOTO_MAX_EDGE), Image.Resampling.LANCZOS)
            if image.mode == "RGBA":
                image.save(out, format="WEBP", quality=_PHOTO_QUALITY, method=4)
                ext = "webp"
            else:
                image.save(out, format="JPEG", quality=_PHOTO_QUALITY, optimize=True, progressive=True)
                ext = "jpg"
        return EncodedImage(out.getvalue(), ext, image.width, image.height)
    except (OSError, ValueError):
        raise UnsupportedImageError() from None
    finally:
        source.close()


def _write_file(name: str, data: bytes) -> Path:
    root = media_root()
    root.mkdir(parents=True, exist_ok=True)
    final = root / name
    temp = root / f".{name}.tmp"
    fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o644)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp, final)
    except BaseException:
        temp.unlink(missing_ok=True)
        raise
    return final


def asset_src(asset: InvitationAsset) -> str:
    return f"/media/{asset.filename}"


def asset_out(asset: InvitationAsset) -> dict[str, object]:
    return {
        "id": asset.id, "src": asset_src(asset), "width": asset.width,
        "height": asset.height, "kind": asset.kind,
    }


def create_asset(db: Session, invitation: Invitation, *, kind: AssetKind, data: bytes) -> InvitationAsset:
    settings = get_settings()
    encoded = encode(data, kind)  # CPU work before taking the lock
    # Lock the invitation row so concurrent uploads cannot both pass the limit check.
    db.scalar(select(Invitation.id).where(Invitation.id == invitation.id).with_for_update())
    count = db.scalar(select(func.count()).select_from(InvitationAsset).where(
        InvitationAsset.invitation_id == invitation.id, InvitationAsset.deleted_at.is_(None),
    ))
    if (count or 0) >= settings.max_assets_per_invitation:
        db.rollback()
        raise LimitReachedError("You have uploaded the maximum number of images. Delete some first.")
    asset_id = uuid.uuid4()
    filename = f"{asset_id}.{encoded.ext}"
    path = _write_file(filename, encoded.data)
    asset = InvitationAsset(
        id=asset_id, invitation_id=invitation.id, kind=kind, filename=filename,
        content_type=CONTENT_TYPES[encoded.ext], width=encoded.width, height=encoded.height,
        bytes=len(encoded.data),
    )
    db.add(asset)
    try:
        db.commit()
    except BaseException:
        db.rollback()
        path.unlink(missing_ok=True)
        raise
    db.refresh(asset)
    return asset


def delete_asset(db: Session, invitation: Invitation, asset_id: str) -> None:
    """Delete an image (owner only). Removed at once unless the LIVE publication still shows
    it: then it is tombstoned (`deleted_at`) and removed by `sweep_deleted_assets` as soon as
    the live page stops using it (publish, unpublish, invitation delete)."""
    try:
        parsed = uuid.UUID(asset_id)
    except ValueError:
        raise NotFoundError("Image not found.") from None
    asset = db.scalar(select(InvitationAsset).where(
        InvitationAsset.id == parsed, InvitationAsset.invitation_id == invitation.id, InvitationAsset.deleted_at.is_(None),
    ))
    if asset is None:
        raise NotFoundError("Image not found.")
    filename = asset.filename
    if _referenced_by_live_publication(db, invitation, filename):
        asset.deleted_at = func.now()
        db.commit()
        return
    db.delete(asset)
    db.commit()
    (media_root() / filename).unlink(missing_ok=True)


def sweep_deleted_assets(db: Session, invitation: Invitation) -> None:
    """Remove tombstoned images the live publication no longer shows (file first, then row).
    Call after the live publication changed (publish / unpublish)."""
    rows = list(db.scalars(select(InvitationAsset).where(
        InvitationAsset.invitation_id == invitation.id, InvitationAsset.deleted_at.is_not(None),
    )))
    removed = False
    for row in rows:
        if _referenced_by_live_publication(db, invitation, row.filename):
            continue
        try:
            (media_root() / row.filename).unlink(missing_ok=True)
        except OSError:
            logger.warning("Could not remove a deleted media file")
            continue
        db.delete(row)
        removed = True
    if removed:
        db.commit()


def _referenced_by_live_publication(db: Session, invitation: Invitation, filename: str) -> bool:
    if invitation.published_publication_id is None:
        return False
    content = db.scalar(
        select(InvitationPublication.content).where(InvitationPublication.id == invitation.published_publication_id)
    )
    return f"/media/{filename}" in json.dumps(content or {})


def media_path(name: str) -> tuple[Path, str] | None:
    """(path, content type) for a well-formed, existing media name, else None."""
    match = MEDIA_NAME.fullmatch(name)
    if match is None:
        return None
    path = media_root() / name
    if not path.is_file():
        return None
    return path, CONTENT_TYPES[match.group(1)]

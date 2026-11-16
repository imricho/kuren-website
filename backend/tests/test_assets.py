"""CMS v2.0 image uploads: decode-based validation, re-encoding, storage and serving."""

import io
import re
import struct
import zlib
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.core.config import get_settings
from tests.wedding_helpers import API, create_wedding, png_bytes, upload

SRC = re.compile(r"/media/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)")


@pytest.fixture
def wid(auth_client: TestClient) -> str:
    return create_wedding(auth_client)["id"]


def _encode(fmt: str, size: tuple[int, int] = (80, 60), mode: str = "RGB", **save: Any) -> bytes:
    out = io.BytesIO()
    color = (10, 120, 200, 128) if mode == "RGBA" else (10, 120, 200)
    Image.new(mode, size, color).save(out, format=fmt, **save)
    return out.getvalue()


def _served(client: TestClient, src: str) -> Image.Image:
    response = client.get(src)
    assert response.status_code == 200
    return Image.open(io.BytesIO(response.content))


def _unsupported(response: Any) -> None:
    assert response.status_code == 422, response.text
    assert response.json()["error"]["code"] == "unsupported_image"


# --- Accepted formats ---------------------------------------------------------------------


@pytest.mark.parametrize(
    ("fmt", "mode", "ext"),
    [("PNG", "RGB", "jpg"), ("JPEG", "RGB", "jpg"), ("WEBP", "RGB", "jpg"), ("PNG", "RGBA", "webp")],
)
def test_photo_upload_is_reencoded(
    auth_client: TestClient, wid: str, media_root: Path, fmt: str, mode: str, ext: str
) -> None:
    # Name and MIME type are deliberately wrong: only the decoded bytes count.
    response = upload(auth_client, wid, _encode(fmt, mode=mode), filename="x.svg", content_type="image/svg+xml")
    assert response.status_code == 201, response.text
    body = response.json()
    assert set(body) == {"id", "src", "width", "height", "kind"}
    assert SRC.fullmatch(body["src"]) and body["src"].endswith(f".{ext}")
    assert body["src"] == f"/media/{body['id']}.{ext}"
    assert (body["width"], body["height"], body["kind"]) == (80, 60, "image")
    assert (media_root / body["src"].removeprefix("/media/")).is_file()
    # Uploads are not content writes.
    assert auth_client.get(f"{API}/me").json()["revision"] == 0


def test_large_photos_are_downscaled(auth_client: TestClient, wid: str) -> None:
    body = upload(auth_client, wid, _encode("PNG", size=(3000, 1500))).json()
    assert (body["width"], body["height"]) == (2560, 1280)


def test_qris_is_lossless_png_at_original_size(auth_client: TestClient, wid: str) -> None:
    source = Image.new("L", (3000, 3000), 255)
    for x in range(0, 3000, 7):
        source.putpixel((x, x), 0)
    raw = io.BytesIO()
    source.save(raw, format="PNG")
    body = upload(auth_client, wid, raw.getvalue(), kind="qris").json()
    assert body["src"].endswith(".png") and (body["width"], body["height"]) == (3000, 3000)
    served = _served(auth_client, body["src"])
    assert served.format == "PNG" and list(served.convert("L").getdata()) == list(source.getdata())


def test_exif_gps_is_stripped_and_orientation_applied(auth_client: TestClient, wid: str) -> None:
    exif = Image.Exif()
    exif[0x0112] = 6  # Orientation: rotate 90° CW to display
    exif[0x010F] = "SecretCam"
    exif.get_ifd(0x8825)[2] = (6.0, 10.0, 30.0)  # GPSLatitude
    raw = io.BytesIO()
    Image.new("RGB", (80, 40), (0, 200, 0)).save(raw, format="JPEG", exif=exif)
    assert b"SecretCam" in raw.getvalue()

    body = upload(auth_client, wid, raw.getvalue()).json()
    assert (body["width"], body["height"]) == (40, 80)
    response = auth_client.get(body["src"])
    assert b"SecretCam" not in response.content and b"Exif" not in response.content
    served = Image.open(io.BytesIO(response.content))
    assert dict(served.getexif()) == {} and served.size == (40, 80)


# --- Rejected input -----------------------------------------------------------------------

_SVG = b'<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect width="1" height="1"/></svg>'


def _apng() -> bytes:
    frames = [Image.new("RGB", (8, 8), c) for c in ((255, 0, 0), (0, 255, 0))]
    out = io.BytesIO()
    frames[0].save(out, format="PNG", save_all=True, append_images=frames[1:])
    return out.getvalue()


def _animated_webp() -> bytes:
    frames = [Image.new("RGB", (8, 8), c) for c in ((255, 0, 0), (0, 255, 0))]
    out = io.BytesIO()
    frames[0].save(out, format="WEBP", save_all=True, append_images=frames[1:])
    return out.getvalue()


@pytest.mark.parametrize(
    "data",
    [
        _SVG,
        _encode("GIF"),
        _encode("BMP"),
        _encode("TIFF"),
        b"just some text, not an image",
        b"",
        _encode("PNG")[:40],  # truncated
        _apng(),
        _animated_webp(),
    ],
    ids=["svg", "gif", "bmp", "tiff", "text", "empty", "truncated", "apng", "animated-webp"],
)
def test_unsupported_files_are_rejected(auth_client: TestClient, wid: str, media_root: Path, data: bytes) -> None:
    _unsupported(upload(auth_client, wid, data, filename="photo.png", content_type="image/png"))
    assert not media_root.exists() or not any(media_root.iterdir())


def _png_header_only(width: int, height: int) -> bytes:
    """A PNG claiming huge dimensions with a tiny body (decompression bomb shape)."""
    def chunk(kind: bytes, payload: bytes) -> bytes:
        return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload))

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(b"\x00" * 64)) + chunk(b"IEND", b"")


def test_decompression_bomb_is_rejected(auth_client: TestClient, wid: str) -> None:
    _unsupported(upload(auth_client, wid, _png_header_only(10_000, 10_000)))  # 100 MP > 40 MP cap


def test_oversized_upload_is_413(auth_client: TestClient, wid: str) -> None:
    limit = get_settings().max_upload_bytes
    response = upload(auth_client, wid, b"\x00" * (limit + 1))
    assert response.status_code == 413 and response.json()["error"]["code"] == "payload_too_large"
    # Way past the route's cap: refused by the body-size middleware before parsing.
    response = upload(auth_client, wid, b"\x00" * (limit + 200 * 1024))
    assert response.status_code == 413


def test_upload_between_1mib_and_5mb_is_accepted(auth_client: TestClient, wid: str) -> None:
    noise = Image.frombytes("RGB", (1000, 1000), bytes(range(256)) * (3_000_000 // 256) + b"\x00" * (3_000_000 % 256))
    raw = io.BytesIO()
    noise.save(raw, format="PNG", compress_level=0)
    assert 1_048_576 < len(raw.getvalue()) < get_settings().max_upload_bytes
    assert upload(auth_client, wid, raw.getvalue()).status_code == 201


def test_other_routes_keep_the_1mib_limit(auth_client: TestClient, wid: str) -> None:
    body = b'{"a": "' + b"x" * (2 * 1024 * 1024) + b'"}'
    response = auth_client.put(f"{API}/{wid}/content", content=body, headers={"Content-Type": "application/json"})
    assert response.status_code == 413


@pytest.mark.parametrize("kind", ["photo", "", "QRIS"])
def test_kind_is_validated(auth_client: TestClient, wid: str, kind: str) -> None:
    response = upload(auth_client, wid, png_bytes(), kind=kind)
    assert response.status_code == 422 and response.json()["error"]["code"] == "validation_error"


# --- Ownership and deletion ---------------------------------------------------------------


def test_uploads_and_deletes_are_owner_only(auth_client: TestClient, other_client: TestClient, wid: str) -> None:
    assert upload(other_client, wid, png_bytes()).status_code == 404
    asset = upload(auth_client, wid, png_bytes()).json()
    assert other_client.delete(f"{API}/{wid}/assets/{asset['id']}").status_code == 404
    other_wid = create_wedding(other_client)["id"]
    assert other_client.delete(f"{API}/{other_wid}/assets/{asset['id']}").status_code == 404
    assert auth_client.get(asset["src"]).status_code == 200


def test_delete_removes_record_and_file(auth_client: TestClient, wid: str, media_root: Path) -> None:
    asset = upload(auth_client, wid, png_bytes()).json()
    response = auth_client.delete(f"{API}/{wid}/assets/{asset['id']}")
    assert response.status_code == 204
    assert auth_client.get(asset["src"]).status_code == 404
    assert auth_client.delete(f"{API}/{wid}/assets/{asset['id']}").status_code == 404
    assert auth_client.delete(f"{API}/{wid}/assets/not-a-uuid").status_code == 404


def test_upload_requires_login(client: TestClient) -> None:
    assert upload(client, "00000000-0000-0000-0000-000000000000", png_bytes()).status_code == 401


# --- Serving ------------------------------------------------------------------------------


def test_media_is_served_with_strict_headers(auth_client: TestClient, wid: str) -> None:
    from app.main import app

    src = upload(auth_client, wid, _encode("PNG", mode="RGBA")).json()["src"]
    with TestClient(app, base_url="http://testserver") as anonymous:
        response = anonymous.get(src)
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/webp"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["content-security-policy"] == "default-src 'none'"
    assert response.headers["cache-control"] == "public, max-age=31536000, immutable"
    assert "set-cookie" not in response.headers


@pytest.mark.parametrize(
    "name",
    [
        "..%2F..%2Fetc%2Fpasswd",
        "%2e%2e%2fapp%2fmain.py",
        "00000000-0000-0000-0000-000000000000.svg",
        "00000000-0000-0000-0000-000000000000.PNG",
        "00000000-0000-0000-0000-000000000000.png.html",
        "00000000-0000-0000-0000-00000000000.png",
        "main.py",
        "00000000-0000-0000-0000-000000000000.png",  # well-formed but missing
    ],
)
def test_media_names_are_strict(client: TestClient, name: str) -> None:
    assert client.get(f"/media/{name}").status_code == 404


def test_media_traversal_cannot_reach_files_outside_root(client: TestClient, media_root: Path) -> None:
    media_root.mkdir(parents=True, exist_ok=True)
    (media_root.parent / "secret.png").write_bytes(png_bytes())
    assert client.get("/media/../secret.png").status_code == 404
    assert client.get("/media/%2e%2e/secret.png").status_code == 404


def test_media_src_is_accepted_in_content(auth_client: TestClient, wid: str) -> None:
    src = upload(auth_client, wid, png_bytes()).json()["src"]
    response = auth_client.put(f"{API}/{wid}/sections/closing", json={"image": {"src": src, "alt": "Us"}})
    assert response.status_code == 200 and response.json()["image"]["src"] == src
    for bad in ("/media/../api/v1/users/me", "/media/abc.png", f"{src}.html", src.upper()):
        response = auth_client.put(f"{API}/{wid}/sections/closing", json={"image": {"src": bad, "alt": "Us"}})
        assert response.status_code == 422, bad

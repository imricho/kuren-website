from typing import Any

from fastapi.testclient import TestClient

API = "/api/v1/weddings"


def create_wedding(client: TestClient, **body: Any) -> dict[str, Any]:
    response = client.post(API, json=body)
    assert response.status_code == 201, response.text
    return response.json()


def fields(response: Any) -> list[str]:
    body = response.json()
    assert response.status_code == 422, body
    assert body["error"]["code"] == "validation_error"
    return [d["field"] for d in body["error"]["details"]]


PUBLIC = "/api/v1/public/weddings"


def png_bytes(size: tuple[int, int] = (64, 48), color: tuple[int, ...] = (200, 30, 30), mode: str = "RGB") -> bytes:
    import io

    from PIL import Image

    out = io.BytesIO()
    Image.new(mode, size, color).save(out, format="PNG")
    return out.getvalue()


def upload(client: TestClient, wedding_id: str, data: bytes, *, kind: str = "image",
           filename: str = "photo.bin", content_type: str = "application/octet-stream") -> Any:
    return client.post(f"{API}/{wedding_id}/assets", data={"kind": kind},
                       files={"file": (filename, data, content_type)})

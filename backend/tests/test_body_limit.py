from collections.abc import Iterator

from fastapi.testclient import TestClient

from app.core.config import get_settings
from tests.wedding_helpers import API, create_wedding
from tests.wedding_samples import SAMPLE_WEDDING

LIMIT = get_settings().max_request_body_bytes


def _assert_too_large(response) -> None:  # type: ignore[no-untyped-def]
    assert response.status_code == 413, response.text
    assert response.json()["error"]["code"] == "payload_too_large"


def test_declared_oversized_body_is_rejected_without_auth(client: TestClient) -> None:
    body = b'{"a": "' + b"x" * LIMIT + b'"}'
    _assert_too_large(
        client.put(f"{API}/00000000-0000-0000-0000-000000000000/content", content=body,
                   headers={"Content-Type": "application/json"})
    )
    _assert_too_large(client.post("/api/v1/auth/login", content=body,
                                  headers={"Content-Type": "application/json"}))


def test_streamed_oversized_body_is_rejected(client: TestClient) -> None:
    def chunks() -> Iterator[bytes]:
        yield b'{"email": "'
        for _ in range(LIMIT // 65536 + 2):
            yield b"x" * 65536
        yield b'"}'

    response = client.post("/api/v1/auth/login", content=chunks(),
                           headers={"Content-Type": "application/json"})
    _assert_too_large(response)


def test_normal_content_put_still_works(auth_client: TestClient) -> None:
    wid = create_wedding(auth_client)["id"]
    response = auth_client.put(f"{API}/{wid}/content", json=SAMPLE_WEDDING)
    assert response.status_code == 200
    assert response.json() == SAMPLE_WEDDING


def test_body_at_limit_is_not_rejected_for_size(client: TestClient) -> None:
    body = b" " * (LIMIT - 2) + b"{}"
    response = client.post("/api/v1/auth/login", content=body, headers={"Content-Type": "application/json"})
    assert response.status_code == 422

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

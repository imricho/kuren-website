"""Helpers for the multi-variant invitation tests (`/api/v1/invitations`)."""

from typing import Any

from fastapi.testclient import TestClient

from app.core.invitation_registry import REGISTRY, get_variant

INV = "/api/v1/invitations"
PUBLIC_INV = "/api/v1/public/invitations"
ALL_VARIANTS = tuple(REGISTRY.variants)
#: One representative variant per category.
PER_CATEGORY = ("wedding_ceremony", "birthday", "family_reunion", "seminar")
FUTURE = "2099-06-01"


def category_of(variant: str) -> str:
    return get_variant(variant).category


def create_invitation(client: TestClient, variant: str, **body: Any) -> dict[str, Any]:
    response = client.post(INV, json={"category": category_of(variant), "variant": variant, **body})
    assert response.status_code == 201, response.text
    return response.json()


def put(client: TestClient, path: str, body: Any) -> dict[str, Any]:
    response = client.put(path, json=body)
    assert response.status_code == 200, (path, response.text)
    return response.json()


def make_publishable(client: TestClient, iid: str) -> None:
    """Fill every section the variant shows by default so the draft passes the publish checks."""
    base = f"{INV}/{iid}"
    record = client.get(base).json()
    variant = get_variant(record["variant"])
    if record["themeId"] is None:
        assert client.patch(base, json={"themeId": "temuvibe-elegant"}).status_code == 200
    put(client, f"{base}/sections/opening", {"weddingTitle": "A celebration", "weddingDate": FUTURE})
    put(client, f"{base}/sections/closing", {"message": "See you there."})
    if variant.offers("couple"):
        put(client, f"{base}/sections/couple", {"groom": {"name": "Adi Nugroho"}, "bride": {"name": "Bunga Citra"}})
    for event in client.get(f"{base}/events").json():
        put(client, f"{base}/events/{event['id']}", {
            "type": event["type"], "title": event.get("title") or "Session", "date": FUTURE,
            "startTime": "10:00", "venueName": "Gedung Serbaguna", "address": "Jl. Merdeka No. 1",
        })
    for section in variant.sections:
        if not section.default_enabled:
            continue
        if section.id == "profiles":
            put(client, f"{base}/sections/profiles",
                {"enabled": True, "people": [{"role": section.roles[0], "name": "Citra Lestari"}]})
        elif section.id == "milestone":
            field = section.fields[0]
            value = 17 if field == "age" else 10 if field == "years" else "Something to celebrate"
            put(client, f"{base}/sections/milestone", {"enabled": True, field: value})
        elif section.id == "organization":
            put(client, f"{base}/sections/organization", {"enabled": True, "name": "PT Contoh Jaya"})
        elif section.id == "agenda":
            put(client, f"{base}/sections/agenda", {"enabled": True, "items": [{"time": "10:00", "title": "Opening"}]})
        elif section.id == "speakers":
            put(client, f"{base}/sections/speakers", {"enabled": True, "people": [{"name": "Dr. Sari"}]})


def publish(client: TestClient, iid: str) -> dict[str, Any]:
    response = client.post(f"{INV}/{iid}/publish")
    assert response.status_code == 200, response.text
    return response.json()


def blocked(response: Any) -> list[tuple[str, str, str]]:
    body = response.json()
    assert response.status_code == 422, body
    assert body["error"]["code"] == "publish_blocked"
    return [(d["section"], d["field"], d["code"]) for d in body["error"]["details"]]


def error_code(response: Any, status: int) -> str:
    assert response.status_code == status, response.text
    return response.json()["error"]["code"]

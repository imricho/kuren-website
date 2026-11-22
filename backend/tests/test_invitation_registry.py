"""The invitation registry: validation at load time, public document, template compatibility."""

import copy
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core import invitation_registry as registry
from app.core.themes import SELECTABLE_THEME_IDS
from app.models.invitation import EVENT_TYPES

RAW = json.loads(Path(registry.__file__).with_name("invitation_registry.json").read_text(encoding="utf-8"))
TEMUVIBE = ("temuvibe-elegant", "temuvibe-minimal", "temuvibe-festive", "temuvibe-corporate")
LEGACY_VARIANTS = {"wedding_ceremony", "wedding_reception", "engagement", "anniversary"}


def _load(tmp_path: Path, raw: dict) -> registry.Registry:
    path = tmp_path / "invitation_registry.json"
    path.write_text(json.dumps(raw), encoding="utf-8")
    return registry.load(path)


def test_taxonomy_matches_the_contract() -> None:
    assert registry.CATEGORY_IDS == ("wedding", "celebration", "gathering", "corporate")
    assert len(registry.VARIANT_IDS) == 17
    assert registry.is_valid_pair("celebration", "sweet_17")
    assert not registry.is_valid_pair("wedding", "sweet_17")
    assert set(registry.SESSION_TYPES) == set(EVENT_TYPES)
    for variant in registry.REGISTRY.variants.values():
        assert variant.label["en"] and variant.label["id"]
        for structural in ("opening", "countdown", "events", "closing"):
            assert variant.requires(structural)


def test_shipped_registry_loads(tmp_path: Path) -> None:
    assert _load(tmp_path, RAW).variants.keys() == registry.REGISTRY.variants.keys()


@pytest.mark.parametrize(
    ("mutate", "message"),
    [
        (lambda r: r["variants"][2]["sections"].append({"id": "karaoke", "defaultEnabled": False}), "unknown section"),
        (lambda r: r["variants"][2]["sections"].append(dict(r["variants"][2]["sections"][-1])), "duplicate section"),
        (lambda r: r["variants"].append(copy.deepcopy(r["variants"][0])), "duplicate variant"),
        (lambda r: r["categories"].append(copy.deepcopy(r["categories"][0])), "duplicate category"),
        (lambda r: r["variants"][0].update(category="party"), "unknown category"),
        (lambda r: r["variants"][2]["sections"][1].update(roles=["dragon"]), "unknown profile roles"),
        (lambda r: r["variants"][2]["sessionPresets"].append({"type": "rave", "title": {"en": "x", "id": "y"}}),
         "unknown session preset type"),
        (lambda r: r["templates"].append({"id": "not-a-theme", "categories": ["wedding"]}), "not in selectable"),
        (lambda r: r["variants"][0]["sections"].pop(0), "must be required|missing structural"),
    ],
)
def test_invalid_registry_fails_fast(tmp_path: Path, mutate, message: str) -> None:  # type: ignore[no-untyped-def]
    raw = copy.deepcopy(RAW)
    mutate(raw)
    with pytest.raises(registry.RegistryError, match=message):
        _load(tmp_path, raw)


def test_temuvibe_templates_are_selectable_and_compatible() -> None:
    assert set(TEMUVIBE) <= SELECTABLE_THEME_IDS
    for variant in registry.VARIANT_IDS:
        category = registry.get_variant(variant).category
        assert registry.template_supports("temuvibe-elegant", category, variant)
        assert registry.template_supports("temuvibe-minimal", category, variant)
        assert registry.template_supports("temuvibe-festive", category, variant) == (
            category in ("celebration", "gathering")
        )
        assert registry.template_supports("temuvibe-corporate", category, variant) == (
            category in ("corporate", "gathering")
        )


def test_original_themes_only_support_wedding_like_variants() -> None:
    legacy = SELECTABLE_THEME_IDS - set(TEMUVIBE)
    assert len(legacy) == 49
    for theme in legacy:
        supported = {v for v in registry.VARIANT_IDS
                     if registry.template_supports(theme, registry.get_variant(v).category, v)}
        assert supported == LEGACY_VARIANTS, theme
    assert not registry.template_supports("unknown", "wedding", "wedding_ceremony")


def test_invitation_types_endpoint_is_public_and_cacheable(client: TestClient) -> None:
    response = client.get("/api/v1/invitation-types")
    assert response.status_code == 200
    assert "public" in response.headers["cache-control"]
    body = response.json()
    assert {c["id"] for c in body["categories"]} == set(registry.CATEGORY_IDS)
    assert [v["id"] for v in body["variants"]] == list(registry.VARIANT_IDS)
    assert "legacyTemplates" not in body
    templates = {t["id"]: t for t in body["templates"]}
    assert set(templates) == SELECTABLE_THEME_IDS
    assert templates["temuvibe-festive"] == {"id": "temuvibe-festive", "categories": ["celebration", "gathering"]}
    assert set(templates["afterglow"]["variants"]) == LEGACY_VARIANTS
    seminar = next(v for v in body["variants"] if v["id"] == "seminar")
    assert [s["id"] for s in seminar["sections"]] == [
        "opening", "organization", "countdown", "events", "agenda", "speakers", "rsvp", "closing",
    ]
    assert seminar["rsvpDefaults"]["collectContact"] == "email"

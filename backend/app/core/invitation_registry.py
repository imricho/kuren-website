"""Invitation taxonomy: categories, variants, per-variant sections, presets and templates.

`invitation_registry.json` is the single source of truth (the frontend keeps a typed
mirror with a parity test). It is loaded and validated once, at import: an unknown or
duplicate id fails fast at startup instead of surfacing as a broken editor later.

`fields` on a section is an editor hint (which person/milestone fields to show); for
`milestone` it also limits what is published. `roles` (profiles only) limits
`profiles.people[].role` and is enforced on write.
"""

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from app.core.themes import SELECTABLE_THEME_IDS

_PATH = Path(__file__).with_name("invitation_registry.json")

#: Every section id the backend can store and publish (canonical render order).
SECTION_IDS: tuple[str, ...] = (
    "opening", "holyRecite1", "greeting", "couple", "profiles", "organization", "milestone",
    "countdown", "events", "agenda", "speakers", "story", "gallery", "rsvp", "wishes",
    "amplopDigital", "holyRecite2", "closing",
)
#: Offered by every variant, always required (the publish checks rely on them).
STRUCTURAL_SECTIONS = ("opening", "countdown", "events", "closing")
#: Sections whose `enabled` flag is not a visibility switch: `countdown.enabled` only
#: toggles the countdown timer (the event date itself is `opening.weddingDate`).
TOGGLE_ONLY_SECTIONS = frozenset({"countdown"})
_PERSON_FIELDS = frozenset({"nickname", "image", "description", "parents", "birthDate"})
_RSVP_DEFAULT_KEYS = frozenset({"maxGuestsPerResponse", "collectContact", "allowSessionChoice", "registrationFields"})


class RegistryError(RuntimeError):
    pass


@dataclass(frozen=True)
class SectionConfig:
    id: str
    required: bool
    default_enabled: bool
    roles: tuple[str, ...] = ()
    fields: tuple[str, ...] = ()
    defaults: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class SessionPreset:
    type: str
    title: dict[str, str]


@dataclass(frozen=True)
class VariantConfig:
    id: str
    category: str
    label: dict[str, str]
    sections: tuple[SectionConfig, ...]
    session_presets: tuple[SessionPreset, ...]
    rsvp_defaults: dict[str, Any]

    def section(self, section_id: str) -> SectionConfig | None:
        return next((s for s in self.sections if s.id == section_id), None)

    def offers(self, section_id: str) -> bool:
        return self.section(section_id) is not None

    def requires(self, section_id: str) -> bool:
        config = self.section(section_id)
        return config is not None and config.required


@dataclass(frozen=True)
class TemplateCompat:
    id: str
    categories: tuple[str, ...]
    variants: tuple[str, ...] | None  # None = every variant of `categories`


@dataclass(frozen=True)
class Registry:
    raw: dict[str, Any]
    categories: tuple[str, ...]
    variants: dict[str, VariantConfig]
    session_types: tuple[str, ...]
    profile_roles: tuple[str, ...]
    milestone_fields: tuple[str, ...]
    templates: dict[str, TemplateCompat]
    default_timezone: str


def _fail(message: str) -> None:
    raise RegistryError(f"{_PATH.name}: {message}")


def _unique(ids: list[str], what: str) -> None:
    seen: set[str] = set()
    for item in ids:
        if not isinstance(item, str) or not item:
            _fail(f"{what}: ids must be non-empty strings")
        if item in seen:
            _fail(f"duplicate {what} id {item!r}")
        seen.add(item)


def _label(value: Any, where: str) -> dict[str, str]:
    if not isinstance(value, dict) or set(value) != {"en", "id"} or not all(isinstance(v, str) and v for v in value.values()):
        _fail(f"{where}: label must have non-empty 'en' and 'id'")
    return dict(value)


def _parse(raw: dict[str, Any], selectable: frozenset[str]) -> Registry:
    if tuple(raw.get("sectionOrder", ())) != SECTION_IDS:
        _fail("sectionOrder must list every known section in canonical order")
    session_types = tuple(raw["sessionTypes"])
    profile_roles = tuple(raw["profileRoles"])
    milestone_fields = tuple(raw["milestoneFields"])
    _unique(list(session_types), "session type")
    _unique(list(profile_roles), "profile role")
    _unique(list(milestone_fields), "milestone field")

    categories = [c["id"] for c in raw["categories"]]
    _unique(categories, "category")
    variant_ids = [v["id"] for v in raw["variants"]]
    _unique(variant_ids, "variant")

    variants: dict[str, VariantConfig] = {}
    for v in raw["variants"]:
        vid = v["id"]
        if v.get("category") not in categories:
            _fail(f"variant {vid}: unknown category {v.get('category')!r}")
        section_ids = [s["id"] for s in v["sections"]]
        _unique(section_ids, f"section (variant {vid})")
        unknown = set(section_ids) - set(SECTION_IDS)
        if unknown:
            _fail(f"variant {vid}: unknown section ids {sorted(unknown)}")
        if [s for s in SECTION_IDS if s in section_ids] != section_ids:
            _fail(f"variant {vid}: sections must follow sectionOrder")
        sections: list[SectionConfig] = []
        for s in v["sections"]:
            sid = s["id"]
            roles = tuple(s.get("roles", ()))
            fields = tuple(s.get("fields", ()))
            required = bool(s.get("required", False))
            if sid in STRUCTURAL_SECTIONS and not required:
                _fail(f"variant {vid}: section {sid} must be required")
            if roles and sid != "profiles":
                _fail(f"variant {vid}: only profiles may declare roles")
            if sid == "profiles" and not roles:
                _fail(f"variant {vid}: profiles needs at least one role")
            if set(roles) - set(profile_roles):
                _fail(f"variant {vid}: unknown profile roles {sorted(set(roles) - set(profile_roles))}")
            allowed_fields = {"milestone": set(milestone_fields), "profiles": _PERSON_FIELDS}.get(sid, set())
            if set(fields) - allowed_fields:
                _fail(f"variant {vid}: unknown fields for {sid}: {sorted(set(fields) - allowed_fields)}")
            defaults = dict(s.get("defaults", {}))
            if set(defaults) - set(fields):
                _fail(f"variant {vid}: defaults for {sid} must be listed fields")
            if not isinstance(s.get("defaultEnabled"), bool) or (required and not s["defaultEnabled"]):
                _fail(f"variant {vid}: section {sid} needs a boolean defaultEnabled (true when required)")
            sections.append(SectionConfig(sid, required, s["defaultEnabled"], roles, fields, defaults))
        missing = set(STRUCTURAL_SECTIONS) - set(section_ids)
        if missing:
            _fail(f"variant {vid}: missing structural sections {sorted(missing)}")
        presets = tuple(SessionPreset(p["type"], _label(p["title"], f"variant {vid} preset")) for p in v["sessionPresets"])
        for p in presets:
            if p.type not in session_types:
                _fail(f"variant {vid}: unknown session preset type {p.type!r}")
        rsvp_defaults = dict(v.get("rsvpDefaults", {}))
        if set(rsvp_defaults) - _RSVP_DEFAULT_KEYS:
            _fail(f"variant {vid}: unknown rsvpDefaults keys")
        variants[vid] = VariantConfig(
            vid, v["category"], _label(v["label"], f"variant {vid}"), tuple(sections), presets, rsvp_defaults,
        )

    for c in raw["categories"]:
        _label(c["label"], f"category {c['id']}")
        expected = [vid for vid in variant_ids if variants[vid].category == c["id"]]
        if c.get("variants") != expected:
            _fail(f"category {c['id']}: variants must list its variants in order")
        if not expected:
            _fail(f"category {c['id']} has no variants")

    templates: dict[str, TemplateCompat] = {}

    def add_template(tid: str, cats: Any, vars_: Any) -> None:
        if tid in templates:
            _fail(f"duplicate template id {tid!r}")
        if tid not in selectable:
            _fail(f"template {tid!r} is not in selectable_theme_ids.json")
        if not cats or set(cats) - set(categories):
            _fail(f"template {tid}: unknown categories")
        if vars_ is not None and (not vars_ or set(vars_) - set(variant_ids)
                                  or any(variants[x].category not in cats for x in vars_)):
            _fail(f"template {tid}: variants must belong to its categories")
        templates[tid] = TemplateCompat(tid, tuple(cats), None if vars_ is None else tuple(vars_))

    for t in raw["templates"]:
        add_template(t["id"], t["categories"], t.get("variants"))
    legacy = raw["legacyTemplates"]
    for tid in sorted(selectable - set(templates)):
        add_template(tid, legacy["categories"], legacy["variants"])

    return Registry(
        raw=raw,
        categories=tuple(categories),
        variants=variants,
        session_types=session_types,
        profile_roles=profile_roles,
        milestone_fields=milestone_fields,
        templates=templates,
        default_timezone=raw["defaultTimezone"],
    )


def load(path: Path = _PATH, selectable: frozenset[str] = SELECTABLE_THEME_IDS) -> Registry:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        return _parse(raw, selectable)
    except (KeyError, TypeError, AttributeError) as exc:
        raise RegistryError(f"{path.name}: malformed ({exc!r})") from exc


REGISTRY: Registry = load()

CATEGORY_IDS: tuple[str, ...] = REGISTRY.categories
VARIANT_IDS: tuple[str, ...] = tuple(REGISTRY.variants)
VARIANT_PAIRS: tuple[tuple[str, str], ...] = tuple((v.category, v.id) for v in REGISTRY.variants.values())
SESSION_TYPES: tuple[str, ...] = REGISTRY.session_types
PROFILE_ROLES: tuple[str, ...] = REGISTRY.profile_roles
DEFAULT_TIMEZONE: str = REGISTRY.default_timezone


def get_variant(variant_id: str) -> VariantConfig:
    return REGISTRY.variants[variant_id]


def is_valid_pair(category: str, variant: str) -> bool:
    config = REGISTRY.variants.get(variant)
    return config is not None and config.category == category


def template_supports(theme_id: str, category: str, variant: str) -> bool:
    compat = REGISTRY.templates.get(theme_id)
    if compat is None or category not in compat.categories:
        return False
    return compat.variants is None or variant in compat.variants


def public_document() -> dict[str, Any]:
    """`GET /invitation-types`: the registry plus the expanded template compatibility list."""
    doc = {k: v for k, v in REGISTRY.raw.items() if k != "legacyTemplates"}
    doc["templates"] = [
        {"id": t.id, "categories": list(t.categories), **({"variants": list(t.variants)} if t.variants else {})}
        for t in REGISTRY.templates.values()
    ]
    return doc

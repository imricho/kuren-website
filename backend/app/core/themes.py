"""Allowlist of theme ids a couple may select.

`selectable_theme_ids.json` is generated from the frontend template registry
(only `available` templates; drafts and planned ones are excluded). It is
loaded once at import time.
"""

import json
from pathlib import Path

_ALLOWLIST_PATH = Path(__file__).with_name("selectable_theme_ids.json")


def _load() -> frozenset[str]:
    ids = json.loads(_ALLOWLIST_PATH.read_text(encoding="utf-8"))
    if not isinstance(ids, list) or not all(isinstance(i, str) for i in ids):
        raise RuntimeError(f"{_ALLOWLIST_PATH.name} must be a JSON array of strings")
    return frozenset(ids)


SELECTABLE_THEME_IDS: frozenset[str] = _load()


def is_selectable_theme(theme_id: str) -> bool:
    return theme_id in SELECTABLE_THEME_IDS

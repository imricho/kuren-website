"""Text hygiene shared by every request schema.

- `check_controls`: NUL and other C0/C1 control characters are never accepted (Postgres
  rejects NUL in text, and controls have no place in content). Only `\\n` and `\\t` pass.
- `clean_guest_text`: stricter rules for free text typed by anonymous guests (RSVP):
  NFC-normalised, bidi overrides/isolates and zero-width characters stripped (they can
  visually reorder or hide text in the owner's list and CSV), and no control characters
  at all except `\\n` where line breaks make sense.
"""

import re
import unicodedata
from typing import Any

# C0 except \t (09) and \n (0A); DEL; C1.
_CONTROL = re.compile(r"[\x00-\x08\x0b-\x1f\x7f-\x9f]")
# Zero-width/marks U+200B-200F, bidi embeddings/overrides U+202A-202E, isolates U+2066-2069.
_INVISIBLE = re.compile(r"[​-‏‪-‮⁦-⁩]")
CONTROL_MESSAGE = "must not contain control characters"


def check_controls(value: str) -> str:
    if _CONTROL.search(value):
        raise ValueError(CONTROL_MESSAGE)
    return value


def check_controls_deep(value: Any) -> Any:
    """`check_controls` on every string (and dict key) inside a raw JSON value."""
    if isinstance(value, str):
        check_controls(value)
    elif isinstance(value, dict):
        for key, item in value.items():
            check_controls_deep(key)
            check_controls_deep(item)
    elif isinstance(value, list | tuple):
        for item in value:
            check_controls_deep(item)
    return value


def clean_guest_text(value: Any, *, multiline: bool = False) -> Any:
    if not isinstance(value, str):
        return value
    value = _INVISIBLE.sub("", unicodedata.normalize("NFC", value))
    check_controls(value)
    if "\t" in value or (not multiline and "\n" in value):
        raise ValueError("must be a single line of text" if not multiline else CONTROL_MESSAGE)
    return value

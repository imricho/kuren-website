"""Wire schemas for the Wedding CMS API (docs/api/weddings.md).

All JSON is camelCase. Request models reject unknown keys, trim strings and
treat an empty string as "not set" (None). Response models are documentation
shaped: handlers return dicts built by `wedding_content_service`, and routes use
`response_model_exclude_unset=True` so keys that are not set are omitted.
"""

import re
import uuid
from datetime import date, datetime, time
from typing import Annotated, Any, Literal
from urllib.parse import urlsplit

from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    PlainSerializer,
    StringConstraints,
    ValidationInfo,
    field_validator,
)
from pydantic.alias_generators import to_camel

from app.core.themes import is_selectable_theme
from app.models.wedding import EVENT_TYPES

Locale = Literal["en", "id"]
EventType = Literal["engagement", "akad", "holy_matrimony", "ceremony", "reception", "other"]
assert set(EventType.__args__) == set(EVENT_TYPES)  # type: ignore[attr-defined]

# Unanchored; Python code uses re.fullmatch (a `$` anchor would accept a trailing "\n").
PUBLIC_ID_CHARS = r"[A-Za-z0-9_-]{1,64}"
# For pydantic's Rust regex engine, where `$` only matches at the very end.
PUBLIC_ID_PATTERN = rf"^{PUBLIC_ID_CHARS}$"
URL_MAX_LENGTH = 2048

# --- Reusable field types ---------------------------------------------------------------


def _blank_to_none(value: Any) -> Any:
    """Trim strings; an empty string means "not set"."""
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


def _opt_str(max_length: int) -> Any:
    bounded = Annotated[str, StringConstraints(max_length=max_length)]
    return Annotated[bounded | None, BeforeValidator(_blank_to_none), Field(default=None)]


Str40 = _opt_str(40)
Str60 = _opt_str(60)
Str120 = _opt_str(120)
Str160 = _opt_str(160)
Str200 = _opt_str(200)
Str500 = _opt_str(500)
Str2000 = _opt_str(2000)

_ISO_DATE = re.compile(r"\d{4}-\d{2}-\d{2}")
_HH_MM = re.compile(r"([01]\d|2[0-3]):[0-5]\d")


def _parse_date(value: Any) -> Any:
    value = _blank_to_none(value)
    if value is None or isinstance(value, date):
        return value
    if not isinstance(value, str) or not _ISO_DATE.fullmatch(value):
        raise ValueError("must be a date in YYYY-MM-DD format")
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ValueError("must be a valid calendar date") from None


def _parse_time(value: Any) -> Any:
    value = _blank_to_none(value)
    if value is None or isinstance(value, time):
        return value
    if not isinstance(value, str) or not _HH_MM.fullmatch(value):
        raise ValueError("must be a time in HH:mm (24-hour) format")
    return time.fromisoformat(value)


def format_time(value: time) -> str:
    return value.strftime("%H:%M")


OptDate = Annotated[date | None, BeforeValidator(_parse_date), Field(default=None)]
OptTime = Annotated[
    time | None,
    BeforeValidator(_parse_time),
    PlainSerializer(lambda t: None if t is None else format_time(t), return_type=str | None),
    Field(default=None),
]

_CONTROL_OR_SPACE = re.compile(r"[\s\x00-\x1f\x7f\\]")


def _check_http_url(value: str, *, https_only: bool = False) -> str:
    if len(value) > URL_MAX_LENGTH:
        raise ValueError(f"must be at most {URL_MAX_LENGTH} characters")
    if _CONTROL_OR_SPACE.search(value):
        raise ValueError("must be a valid URL")
    try:
        parts = urlsplit(value)
        hostname = parts.hostname
        parts.port  # noqa: B018  (raises ValueError on a malformed port)
    except ValueError:
        raise ValueError("must be a valid URL") from None
    allowed = ("https",) if https_only else ("http", "https")
    if parts.scheme.lower() not in allowed or not hostname:
        raise ValueError("must be an https URL" if https_only else "must be an http(s) URL")
    if parts.username is not None or parts.password is not None:
        raise ValueError("must not contain credentials")
    return value


def _validate_http_url(value: str | None) -> str | None:
    return None if value is None else _check_http_url(value)


_INSTAGRAM_HOSTS = {"instagram.com", "www.instagram.com"}


def _validate_instagram_url(value: str | None) -> str | None:
    if value is None:
        return None
    _check_http_url(value, https_only=True)
    if (urlsplit(value).hostname or "").lower() not in _INSTAGRAM_HOSTS:
        raise ValueError("must be an instagram.com URL")
    return value


# Same-origin images are only allowed from the bundled sample assets or uploaded media,
# so a src can never point at an arbitrary same-origin path such as an API endpoint.
_SAME_ORIGIN_IMAGE = re.compile(r"/sample-wedding/[A-Za-z0-9_.-]+")
#: An uploaded asset: `/media/<lowercase uuid>.<ext>` (see media_service).
MEDIA_SRC = re.compile(r"/media/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(jpg|png|webp)")
_IMAGE_SRC_ERROR = "must be an http(s) URL, an uploaded /media/ image or a path under /sample-wedding/"


def _validate_image_src(value: str) -> str:
    if value.startswith("/") and not value.startswith("//"):
        if MEDIA_SRC.fullmatch(value):
            return value
        if not _SAME_ORIGIN_IMAGE.fullmatch(value) or ".." in value:
            raise ValueError(_IMAGE_SRC_ERROR)
        return value
    try:
        return _check_http_url(value)
    except ValueError:
        raise ValueError(_IMAGE_SRC_ERROR) from None


def _pattern(regex: str, message: str) -> Any:
    compiled = re.compile(regex)

    def check(value: str | None) -> str | None:
        if value is not None and not compiled.fullmatch(value):
            raise ValueError(message)
        return value

    return check


# Digits with optional single spaces/hyphens. Rejects letters and invisible
# bidi/control characters that could visually reorder a number.
AccountNumber = Annotated[
    str,
    StringConstraints(min_length=1, max_length=40, strict=True),
    AfterValidator(_pattern(r"[0-9]+(?:[ -][0-9]+)*", "use digits only (spaces or hyphens allowed)")),
]
PhoneNumber = Annotated[
    str | None,
    BeforeValidator(_blank_to_none),
    AfterValidator(_pattern(r"\+?[0-9]+(?:[ -][0-9]+)*", "use digits, spaces, hyphens and an optional leading +")),
    Field(default=None, max_length=30),
]
# Language of a text block (BCP 47 subset, e.g. "ar", "id", "zh-Hant"), used for `lang=`.
LangTag = Annotated[
    str | None,
    BeforeValidator(_blank_to_none),
    AfterValidator(_pattern(r"[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*", "must be a language code such as ar, id or en")),
    Field(default=None, max_length=35),
]
HttpsUrl = Annotated[
    str | None,
    BeforeValidator(_blank_to_none),
    AfterValidator(lambda v: None if v is None else _check_http_url(v, https_only=True)),
    Field(default=None),
]
MapsUrl = Annotated[str | None, BeforeValidator(_blank_to_none), AfterValidator(_validate_http_url), Field(default=None)]
InstagramUrl = Annotated[
    str | None, BeforeValidator(_blank_to_none), AfterValidator(_validate_instagram_url), Field(default=None)
]
ImageSrc = Annotated[str, BeforeValidator(_blank_to_none), AfterValidator(_validate_image_src)]
AltText = Annotated[
    Annotated[str, StringConstraints(min_length=1, max_length=300)], BeforeValidator(_blank_to_none)
]
Percent = Annotated[int, Field(ge=0, le=100, strict=True)]


# --- Base models ------------------------------------------------------------------------


class RequestModel(BaseModel):
    """camelCase-only input; unknown (including snake_case) keys are rejected."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=False, extra="forbid")


class ResponseModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


# --- Shared value types -----------------------------------------------------------------


class FocalPoint(RequestModel):
    x: Percent
    y: Percent


class ImageAsset(RequestModel):
    src: ImageSrc
    alt: AltText
    focal_point: FocalPoint | None = None


# --- Wedding record ---------------------------------------------------------------------


def _validate_theme_id(value: Any) -> Any:
    value = _blank_to_none(value)
    if value is None:
        return None
    if not isinstance(value, str) or not is_selectable_theme(value):
        raise ValueError("is not a selectable theme")
    return value


ThemeId = Annotated[str | None, BeforeValidator(_validate_theme_id), Field(default=None)]


class WeddingCreate(RequestModel):
    theme_id: ThemeId
    locale: Locale = "en"


class WeddingUpdate(RequestModel):
    """PATCH: only keys present in the body are applied."""

    theme_id: ThemeId
    locale: Locale | None = None

    @field_validator("locale")
    @classmethod
    def _locale_not_null(cls, value: Locale | None) -> Locale:
        if value is None:
            raise ValueError("must be 'en' or 'id'")
        return value


class PublicationSummary(ResponseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)

    published_at: datetime
    #: Content revision that was published.
    revision: int
    theme_id: str


class WeddingRead(ResponseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)

    id: uuid.UUID
    theme_id: str | None
    locale: Locale
    status: Literal["draft", "published"]
    published_at: datetime | None
    #: Content revision; send it back as `If-Match: "<revision>"` on content writes.
    revision: int
    #: Public URL slug (assigned on first publish, then stable); null before.
    slug: str | None
    #: Published, and the draft content revision or theme differs from the live snapshot.
    has_unpublished_changes: bool
    #: The live publication, or null when not published.
    publication: PublicationSummary | None
    created_at: datetime
    updated_at: datetime


class PublicWeddingOut(ResponseModel):
    theme_id: str
    locale: Locale
    #: The allow-listed snapshot, in draft shape.
    content: dict[str, Any]
    published_at: datetime


class AssetOut(ResponseModel):
    id: uuid.UUID
    src: str
    width: int
    height: int
    kind: Literal["image", "qris"]


# --- Sections ---------------------------------------------------------------------------


def _none_to_empty(value: Any) -> Any:
    return {} if value is None else value


class GuestGreeting(RequestModel):
    """Opening line for a named guest, e.g. "Kepada Yth." + the `?to=` name in the link."""

    enabled: bool = Field(default=False, strict=True)
    label: Str120


class OpeningSection(RequestModel):
    wedding_title: Str120
    couple_names: Str120
    headline: Str200
    introduction: Str2000
    cover_image: ImageAsset | None = None
    wedding_date: OptDate
    guest_greeting: GuestGreeting | None = None


class PersonDraft(RequestModel):
    name: Str120
    nickname: Str40
    image: ImageAsset | None = None
    description: Str2000
    parents: Str200
    instagram_url: InstagramUrl


PersonField = Annotated[PersonDraft, BeforeValidator(_none_to_empty)]


class CoupleSection(RequestModel):
    groom: PersonField = Field(default_factory=PersonDraft)
    bride: PersonField = Field(default_factory=PersonDraft)


_ShowFlag = Annotated[bool, BeforeValidator(lambda v: True if v is None else v), Field(strict=True)]


class StoryMeta(RequestModel):
    title: Str120
    introduction: Str2000
    #: "Show on website". Optional sections can be hidden without losing their content.
    enabled: _ShowFlag = True


class GalleryMeta(RequestModel):
    title: Str120
    description: Str2000
    enabled: _ShowFlag = True


class RsvpSection(RequestModel):
    title: Str120
    introduction: Str2000
    enabled: Annotated[bool, BeforeValidator(lambda v: True if v is None else v), Field(strict=True)] = True
    deadline: OptDate
    confirmation_message: Str500
    max_guests_per_response: Annotated[int | None, Field(default=None, ge=1, le=20, strict=True)]


class ClosingSection(RequestModel):
    message: Str2000
    thank_you: Str200
    image: ImageAsset | None = None
    #: "Turut mengundang" — family acknowledgments, line breaks preserved.
    family_acknowledgments: Str2000


SECTION_MODELS: dict[str, type[RequestModel]] = {
    "opening": OpeningSection,
    "couple": CoupleSection,
    "story": StoryMeta,
    "gallery": GalleryMeta,
    "rsvp": RsvpSection,
    "closing": ClosingSection,
}

# --- Collection items -------------------------------------------------------------------


class StoryEntryIn(RequestModel):
    title: Str120
    date: Str60  # free-text label, e.g. "March 2018"
    description: Str2000
    image: ImageAsset | None = None


class DressCode(RequestModel):
    enabled: bool = Field(default=False, strict=True)
    text: Str200


class Livestream(RequestModel):
    enabled: bool = Field(default=False, strict=True)
    url: HttpsUrl
    label: Str120


class EventIn(RequestModel):
    type: Annotated[EventType, BeforeValidator(lambda v: "other" if v is None else v)] = "other"
    title: Str120
    date: OptDate
    start_time: OptTime
    end_time: OptTime
    venue_name: Str160
    address: Str500
    maps_url: MapsUrl
    description: Str2000
    dress_code: DressCode | None = None
    livestream: Livestream | None = None

    @field_validator("end_time")
    @classmethod
    def _end_after_start(cls, value: time | None, info: ValidationInfo) -> time | None:
        start = info.data.get("start_time")
        if value is not None and start is not None and value <= start:
            raise ValueError("must be later than startTime")
        return value


class GalleryItemIn(RequestModel):
    src: ImageSrc
    alt: AltText
    caption: Str200
    focal_point: FocalPoint | None = None


PublicId = Annotated[str | None, Field(default=None, pattern=PUBLIC_ID_PATTERN)]


class StoryEntryWithId(StoryEntryIn):
    id: PublicId


class EventWithId(EventIn):
    id: PublicId


class GalleryItemWithId(GalleryItemIn):
    id: PublicId


class ReorderRequest(RequestModel):
    ids: list[Annotated[str, StringConstraints(max_length=64)]] = Field(max_length=100)


# --- Full content PUT -------------------------------------------------------------------


class StoryContentIn(StoryMeta):
    timeline: list[StoryEntryWithId] = Field(max_length=100)


class GalleryContentIn(GalleryMeta):
    images: list[GalleryItemWithId] = Field(max_length=200)


class OptionalSection(RequestModel):
    enabled: bool = Field(default=False, strict=True)


class HolyReciteSection(OptionalSection):
    """Sacred text exactly as the couple entered it (never rewritten or invented)."""

    title: Str120
    tradition: Str120
    book: Str120
    reference: Str200
    passage: Str2000
    original_script: Str2000
    original_language: LangTag
    translation: Str2000
    translation_language: LangTag
    attribution: Str200


class MessageSection(OptionalSection):
    title: Str120
    message: Str2000


class GreetingSection(MessageSection):
    prayer: Str2000


class CountdownSection(OptionalSection):
    """Wedding Date & Countdown options; the date itself lives in `opening.weddingDate`."""

    add_to_calendar: bool = Field(default=False, strict=True)


class WishesSection(OptionalSection):
    title: Str120
    introduction: Str2000


class BankAccount(RequestModel):
    id: Annotated[str | None, StringConstraints(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")] = None
    bank_name: Annotated[str, StringConstraints(min_length=1, max_length=120)]
    account_holder: Annotated[str, StringConstraints(min_length=1, max_length=120)]
    # Never coerce numbers: leading zeroes are meaningful account data.
    account_number: AccountNumber


class PhysicalGifts(OptionalSection):
    recipient: Str120
    address: Str500
    note: Str500
    phone: PhoneNumber


class AmplopDigitalSection(MessageSection):
    bank_accounts_enabled: bool = Field(default=False, strict=True)
    bank_accounts: list[BankAccount] = Field(default_factory=list, max_length=20)
    qris_enabled: bool = Field(default=False, strict=True)
    qris_image: ImageAsset | None = None
    physical_gifts: PhysicalGifts | None = None

    @field_validator("bank_accounts")
    @classmethod
    def _unique_account_ids(cls, accounts: list[BankAccount]) -> list[BankAccount]:
        ids = [a.id for a in accounts if a.id is not None]
        if len(ids) != len(set(ids)):
            raise ValueError("bank account ids must be unique")
        return accounts


UNIVERSAL_FIELDS = (
    "content_version", "holy_recite1", "holy_recite2", "greeting", "countdown", "wishes", "amplop_digital",
)


#: Universal (v1.1+) sections stored in `weddings.universal_content`, keyed by camelCase id.
UNIVERSAL_SECTION_MODELS: dict[str, type[RequestModel]] = {
    "holyRecite1": HolyReciteSection,
    "holyRecite2": HolyReciteSection,
    "greeting": GreetingSection,
    "countdown": CountdownSection,
    "wishes": WishesSection,
    "amplopDigital": AmplopDigitalSection,
}


class WeddingDraftIn(RequestModel):
    content_version: Literal["1.1", "1.2"] | None = None
    holy_recite1: HolyReciteSection | None = None
    holy_recite2: HolyReciteSection | None = None
    greeting: GreetingSection | None = None
    countdown: CountdownSection | None = None
    wishes: WishesSection | None = None
    amplop_digital: AmplopDigitalSection | None = None
    schema_version: Literal[1] | None = None
    locale: Locale | None = None
    opening: OpeningSection
    couple: CoupleSection
    story: StoryContentIn
    events: list[EventWithId] = Field(max_length=100)
    gallery: GalleryContentIn
    rsvp: RsvpSection
    closing: ClosingSection


# --- Responses (documentation shape; keys that are not set are omitted) ----------------


class FocalPointOut(ResponseModel):
    x: int
    y: int


class ImageAssetOut(ResponseModel):
    src: str
    alt: str
    focal_point: FocalPointOut | None = None


class GuestGreetingOut(ResponseModel):
    enabled: bool = False
    label: str | None = None


class OpeningOut(ResponseModel):
    wedding_title: str | None = None
    couple_names: str | None = None
    headline: str | None = None
    introduction: str | None = None
    cover_image: ImageAssetOut | None = None
    wedding_date: str | None = None
    guest_greeting: GuestGreetingOut | None = None


class PersonOut(ResponseModel):
    name: str | None = None
    nickname: str | None = None
    image: ImageAssetOut | None = None
    description: str | None = None
    parents: str | None = None
    instagram_url: str | None = None


class CoupleOut(ResponseModel):
    groom: PersonOut
    bride: PersonOut


class StoryMetaOut(ResponseModel):
    title: str | None = None
    introduction: str | None = None
    enabled: bool = True


class GalleryMetaOut(ResponseModel):
    title: str | None = None
    description: str | None = None
    enabled: bool = True


class RsvpOut(ResponseModel):
    title: str | None = None
    introduction: str | None = None
    enabled: bool
    deadline: str | None = None
    confirmation_message: str | None = None
    max_guests_per_response: int | None = None


class ClosingOut(ResponseModel):
    message: str | None = None
    thank_you: str | None = None
    image: ImageAssetOut | None = None
    family_acknowledgments: str | None = None


class StoryEntryOut(ResponseModel):
    id: str
    title: str | None = None
    date: str | None = None
    description: str | None = None
    image: ImageAssetOut | None = None


class DressCodeOut(ResponseModel):
    enabled: bool = False
    text: str | None = None


class LivestreamOut(ResponseModel):
    enabled: bool = False
    url: str | None = None
    label: str | None = None


class EventOut(ResponseModel):
    id: str
    type: EventType
    title: str | None = None
    date: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    venue_name: str | None = None
    address: str | None = None
    maps_url: str | None = None
    description: str | None = None
    dress_code: DressCodeOut | None = None
    livestream: LivestreamOut | None = None


class GalleryItemOut(ResponseModel):
    id: str
    src: str
    alt: str
    caption: str | None = None
    focal_point: FocalPointOut | None = None


class StoryOut(StoryMetaOut):
    timeline: list[StoryEntryOut]


class GalleryOut(GalleryMetaOut):
    images: list[GalleryItemOut]


class OptionalSectionOut(ResponseModel):
    enabled: bool = False


class HolyReciteOut(OptionalSectionOut):
    title: str | None = None
    tradition: str | None = None
    book: str | None = None
    reference: str | None = None
    passage: str | None = None
    original_script: str | None = None
    original_language: str | None = None
    translation: str | None = None
    translation_language: str | None = None
    attribution: str | None = None


class GreetingOut(OptionalSectionOut):
    title: str | None = None
    message: str | None = None
    prayer: str | None = None


class CountdownOut(OptionalSectionOut):
    add_to_calendar: bool = False


class WishesOut(OptionalSectionOut):
    title: str | None = None
    introduction: str | None = None


class BankAccountOut(ResponseModel):
    id: str | None = None
    bank_name: str
    account_holder: str
    account_number: str


class PhysicalGiftsOut(OptionalSectionOut):
    recipient: str | None = None
    address: str | None = None
    note: str | None = None
    phone: str | None = None


class AmplopDigitalOut(OptionalSectionOut):
    title: str | None = None
    message: str | None = None
    bank_accounts_enabled: bool = False
    bank_accounts: list[BankAccountOut] = Field(default_factory=list)
    qris_enabled: bool = False
    qris_image: ImageAssetOut | None = None
    physical_gifts: PhysicalGiftsOut | None = None


UNIVERSAL_SECTION_OUT_MODELS: dict[str, type[ResponseModel]] = {
    "holyRecite1": HolyReciteOut,
    "holyRecite2": HolyReciteOut,
    "greeting": GreetingOut,
    "countdown": CountdownOut,
    "wishes": WishesOut,
    "amplopDigital": AmplopDigitalOut,
}


class WeddingDraftOut(ResponseModel):
    content_version: Literal["1.1", "1.2"] | None = None
    holy_recite1: HolyReciteOut | None = None
    holy_recite2: HolyReciteOut | None = None
    greeting: GreetingOut | None = None
    countdown: CountdownOut | None = None
    wishes: WishesOut | None = None
    amplop_digital: AmplopDigitalOut | None = None
    schema_version: Literal[1]
    locale: Locale
    opening: OpeningOut
    couple: CoupleOut
    story: StoryOut
    events: list[EventOut]
    gallery: GalleryOut
    rsvp: RsvpOut
    closing: ClosingOut


class PreviewOut(ResponseModel):
    theme_id: str | None
    content: WeddingDraftOut


SECTION_OUT_MODELS: dict[str, type[ResponseModel]] = {
    "opening": OpeningOut,
    "couple": CoupleOut,
    "story": StoryMetaOut,
    "gallery": GalleryMetaOut,
    "rsvp": RsvpOut,
    "closing": ClosingOut,
}

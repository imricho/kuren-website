"""Wire schemas for the Invitation CMS API (docs/api/invitations.md).

All JSON is camelCase. Request models reject unknown keys, trim strings and
treat an empty string as "not set" (None). Response models are documentation
shaped and tolerant: handlers return dicts built by `invitation_content_service`,
and routes use `response_model_exclude_unset=True` so keys that are not set are omitted.

Variant-dependent rules (which sections a variant offers, allowed profile roles) need
the invitation, so they are enforced by the services, not here.
"""

import re
import uuid
import zoneinfo
from datetime import date, datetime, time
from functools import lru_cache
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
    model_validator,
)
from pydantic.alias_generators import to_camel

from app.core import invitation_registry as registry
from app.core.themes import is_selectable_theme
from app.models.invitation import EVENT_TYPES, TIMEZONE_MAX_LENGTH, TITLE_MAX_LENGTH
from app.schemas.text import check_controls_deep

Locale = Literal["en", "id"]
SessionFormat = Literal["in_person", "online", "hybrid"]
EventType = Literal[
    "engagement", "akad", "holy_matrimony", "ceremony", "reception", "party", "celebration",
    "session", "talk", "workshop", "gathering", "prayer", "dinner", "other",
]
assert set(EventType.__args__) == set(EVENT_TYPES)  # type: ignore[attr-defined]
CategoryId = Literal["wedding", "celebration", "gathering", "corporate"]
assert set(CategoryId.__args__) == set(registry.CATEGORY_IDS)  # type: ignore[attr-defined]
VariantId = Literal[
    "wedding_ceremony", "wedding_reception", "birthday", "sweet_17", "khitanan", "aqiqah", "engagement",
    "anniversary", "graduation", "religious_celebration", "family_reunion", "family_gathering",
    "community_gathering", "corporate_event", "company_celebration", "seminar", "workshop",
]
assert set(VariantId.__args__) == set(registry.VARIANT_IDS)  # type: ignore[attr-defined]
ProfileRole = Literal["celebrant", "child", "graduate", "host", "partner", "organizer"]
assert set(ProfileRole.__args__) == set(registry.PROFILE_ROLES)  # type: ignore[attr-defined]
ContentVersion = Literal["1.1", "1.2", "2.0"]
#: Stamped on every content write; "1.1"/"1.2" stay readable.
CONTENT_VERSION = "2.0"

# Unanchored; Python code uses re.fullmatch (a `$` anchor would accept a trailing "\n").
PUBLIC_ID_CHARS = r"[A-Za-z0-9_-]{1,64}"
# For pydantic's Rust regex engine, where `$` only matches at the very end.
PUBLIC_ID_PATTERN = rf"^{PUBLIC_ID_CHARS}$"
URL_MAX_LENGTH = 2048
#: Client-facing ids of list items (collections, people, agenda items, fields, ...).
PublicId = Annotated[str | None, Field(default=None, pattern=PUBLIC_ID_PATTERN)]
SafeId = Annotated[str, StringConstraints(pattern=PUBLIC_ID_PATTERN, strict=True)]

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
Str80 = _opt_str(80)
Str1000 = _opt_str(1000)
Str2000 = _opt_str(2000)


def _req_str(max_length: int) -> Any:
    """Required, trimmed, non-empty string."""
    bounded = Annotated[str, StringConstraints(min_length=1, max_length=max_length)]
    return Annotated[bounded, BeforeValidator(_blank_to_none)]


ReqStr80 = _req_str(80)
ReqStr120 = _req_str(120)

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
    """camelCase-only input; unknown (including snake_case) keys are rejected, and no string
    anywhere in the body (dict keys included) may contain NUL or other control characters."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=False, extra="forbid")

    @field_validator("*", mode="before")
    @classmethod
    def _no_control_characters(cls, value: Any) -> Any:
        return check_controls_deep(value)


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


# --- Invitation record ------------------------------------------------------------------


def _validate_theme_id(value: Any) -> Any:
    value = _blank_to_none(value)
    if value is None:
        return None
    if not isinstance(value, str) or not is_selectable_theme(value):
        raise ValueError("is not a selectable theme")
    return value


ThemeId = Annotated[str | None, BeforeValidator(_validate_theme_id), Field(default=None)]


@lru_cache(maxsize=1)
def _timezones() -> frozenset[str]:
    return frozenset(zoneinfo.available_timezones())


def _validate_timezone(value: Any) -> Any:
    value = _blank_to_none(value)
    if value is None:
        return None
    if not isinstance(value, str) or len(value) > TIMEZONE_MAX_LENGTH or value not in _timezones():
        raise ValueError("must be an IANA time zone such as Asia/Jakarta")
    return value


Timezone = Annotated[str | None, BeforeValidator(_validate_timezone), Field(default=None)]
Title = _opt_str(TITLE_MAX_LENGTH)


class SessionSeed(RequestModel):
    """A session to create with the invitation (the creation wizard's choices)."""

    type: EventType
    title: Str120


class InvitationCreate(RequestModel):
    category: CategoryId
    variant: VariantId
    theme_id: ThemeId
    title: Title
    locale: Locale = "en"
    timezone: Timezone
    #: Sessions to start with, in order, replacing the variant's presets (e.g. ceremony only,
    #: or ceremony + reception). Omit to use the presets; [] starts with no sessions.
    sessions: list[SessionSeed] | None = Field(default=None, max_length=6)

    @model_validator(mode="after")
    def _valid_pair(self) -> "InvitationCreate":
        if not registry.is_valid_pair(self.category, self.variant):
            raise ValueError(f"variant {self.variant} does not belong to category {self.category}")
        return self


class LegacyWeddingCreate(RequestModel):
    """`POST /weddings` (legacy): always a `wedding_ceremony`."""

    theme_id: ThemeId
    locale: Locale = "en"


class InvitationUpdate(RequestModel):
    """PATCH: only keys present in the body are applied. Category/variant are immutable."""

    title: Title
    theme_id: ThemeId
    locale: Locale | None = None
    timezone: Timezone

    @field_validator("locale")
    @classmethod
    def _locale_not_null(cls, value: Locale | None) -> Locale:
        if value is None:
            raise ValueError("must be 'en' or 'id'")
        return value

    @field_validator("timezone")
    @classmethod
    def _timezone_not_null(cls, value: str | None) -> str:
        if value is None:
            raise ValueError("must be an IANA time zone such as Asia/Jakarta")
        return value


class PublicationSummary(ResponseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)

    published_at: datetime
    #: Content revision that was published.
    revision: int
    theme_id: str
    #: Time zone and language guests see until the next publish.
    timezone: str | None = None
    locale: str | None = None


class InvitationRead(ResponseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)

    id: uuid.UUID
    category: CategoryId
    variant: VariantId
    title: str | None
    timezone: str
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


class InvitationSummary(ResponseModel):
    id: uuid.UUID
    title: str | None
    category: CategoryId
    variant: VariantId
    theme_id: str | None
    status: Literal["draft", "published"]
    slug: str | None
    has_unpublished_changes: bool
    #: `opening.weddingDate` (the main event date), if set.
    event_date: str | None
    updated_at: datetime
    published_at: datetime | None


class InvitationList(ResponseModel):
    items: list[InvitationSummary]


class PublicInvitationOut(ResponseModel):
    category: CategoryId
    variant: VariantId
    theme_id: str
    locale: Locale
    timezone: str
    #: The allow-listed snapshot, in draft shape (plus `rsvp.full` when a capacity is reached).
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
    #: Only meaningful where the variant offers couple as optional (anniversary); unset = shown.
    enabled: bool | None = Field(default=None, strict=True)


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


def _unique_ids(items: list[Any], what: str) -> list[Any]:
    ids = [item.id for item in items if item.id is not None]
    if len(ids) != len(set(ids)):
        raise ValueError(f"{what} ids must be unique")
    return items


CollectContact = Literal["none", "email", "phone", "email_or_phone"]
RegistrationFieldType = Literal["text", "textarea", "email", "phone", "select", "checkbox"]
OptionText = Annotated[str, BeforeValidator(_blank_to_none), StringConstraints(min_length=1, max_length=80)]


class RegistrationField(RequestModel):
    """An extra question on the RSVP form. Answers are keyed by `id`."""

    id: PublicId
    label: ReqStr80
    type: RegistrationFieldType
    required: bool = Field(default=False, strict=True)
    #: `select` only: 1..20 distinct choices.
    options: list[OptionText] | None = Field(default=None, max_length=20)

    @model_validator(mode="after")
    def _options_match_type(self) -> "RegistrationField":
        if self.type == "select":
            if not self.options:
                raise ValueError("a select field needs at least one option")
            if len(set(self.options)) != len(self.options):
                raise ValueError("options must be unique")
        elif self.options:
            raise ValueError("only select fields have options")
        else:
            self.options = None
        return self


class RsvpSection(RequestModel):
    title: Str120
    introduction: Str2000
    enabled: Annotated[bool, BeforeValidator(lambda v: True if v is None else v), Field(strict=True)] = True
    deadline: OptDate
    confirmation_message: Str500
    #: Party-size limit per reply.
    max_guests_per_response: Annotated[int | None, Field(default=None, ge=1, le=20, strict=True)]
    #: Total attending people accepted (replies beyond it get 409 `capacity_reached`).
    capacity: Annotated[int | None, Field(default=None, ge=1, le=100_000, strict=True)]
    collect_contact: CollectContact | None = None
    #: Guests pick which optional sessions (`events[].optional`) they attend.
    allow_session_choice: bool | None = Field(default=None, strict=True)
    registration_fields: list[RegistrationField] | None = Field(default=None, max_length=10)

    @field_validator("registration_fields")
    @classmethod
    def _unique_field_ids(cls, value: list[RegistrationField] | None) -> list[RegistrationField] | None:
        return None if value is None else _unique_ids(value, "registration field")


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
    #: Last day of a multi-day session (inclusive); unset = same day as `date`.
    end_date: OptDate
    start_time: OptTime
    end_time: OptTime
    venue_name: Str160
    address: Str500
    maps_url: MapsUrl
    description: Str2000
    dress_code: DressCode | None = None
    livestream: Livestream | None = None
    #: A session guests may choose to attend (with `rsvp.allowSessionChoice`).
    optional: bool | None = Field(default=None, strict=True)
    #: in_person (default when unset; every session created before formats existed),
    #: online (no venue needed) or hybrid (venue AND online access).
    format: SessionFormat | None = None
    online_url: HttpsUrl
    online_label: Str120
    #: How to join when there is no link yet (e.g. "The Zoom link is emailed on the day").
    online_instructions: Str1000

    @field_validator("end_date")
    @classmethod
    def _end_date_after_date(cls, value: date | None, info: ValidationInfo) -> date | None:
        start = info.data.get("date")
        if value is not None and start is not None and value < start:
            raise ValueError("must not be before date")
        return value

    @field_validator("end_time")
    @classmethod
    def _end_after_start(cls, value: time | None, info: ValidationInfo) -> time | None:
        if "end_date" not in info.data:
            return value  # endDate itself is invalid: report that one error, not two
        start = info.data.get("start_time")
        day, last_day = info.data.get("date"), info.data.get("end_date")
        multi_day = day is not None and last_day is not None and last_day > day
        if value is not None and start is not None and value <= start and not multi_day:
            raise ValueError("must be later than startTime")
        return value


class GalleryItemIn(RequestModel):
    src: ImageSrc
    alt: AltText
    caption: Str200
    focal_point: FocalPoint | None = None




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


# --- v2.0 sections (stored in `universal_content`) -------------------------------------


class ProfilePerson(RequestModel):
    id: PublicId
    role: ProfileRole
    name: ReqStr120
    nickname: Str40
    image: ImageAsset | None = None
    description: Str2000
    parents: Str200
    birth_date: OptDate


class ProfilesSection(OptionalSection):
    """Celebrant / child / graduate / hosts / organizers. Allowed roles depend on the variant."""

    title: Str120
    people: list[ProfilePerson] = Field(default_factory=list, max_length=20)

    @field_validator("people")
    @classmethod
    def _unique(cls, value: list[ProfilePerson]) -> list[ProfilePerson]:
        return _unique_ids(value, "people")


class MilestoneSection(OptionalSection):
    """What is being celebrated; the variant decides which fields are published."""

    title: Str120
    age: Annotated[int | None, Field(default=None, ge=1, le=150, strict=True)]
    years: Annotated[int | None, Field(default=None, ge=1, le=100, strict=True)]
    occasion: Str120
    institution: Str160
    program: Str160
    degree: Str160
    party_theme: Str200
    description: Str2000


class OrganizationSection(OptionalSection):
    name: Str160
    tagline: Str200
    description: Str2000
    logo: ImageAsset | None = None
    website_url: HttpsUrl


class AgendaItem(RequestModel):
    id: PublicId
    time: OptTime
    end_time: OptTime
    title: ReqStr120
    description: Str2000
    #: An `events[].id` (dangling references are dropped when publishing).
    session_id: PublicId
    #: `speakers.people[].id` values.
    speaker_ids: list[SafeId] = Field(default_factory=list, max_length=30)

    @field_validator("end_time")
    @classmethod
    def _end_after_start(cls, value: time | None, info: ValidationInfo) -> time | None:
        start = info.data.get("time")
        if value is not None and start is not None and value <= start:
            raise ValueError("must be later than time")
        return value

    @field_validator("speaker_ids")
    @classmethod
    def _unique_speakers(cls, value: list[str]) -> list[str]:
        if len(set(value)) != len(value):
            raise ValueError("speaker ids must be unique")
        return value


class AgendaSection(OptionalSection):
    title: Str120
    items: list[AgendaItem] = Field(default_factory=list, max_length=50)

    @field_validator("items")
    @classmethod
    def _unique(cls, value: list[AgendaItem]) -> list[AgendaItem]:
        return _unique_ids(value, "agenda item")


class Speaker(RequestModel):
    id: PublicId
    name: ReqStr120
    role: Str120
    organization: Str160
    image: ImageAsset | None = None
    bio: Str2000


class SpeakersSection(OptionalSection):
    title: Str120
    people: list[Speaker] = Field(default_factory=list, max_length=30)

    @field_validator("people")
    @classmethod
    def _unique(cls, value: list[Speaker]) -> list[Speaker]:
        return _unique_ids(value, "speaker")


UNIVERSAL_FIELDS = (
    "content_version", "holy_recite1", "holy_recite2", "greeting", "countdown", "wishes", "amplop_digital",
    "profiles", "milestone", "organization", "agenda", "speakers",
)


#: Universal (v1.1+) sections stored in `invitations.universal_content`, keyed by camelCase id.
UNIVERSAL_SECTION_MODELS: dict[str, type[RequestModel]] = {
    "holyRecite1": HolyReciteSection,
    "holyRecite2": HolyReciteSection,
    "greeting": GreetingSection,
    "countdown": CountdownSection,
    "wishes": WishesSection,
    "amplopDigital": AmplopDigitalSection,
    "profiles": ProfilesSection,
    "milestone": MilestoneSection,
    "organization": OrganizationSection,
    "agenda": AgendaSection,
    "speakers": SpeakersSection,
}


class InvitationDraftIn(RequestModel):
    """PUT /content. `couple`/`story`/`gallery`/`rsvp` are required when the variant offers
    them and rejected (422 `section_not_available`) when it does not (checked by the service)."""

    content_version: ContentVersion | None = None
    holy_recite1: HolyReciteSection | None = None
    holy_recite2: HolyReciteSection | None = None
    greeting: GreetingSection | None = None
    countdown: CountdownSection | None = None
    wishes: WishesSection | None = None
    amplop_digital: AmplopDigitalSection | None = None
    profiles: ProfilesSection | None = None
    milestone: MilestoneSection | None = None
    organization: OrganizationSection | None = None
    agenda: AgendaSection | None = None
    speakers: SpeakersSection | None = None
    schema_version: Literal[1, 2] | None = None
    locale: Locale | None = None
    opening: OpeningSection
    couple: CoupleSection | None = None
    story: StoryContentIn | None = None
    events: list[EventWithId] = Field(max_length=100)
    gallery: GalleryContentIn | None = None
    rsvp: RsvpSection | None = None
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
    enabled: bool | None = None


class StoryMetaOut(ResponseModel):
    title: str | None = None
    introduction: str | None = None
    enabled: bool = True


class GalleryMetaOut(ResponseModel):
    title: str | None = None
    description: str | None = None
    enabled: bool = True


class RegistrationFieldOut(ResponseModel):
    id: str
    label: str
    type: str
    required: bool = False
    options: list[str] | None = None


class RsvpOut(ResponseModel):
    title: str | None = None
    introduction: str | None = None
    enabled: bool
    deadline: str | None = None
    confirmation_message: str | None = None
    max_guests_per_response: int | None = None
    capacity: int | None = None
    collect_contact: str | None = None
    allow_session_choice: bool | None = None
    registration_fields: list[RegistrationFieldOut] | None = None


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
    optional: bool | None = None
    format: SessionFormat | None = None
    online_url: str | None = None
    online_label: str | None = None
    online_instructions: str | None = None
    end_date: str | None = None


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


class ProfilePersonOut(ResponseModel):
    id: str
    role: str
    name: str
    nickname: str | None = None
    image: ImageAssetOut | None = None
    description: str | None = None
    parents: str | None = None
    birth_date: str | None = None


class ProfilesOut(OptionalSectionOut):
    title: str | None = None
    people: list[ProfilePersonOut] = Field(default_factory=list)


class MilestoneOut(OptionalSectionOut):
    title: str | None = None
    age: int | None = None
    years: int | None = None
    occasion: str | None = None
    institution: str | None = None
    program: str | None = None
    degree: str | None = None
    party_theme: str | None = None
    description: str | None = None


class OrganizationOut(OptionalSectionOut):
    name: str | None = None
    tagline: str | None = None
    description: str | None = None
    logo: ImageAssetOut | None = None
    website_url: str | None = None


class AgendaItemOut(ResponseModel):
    id: str
    time: str | None = None
    end_time: str | None = None
    title: str
    description: str | None = None
    session_id: str | None = None
    speaker_ids: list[str] = Field(default_factory=list)


class AgendaOut(OptionalSectionOut):
    title: str | None = None
    items: list[AgendaItemOut] = Field(default_factory=list)


class SpeakerOut(ResponseModel):
    id: str
    name: str
    role: str | None = None
    organization: str | None = None
    image: ImageAssetOut | None = None
    bio: str | None = None


class SpeakersOut(OptionalSectionOut):
    title: str | None = None
    people: list[SpeakerOut] = Field(default_factory=list)


UNIVERSAL_SECTION_OUT_MODELS: dict[str, type[ResponseModel]] = {
    "holyRecite1": HolyReciteOut,
    "holyRecite2": HolyReciteOut,
    "greeting": GreetingOut,
    "countdown": CountdownOut,
    "wishes": WishesOut,
    "amplopDigital": AmplopDigitalOut,
    "profiles": ProfilesOut,
    "milestone": MilestoneOut,
    "organization": OrganizationOut,
    "agenda": AgendaOut,
    "speakers": SpeakersOut,
}


class InvitationDraftOut(ResponseModel):
    content_version: ContentVersion | None = None
    holy_recite1: HolyReciteOut | None = None
    holy_recite2: HolyReciteOut | None = None
    greeting: GreetingOut | None = None
    countdown: CountdownOut | None = None
    wishes: WishesOut | None = None
    amplop_digital: AmplopDigitalOut | None = None
    profiles: ProfilesOut | None = None
    milestone: MilestoneOut | None = None
    organization: OrganizationOut | None = None
    agenda: AgendaOut | None = None
    speakers: SpeakersOut | None = None
    schema_version: int
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
    content: InvitationDraftOut


SECTION_OUT_MODELS: dict[str, type[ResponseModel]] = {
    "opening": OpeningOut,
    "couple": CoupleOut,
    "story": StoryMetaOut,
    "gallery": GalleryMetaOut,
    "rsvp": RsvpOut,
    "closing": ClosingOut,
}

#: Every section id has exactly one storage model (core column or `universal_content`).
assert set(SECTION_MODELS) | set(UNIVERSAL_SECTION_MODELS) | {"events"} == set(registry.SECTION_IDS)


class PublishIssueOut(ResponseModel):
    section: str
    field: str
    code: str
    message: str


class PublishCheckOut(ResponseModel):
    revision: int
    ready: bool
    issues: list[PublishIssueOut]

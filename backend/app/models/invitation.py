import uuid
from datetime import date, datetime, time
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
    Time,
    UniqueConstraint,
    Uuid,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.invitation_registry import CATEGORY_IDS, DEFAULT_TIMEZONE, SESSION_TYPES, VARIANT_IDS, VARIANT_PAIRS
from app.db.base import Base, TimestampMixin

INVITATION_STATUSES = ("draft", "published")
INVITATION_LOCALES = ("en", "id")
EVENT_TYPES = SESSION_TYPES
ASSET_KINDS = ("image", "qris")
RSVP_ATTENDANCE = ("attending", "not_attending")
#: Public slugs: lowercase ASCII words joined by single hyphens.
SLUG_REGEX = r"[a-z0-9]+(-[a-z0-9]+)*"
SLUG_MAX_LENGTH = 80
#: Row layout version: 1 = created before migration 0008, 2 = invitation engine.
SCHEMA_VERSION = 2
TITLE_MAX_LENGTH = 120
TIMEZONE_MAX_LENGTH = 64


def _in_list(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN ({', '.join(repr(v) for v in values)})"


def _pair_check() -> str:
    pairs = ", ".join(f"({c!r}, {v!r})" for c, v in VARIANT_PAIRS)
    return f"(category, variant) IN ({pairs})"


def _json_section() -> Mapped[dict[str, Any]]:
    # Section objects are stored with the contract's camelCase keys; unset keys are omitted.
    return mapped_column(JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb"))


class Invitation(TimestampMixin, Base):
    """One invitation site (wedding, birthday, seminar, ...). A user may own many.

    Singleton sections live in JSONB columns (`universal_content` holds the sections added
    after v1); repeatable items (story entries, sessions, gallery images) live in their own
    ordered tables. `category`/`variant` are fixed at creation.
    """

    __tablename__ = "invitations"
    __table_args__ = (
        CheckConstraint(_in_list("status", INVITATION_STATUSES), name="status"),
        CheckConstraint(_in_list("locale", INVITATION_LOCALES), name="locale"),
        CheckConstraint(f"slug ~ '^{SLUG_REGEX}$'", name="slug_format"),
        CheckConstraint(_in_list("category", CATEGORY_IDS), name="category"),
        CheckConstraint(_in_list("variant", VARIANT_IDS), name="variant"),
        CheckConstraint(_pair_check(), name="category_variant"),
        Index("ix_invitations_owner_id_updated_at", "owner_id", "updated_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    variant: Mapped[str] = mapped_column(String(40), nullable=False)
    #: Internal name shown in the owner's list (never published).
    title: Mapped[str | None] = mapped_column(String(TITLE_MAX_LENGTH), nullable=True)
    #: IANA zone used for the RSVP deadline (and shown to guests).
    timezone: Mapped[str] = mapped_column(
        String(TIMEZONE_MAX_LENGTH), nullable=False, default=DEFAULT_TIMEZONE, server_default=DEFAULT_TIMEZONE
    )
    theme_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="draft", server_default="draft"
    )
    locale: Mapped[str] = mapped_column(String(5), nullable=False, default="en", server_default="en")
    # Content revision for optimistic concurrency: bumped by every content write
    # (sections, collections, whole-content replace), not by record (theme/locale/...) changes.
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    schema_version: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=SCHEMA_VERSION, server_default=str(SCHEMA_VERSION)
    )
    universal_content: Mapped[dict[str, Any]] = _json_section()
    opening: Mapped[dict[str, Any]] = _json_section()
    couple: Mapped[dict[str, Any]] = _json_section()
    story_meta: Mapped[dict[str, Any]] = _json_section()
    gallery_meta: Mapped[dict[str, Any]] = _json_section()
    rsvp: Mapped[dict[str, Any]] = _json_section()
    closing: Mapped[dict[str, Any]] = _json_section()
    #: Mirrors the live publication's `published_at` (None while unpublished).
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    #: Public URL slug, assigned on first publish and never changed afterwards.
    slug: Mapped[str | None] = mapped_column(String(SLUG_MAX_LENGTH), unique=True, nullable=True)
    #: The live snapshot (None = not published). `status` is kept in sync with it.
    published_publication_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("invitation_publications.id", ondelete="SET NULL", use_alter=True),
        nullable=True,
    )
    publication: Mapped["InvitationPublication | None"] = relationship(
        foreign_keys=[published_publication_id], viewonly=True, lazy="select"
    )

    @property
    def has_unpublished_changes(self) -> bool:
        pub = self.publication
        if pub is None:
            return False
        return self.revision != pub.revision or self.theme_id != pub.theme_id

    def __repr__(self) -> str:
        return f"<Invitation id={self.id} variant={self.variant}>"


class InvitationPublication(Base):
    """An immutable, allow-listed snapshot of an invitation's content at publish time.

    Rows are kept after unpublish/republish (history); the invitation points at the live one.
    """

    __tablename__ = "invitation_publications"
    __table_args__ = (
        CheckConstraint(_in_list("locale", INVITATION_LOCALES), name="locale"),
        CheckConstraint(_in_list("category", CATEGORY_IDS), name="category"),
        CheckConstraint(_in_list("variant", VARIANT_IDS), name="variant"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    invitation_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("invitations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    #: The invitation's content revision that was published.
    revision: Mapped[int] = mapped_column(Integer, nullable=False)
    theme_id: Mapped[str] = mapped_column(String(64), nullable=False)
    locale: Mapped[str] = mapped_column(String(5), nullable=False)
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    variant: Mapped[str] = mapped_column(String(40), nullable=False)
    content: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    published_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class InvitationAsset(Base):
    """An uploaded, re-encoded image stored under `settings.media_root` as `filename`."""

    __tablename__ = "invitation_assets"
    __table_args__ = (
        CheckConstraint(_in_list("kind", ASSET_KINDS), name="kind"),
        CheckConstraint("width > 0 AND height > 0 AND bytes > 0", name="dimensions_positive"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    invitation_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("invitations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    filename: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    content_type: Mapped[str] = mapped_column(String(32), nullable=False)
    width: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)
    bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class _InvitationItem(TimestampMixin):
    """Columns shared by the ordered collections of an invitation.

    `public_id` is the client-facing id (unique per invitation); `position` is kept
    contiguous (0..n-1) by the service layer under a row lock on the invitation.
    The (invitation_id, public_id) unique index also serves invitation_id lookups.
    """

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    invitation_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("invitations.id", ondelete="CASCADE"), nullable=False
    )
    public_id: Mapped[str] = mapped_column(String(64), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)


class InvitationStoryEntry(_InvitationItem, Base):
    __tablename__ = "invitation_story_entries"
    __table_args__ = (
        UniqueConstraint(
            "invitation_id", "public_id", name="uq_invitation_story_entries_invitation_id_public_id"
        ),
        CheckConstraint("position >= 0", name="position_non_negative"),
    )

    title: Mapped[str | None] = mapped_column(String(120), nullable=True)
    date_label: Mapped[str | None] = mapped_column(String(60), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    image: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)


class InvitationSession(_InvitationItem, Base):
    """A session of the invitation (API name: `events`)."""

    __tablename__ = "invitation_sessions"
    __table_args__ = (
        UniqueConstraint("invitation_id", "public_id", name="uq_invitation_sessions_invitation_id_public_id"),
        CheckConstraint("position >= 0", name="position_non_negative"),
        CheckConstraint(_in_list("type", EVENT_TYPES), name="type"),
        CheckConstraint(
            "end_time IS NULL OR start_time IS NULL OR end_time > start_time", name="time_order"
        ),
    )

    type: Mapped[str] = mapped_column(String(20), nullable=False, default="other", server_default="other")
    title: Mapped[str | None] = mapped_column(String(120), nullable=True)
    date: Mapped[date | None] = mapped_column(Date, nullable=True)
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    venue_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    maps_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    #: Optional extras: {"dressCode": {...}, "livestream": {...}, "optional": true}.
    extras: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb")
    )


class InvitationGalleryImage(_InvitationItem, Base):
    __tablename__ = "invitation_gallery_images"
    __table_args__ = (
        UniqueConstraint(
            "invitation_id", "public_id", name="uq_invitation_gallery_images_invitation_id_public_id"
        ),
        CheckConstraint("position >= 0", name="position_non_negative"),
        CheckConstraint("focal_x BETWEEN 0 AND 100", name="focal_x_range"),
        CheckConstraint("focal_y BETWEEN 0 AND 100", name="focal_y_range"),
    )

    src: Mapped[str] = mapped_column(String(2048), nullable=False)
    alt: Mapped[str] = mapped_column(String(300), nullable=False)
    caption: Mapped[str | None] = mapped_column(String(200), nullable=True)
    focal_x: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    focal_y: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)


class InvitationRsvpResponse(Base):
    """A guest's RSVP reply. Guest PII: owner-only, never published, never logged."""

    __tablename__ = "invitation_rsvp_responses"
    __table_args__ = (
        CheckConstraint(_in_list("attendance", RSVP_ATTENDANCE), name="attendance"),
        CheckConstraint("party_size >= 0 AND party_size <= 20", name="party_size"),
        CheckConstraint("char_length(message) <= 1000", name="message_length"),
        Index(
            "ix_invitation_rsvp_responses_invitation_id_created_at", "invitation_id", text("created_at DESC")
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    invitation_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("invitations.id", ondelete="CASCADE"), nullable=False
    )
    publication_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey(
            "invitation_publications.id", ondelete="SET NULL", name="fk_invitation_rsvp_responses_publication_id"
        ),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    attendance: Mapped[str] = mapped_column(String(16), nullable=False)
    party_size: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    email: Mapped[str | None] = mapped_column(String(254), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    session_ids: Mapped[list[str]] = mapped_column(
        JSONB, nullable=False, default=list, server_default=text("'[]'::jsonb")
    )
    answers: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb")
    )
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    guest_label: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

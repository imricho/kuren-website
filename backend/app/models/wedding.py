import uuid
from datetime import date, datetime, time
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    Time,
    UniqueConstraint,
    Uuid,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin

WEDDING_STATUSES = ("draft", "published")
WEDDING_LOCALES = ("en", "id")
EVENT_TYPES = ("engagement", "akad", "holy_matrimony", "ceremony", "reception", "other")
SCHEMA_VERSION = 1


def _in_list(column: str, values: tuple[str, ...]) -> str:
    return f"{column} IN ({', '.join(repr(v) for v in values)})"


def _json_section() -> Mapped[dict[str, Any]]:
    # Section objects are stored with the contract's camelCase keys; unset keys are omitted.
    return mapped_column(JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb"))


class Wedding(TimestampMixin, Base):
    """One couple's wedding site (MVP: one per user).

    Singleton sections live in JSONB columns; repeatable items (story entries,
    events, gallery images) live in their own ordered tables.
    """

    __tablename__ = "weddings"
    __table_args__ = (
        CheckConstraint(_in_list("status", WEDDING_STATUSES), name="status"),
        CheckConstraint(_in_list("locale", WEDDING_LOCALES), name="locale"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    theme_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="draft", server_default="draft"
    )
    locale: Mapped[str] = mapped_column(String(5), nullable=False, default="en", server_default="en")
    # Content revision for optimistic concurrency: bumped by every content write
    # (sections, collections, whole-content replace), not by theme/locale changes.
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    schema_version: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=SCHEMA_VERSION, server_default=str(SCHEMA_VERSION)
    )
    opening: Mapped[dict[str, Any]] = _json_section()
    couple: Mapped[dict[str, Any]] = _json_section()
    story_meta: Mapped[dict[str, Any]] = _json_section()
    gallery_meta: Mapped[dict[str, Any]] = _json_section()
    rsvp: Mapped[dict[str, Any]] = _json_section()
    closing: Mapped[dict[str, Any]] = _json_section()
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<Wedding id={self.id} owner_id={self.owner_id}>"


class _WeddingItem(TimestampMixin):
    """Columns shared by the ordered collections of a wedding.

    `public_id` is the client-facing id (unique per wedding); `position` is kept
    contiguous (0..n-1) by the service layer under a row lock on the wedding.
    The (wedding_id, public_id) unique index also serves wedding_id lookups.
    """

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    wedding_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("weddings.id", ondelete="CASCADE"), nullable=False
    )
    public_id: Mapped[str] = mapped_column(String(64), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)


class WeddingStoryEntry(_WeddingItem, Base):
    __tablename__ = "wedding_story_entries"
    __table_args__ = (
        UniqueConstraint("wedding_id", "public_id", name="uq_wedding_story_entries_wedding_id_public_id"),
        CheckConstraint("position >= 0", name="position_non_negative"),
    )

    title: Mapped[str | None] = mapped_column(String(120), nullable=True)
    date_label: Mapped[str | None] = mapped_column(String(60), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    image: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)


class WeddingEvent(_WeddingItem, Base):
    __tablename__ = "wedding_events"
    __table_args__ = (
        UniqueConstraint("wedding_id", "public_id", name="uq_wedding_events_wedding_id_public_id"),
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


class WeddingGalleryImage(_WeddingItem, Base):
    __tablename__ = "wedding_gallery_images"
    __table_args__ = (
        UniqueConstraint("wedding_id", "public_id", name="uq_wedding_gallery_images_wedding_id_public_id"),
        CheckConstraint("position >= 0", name="position_non_negative"),
        CheckConstraint("focal_x BETWEEN 0 AND 100", name="focal_x_range"),
        CheckConstraint("focal_y BETWEEN 0 AND 100", name="focal_y_range"),
    )

    src: Mapped[str] = mapped_column(String(2048), nullable=False)
    alt: Mapped[str] = mapped_column(String(300), nullable=False)
    caption: Mapped[str | None] = mapped_column(String(200), nullable=True)
    focal_x: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    focal_y: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)

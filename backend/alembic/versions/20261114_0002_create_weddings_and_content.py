"""create weddings and wedding content tables

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-14
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_EMPTY_JSON = sa.text("'{}'::jsonb")
_EVENT_TYPES = "'engagement', 'akad', 'holy_matrimony', 'ceremony', 'reception', 'other'"


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    ]


def _item_columns(table: str) -> list[sa.Column | sa.Constraint]:
    return [
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("wedding_id", sa.Uuid(), nullable=False),
        sa.Column("public_id", sa.String(length=64), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["wedding_id"], ["weddings.id"],
            name=op.f(f"fk_{table}_wedding_id_weddings"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f(f"pk_{table}")),
        sa.UniqueConstraint("wedding_id", "public_id", name=op.f(f"uq_{table}_wedding_id_public_id")),
        sa.CheckConstraint("position >= 0", name=op.f(f"ck_{table}_position_non_negative")),
    ]


def upgrade() -> None:
    op.create_table(
        "weddings",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=False),
        sa.Column("theme_id", sa.String(length=64), nullable=True),
        sa.Column("status", sa.String(length=16), server_default="draft", nullable=False),
        sa.Column("locale", sa.String(length=5), server_default="en", nullable=False),
        sa.Column("schema_version", sa.SmallInteger(), server_default="1", nullable=False),
        sa.Column("opening", postgresql.JSONB(), server_default=_EMPTY_JSON, nullable=False),
        sa.Column("couple", postgresql.JSONB(), server_default=_EMPTY_JSON, nullable=False),
        sa.Column("story_meta", postgresql.JSONB(), server_default=_EMPTY_JSON, nullable=False),
        sa.Column("gallery_meta", postgresql.JSONB(), server_default=_EMPTY_JSON, nullable=False),
        sa.Column("rsvp", postgresql.JSONB(), server_default=_EMPTY_JSON, nullable=False),
        sa.Column("closing", postgresql.JSONB(), server_default=_EMPTY_JSON, nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["owner_id"], ["users.id"],
            name=op.f("fk_weddings_owner_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_weddings")),
        sa.UniqueConstraint("owner_id", name=op.f("uq_weddings_owner_id")),
        sa.CheckConstraint("status IN ('draft', 'published')", name=op.f("ck_weddings_status")),
        sa.CheckConstraint("locale IN ('en', 'id')", name=op.f("ck_weddings_locale")),
    )

    op.create_table(
        "wedding_story_entries",
        *_item_columns("wedding_story_entries"),
        sa.Column("title", sa.String(length=120), nullable=True),
        sa.Column("date_label", sa.String(length=60), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("image", postgresql.JSONB(), nullable=True),
        *_timestamps(),
    )

    op.create_table(
        "wedding_events",
        *_item_columns("wedding_events"),
        sa.Column("type", sa.String(length=20), server_default="other", nullable=False),
        sa.Column("title", sa.String(length=120), nullable=True),
        sa.Column("date", sa.Date(), nullable=True),
        sa.Column("start_time", sa.Time(), nullable=True),
        sa.Column("end_time", sa.Time(), nullable=True),
        sa.Column("venue_name", sa.String(length=160), nullable=True),
        sa.Column("address", sa.String(length=500), nullable=True),
        sa.Column("maps_url", sa.String(length=2048), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        *_timestamps(),
        sa.CheckConstraint(f"type IN ({_EVENT_TYPES})", name=op.f("ck_wedding_events_type")),
        sa.CheckConstraint(
            "end_time IS NULL OR start_time IS NULL OR end_time > start_time",
            name=op.f("ck_wedding_events_time_order"),
        ),
    )

    op.create_table(
        "wedding_gallery_images",
        *_item_columns("wedding_gallery_images"),
        sa.Column("src", sa.String(length=2048), nullable=False),
        sa.Column("alt", sa.String(length=300), nullable=False),
        sa.Column("caption", sa.String(length=200), nullable=True),
        sa.Column("focal_x", sa.SmallInteger(), nullable=True),
        sa.Column("focal_y", sa.SmallInteger(), nullable=True),
        *_timestamps(),
        sa.CheckConstraint(
            "focal_x BETWEEN 0 AND 100", name=op.f("ck_wedding_gallery_images_focal_x_range")
        ),
        sa.CheckConstraint(
            "focal_y BETWEEN 0 AND 100", name=op.f("ck_wedding_gallery_images_focal_y_range")
        ),
    )


def downgrade() -> None:
    op.drop_table("wedding_gallery_images")
    op.drop_table("wedding_events")
    op.drop_table("wedding_story_entries")
    op.drop_table("weddings")

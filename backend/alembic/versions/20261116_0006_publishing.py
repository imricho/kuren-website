"""publishing: wedding_publications snapshots, public slug and live-publication pointer

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-16
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "wedding_publications",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("wedding_id", sa.Uuid(), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("theme_id", sa.String(length=64), nullable=False),
        sa.Column("locale", sa.String(length=5), nullable=False),
        sa.Column("content", postgresql.JSONB(), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["wedding_id"], ["weddings.id"],
            name=op.f("fk_wedding_publications_wedding_id_weddings"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_wedding_publications")),
        sa.CheckConstraint("locale IN ('en', 'id')", name=op.f("ck_wedding_publications_locale")),
    )
    op.create_index(
        op.f("ix_wedding_publications_wedding_id"), "wedding_publications", ["wedding_id"], unique=False
    )

    op.add_column("weddings", sa.Column("slug", sa.String(length=80), nullable=True))
    op.add_column("weddings", sa.Column("published_publication_id", sa.Uuid(), nullable=True))
    op.create_unique_constraint(op.f("uq_weddings_slug"), "weddings", ["slug"])
    op.create_check_constraint(
        op.f("ck_weddings_slug_format"), "weddings", "slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'"
    )
    op.create_foreign_key(
        op.f("fk_weddings_published_publication_id_wedding_publications"),
        "weddings", "wedding_publications",
        ["published_publication_id"], ["id"],
        ondelete="SET NULL",
    )
    # No backfill: every existing wedding is a draft without a publication.


def downgrade() -> None:
    op.drop_constraint(
        op.f("fk_weddings_published_publication_id_wedding_publications"), "weddings", type_="foreignkey"
    )
    op.drop_constraint(op.f("ck_weddings_slug_format"), "weddings", type_="check")
    op.drop_constraint(op.f("uq_weddings_slug"), "weddings", type_="unique")
    op.drop_column("weddings", "published_publication_id")
    op.drop_column("weddings", "slug")
    op.drop_index(op.f("ix_wedding_publications_wedding_id"), table_name="wedding_publications")
    op.drop_table("wedding_publications")
    op.execute("UPDATE weddings SET status = 'draft', published_at = NULL")

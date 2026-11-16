"""wedding_assets: uploaded, re-encoded images (photos and QRIS codes)

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-16
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "wedding_assets",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("wedding_id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("filename", sa.String(length=64), nullable=False),
        sa.Column("content_type", sa.String(length=32), nullable=False),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        sa.Column("bytes", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["wedding_id"], ["weddings.id"],
            name=op.f("fk_wedding_assets_wedding_id_weddings"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_wedding_assets")),
        sa.UniqueConstraint("filename", name=op.f("uq_wedding_assets_filename")),
        sa.CheckConstraint("kind IN ('image', 'qris')", name=op.f("ck_wedding_assets_kind")),
        sa.CheckConstraint(
            "width > 0 AND height > 0 AND bytes > 0", name=op.f("ck_wedding_assets_dimensions_positive")
        ),
    )
    op.create_index(op.f("ix_wedding_assets_wedding_id"), "wedding_assets", ["wedding_id"], unique=False)


def downgrade() -> None:
    # Files under the media root are left in place; remove them separately if needed.
    op.drop_index(op.f("ix_wedding_assets_wedding_id"), table_name="wedding_assets")
    op.drop_table("wedding_assets")

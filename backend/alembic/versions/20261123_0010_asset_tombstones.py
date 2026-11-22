"""Asset tombstones: images deleted while the live page still shows them

Revision ID: 0010
Revises: 0009
Create Date: 2026-11-23

Adds `invitation_assets.deleted_at`. Deleting an image that the LIVE publication still
shows used to drop its row and keep the file forever (there was no cleanup), so the photo
stayed public even after the invitation was deleted. Now the row is kept with `deleted_at`
set; the file and row are removed as soon as no live publication uses them (on publish,
unpublish and invitation delete). Additive; downgrade drops the column (tombstoned rows
are then treated as normal assets again).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("invitation_assets", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("invitation_assets", "deleted_at")

"""add content revision to weddings (optimistic concurrency for autosave)

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-15
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("weddings", sa.Column("revision", sa.Integer(), server_default="0", nullable=False))


def downgrade() -> None:
    op.drop_column("weddings", "revision")

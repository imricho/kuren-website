"""add per-event extras (dress code, livestream) for CMS v2.0

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-16
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "wedding_events",
        sa.Column("extras", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("wedding_events", "extras")

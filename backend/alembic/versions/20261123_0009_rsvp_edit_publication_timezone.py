"""RSVP edit links, published time zone, shared rate-limit counters

Revision ID: 0009
Revises: 0008
Create Date: 2026-11-23

Additive only; no existing value is changed except the backfill below.

- `invitation_rsvp_responses.edit_token_hash` (sha256 hex of the guest's private edit token;
  the token itself is never stored), `updated_at`, `edit_count`. Existing replies get no
  token: they stay valid but cannot be edited by the guest (the organizer can still see,
  export and delete them).
- `invitation_publications.timezone`: the time zone a publication was published with.
  Existing publications are backfilled with their invitation's CURRENT time zone, which is
  exactly what guests were seeing before this revision, so nothing visible changes.
- `rate_limit_hits`: fixed-window counters shared by every worker/replica
  (RATE_LIMIT_BACKEND=database). Keys are hashed; rows older than a few minutes are pruned.
- `invitation_sessions` time-order check: a multi-day session (`extras.endDate` set) may end
  at an earlier clock time than it starts (e.g. Fri 16:00 - Sun 12:00).

DOWNGRADE drops these columns and the table. Guests lose their edit links (replies are
kept); publications fall back to the invitation's live time zone (the 0008 behaviour).
It REFUSES (nothing changed) while a multi-day session ends at an earlier clock time than
it starts, because the old check would reject that row; edit or remove it first.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


OLD_TIME_ORDER = "end_time IS NULL OR start_time IS NULL OR end_time > start_time"
NEW_TIME_ORDER = OLD_TIME_ORDER + " OR (extras ? 'endDate')"


def upgrade() -> None:
    op.drop_constraint(op.f("ck_invitation_sessions_time_order"), "invitation_sessions", type_="check")
    op.create_check_constraint(op.f("ck_invitation_sessions_time_order"), "invitation_sessions", NEW_TIME_ORDER)

    op.add_column("invitation_rsvp_responses", sa.Column("edit_token_hash", sa.String(64), nullable=True))
    op.add_column("invitation_rsvp_responses", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "invitation_rsvp_responses",
        sa.Column("edit_count", sa.SmallInteger(), nullable=False, server_default="0"),
    )
    op.create_index(
        "ix_invitation_rsvp_responses_edit_token_hash", "invitation_rsvp_responses", ["edit_token_hash"], unique=True
    )

    op.add_column("invitation_publications", sa.Column("timezone", sa.String(64), nullable=True))
    op.execute(
        "UPDATE invitation_publications AS p SET timezone = i.timezone "
        "FROM invitations AS i WHERE p.invitation_id = i.id"
    )
    op.execute("UPDATE invitation_publications SET timezone = 'Asia/Jakarta' WHERE timezone IS NULL")
    op.alter_column("invitation_publications", "timezone", nullable=False)

    op.create_table(
        "rate_limit_hits",
        sa.Column("bucket", sa.String(80), nullable=False),
        sa.Column("window_start", sa.BigInteger(), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("bucket", "window_start", name=op.f("pk_rate_limit_hits")),
    )
    op.create_index("ix_rate_limit_hits_window_start", "rate_limit_hits", ["window_start"])


def downgrade() -> None:
    blocking = op.get_bind().scalar(sa.text(
        f"SELECT count(*) FROM invitation_sessions WHERE NOT ({OLD_TIME_ORDER})"
    ))
    if blocking:
        raise RuntimeError(
            f"Cannot downgrade: {blocking} multi-day session(s) end at an earlier clock time than they "
            "start, which revision 0008 cannot store. Edit or remove them first."
        )
    op.drop_constraint(op.f("ck_invitation_sessions_time_order"), "invitation_sessions", type_="check")
    op.create_check_constraint(op.f("ck_invitation_sessions_time_order"), "invitation_sessions", OLD_TIME_ORDER)
    op.drop_index("ix_rate_limit_hits_window_start", table_name="rate_limit_hits")
    op.drop_table("rate_limit_hits")
    op.drop_column("invitation_publications", "timezone")
    op.drop_index("ix_invitation_rsvp_responses_edit_token_hash", table_name="invitation_rsvp_responses")
    op.drop_column("invitation_rsvp_responses", "edit_count")
    op.drop_column("invitation_rsvp_responses", "updated_at")
    op.drop_column("invitation_rsvp_responses", "edit_token_hash")

"""invitation engine: weddings -> invitations (many per user), category/variant, RSVP replies

Revision ID: 0008
Revises: 0007
Create Date: 2026-11-22

Renames every wedding table, FK column, constraint and index to the invitation
vocabulary, drops the one-invitation-per-user unique constraint, adds
category/variant/title/timezone (existing rows become wedding/wedding_ceremony),
snapshots category/variant on publications, widens the session type list and adds
`invitation_rsvp_responses`.

The value lists below are frozen copies of `app/core/invitation_registry.json` at the
time of this revision (migrations must not import application code that may change).

DOWNGRADE LIMITATIONS
- Refuses to run (nothing is changed) while
  - any user owns more than one invitation: the old `UNIQUE(owner_id)` cannot be restored;
  - any invitation is not a wedding (`category <> 'wedding'`): the old schema cannot
    represent it, and keeping it would silently turn e.g. a seminar into a wedding.
  Delete or reassign those invitations first.
- Drops category/variant/title/timezone and every RSVP reply (irreversible data loss).
  Sessions with a type that did not exist before (party, session, ...) become `other`.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CATEGORIES = ("wedding", "celebration", "gathering", "corporate")
PAIRS = (
    ("wedding", "wedding_ceremony"), ("wedding", "wedding_reception"),
    ("celebration", "birthday"), ("celebration", "sweet_17"), ("celebration", "khitanan"),
    ("celebration", "aqiqah"), ("celebration", "engagement"), ("celebration", "anniversary"),
    ("celebration", "graduation"), ("celebration", "religious_celebration"),
    ("gathering", "family_reunion"), ("gathering", "family_gathering"), ("gathering", "community_gathering"),
    ("corporate", "corporate_event"), ("corporate", "company_celebration"), ("corporate", "seminar"),
    ("corporate", "workshop"),
)
VARIANTS = tuple(v for _, v in PAIRS)
OLD_SESSION_TYPES = ("engagement", "akad", "holy_matrimony", "ceremony", "reception", "other")
NEW_SESSION_TYPES = (
    "engagement", "akad", "holy_matrimony", "ceremony", "reception", "party", "celebration",
    "session", "talk", "workshop", "gathering", "prayer", "dinner", "other",
)

# (old table, new table)
TABLES = (
    ("weddings", "invitations"),
    ("wedding_publications", "invitation_publications"),
    ("wedding_assets", "invitation_assets"),
    ("wedding_events", "invitation_sessions"),
    ("wedding_story_entries", "invitation_story_entries"),
    ("wedding_gallery_images", "invitation_gallery_images"),
)
CHILD_TABLES = TABLES[1:]
ITEM_TABLES = TABLES[3:]


def _in_list(column: str, values: Sequence[str]) -> str:
    return f"{column} IN ({', '.join(repr(v) for v in values)})"


def _pairs_check() -> str:
    return "(category, variant) IN (" + ", ".join(f"({c!r}, {v!r})" for c, v in PAIRS) + ")"


def _renames() -> list[tuple[str, str, str]]:
    """(kind, old name, new name) for every constraint/index, named as in the new schema."""
    out: list[tuple[str, str, str]] = []
    for old, new in TABLES:
        out.append(("constraint", f"pk_{old}", f"pk_{new}"))
    out += [
        ("constraint", "ck_weddings_status", "ck_invitations_status"),
        ("constraint", "ck_weddings_locale", "ck_invitations_locale"),
        ("constraint", "ck_weddings_slug_format", "ck_invitations_slug_format"),
        ("constraint", "uq_weddings_slug", "uq_invitations_slug"),
        ("constraint", "fk_weddings_owner_id_users", "fk_invitations_owner_id_users"),
        ("constraint", "fk_weddings_published_publication_id_wedding_publications",
         "fk_invitations_published_publication_id_invitation_publications"),
        ("constraint", "ck_wedding_publications_locale", "ck_invitation_publications_locale"),
        ("index", "ix_wedding_publications_wedding_id", "ix_invitation_publications_invitation_id"),
        ("constraint", "ck_wedding_assets_kind", "ck_invitation_assets_kind"),
        ("constraint", "ck_wedding_assets_dimensions_positive", "ck_invitation_assets_dimensions_positive"),
        ("constraint", "uq_wedding_assets_filename", "uq_invitation_assets_filename"),
        ("index", "ix_wedding_assets_wedding_id", "ix_invitation_assets_invitation_id"),
        ("constraint", "ck_wedding_events_time_order", "ck_invitation_sessions_time_order"),
        ("constraint", "ck_wedding_gallery_images_focal_x_range", "ck_invitation_gallery_images_focal_x_range"),
        ("constraint", "ck_wedding_gallery_images_focal_y_range", "ck_invitation_gallery_images_focal_y_range"),
    ]
    for old, new in CHILD_TABLES:
        out.append(("constraint", f"fk_{old}_wedding_id_weddings", f"fk_{new}_invitation_id_invitations"))
    for old, new in ITEM_TABLES:
        out.append(("constraint", f"uq_{old}_wedding_id_public_id", f"uq_{new}_invitation_id_public_id"))
        out.append(("constraint", f"ck_{old}_position_non_negative", f"ck_{new}_position_non_negative"))
    return out


def _table_of(constraint_name: str, forward: bool) -> str:
    """The table owning a constraint, found by name prefix. Constraints are renamed while
    the tables carry their invitation names, in both directions."""
    rest = constraint_name[3:]
    for old, new in sorted(TABLES, key=lambda p: -len(p[0 if forward else 1])):
        name = old if forward else new
        if rest == name or rest.startswith(name + "_"):
            return new
    raise ValueError(constraint_name)


def _rename_objects(forward: bool) -> None:
    for kind, old, new in _renames():
        src, dst = (old, new) if forward else (new, old)
        if kind == "index":
            op.execute(f'ALTER INDEX "{src}" RENAME TO "{dst}"')
        else:
            table = _table_of(src, forward)
            op.execute(f'ALTER TABLE "{table}" RENAME CONSTRAINT "{src}" TO "{dst}"')


def upgrade() -> None:
    # 1. Tables and FK columns.
    for old, new in TABLES:
        op.rename_table(old, new)
    for _, new in CHILD_TABLES:
        op.alter_column(new, "wedding_id", new_column_name="invitation_id")
    _rename_objects(forward=True)

    # 2. Many invitations per user.
    op.drop_constraint(op.f("uq_weddings_owner_id"), "invitations", type_="unique")
    op.create_index(op.f("ix_invitations_owner_id_updated_at"), "invitations", ["owner_id", "updated_at"])

    # 3. Category / variant / title / timezone (backfill: every existing row is a wedding ceremony).
    op.add_column("invitations", sa.Column("category", sa.String(length=20), nullable=True))
    op.add_column("invitations", sa.Column("variant", sa.String(length=40), nullable=True))
    op.add_column("invitations", sa.Column("title", sa.String(length=120), nullable=True))
    op.add_column(
        "invitations",
        sa.Column("timezone", sa.String(length=64), server_default="Asia/Jakarta", nullable=False),
    )
    op.execute("UPDATE invitations SET category = 'wedding', variant = 'wedding_ceremony'")
    op.alter_column("invitations", "category", nullable=False)
    op.alter_column("invitations", "variant", nullable=False)
    op.create_check_constraint(op.f("ck_invitations_category"), "invitations", _in_list("category", CATEGORIES))
    op.create_check_constraint(op.f("ck_invitations_variant"), "invitations", _in_list("variant", VARIANTS))
    op.create_check_constraint(op.f("ck_invitations_category_variant"), "invitations", _pairs_check())
    # Rows created from now on use the v2 layout; existing rows keep schema_version 1.
    op.alter_column("invitations", "schema_version", server_default="2")

    # 4. Publications snapshot what was published.
    op.add_column("invitation_publications", sa.Column("category", sa.String(length=20), nullable=True))
    op.add_column("invitation_publications", sa.Column("variant", sa.String(length=40), nullable=True))
    op.execute(
        "UPDATE invitation_publications p SET category = i.category, variant = i.variant "
        "FROM invitations i WHERE i.id = p.invitation_id"
    )
    op.alter_column("invitation_publications", "category", nullable=False)
    op.alter_column("invitation_publications", "variant", nullable=False)
    op.create_check_constraint(
        op.f("ck_invitation_publications_category"), "invitation_publications", _in_list("category", CATEGORIES)
    )
    op.create_check_constraint(
        op.f("ck_invitation_publications_variant"), "invitation_publications", _in_list("variant", VARIANTS)
    )

    # 5. Generic session types.
    op.drop_constraint(op.f("ck_wedding_events_type"), "invitation_sessions", type_="check")
    op.create_check_constraint(op.f("ck_invitation_sessions_type"), "invitation_sessions", _in_list("type", NEW_SESSION_TYPES))

    # 6. RSVP replies.
    op.create_table(
        "invitation_rsvp_responses",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("invitation_id", sa.Uuid(), nullable=False),
        sa.Column("publication_id", sa.Uuid(), nullable=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("attendance", sa.String(length=16), nullable=False),
        sa.Column("party_size", sa.SmallInteger(), nullable=False),
        sa.Column("email", sa.String(length=254), nullable=True),
        sa.Column("phone", sa.String(length=40), nullable=True),
        sa.Column("session_ids", postgresql.JSONB(), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("answers", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("guest_label", sa.String(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["invitation_id"], ["invitations.id"],
            name=op.f("fk_invitation_rsvp_responses_invitation_id_invitations"), ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["publication_id"], ["invitation_publications.id"],
            name=op.f("fk_invitation_rsvp_responses_publication_id"), ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_invitation_rsvp_responses")),
        sa.CheckConstraint(
            "attendance IN ('attending', 'not_attending')", name=op.f("ck_invitation_rsvp_responses_attendance")
        ),
        sa.CheckConstraint(
            "party_size >= 0 AND party_size <= 20", name=op.f("ck_invitation_rsvp_responses_party_size")
        ),
        sa.CheckConstraint(
            "char_length(message) <= 1000", name=op.f("ck_invitation_rsvp_responses_message_length")
        ),
    )
    op.create_index(
        op.f("ix_invitation_rsvp_responses_invitation_id_created_at"),
        "invitation_rsvp_responses",
        ["invitation_id", sa.text("created_at DESC")],
    )


def downgrade() -> None:
    conn = op.get_bind()
    owners = conn.scalar(sa.text(
        "SELECT count(*) FROM (SELECT owner_id FROM invitations GROUP BY owner_id HAVING count(*) > 1) t"
    ))
    if owners:
        raise RuntimeError(
            f"Cannot downgrade 0008: {owners} user(s) own more than one invitation, so "
            "UNIQUE(owner_id) on weddings cannot be restored. Delete or reassign the extra "
            "invitations first (see the migration docstring)."
        )
    others = conn.scalar(sa.text("SELECT count(*) FROM invitations WHERE category <> 'wedding'"))
    if others:
        raise RuntimeError(
            f"Cannot downgrade 0008: {others} invitation(s) are not weddings and cannot be "
            "represented before 0008. Delete them first (see the migration docstring)."
        )

    # 6. RSVP replies (data loss, documented).
    op.drop_index(op.f("ix_invitation_rsvp_responses_invitation_id_created_at"), table_name="invitation_rsvp_responses")
    op.drop_table("invitation_rsvp_responses")

    # 5. Session types: types unknown to the old schema become 'other'.
    op.drop_constraint(op.f("ck_invitation_sessions_type"), "invitation_sessions", type_="check")
    op.execute(f"UPDATE invitation_sessions SET type = 'other' WHERE NOT ({_in_list('type', OLD_SESSION_TYPES)})")
    op.create_check_constraint(op.f("ck_wedding_events_type"), "invitation_sessions", _in_list("type", OLD_SESSION_TYPES))

    # 4. Publications.
    op.drop_constraint(op.f("ck_invitation_publications_variant"), "invitation_publications", type_="check")
    op.drop_constraint(op.f("ck_invitation_publications_category"), "invitation_publications", type_="check")
    op.drop_column("invitation_publications", "variant")
    op.drop_column("invitation_publications", "category")

    # 3. Invitation columns.
    op.alter_column("invitations", "schema_version", server_default="1")
    op.drop_constraint(op.f("ck_invitations_category_variant"), "invitations", type_="check")
    op.drop_constraint(op.f("ck_invitations_variant"), "invitations", type_="check")
    op.drop_constraint(op.f("ck_invitations_category"), "invitations", type_="check")
    op.drop_column("invitations", "timezone")
    op.drop_column("invitations", "title")
    op.drop_column("invitations", "variant")
    op.drop_column("invitations", "category")

    # 2. One wedding per user again (checked above).
    op.drop_index(op.f("ix_invitations_owner_id_updated_at"), table_name="invitations")
    op.create_unique_constraint(op.f("uq_weddings_owner_id"), "invitations", ["owner_id"])

    # 1. Names back to the wedding vocabulary.
    _rename_objects(forward=False)
    for _, new in CHILD_TABLES:
        op.alter_column(new, "invitation_id", new_column_name="wedding_id")
    for old, new in TABLES:
        op.rename_table(new, old)

"""Add contact context, opportunity fields, archiving, and activity types.

Revision ID: 0002
"""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    # Alembic omits unnamed CHECKs when SQLite recreates a table. Reintroduce
    # the original v1 invariants with names so future rebuilds preserve them.
    original_checks = (
        (
            sa.CheckConstraint(
                "status IN ('New','Contacted','Qualified','Proposal Sent','Won','Lost')",
                name="ck_lead_status",
            ),
            sa.CheckConstraint("version >= 1", name="ck_lead_version"),
        )
        if op.get_context().dialect.name == "sqlite"
        else ()
    )
    with op.batch_alter_table("leads", table_args=original_checks) as batch:
        batch.add_column(sa.Column("email", sa.String(254)))
        batch.add_column(sa.Column("source", sa.String(80)))
        batch.add_column(
            sa.Column("priority", sa.String(10), nullable=False, server_default="Normal")
        )
        batch.add_column(sa.Column("estimated_value", sa.Numeric(14, 2)))
        batch.add_column(sa.Column("currency", sa.String(3), nullable=False, server_default="INR"))
        batch.add_column(
            sa.Column("archived", sa.Boolean(), nullable=False, server_default=sa.false())
        )
        batch.create_check_constraint("ck_lead_priority", "priority IN ('Low','Normal','High')")
        batch.create_check_constraint("ck_lead_currency", "currency IN ('INR','USD','EUR','GBP')")
        batch.create_check_constraint(
            "ck_lead_value", "estimated_value IS NULL OR estimated_value >= 0"
        )
        batch.create_index("ix_leads_archived_priority", ["archived", "priority"])
    with op.batch_alter_table("discussions") as batch:
        batch.add_column(sa.Column("kind", sa.String(10), nullable=False, server_default="Note"))
        batch.create_check_constraint(
            "ck_discussion_kind", "kind IN ('Note','Call','Email','Meeting')"
        )


def downgrade():
    with op.batch_alter_table("discussions") as batch:
        batch.drop_constraint("ck_discussion_kind", type_="check")
        batch.drop_column("kind")
    with op.batch_alter_table("leads") as batch:
        batch.drop_index("ix_leads_archived_priority")
        for name in ("ck_lead_priority", "ck_lead_currency", "ck_lead_value"):
            batch.drop_constraint(name, type_="check")
        for name in ("email", "source", "priority", "estimated_value", "currency", "archived"):
            batch.drop_column(name)

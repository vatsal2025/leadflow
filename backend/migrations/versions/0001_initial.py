"""Create leads and discussion history.

Revision ID: 0001
"""

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "leads",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("company", sa.String(160)),
        sa.Column("phone", sa.String(40)),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("follow_up_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.CheckConstraint(
            "status IN ('New','Contacted','Qualified','Proposal Sent','Won','Lost')"
        ),
        sa.CheckConstraint("version >= 1"),
    )
    for column in ("status", "follow_up_at", "updated_at"):
        op.create_index(f"ix_leads_{column}", "leads", [column])
    op.create_index("ix_leads_status_follow_up", "leads", ["status", "follow_up_at"])
    op.create_table(
        "discussions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "lead_id", sa.String(36), sa.ForeignKey("leads.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("follow_up_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_discussions_lead_created", "discussions", ["lead_id", "created_at", "id"])


def downgrade():
    op.drop_table("discussions")
    op.drop_table("leads")

"""Share login throttling across workers and protect hosted database tables.

Revision ID: 0003
"""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "login_windows",
        sa.Column("key", sa.String(40), primary_key=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
    )
    if op.get_context().dialect.name == "postgresql":
        # No public policies: Supabase's anon/authenticated Data API roles cannot
        # read CRM records. The backend uses its private database owner connection.
        for table in ("leads", "discussions", "login_windows", "alembic_version"):
            op.execute(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY')


def downgrade():
    op.drop_table("login_windows")
    # Preserve RLS protection during rollback. The database owner still has access.

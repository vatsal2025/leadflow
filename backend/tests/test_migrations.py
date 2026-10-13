import os
import subprocess
import sys
from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError


def test_migration_round_trip_and_repeatable_seed(tmp_path):
    url = f"sqlite:///{(tmp_path / 'migration.db').as_posix()}"
    env = {**os.environ, "DATABASE_URL": url, "APP_ENV": "test", "APP_PASSWORD": ""}
    backend = Path(__file__).resolve().parents[1]

    def run(*args):
        result = subprocess.run(
            [sys.executable, *args], cwd=backend, env=env, capture_output=True, text=True
        )
        assert result.returncode == 0, result.stdout + result.stderr

    run("-m", "alembic", "upgrade", "head")
    engine = create_engine(url)
    assert {"leads", "discussions", "alembic_version"} <= set(inspect(engine).get_table_names())
    run("-m", "app.seed", "--timezone", "Asia/Kolkata")
    run("-m", "app.seed", "--timezone", "Asia/Kolkata")
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT COUNT(*) FROM leads")) == 8
        assert connection.scalar(text("SELECT COUNT(*) FROM discussions")) == 14
    engine.dispose()


def test_populated_v1_upgrade_preserves_contacts_and_history(tmp_path):
    url = f"sqlite:///{(tmp_path / 'existing.db').as_posix()}"
    env = {**os.environ, "DATABASE_URL": url, "APP_ENV": "test", "APP_PASSWORD": ""}
    backend = Path(__file__).resolve().parents[1]

    def migrate(target, direction="upgrade"):
        result = subprocess.run(
            [sys.executable, "-m", "alembic", direction, target],
            cwd=backend,
            env=env,
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, result.stdout + result.stderr

    migrate("0001")
    engine = create_engine(url)
    lead_id, note_id = str(uuid4()), str(uuid4())
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO leads (id,name,status,created_at,updated_at,version) VALUES (:id,'Existing','Qualified','2026-01-01','2026-01-01',3)"
            ),
            {"id": lead_id},
        )
        connection.execute(
            text(
                "INSERT INTO discussions (id,lead_id,note,created_at) VALUES (:id,:lead,'Keep this history','2026-01-01')"
            ),
            {"id": note_id, "lead": lead_id},
        )
    migrate("head")
    for statement in (
        "UPDATE leads SET status='Unknown'",
        "UPDATE leads SET version=0",
        "UPDATE leads SET priority='Urgent'",
        "UPDATE leads SET estimated_value=-1",
    ):
        with pytest.raises(IntegrityError), engine.begin() as connection:
            connection.execute(text(statement))
    with engine.connect() as connection:
        row = connection.execute(
            text("SELECT name,version,priority,currency,archived FROM leads")
        ).one()
        assert tuple(row) == ("Existing", 3, "Normal", "INR", 0)
        assert connection.execute(text("SELECT note,kind FROM discussions")).one() == (
            "Keep this history",
            "Note",
        )
        assert connection.execute(text("PRAGMA foreign_key_check")).all() == []
    migrate("0001", "downgrade")
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT note FROM discussions")) == "Keep this history"
        assert connection.scalar(text("SELECT version FROM leads")) == 3
        assert connection.execute(text("PRAGMA foreign_key_check")).all() == []
    engine.dispose()
    migrate("base", "downgrade")
    migrate("head")
    engine = create_engine(url)
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT COUNT(*) FROM leads")) == 0
    engine.dispose()

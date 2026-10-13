import os
import subprocess
import sys
from pathlib import Path

from sqlalchemy import create_engine, inspect, text


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
    run("-m", "alembic", "downgrade", "base")
    run("-m", "alembic", "upgrade", "head")
    engine = create_engine(url)
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT COUNT(*) FROM leads")) == 0
    engine.dispose()

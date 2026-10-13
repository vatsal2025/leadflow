from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta

import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import Settings
from app.rate_limit import reserve_login_attempt, reset_login_attempts


def test_shared_limit_is_atomic_across_independent_connections(db):
    now = datetime.now(UTC)

    def attempt(_):
        with Session(db.bind) as worker:
            try:
                reserve_login_attempt(worker, now)
                return True
            except HTTPException as error:
                assert error.status_code == 429
                return False

    with ThreadPoolExecutor(max_workers=8) as executor:
        assert sum(executor.map(attempt, range(20))) == 5
    # Boundary expiry works without relying on any process-local clock or state.
    reserve_login_attempt(db, now + timedelta(seconds=60))
    reset_login_attempts(db)
    for _ in range(5):
        reserve_login_attempt(db, now + timedelta(seconds=60))
    with pytest.raises(HTTPException):
        reserve_login_attempt(db, now + timedelta(seconds=60))


def test_serverless_configuration_requires_postgres():
    with pytest.raises(ValueError, match="persistent PostgreSQL"):
        Settings(_env_file=None, serverless=True, database_url="sqlite:///local.db")
    with pytest.raises(ValueError, match="exact hostname"):
        Settings(_env_file=None, api_hostname="https://example.com")

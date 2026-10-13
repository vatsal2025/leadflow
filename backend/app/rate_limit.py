"""An atomic, database-backed limit shared by every API instance."""

from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy import case, or_, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from app.models import LoginWindow


def reserve_login_attempt(db, now):
    # One shared password means one shared throttle. It cannot be bypassed by
    # rotating IPs, spoofing proxy headers, or starting another serverless worker.
    insert = pg_insert if db.bind.dialect.name == "postgresql" else sqlite_insert
    expired = LoginWindow.started_at <= now - timedelta(seconds=60)
    statement = insert(LoginWindow).values(key="workspace", started_at=now, attempts=1)
    statement = statement.on_conflict_do_update(
        index_elements=[LoginWindow.key],
        set_={
            "started_at": case((expired, now), else_=LoginWindow.started_at),
            "attempts": case((expired, 1), else_=LoginWindow.attempts + 1),
        },
        where=or_(expired, LoginWindow.attempts < 5),
    ).returning(LoginWindow.attempts)
    allowed = db.scalar(statement)
    db.commit()
    if allowed is None:
        raise HTTPException(
            429,
            "Too many sign-in attempts. Try again in one minute.",
            headers={"Retry-After": "60"},
        )


def reset_login_attempts(db):
    db.execute(update(LoginWindow).where(LoginWindow.key == "workspace").values(attempts=0))
    db.commit()

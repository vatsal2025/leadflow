"""Isolated API process for Playwright. Never reads or changes the development DB."""

import os
from pathlib import Path
import sys
from uuid import uuid4

root = Path(__file__).resolve().parents[1]
test_data = root / ".tools"
test_data.mkdir(exist_ok=True)
os.environ.update({
    "APP_ENV": "test",
    "DATABASE_URL": f"sqlite:///{(test_data / f'e2e-{uuid4()}.db').as_posix()}",
    "APP_PASSWORD": "e2e-workspace-password",
    "SESSION_SECRET": "e2e-session-secret-for-isolated-tests-only",
    "COOKIE_SECURE": "false",
    "PUBLIC_ORIGIN": "http://localhost:3000",
})
os.chdir(root / "backend")
sys.path.insert(0, str(root / "backend"))

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
import uvicorn  # noqa: E402
from app.seed import seed  # noqa: E402

command.upgrade(Config("alembic.ini"), "head")
seed("Asia/Kolkata")
uvicorn.run("app.main:app", host="127.0.0.1", port=8000)

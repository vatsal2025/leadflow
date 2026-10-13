import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

os.environ["APP_ENV"] = "test"
os.environ["APP_PASSWORD"] = ""
os.environ["SESSION_SECRET"] = ""

from app.db import Base, get_db, make_engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture
def db(tmp_path):
    # TEST_DATABASE_URL must point to a disposable test database: tables are dropped.
    engine = make_engine(os.environ.get("TEST_DATABASE_URL") or f"sqlite:///{tmp_path / 'test.db'}")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as session:
        yield session
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture
def client(db):
    def override():
        yield db

    app.dependency_overrides[get_db] = override
    with TestClient(app, headers={"X-Leadflow-Client": "web"}) as client:
        yield client
    app.dependency_overrides.clear()

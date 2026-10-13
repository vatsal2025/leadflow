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
    engine = make_engine(f"sqlite:///{tmp_path / 'test.db'}")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as session:
        yield session
    engine.dispose()


@pytest.fixture
def client(db):
    def override():
        yield db

    app.dependency_overrides[get_db] = override
    with TestClient(app, headers={"X-Leadflow-Client": "web"}) as client:
        yield client
    app.dependency_overrides.clear()

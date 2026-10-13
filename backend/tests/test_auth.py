import pytest
from itsdangerous import URLSafeTimedSerializer

from app import main
from app.config import Settings


@pytest.fixture
def protected(monkeypatch):
    monkeypatch.setattr(main.settings, "app_password", "correct-password-1234")
    monkeypatch.setattr(
        main,
        "signer",
        URLSafeTimedSerializer("test-secret-which-is-long-enough-12345", salt="leadflow-v1"),
    )
    main.login_attempts.clear()


def test_auth_login_logout_and_tampered_cookie(client, protected):
    assert client.get("/api/leads").status_code == 401
    assert client.get("/api/auth/session").json()["authenticated"] is False
    assert client.post("/api/auth/login", json={"password": "wrong"}).status_code == 401
    response = client.post("/api/auth/login", json={"password": "correct-password-1234"})
    assert response.status_code == 200
    assert "HttpOnly" in response.headers["set-cookie"]
    assert "SameSite=strict" in response.headers["set-cookie"]
    assert client.get("/api/leads").status_code == 200
    client.cookies.set(main.COOKIE, "tampered")
    assert client.get("/api/leads").status_code == 401
    client.cookies.clear()
    client.post("/api/auth/login", json={"password": "correct-password-1234"})
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/leads").status_code == 401


def test_login_rate_limit(client, protected):
    for _ in range(5):
        assert client.post("/api/auth/login", json={"password": "wrong"}).status_code == 401
    response = client.post("/api/auth/login", json={"password": "wrong"})
    assert response.status_code == 429
    assert response.headers["retry-after"] == "60"


def test_expired_and_rotated_sessions(client, protected, monkeypatch):
    client.post("/api/auth/login", json={"password": "correct-password-1234"})
    monkeypatch.setattr(main, "SESSION_SECONDS", -1)
    assert client.get("/api/leads").status_code == 401
    monkeypatch.setattr(main, "SESSION_SECONDS", 3600)
    monkeypatch.setattr(main, "password_version", "new-password-fingerprint")
    assert client.get("/api/leads").status_code == 401


def test_production_rejects_insecure_config():
    with pytest.raises(ValueError):
        Settings(_env_file=None, app_env="production", app_password="")
    with pytest.raises(ValueError):
        Settings(
            _env_file=None,
            app_env="production",
            app_password="a" * 20,
            session_secret="s" * 40,
            cookie_secure=False,
        )
    settings = Settings(
        _env_file=None,
        app_env="production",
        app_password="a" * 20,
        session_secret="s" * 40,
        cookie_secure=True,
        public_origin="https://leads.example.com",
    )
    assert settings.cookie_secure

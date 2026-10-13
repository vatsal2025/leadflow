from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")

    app_env: str = "development"
    database_url: str = "sqlite:///./leadflow.db"
    public_origin: str = "http://localhost:3000"
    app_password: str = ""
    session_secret: str = ""
    cookie_secure: bool = False
    serverless: bool = False
    api_hostname: str = ""

    @model_validator(mode="after")
    def validate_security(self):
        if self.app_env not in {"development", "test", "production"}:
            raise ValueError("APP_ENV must be development, test, or production")
        if self.app_env == "production":
            if self.app_password and len(self.app_password) < 16:
                raise ValueError(
                    "When enabled, production APP_PASSWORD requires at least 16 characters"
                )
            if not self.cookie_secure or not self.public_origin.startswith("https://"):
                raise ValueError(
                    "Production requires COOKIE_SECURE=true and an HTTPS PUBLIC_ORIGIN"
                )
        if self.serverless and not self.database_url.startswith("postgresql+psycopg://"):
            raise ValueError("Serverless deployments require persistent PostgreSQL via psycopg")
        if self.api_hostname and any(char in self.api_hostname for char in "/:* "):
            raise ValueError("API_HOSTNAME must be an exact hostname without a scheme or port")
        if self.app_password and len(self.session_secret) < 32:
            raise ValueError("Authentication requires SESSION_SECRET of at least 32 characters")
        self.public_origin = self.public_origin.rstrip("/")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()

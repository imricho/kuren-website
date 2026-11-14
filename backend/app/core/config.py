"""Application configuration, loaded from environment variables.

All secrets and environment-specific values come from the environment (or a
`.env` file in development). Nothing sensitive is hardcoded here.
"""

from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict
from sqlalchemy.engine import URL


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Wedding Platform API"
    environment: Literal["development", "test", "production"] = "development"
    api_v1_prefix: str = "/api/v1"

    # Database (individual parts so passwords never need URL-escaping)
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_user: str
    postgres_password: str
    postgres_db: str
    # Database used by the automated test suite; defaults to "<postgres_db>_test"
    postgres_test_db: str | None = None

    # Browser origins allowed to call the API (comma-separated in the env)
    cors_origins: Annotated[list[str], NoDecode] = Field(default_factory=list)

    # Sessions
    session_cookie_name: str = "wp_session"
    session_ttl_hours: int = Field(default=168, ge=1, le=24 * 90)
    session_cookie_secure: bool = False

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip().rstrip("/") for origin in value.split(",") if origin.strip()]
        return value

    def _db_url(self, database: str) -> URL:
        return URL.create(
            drivername="postgresql+psycopg",
            username=self.postgres_user,
            password=self.postgres_password,
            host=self.postgres_host,
            port=self.postgres_port,
            database=database,
        )

    @property
    def database_url(self) -> URL:
        return self._db_url(self.postgres_db)

    @property
    def test_database_url(self) -> URL:
        return self._db_url(self.postgres_test_db or f"{self.postgres_db}_test")

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # values come from the environment

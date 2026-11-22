"""Application configuration, loaded from environment variables.

All secrets and environment-specific values come from the environment (or a
`.env` file in development). Nothing sensitive is hardcoded here.
"""

from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, field_validator, model_validator
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

    # Requests with a larger body are rejected with 413 before being parsed.
    max_request_body_bytes: int = Field(default=1_048_576, ge=1024)

    # Image uploads: stored (re-encoded) under `media_root`, served at /media/<name>.
    media_root: str = "/app/media"
    max_upload_bytes: int = Field(default=5 * 1024 * 1024, ge=1024)
    max_image_pixels: int = Field(default=40_000_000, ge=1_000_000)
    max_assets_per_invitation: int = Field(default=300, ge=1)

    # Public invitation endpoint: requests per client IP per minute, per process.
    public_rate_limit_per_minute: int = Field(default=120, ge=1)
    # Public RSVP submissions: a separate, stricter bucket (per client IP per minute, per process),
    # plus a per-invitation bucket so one slug cannot be flooded from many addresses.
    rsvp_rate_limit_per_minute: int = Field(default=10, ge=1)
    # Well above the per-IP limit, so a handful of addresses cannot lock real guests out.
    rsvp_slug_rate_limit_per_minute: int = Field(default=300, ge=1)

    # Reverse proxies whose X-Forwarded-For uvicorn trusts (uvicorn reads the same env var,
    # FORWARDED_ALLOW_IPS). Comma-separated IPs/CIDRs; "*" is refused: anyone could then
    # spoof their address and dodge the per-IP rate limits.
    forwarded_allow_ips: str = "127.0.0.1"
    # Where rate-limit counters live: "memory" is per process (fine for one worker in
    # development); "database" is shared by every worker/replica and is required in production.
    rate_limit_backend: Literal["memory", "database"] = "memory"
    # Public RSVP submissions: body cap (the rest of the API keeps max_request_body_bytes).
    max_rsvp_body_bytes: int = Field(default=16 * 1024, ge=1024)

    @field_validator("forwarded_allow_ips")
    @classmethod
    def _no_wildcard_proxy(cls, value: str) -> str:
        if "*" in value:
            raise ValueError("FORWARDED_ALLOW_IPS must list the proxy addresses; '*' is not allowed")
        return value

    @model_validator(mode="after")
    def _secure_cookies_in_production(self) -> "Settings":
        # Production is served over HTTPS; a session cookie without Secure could leak over HTTP.
        if self.environment == "production" and not self.session_cookie_secure:
            raise ValueError("SESSION_COOKIE_SECURE must be true when ENVIRONMENT=production")
        if self.environment == "production" and self.rate_limit_backend != "database":
            raise ValueError("RATE_LIMIT_BACKEND must be 'database' when ENVIRONMENT=production")
        return self

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

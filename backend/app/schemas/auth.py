from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.schemas.text import check_controls

# Upper bound protects the hasher from very large inputs.
PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128


def _strip_name(value: str) -> str:
    value = " ".join(check_controls(value).split())
    if not value:
        raise ValueError("must not be blank")
    return value


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_LENGTH)
    full_name: str = Field(min_length=1, max_length=120)

    _normalise_name = field_validator("full_name")(_strip_name)


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)

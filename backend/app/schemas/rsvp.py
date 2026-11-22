"""RSVP replies: the public submission and the owner's views (docs/api/invitations.md).

The submission is validated twice: here for shape and limits, and by `rsvp_service`
against the PUBLISHED RSVP config (deadline, party size, contact, fields, sessions).
"""

import uuid
from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BeforeValidator, EmailStr, Field, StrictBool, StringConstraints

from app.schemas.invitation import (
    PUBLIC_ID_PATTERN,
    PhoneNumber,
    ReqStr120,
    RequestModel,
    ResponseModel,
    SafeId,
    Str120,
    Str1000,
    _blank_to_none,
)
from app.schemas.text import clean_guest_text

# Guest-typed free text: NFC, bidi/zero-width stripped, no controls (line breaks only in
# multi-line text). Runs before trimming/length checks, so limits apply to the cleaned text.
_SingleLine = BeforeValidator(clean_guest_text)
_MultiLine = BeforeValidator(lambda v: clean_guest_text(v, multiline=True))
GuestName = Annotated[ReqStr120, _SingleLine]
GuestLabel = Annotated[Str120, _SingleLine]
GuestMessage = Annotated[Str1000, _MultiLine]

Attendance = Literal["attending", "not_attending"]
ANSWER_TEXT_MAX = 1000

AnswerKey = Annotated[str, StringConstraints(pattern=PUBLIC_ID_PATTERN)]
AnswerValue = StrictBool | Annotated[str, StringConstraints(max_length=ANSWER_TEXT_MAX), _MultiLine]
OptEmail = Annotated[
    Annotated[EmailStr, StringConstraints(max_length=254)] | None,
    BeforeValidator(_blank_to_none),
    Field(default=None),
]


class RsvpSubmission(RequestModel):
    name: GuestName
    attendance: Attendance
    #: People in this reply (the guest included). Stored as 0 when not attending.
    party_size: int = Field(default=1, ge=0, le=20, strict=True)
    email: OptEmail
    phone: PhoneNumber
    session_ids: list[SafeId] = Field(default_factory=list, max_length=20)
    answers: dict[AnswerKey, AnswerValue] = Field(default_factory=dict, max_length=10)
    message: GuestMessage
    #: The `?to=` name from the guest's link, if any.
    guest_label: GuestLabel
    #: Honeypot: humans never see this field, so it must stay empty.
    website: Annotated[str | None, StringConstraints(max_length=500)] = None


class RsvpSubmitted(ResponseModel):
    id: uuid.UUID
    attendance: Attendance
    party_size: int
    confirmation_message: str | None = None
    #: Private token that lets this guest change THIS reply later (sent once; only its hash
    #: is stored). The page keeps it on the device and offers it as a personal edit link.
    edit_token: str | None = None
    updated_at: datetime | None = None


class RsvpOwnReply(ResponseModel):
    """What a guest holding the edit token sees of their own reply."""

    id: uuid.UUID
    name: str
    attendance: Attendance
    party_size: int
    email: str | None = None
    phone: str | None = None
    session_ids: list[str] = Field(default_factory=list)
    answers: dict[str, Any] = Field(default_factory=dict)
    message: str | None = None
    created_at: datetime
    updated_at: datetime | None = None


class RsvpResponseOut(ResponseModel):
    id: uuid.UUID
    name: str
    attendance: Attendance
    party_size: int
    email: str | None = None
    phone: str | None = None
    session_ids: list[str] = Field(default_factory=list)
    answers: dict[str, Any] = Field(default_factory=dict)
    message: str | None = None
    guest_label: str | None = None
    created_at: datetime
    #: Set when the guest changed this reply through their edit link.
    updated_at: datetime | None = None
    edit_count: int = 0
    #: Another reply has the same name, email or phone. Shown, never merged or removed.
    possible_duplicate: bool = False


class RsvpSummary(ResponseModel):
    responses: int
    attending: int
    not_attending: int
    attending_people: int
    capacity: int | None = None
    #: Replies flagged `possibleDuplicate` (they are still counted in every total).
    possible_duplicates: int = 0


class RsvpResponseList(ResponseModel):
    items: list[RsvpResponseOut]
    total: int
    summary: RsvpSummary


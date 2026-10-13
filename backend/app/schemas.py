from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator


class Status(StrEnum):
    new = "New"
    contacted = "Contacted"
    qualified = "Qualified"
    proposal = "Proposal Sent"
    won = "Won"
    lost = "Lost"


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class LeadCreate(Input):
    id: UUID
    name: str = Field(min_length=1, max_length=120)
    company: str | None = Field(default=None, max_length=160)
    phone: str | None = Field(default=None, max_length=40)

    @field_validator("company", "phone")
    @classmethod
    def empty_to_none(cls, value):
        return value or None


class LeadUpdate(Input):
    expected_version: int = Field(ge=1)
    status: Status | None = None
    follow_up_at: AwareDatetime | None = None


class DiscussionCreate(Input):
    id: UUID
    note: str = Field(min_length=1, max_length=10000)
    follow_up_at: AwareDatetime | None = None
    expected_version: int = Field(ge=1)


class DiscussionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    note: str
    follow_up_at: datetime | None
    created_at: datetime


class LeadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    company: str | None
    phone: str | None
    status: Status
    follow_up_at: datetime | None
    created_at: datetime
    updated_at: datetime
    version: int
    last_discussion: DiscussionOut | None = None


class LeadPage(BaseModel):
    items: list[LeadOut]
    total: int
    offset: int
    limit: int
    status_counts: dict[str, int]
    today_count: int
    overdue_count: int


class DiscussionPage(BaseModel):
    items: list[DiscussionOut]
    total: int
    offset: int
    limit: int


class Login(Input):
    password: str = Field(min_length=1, max_length=1024)

    # Password whitespace is significant, unlike form text.
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)

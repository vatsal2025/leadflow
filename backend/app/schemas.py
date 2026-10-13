from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, EmailStr, Field, field_validator


class Status(StrEnum):
    new = "New"
    contacted = "Contacted"
    qualified = "Qualified"
    proposal = "Proposal Sent"
    won = "Won"
    lost = "Lost"


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Priority(StrEnum):
    low = "Low"
    normal = "Normal"
    high = "High"


class Currency(StrEnum):
    inr = "INR"
    usd = "USD"
    eur = "EUR"
    gbp = "GBP"


class ActivityKind(StrEnum):
    note = "Note"
    call = "Call"
    email = "Email"
    meeting = "Meeting"


class ContactFields(Input):
    company: str | None = Field(default=None, max_length=160)
    phone: str | None = Field(default=None, max_length=40)
    email: EmailStr | None = Field(default=None, max_length=254)
    source: str | None = Field(default=None, max_length=80)
    estimated_value: Decimal | None = Field(
        default=None, ge=0, max_digits=14, decimal_places=2, allow_inf_nan=False
    )

    @field_validator("company", "phone", "email", "source", mode="before")
    @classmethod
    def empty_to_none(cls, value):
        return value.strip() or None if isinstance(value, str) else value


class LeadCreate(ContactFields):
    id: UUID
    name: str = Field(min_length=1, max_length=120)
    priority: Priority = Priority.normal
    currency: Currency = Currency.inr


class LeadUpdate(ContactFields):
    expected_version: int = Field(ge=1)
    status: Status | None = None
    follow_up_at: AwareDatetime | None = None
    name: str | None = Field(default=None, min_length=1, max_length=120)
    priority: Priority | None = None
    currency: Currency | None = None
    archived: bool | None = None


class DiscussionCreate(Input):
    id: UUID
    note: str = Field(min_length=1, max_length=10000)
    kind: ActivityKind = ActivityKind.note
    follow_up_at: AwareDatetime | None = None
    expected_version: int = Field(ge=1)


class DiscussionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    note: str
    kind: ActivityKind
    follow_up_at: datetime | None
    created_at: datetime


class LeadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    company: str | None
    phone: str | None
    email: str | None
    source: str | None
    priority: Priority
    estimated_value: Decimal | None
    currency: Currency
    archived: bool
    status: Status
    follow_up_at: datetime | None
    created_at: datetime
    updated_at: datetime
    version: int
    last_discussion: DiscussionOut | None = None
    attention_reasons: list[str] = Field(default_factory=list)


class LeadPage(BaseModel):
    items: list[LeadOut]
    total: int
    offset: int
    limit: int
    status_counts: dict[str, int]
    today_count: int
    overdue_count: int
    value_totals: dict[str, Decimal] = Field(default_factory=dict)


class DiscussionPage(BaseModel):
    items: list[DiscussionOut]
    total: int
    offset: int
    limit: int


class Login(Input):
    password: str = Field(min_length=1, max_length=1024)

    # Password whitespace is significant, unlike form text.
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)

from datetime import datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    false,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, UTCDateTime, utcnow

STATUSES = ("New", "Contacted", "Qualified", "Proposal Sent", "Won", "Lost")


class Lead(Base):
    __tablename__ = "leads"
    __table_args__ = (
        CheckConstraint("status IN ('New','Contacted','Qualified','Proposal Sent','Won','Lost')"),
        CheckConstraint("version >= 1"),
        Index("ix_leads_status_follow_up", "status", "follow_up_at"),
        CheckConstraint("priority IN ('Low','Normal','High')", name="ck_lead_priority"),
        CheckConstraint("currency IN ('INR','USD','EUR','GBP')", name="ck_lead_currency"),
        CheckConstraint("estimated_value IS NULL OR estimated_value >= 0", name="ck_lead_value"),
        Index("ix_leads_archived_priority", "archived", "priority"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(120))
    company: Mapped[str | None] = mapped_column(String(160))
    phone: Mapped[str | None] = mapped_column(String(40))
    email: Mapped[str | None] = mapped_column(String(254))
    source: Mapped[str | None] = mapped_column(String(80))
    priority: Mapped[str] = mapped_column(String(10), default="Normal", server_default="Normal")
    estimated_value: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    currency: Mapped[str] = mapped_column(String(3), default="INR", server_default="INR")
    archived: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    status: Mapped[str] = mapped_column(String(20), default="New", index=True)
    follow_up_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), index=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow, index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)


class Discussion(Base):
    __tablename__ = "discussions"
    __table_args__ = (
        Index("ix_discussions_lead_created", "lead_id", "created_at", "id"),
        CheckConstraint("kind IN ('Note','Call','Email','Meeting')", name="ck_discussion_kind"),
    )

    # Client-generated UUID makes retried saves safe after a lost response.
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    lead_id: Mapped[str] = mapped_column(ForeignKey("leads.id", ondelete="CASCADE"))
    note: Mapped[str] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(String(10), default="Note", server_default="Note")
    follow_up_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)

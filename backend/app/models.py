from datetime import datetime
from uuid import uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, UTCDateTime, utcnow

STATUSES = ("New", "Contacted", "Qualified", "Proposal Sent", "Won", "Lost")


class Lead(Base):
    __tablename__ = "leads"
    __table_args__ = (
        CheckConstraint("status IN ('New','Contacted','Qualified','Proposal Sent','Won','Lost')"),
        CheckConstraint("version >= 1"),
        Index("ix_leads_status_follow_up", "status", "follow_up_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(120))
    company: Mapped[str | None] = mapped_column(String(160))
    phone: Mapped[str | None] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(20), default="New", index=True)
    follow_up_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), index=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow, index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)


class Discussion(Base):
    __tablename__ = "discussions"
    __table_args__ = (Index("ix_discussions_lead_created", "lead_id", "created_at", "id"),)

    # Client-generated UUID makes retried saves safe after a lost response.
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    lead_id: Mapped[str] = mapped_column(ForeignKey("leads.id", ondelete="CASCADE"))
    note: Mapped[str] = mapped_column(Text)
    follow_up_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)

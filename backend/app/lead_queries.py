"""Shared list/export filters. Attention signals describe facts, never predictions."""

from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException
from sqlalchemy import case, func, or_, select

from app.models import STATUSES, Discussion, Lead
from app.schemas import DiscussionOut, LeadOut, LeadPage


def day_bounds(timezone: str, now: datetime):
    try:
        zone = ZoneInfo(timezone)
    except (ZoneInfoNotFoundError, ValueError):
        raise HTTPException(422, "Unknown IANA timezone.") from None
    today = now.astimezone(zone).date()
    return (
        datetime.combine(today, time.min, zone).astimezone(UTC),
        datetime.combine(today + timedelta(days=1), time.min, zone).astimezone(UTC),
    )


def decorate(lead: Lead, latest: Discussion | None, now: datetime) -> LeadOut:
    result = LeadOut.model_validate(lead)
    result.last_discussion = DiscussionOut.model_validate(latest) if latest else None
    if not lead.archived and lead.status not in {"Won", "Lost"}:
        if lead.follow_up_at is None:
            result.attention_reasons.append("No next step")
        elif lead.follow_up_at < now:
            result.attention_reasons.append("Overdue follow-up")
        last_activity = latest.created_at if latest else lead.created_at
        if last_activity <= now - timedelta(days=7):
            result.attention_reasons.append("No activity in 7 days")
    return result


def filters(*, search, priority, focus, archived, now):
    predicates = []
    if archived != "all":
        predicates.append(Lead.archived.is_(archived == "archived"))
    if search.strip():
        predicates.append(
            or_(
                *(
                    column.icontains(search.strip(), autoescape=True)
                    for column in (Lead.name, Lead.company, Lead.email, Lead.source)
                )
            )
        )
    if priority:
        predicates.append(Lead.priority == priority)
    if focus != "all":
        predicates.extend([Lead.status.not_in(["Won", "Lost"]), Lead.archived.is_(False)])
        latest = (
            select(func.max(Discussion.created_at))
            .where(Discussion.lead_id == Lead.id)
            .correlate(Lead)
            .scalar_subquery()
        )
        quiet = func.coalesce(latest, Lead.created_at) <= now - timedelta(days=7)
        no_next = Lead.follow_up_at.is_(None)
        predicates.append(
            no_next
            if focus == "no_next_step"
            else quiet
            if focus == "quiet"
            else or_(no_next, quiet, Lead.follow_up_at < now)
        )
    return predicates


def filtered_predicates(*, status, search, priority, focus, archived, follow_up, timezone, now):
    start, end = day_bounds(timezone, now)
    today = (Lead.follow_up_at >= start) & (Lead.follow_up_at < end)
    overdue = Lead.follow_up_at < now
    base = filters(search=search, priority=priority, focus=focus, archived=archived, now=now)
    selected = [*base]
    if status:
        selected.append(Lead.status == status)
    matching = [*selected]
    if follow_up == "today":
        matching.append(today)
    elif follow_up == "overdue":
        matching.append(overdue)
    return base, selected, matching, today, overdue, end


def query_leads(db, *, offset, limit, now, **kwargs):
    base, selected, matching, today, overdue, end = filtered_predicates(now=now, **kwargs)
    counts = dict(
        db.execute(select(Lead.status, func.count()).where(*base).group_by(Lead.status)).all()
    )
    total = db.scalar(select(func.count()).select_from(Lead).where(*matching)) or 0
    leads = db.scalars(
        select(Lead)
        .where(*matching)
        .order_by(
            case((today, 0), (overdue, 1), else_=2),
            case((Lead.follow_up_at < end, Lead.follow_up_at), else_=None).asc().nulls_last(),
            Lead.updated_at.desc(),
            Lead.id,
        )
        .offset(offset)
        .limit(limit)
    ).all()
    latest_by_lead = {}
    if leads:
        ranked = (
            select(
                Discussion.id,
                func.row_number()
                .over(
                    partition_by=Discussion.lead_id,
                    order_by=(Discussion.created_at.desc(), Discussion.id.desc()),
                )
                .label("rank"),
            )
            .where(Discussion.lead_id.in_([lead.id for lead in leads]))
            .subquery()
        )
        latest = db.scalars(
            select(Discussion).join(ranked, Discussion.id == ranked.c.id).where(ranked.c.rank == 1)
        ).all()
        latest_by_lead = {item.lead_id: item for item in latest}
    totals = dict(
        db.execute(
            select(Lead.currency, func.sum(Lead.estimated_value))
            .where(*matching, Lead.estimated_value.is_not(None))
            .group_by(Lead.currency)
        ).all()
    )
    return LeadPage(
        items=[decorate(lead, latest_by_lead.get(lead.id), now) for lead in leads],
        total=total,
        offset=offset,
        limit=limit,
        status_counts={s: counts.get(s, 0) for s in STATUSES},
        today_count=db.scalar(select(func.count()).select_from(Lead).where(*selected, today)) or 0,
        overdue_count=db.scalar(select(func.count()).select_from(Lead).where(*selected, overdue))
        or 0,
        value_totals=totals,
    )

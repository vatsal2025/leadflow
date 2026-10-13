import hashlib
import hmac
import logging
import time
from collections import defaultdict, deque
from datetime import UTC, datetime, timedelta
from datetime import time as day_time
from threading import Lock
from typing import Annotated, Literal
from urllib.parse import urlparse
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy import case, func, select, text, update
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.config import get_settings
from app.db import get_db, utcnow
from app.models import STATUSES, Discussion, Lead
from app.schemas import (
    DiscussionCreate,
    DiscussionOut,
    DiscussionPage,
    LeadCreate,
    LeadOut,
    LeadPage,
    LeadUpdate,
    Login,
    Status,
)

settings = get_settings()
app = FastAPI(
    title="LeadFlow API",
    version="1.0.0",
    docs_url="/api/docs" if settings.app_env != "production" else None,
    redoc_url=None,
    openapi_url="/api/openapi.json" if settings.app_env != "production" else None,
)
logger = logging.getLogger("leadflow")
Db = Annotated[Session, Depends(get_db)]
COOKIE = "leadflow_session"
SESSION_SECONDS = 60 * 60 * 12
signer = URLSafeTimedSerializer(
    settings.session_secret or "development-auth-disabled", salt="leadflow-v1"
)
# A password rotation invalidates outstanding sessions.
password_version = hashlib.sha256(settings.app_password.encode()).hexdigest()
login_attempts: dict[str, deque] = defaultdict(deque)
attempts_lock = Lock()
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=[
        urlparse(settings.public_origin).hostname,
        "localhost",
        "127.0.0.1",
        "api",
        "testserver",
    ],
)


def authenticated(request: Request) -> bool:
    if not settings.app_password:
        return True
    try:
        data = signer.loads(request.cookies.get(COOKIE, ""), max_age=SESSION_SECONDS)
        return isinstance(data, dict) and hmac.compare_digest(data.get("v", ""), password_version)
    except (BadSignature, SignatureExpired, TypeError):
        return False


def require_auth(request: Request):
    if not authenticated(request):
        raise HTTPException(401, "Please sign in to continue.")


Auth = Depends(require_auth)


@app.middleware("http")
async def security_and_errors(request: Request, call_next):
    request_id = str(uuid4())
    if request.method in {"POST", "PATCH", "PUT", "DELETE"}:
        origin = request.headers.get("origin")
        if (origin and origin != settings.public_origin) or request.headers.get(
            "x-leadflow-client"
        ) not in {"web", "cli"}:
            return JSONResponse(
                status_code=403, content={"detail": "Request origin could not be verified."}
            )
        # Bound even chunked bodies before JSON parsing.
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > 65536:
                return JSONResponse(status_code=413, content={"detail": "Request is too large."})
        request._body = bytes(body)
    try:
        response = await call_next(request)
    except Exception:
        logger.exception("Unhandled request failure request_id=%s", request_id)
        response = JSONResponse(
            status_code=500,
            content={"detail": "Something went wrong. Please retry.", "request_id": request_id},
        )
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    return response


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    # Do not echo submitted passwords, notes, or other private data.
    return JSONResponse(
        status_code=422,
        content={
            "detail": [{"loc": e["loc"], "msg": e["msg"], "type": e["type"]} for e in exc.errors()]
        },
    )


@app.get("/api/health/live")
def live():
    return {"status": "ok"}


@app.get("/api/health/ready")
def ready(db: Db):
    try:
        db.execute(text("SELECT version_num FROM alembic_version"))
        db.execute(select(Lead.id).limit(1))
    except SQLAlchemyError:
        raise HTTPException(503, "Database is not ready.") from None
    return {"status": "ok"}


@app.get("/api/auth/session")
def session(request: Request):
    return {"authenticated": authenticated(request), "auth_enabled": bool(settings.app_password)}


@app.post("/api/auth/login")
def login(payload: Login, request: Request, response: Response):
    if not settings.app_password:
        return {"authenticated": True}
    now = time.monotonic()
    # Deliberately one API worker. See README before scaling; never trust forwarded IPs.
    address = request.client.host if request.client else "unknown"
    with attempts_lock:
        for key in list(login_attempts):
            if not login_attempts[key] or login_attempts[key][-1] <= now - 60:
                del login_attempts[key]
        attempts = login_attempts[address]
        while attempts and attempts[0] <= now - 60:
            attempts.popleft()
        if len(attempts) >= 5:
            raise HTTPException(
                429,
                "Too many sign-in attempts. Try again in one minute.",
                headers={"Retry-After": "60"},
            )
        attempts.append(now)
    if not hmac.compare_digest(payload.password.encode(), settings.app_password.encode()):
        raise HTTPException(401, "Incorrect workspace password.")
    response.set_cookie(
        COOKIE,
        signer.dumps({"v": password_version}),
        max_age=SESSION_SECONDS,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="strict",
        path="/",
    )
    return {"authenticated": True}


@app.post("/api/auth/logout", status_code=204)
def logout(response: Response):
    response.delete_cookie(
        COOKIE, path="/", secure=settings.cookie_secure, httponly=True, samesite="strict"
    )


def get_lead(db: Session, lead_id: UUID) -> Lead:
    lead = db.get(Lead, str(lead_id))
    if not lead:
        raise HTTPException(404, "Lead not found.")
    return lead


def as_lead(db: Session, lead: Lead) -> LeadOut:
    latest = db.scalar(
        select(Discussion)
        .where(Discussion.lead_id == lead.id)
        .order_by(Discussion.created_at.desc(), Discussion.id.desc())
        .limit(1)
    )
    result = LeadOut.model_validate(lead)
    result.last_discussion = DiscussionOut.model_validate(latest) if latest else None
    return result


def day_bounds(timezone: str, now: datetime):
    try:
        tz = ZoneInfo(timezone)
    except (ZoneInfoNotFoundError, ValueError):
        raise HTTPException(422, "Unknown IANA timezone.") from None
    today = now.astimezone(tz).date()
    return (
        datetime.combine(today, day_time.min, tz).astimezone(UTC),
        datetime.combine(today + timedelta(days=1), day_time.min, tz).astimezone(UTC),
    )


@app.get("/api/leads", response_model=LeadPage, dependencies=[Auth])
def list_leads(
    db: Db,
    status: Status | None = None,
    search: str = Query(default="", max_length=120),
    timezone: str = Query(default="UTC", max_length=100),
    follow_up: Literal["all", "today", "overdue"] = "all",
    offset: int = Query(default=0, ge=0, le=1000000),
    limit: int = Query(default=50, ge=1, le=100),
):
    now = utcnow()
    start, end = day_bounds(timezone, now)
    today = (Lead.follow_up_at >= start) & (Lead.follow_up_at < end)
    overdue = Lead.follow_up_at < now
    predicates = []
    if search.strip():
        predicates.append(Lead.name.icontains(search.strip(), autoescape=True))
    counts = dict(
        db.execute(select(Lead.status, func.count()).where(*predicates).group_by(Lead.status)).all()
    )
    if status:
        predicates.append(Lead.status == status.value)
    today_count = db.scalar(select(func.count()).select_from(Lead).where(*predicates, today)) or 0
    overdue_count = (
        db.scalar(select(func.count()).select_from(Lead).where(*predicates, overdue)) or 0
    )
    if follow_up == "today":
        predicates.append(today)
    elif follow_up == "overdue":
        predicates.append(overdue)
    total = db.scalar(select(func.count()).select_from(Lead).where(*predicates)) or 0
    # Pin today's follow-ups BEFORE pagination; overdue leads from earlier days follow.
    leads = db.scalars(
        select(Lead)
        .where(*predicates)
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
    items = []
    for lead in leads:
        item = LeadOut.model_validate(lead)
        note = latest_by_lead.get(lead.id)
        item.last_discussion = DiscussionOut.model_validate(note) if note else None
        items.append(item)
    return LeadPage(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
        status_counts={s: counts.get(s, 0) for s in STATUSES},
        today_count=today_count,
        overdue_count=overdue_count,
    )


@app.post("/api/leads", response_model=LeadOut, status_code=201, dependencies=[Auth])
def create_lead(payload: LeadCreate, db: Db, response: Response):
    existing = db.get(Lead, str(payload.id))
    if existing:
        if (existing.name, existing.company, existing.phone) != (
            payload.name,
            payload.company,
            payload.phone,
        ):
            raise HTTPException(409, "This request ID was already used. Refresh and try again.")
        response.status_code = 200
        return as_lead(db, existing)
    lead = Lead(id=str(payload.id), name=payload.name, company=payload.company, phone=payload.phone)
    db.add(lead)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Lead was saved by another request. Please refresh.") from None
    response.headers["Location"] = f"/api/leads/{lead.id}"
    return as_lead(db, lead)


@app.get("/api/leads/{lead_id}", response_model=LeadOut, dependencies=[Auth])
def lead_detail(lead_id: UUID, db: Db):
    return as_lead(db, get_lead(db, lead_id))


def update_version(db: Session, lead: Lead, expected_version: int, values: dict):
    result = db.execute(
        update(Lead)
        .where(Lead.id == lead.id, Lead.version == expected_version)
        .values(**values, version=Lead.version + 1, updated_at=utcnow())
        .execution_options(synchronize_session=False)
    )
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(
            409, "This lead changed in another session. Review the latest details and retry."
        )


@app.patch("/api/leads/{lead_id}", response_model=LeadOut, dependencies=[Auth])
def patch_lead(lead_id: UUID, payload: LeadUpdate, db: Db):
    lead = get_lead(db, lead_id)
    values = payload.model_dump(exclude_unset=True, exclude={"expected_version"})
    if "status" in values and values["status"] is None:
        raise HTTPException(422, "Status cannot be empty.")
    if not values:
        raise HTTPException(422, "Provide a status or follow-up change.")
    update_version(db, lead, payload.expected_version, values)
    db.commit()
    db.refresh(lead)
    return as_lead(db, lead)


@app.get("/api/leads/{lead_id}/discussions", response_model=DiscussionPage, dependencies=[Auth])
def list_discussions(
    lead_id: UUID,
    db: Db,
    offset: int = Query(default=0, ge=0, le=1000000),
    limit: int = Query(default=50, ge=1, le=100),
):
    get_lead(db, lead_id)
    predicate = Discussion.lead_id == str(lead_id)
    total = db.scalar(select(func.count()).select_from(Discussion).where(predicate)) or 0
    items = db.scalars(
        select(Discussion)
        .where(predicate)
        .order_by(Discussion.created_at.desc(), Discussion.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    return DiscussionPage(
        items=[DiscussionOut.model_validate(item) for item in items],
        total=total,
        offset=offset,
        limit=limit,
    )


@app.post(
    "/api/leads/{lead_id}/discussions", response_model=LeadOut, status_code=201, dependencies=[Auth]
)
def create_discussion(lead_id: UUID, payload: DiscussionCreate, db: Db, response: Response):
    lead = get_lead(db, lead_id)
    existing = db.get(Discussion, str(payload.id))
    if existing:
        if (existing.lead_id, existing.note, existing.follow_up_at) != (
            lead.id,
            payload.note,
            payload.follow_up_at,
        ):
            raise HTTPException(409, "This request ID was already used for a different discussion.")
        response.status_code = 200
        return as_lead(db, lead)
    values = {}
    # Omitting a reminder preserves the existing lead reminder; clearing is explicit via PATCH.
    if payload.follow_up_at is not None:
        values["follow_up_at"] = payload.follow_up_at
    update_version(db, lead, payload.expected_version, values)
    db.add(
        Discussion(
            id=str(payload.id),
            lead_id=lead.id,
            note=payload.note,
            follow_up_at=payload.follow_up_at,
        )
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            409, "Discussion was saved by another request. Please refresh."
        ) from None
    db.refresh(lead)
    return as_lead(db, lead)

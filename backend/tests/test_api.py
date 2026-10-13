from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import func, select

from app import main
from app.models import Discussion, Lead


def create(client, name="Test Lead", **fields):
    response = client.post("/api/leads", json={"id": str(uuid4()), "name": name, **fields})
    assert response.status_code == 201, response.text
    return response.json()


def discussion(client, lead, note="Had a useful conversation.", **fields):
    return client.post(
        f"/api/leads/{lead['id']}/discussions",
        json={"id": str(uuid4()), "note": note, "expected_version": lead["version"], **fields},
    )


def test_create_defaults_and_persistence(client):
    lead = create(client, "  Aarav Mehta  ", company=" ", phone="+91 99999 00000")
    assert lead["name"] == "Aarav Mehta"
    assert lead["status"] == "New"
    assert lead["company"] is None
    assert lead["version"] == 1
    assert lead["last_discussion"] is None
    assert client.get(f"/api/leads/{lead['id']}").json() == lead


@pytest.mark.parametrize(
    "fields",
    [
        {"name": " "},
        {"name": "a" * 121},
        {"name": "ok", "company": "a" * 161},
        {"name": "ok", "phone": "1" * 41},
        {"name": "ok", "status": "Won"},
        {"name": "ok", "extra": True},
    ],
)
def test_invalid_lead(client, fields):
    assert client.post("/api/leads", json={"id": str(uuid4()), **fields}).status_code == 422


def test_create_idempotency(client, db):
    payload = {"id": str(uuid4()), "name": "One lead"}
    assert client.post("/api/leads", json=payload).status_code == 201
    assert client.post("/api/leads", json=payload).status_code == 200
    assert db.scalar(select(func.count()).select_from(Lead)) == 1
    assert client.post("/api/leads", json={**payload, "name": "Different"}).status_code == 409


def test_discussion_updates_list_and_preserves_reminder_when_omitted(client):
    lead = create(client)
    follow_up = datetime.now(UTC) + timedelta(days=1)
    response = discussion(
        client, lead, note="  First discussion  ", follow_up_at=follow_up.isoformat()
    )
    assert response.status_code == 201
    updated = response.json()
    assert updated["last_discussion"]["note"] == "First discussion"
    assert datetime.fromisoformat(updated["follow_up_at"]) == follow_up
    assert updated["version"] == 2
    item = client.get("/api/leads").json()["items"][0]
    assert item == updated
    response = discussion(client, updated, note="Another discussion")
    assert response.status_code == 201
    assert response.json()["follow_up_at"] == updated["follow_up_at"]
    history = client.get(f"/api/leads/{lead['id']}/discussions").json()
    assert [item["note"] for item in history["items"]] == ["Another discussion", "First discussion"]


def test_discussion_idempotency_and_conflicting_reuse(client, db):
    lead = create(client)
    payload = {"id": str(uuid4()), "note": "Only once", "expected_version": 1}
    url = f"/api/leads/{lead['id']}/discussions"
    assert client.post(url, json=payload).status_code == 201
    assert client.post(url, json=payload).status_code == 200
    assert db.scalar(select(func.count()).select_from(Discussion)) == 1
    assert client.post(url, json={**payload, "note": "Changed"}).status_code == 409
    assert client.get(f"/api/leads/{lead['id']}").json()["version"] == 2


@pytest.mark.parametrize(
    "fields",
    [
        {"note": " "},
        {"note": "a" * 10001},
        {"follow_up_at": "2026-10-13T15:00:00"},
        {"follow_up_at": "bad-date"},
        {"expected_version": 0},
    ],
)
def test_invalid_discussions(client, fields):
    lead = create(client)
    assert discussion(client, lead, **fields).status_code == 422
    assert client.get(f"/api/leads/{lead['id']}/discussions").json()["total"] == 0


def test_status_persists_and_conflict_does_not_save_note(client):
    lead = create(client)
    url = f"/api/leads/{lead['id']}"
    assert client.patch(url, json={"status": "Qualified", "expected_version": 1}).status_code == 200
    assert client.patch(url, json={"status": "Lost", "expected_version": 1}).status_code == 409
    assert discussion(client, lead, follow_up_at="2030-01-01T12:00:00Z").status_code == 409
    latest = client.get(url).json()
    assert latest["status"] == "Qualified"
    assert latest["follow_up_at"] is None
    assert client.get(url + "/discussions").json()["total"] == 0


def test_clear_reminder_without_erasing_history(client):
    lead = create(client)
    updated = discussion(client, lead, follow_up_at="2030-01-01T12:00:00+05:30").json()
    result = client.patch(
        f"/api/leads/{lead['id']}",
        json={"follow_up_at": None, "expected_version": updated["version"]},
    )
    assert result.status_code == 200
    assert result.json()["follow_up_at"] is None
    assert result.json()["last_discussion"]["follow_up_at"] is not None


def test_status_search_and_literal_wildcards(client):
    first = create(client, "Aarav Mehta")
    create(client, "Priya Sharma")
    create(client, "100% Real_Name")
    client.patch(f"/api/leads/{first['id']}", json={"status": "Won", "expected_version": 1})
    assert client.get("/api/leads?status=Won").json()["total"] == 1
    assert client.get("/api/leads?search=aARav").json()["items"][0]["name"] == "Aarav Mehta"
    assert client.get("/api/leads", params={"search": "%"}).json()["total"] == 1
    assert client.get("/api/leads", params={"search": "_"}).json()["total"] == 1
    assert client.get("/api/leads?search=missing").json()["total"] == 0


def test_today_pinned_before_pagination_in_user_timezone(client, monkeypatch):
    fixed = datetime(2026, 10, 13, 20, 0, tzinfo=UTC)  # Oct 14 in Kolkata
    monkeypatch.setattr(main, "utcnow", lambda: fixed)
    reminders = [
        ("Tomorrow", "2026-10-14T18:30:00Z"),
        ("Yesterday overdue", "2026-10-13T18:29:59Z"),
        ("Today start overdue", "2026-10-13T18:30:00Z"),
        ("Today last second", "2026-10-14T18:29:59Z"),
        ("Today later", "2026-10-14T06:00:00Z"),
    ]
    for name, timestamp in reminders:
        lead = create(client, name)
        assert discussion(client, lead, follow_up_at=timestamp).status_code == 201
    response = client.get("/api/leads", params={"timezone": "Asia/Kolkata", "limit": 2}).json()
    assert [lead["name"] for lead in response["items"]] == ["Today start overdue", "Today later"]
    assert response["today_count"] == 3
    assert response["overdue_count"] == 2
    next_page = client.get(
        "/api/leads", params={"timezone": "Asia/Kolkata", "limit": 2, "offset": 2}
    ).json()
    assert [lead["name"] for lead in next_page["items"]] == [
        "Today last second",
        "Yesterday overdue",
    ]
    assert client.get("/api/leads?timezone=Asia/Kolkata&follow_up=today").json()["total"] == 3
    assert client.get("/api/leads?timezone=Asia/Kolkata&follow_up=overdue").json()["total"] == 2


@pytest.mark.parametrize(
    "instant,expected_hours",
    [(datetime(2026, 3, 8, 15, tzinfo=UTC), 23), (datetime(2026, 11, 1, 15, tzinfo=UTC), 25)],
)
def test_dst_day_bounds(instant, expected_hours):
    start, end = main.day_bounds("America/New_York", instant)
    assert (end - start).total_seconds() == expected_hours * 3600


@pytest.mark.parametrize(
    "query", ["timezone=Not/AZone", "status=Invalid", "limit=101", "offset=-1", "follow_up=invalid"]
)
def test_invalid_list_parameters(client, query):
    assert client.get(f"/api/leads?{query}").status_code == 422


def test_missing_resources(client):
    missing = str(uuid4())
    assert client.get(f"/api/leads/{missing}").status_code == 404
    assert client.get(f"/api/leads/{missing}/discussions").status_code == 404
    assert client.get("/api/leads/not-a-uuid").status_code == 422


@pytest.mark.parametrize("payload", [{"status": None}, {"status": "Invalid"}, {}])
def test_invalid_status_changes(client, payload):
    lead = create(client)
    assert (
        client.patch(
            f"/api/leads/{lead['id']}", json={"expected_version": 1, **payload}
        ).status_code
        == 422
    )


def test_history_pagination_and_tie_breaking(client, db):
    lead = create(client)
    fixed = datetime(2026, 1, 1, tzinfo=UTC)
    for i in range(55):
        db.add(
            Discussion(
                id=f"00000000-0000-0000-0000-{i:012d}",
                lead_id=lead["id"],
                note=str(i),
                created_at=fixed,
            )
        )
    db.commit()
    url = f"/api/leads/{lead['id']}/discussions"
    page1 = client.get(url).json()
    page2 = client.get(url + "?offset=50").json()
    assert len(page1["items"]) == 50
    assert len(page2["items"]) == 5
    assert [item["note"] for item in page1["items"] + page2["items"]] == [
        str(i) for i in reversed(range(55))
    ]
    assert client.get("/api/leads").json()["items"][0]["last_discussion"]["note"] == "54"


def test_csrf_and_size_limit(client):
    payload = {"id": str(uuid4()), "name": "Lead"}
    assert (
        client.post(
            "/api/leads", json=payload, headers={"Origin": "https://evil.example"}
        ).status_code
        == 403
    )
    assert (
        client.post("/api/leads", json=payload, headers={"X-Leadflow-Client": ""}).status_code
        == 403
    )
    assert client.post("/api/leads", content="x" * 65537).status_code == 413


def test_security_headers_and_no_private_validation_echo(client):
    result = client.post("/api/auth/login", json={"password": "secret", "unexpected": "private"})
    assert result.status_code == 422
    assert "private" not in result.text
    assert result.headers["cache-control"] == "no-store"
    assert result.headers["x-content-type-options"] == "nosniff"
    assert result.headers["x-request-id"]

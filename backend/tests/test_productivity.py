import csv
import io
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from test_api import create, discussion

from app import main
from app.models import Discussion, Lead


def patch(client, lead, **fields):
    response = client.patch(
        f"/api/leads/{lead['id']}", json={"expected_version": lead["version"], **fields}
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_profile_edits_exact_values_and_conflicts(client):
    lead = create(
        client,
        email=" person@example.com ",
        source=" Referral ",
        priority="High",
        estimated_value="123456789012.34",
        currency="USD",
    )
    assert lead["email"] == "person@example.com"
    assert lead["source"] == "Referral"
    assert lead["estimated_value"] == "123456789012.34"
    updated = patch(client, lead, name="Renamed", email=None, estimated_value="0.00")
    assert updated["name"] == "Renamed"
    assert updated["email"] is None
    assert updated["estimated_value"] == "0.00"
    assert updated["priority"] == "High"
    assert (
        client.patch(
            f"/api/leads/{lead['id']}",
            json={"expected_version": lead["version"], "source": "Concurrent"},
        ).status_code
        == 409
    )
    updated = patch(client, updated, estimated_value=None, source=" ")
    assert updated["estimated_value"] is None and updated["source"] is None


@pytest.mark.parametrize(
    "fields",
    [
        {"email": "not-an-email"},
        {"estimated_value": "-0.01"},
        {"estimated_value": "1.001"},
        {"estimated_value": "1000000000000"},
        {"estimated_value": "NaN"},
        {"currency": "XYZ"},
        {"priority": "Urgent"},
        {"source": "x" * 81},
    ],
)
def test_invalid_profile_values(client, fields):
    assert (
        client.post(
            "/api/leads", json={"id": str(uuid4()), "name": "Invalid", **fields}
        ).status_code
        == 422
    )


@pytest.mark.parametrize("field", ["name", "priority", "currency", "archived", "status"])
def test_required_profile_fields_cannot_be_cleared(client, field):
    lead = create(client)
    assert (
        client.patch(
            f"/api/leads/{lead['id']}", json={"expected_version": 1, field: None}
        ).status_code
        == 422
    )


def test_new_fields_participate_in_idempotency(client):
    payload = {"id": str(uuid4()), "name": "Retry", "estimated_value": "0.10", "priority": "High"}
    assert client.post("/api/leads", json=payload).status_code == 201
    assert client.post("/api/leads", json=payload).status_code == 200
    assert client.post("/api/leads", json={**payload, "priority": "Low"}).status_code == 409
    lead = client.get(f"/api/leads/{payload['id']}").json()
    note = {"id": str(uuid4()), "note": "Called", "kind": "Call", "expected_version": 1}
    url = f"/api/leads/{lead['id']}/discussions"
    assert client.post(url, json=note).json()["last_discussion"]["kind"] == "Call"
    assert client.post(url, json=note).status_code == 200
    assert client.post(url, json={**note, "kind": "Meeting"}).status_code == 409
    assert client.post(url, json={**note, "kind": "Fax"}).status_code == 422


def test_archive_restore_preserves_history(client):
    lead = create(client)
    lead = discussion(client, lead, kind="Email").json()
    lead = patch(client, lead, archived=True)
    assert lead["attention_reasons"] == []
    assert client.get("/api/leads").json()["total"] == 0
    assert client.get("/api/leads?archived=archived").json()["total"] == 1
    assert client.get("/api/leads?archived=all&focus=attention").json()["total"] == 0
    assert client.get(f"/api/leads/{lead['id']}/discussions").json()["total"] == 1
    patch(client, lead, archived=False)
    restored = client.get("/api/leads").json()["items"][0]
    assert restored["last_discussion"]["kind"] == "Email"


def test_attention_rules_boundaries_and_closed_exclusion(client, db, monkeypatch):
    now = datetime(2026, 10, 13, 12, tzinfo=UTC)
    monkeypatch.setattr(main, "utcnow", lambda: now)
    quiet = create(client, "Quiet")
    quiet = patch(client, quiet, follow_up_at=(now + timedelta(days=1)).isoformat())
    row = db.get(Lead, quiet["id"])
    row.created_at = now - timedelta(days=7)
    row.updated_at = now
    db.commit()
    assert client.get("/api/leads?focus=quiet").json()["items"][0]["attention_reasons"] == [
        "No activity in 7 days"
    ]
    # A profile edit does not represent contact with the lead.
    quiet = patch(client, quiet, company="Updated today")
    assert client.get("/api/leads?focus=quiet").json()["total"] == 1
    db.add(
        Discussion(
            id=str(uuid4()),
            lead_id=quiet["id"],
            note="Recent call",
            kind="Call",
            created_at=now - timedelta(days=7) + timedelta(seconds=1),
        )
    )
    db.commit()
    assert client.get("/api/leads?focus=quiet").json()["total"] == 0
    fresh = create(client, "No next")
    due = create(client, "Overdue")
    patch(client, due, follow_up_at=(now - timedelta(seconds=1)).isoformat())
    closed = create(client, "Closed")
    patch(client, closed, status="Won")
    results = client.get("/api/leads?focus=attention").json()
    assert {item["name"] for item in results["items"]} == {"No next", "Overdue"}
    assert client.get("/api/leads?focus=no_next_step").json()["items"][0]["id"] == fresh["id"]


def test_totals_search_priority_and_export_share_filters(client):
    a = create(
        client,
        "A",
        company="100% Partners",
        email="a@example.com",
        source="Referral",
        priority="High",
        estimated_value="0.10",
        currency="USD",
    )
    b = create(
        client, "B", source="Referral", priority="High", estimated_value="0.20", currency="USD"
    )
    create(client, "C", source="Referral", priority="High", estimated_value="50.01", currency="INR")
    create(client, "Excluded", source="Referral", priority="Low", estimated_value="999.99")
    params = "search=referral&priority=High"
    page = client.get(f"/api/leads?{params}&limit=1").json()
    assert page["total"] == 3 and len(page["items"]) == 1
    assert {k: Decimal(v) for k, v in page["value_totals"].items()} == {
        "USD": Decimal("0.30"),
        "INR": Decimal("50.01"),
    }
    response = client.get(f"/api/leads/export.csv?{params}")
    rows = list(csv.DictReader(io.StringIO(response.content.decode("utf-8-sig"))))
    assert {r["name"] for r in rows} == {"A", "B", "C"}
    assert "attachment" in response.headers["content-disposition"]
    assert client.get("/api/leads?search=100%25").json()["items"][0]["id"] == a["id"]
    assert client.get("/api/leads?search=a%40example.com").json()["total"] == 1
    patch(client, b, status="Qualified")
    rows = list(
        csv.DictReader(
            io.StringIO(
                client.get(f"/api/leads/export.csv?{params}&status=Qualified").text.lstrip("\ufeff")
            )
        )
    )
    assert [r["name"] for r in rows] == ["B"]


def test_csv_neutralizes_formulas_and_roundtrips_unicode(client):
    create(client, '=HYPERLINK("bad")', company="@formula", phone="+91999", source="शुभ, привет")
    rows = list(
        csv.DictReader(io.StringIO(client.get("/api/leads/export.csv").content.decode("utf-8-sig")))
    )
    assert rows[0]["name"].startswith("'=")
    assert rows[0]["company"] == "'@formula"
    assert rows[0]["phone"] == "'+91999"
    assert rows[0]["source"] == "शुभ, привет"


def test_export_limit_is_explicit(client, db):
    db.add_all(Lead(id=str(uuid4()), name=f"Bulk {i}") for i in range(10001))
    db.commit()
    response = client.get("/api/leads/export.csv")
    assert response.status_code == 422
    assert "10,000" in response.json()["detail"]


def test_calendar_utc_identity_escaping_and_folding(client):
    lead = create(client, "Zoë; " + "界" * 80, company="One,Two\nThree")
    url = f"/api/leads/{lead['id']}/reminder.ics"
    assert client.get(url).status_code == 404
    lead = patch(client, lead, follow_up_at="2026-12-31T23:55:00+05:30")
    response = client.get(url)
    assert response.status_code == 200
    assert "attachment" in response.headers["content-disposition"]
    assert all(len(line) <= 75 for line in response.content.split(b"\r\n"))
    text = response.content.decode().replace("\r\n ", "")
    assert "DTSTART:20261231T182500Z" in text
    assert "DTEND:20261231T184000Z" in text
    assert "Zoë\\;" in text and "One\\,Two\\nThree" in text
    assert f"UID:{lead['id']}-followup@leadflow" in text
    assert f"SEQUENCE:{lead['version']}" in text
    updated = patch(client, lead, follow_up_at="2027-01-01T00:00:00Z")
    assert f"SEQUENCE:{updated['version']}" in client.get(url).text
    patch(client, updated, follow_up_at=None)
    assert client.get(url).status_code == 404

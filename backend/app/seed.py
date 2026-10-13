"""Non-destructive, repeatable demo data: python -m app.seed --timezone Asia/Kolkata."""

import argparse
from datetime import UTC, datetime, time, timedelta
from uuid import NAMESPACE_URL, uuid5
from zoneinfo import ZoneInfo

from app.db import SessionLocal
from app.models import Discussion, Lead


def seed(timezone: str):
    now = datetime.now(UTC)
    tz = ZoneInfo(timezone)
    today = now.astimezone(tz).date()

    def at(days, hour):
        return datetime.combine(today + timedelta(days=days), time(hour), tz).astimezone(UTC)

    rows = [
        (
            "Aarav Mehta",
            "Meridian Ventures",
            "Qualified",
            at(0, 15),
            "Walked through the advisory platform. Aarav is interested in a tailored proposal for his team.",
            "Discovery call: looking for a more personal approach to wealth planning.",
        ),
        (
            "Priya Sharma",
            "Northstar Capital",
            "Proposal Sent",
            at(0, 17),
            "Shared the proposal and pricing. Following up today to discuss next steps.",
            "Reviewed the team's priorities and confirmed the scope.",
        ),
        (
            "Rohan Kapoor",
            "Oak & Co.",
            "Contacted",
            at(-1, 11),
            "Connected briefly. Rohan asked for a call back after reviewing the overview.",
            "Introduced LeadFlow and shared a short product overview.",
        ),
        (
            "Ananya Rao",
            "Bloom Financial",
            "New",
            None,
            "Inbound enquiry about financial planning for a growing team.",
            None,
        ),
        (
            "Vikram Desai",
            "Summit Partners",
            "Qualified",
            at(2, 14),
            "Great conversation about their current workflow. Product demo scheduled for later this week.",
            "Discussed goals and the onboarding process.",
        ),
        (
            "Isha Patel",
            "Cedar Wealth",
            "Won",
            None,
            "Agreement signed. Handing over to the onboarding team — excited to get started.",
            "Final review complete. All questions on the proposal answered.",
        ),
        (
            "Kabir Sethi",
            "Atlas Advisory",
            "Lost",
            None,
            "Timing isn't right this quarter. Left the door open for a future conversation.",
            "Evaluated the proposal; budget is currently committed elsewhere.",
        ),
        (
            "Meera Joshi",
            "Lumen Studio",
            "New",
            at(1, 10),
            "Referred by an existing client. Introductory call booked for tomorrow.",
            None,
        ),
    ]
    added = 0
    with SessionLocal() as db:
        for i, (name, company, status, reminder, latest, older) in enumerate(rows):
            lead_id = str(uuid5(NAMESPACE_URL, f"leadflow/demo/{name}"))
            if db.get(Lead, lead_id):
                continue
            latest_at = now - timedelta(hours=2 + i * 5)
            lead = Lead(
                id=lead_id,
                name=name,
                company=company,
                phone=f"+91 90000 0000{i}",
                status=status,
                follow_up_at=reminder,
                created_at=now - timedelta(days=10 + i),
                updated_at=latest_at,
            )
            db.add(lead)
            db.flush()
            for j, note in enumerate([latest, older]):
                if note:
                    db.add(
                        Discussion(
                            id=str(uuid5(NAMESPACE_URL, f"leadflow/demo/{name}/{j}")),
                            lead_id=lead_id,
                            note=note,
                            follow_up_at=reminder if j == 0 else None,
                            created_at=latest_at - timedelta(days=j * 3),
                        )
                    )
            added += 1
        db.commit()
    print(f"Created {added} demo leads. Existing leads were preserved. Timezone: {timezone}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--timezone", default="UTC", help="IANA timezone for demo reminders")
    seed(parser.parse_args().timezone)

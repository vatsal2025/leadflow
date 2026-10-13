import csv
import io
from datetime import UTC, timedelta


def safe_cell(value):
    text = "" if value is None else str(value)
    # Prevent formulas even when hidden behind whitespace/BOM characters.
    if text.lstrip(" \t\r\n\v\f\ufeff").startswith(("=", "+", "-", "@")):
        return "'" + text
    return text


def leads_csv(leads):
    stream = io.StringIO(newline="")
    writer = csv.writer(stream, quoting=csv.QUOTE_ALL, lineterminator="\r\n")
    fields = [
        "id",
        "name",
        "company",
        "email",
        "phone",
        "source",
        "priority",
        "status",
        "estimated_value",
        "currency",
        "archived",
        "follow_up_at",
        "created_at",
    ]
    writer.writerow(fields)
    for lead in leads:
        writer.writerow([safe_cell(getattr(lead, field)) for field in fields])
    return b"\xef\xbb\xbf" + stream.getvalue().encode("utf-8")


def ical_escape(text):
    return (
        str(text)
        .replace("\\", "\\\\")
        .replace("\r\n", "\n")
        .replace("\r", "\n")
        .replace("\n", "\\n")
        .replace(";", "\\;")
        .replace(",", "\\,")
    )


def fold_line(line):
    lines, current = [], ""
    for char in line:
        if len((current + char).encode("utf-8")) > 75:
            lines.append(current)
            current = " "
        current += char
    return "\r\n".join([*lines, current])


def calendar_reminder(lead, now):
    def stamp(value):
        return value.astimezone(UTC).strftime("%Y%m%dT%H%M%SZ")

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//LeadFlow//Follow-up//EN",
        "CALSCALE:GREGORIAN",
        "BEGIN:VEVENT",
        f"UID:{lead.id}-followup@leadflow",
        f"DTSTAMP:{stamp(now)}",
        f"SEQUENCE:{lead.version}",
        f"DTSTART:{stamp(lead.follow_up_at)}",
        f"DTEND:{stamp(lead.follow_up_at + timedelta(minutes=15))}",
        f"SUMMARY:{ical_escape('Follow up with ' + lead.name)}",
        f"DESCRIPTION:{ical_escape('LeadFlow follow-up reminder. Company: ' + (lead.company or 'Not specified') + '. This calendar copy does not sync automatically.')}",
        "END:VEVENT",
        "END:VCALENDAR",
    ]
    return ("\r\n".join(fold_line(line) for line in lines) + "\r\n").encode("utf-8")

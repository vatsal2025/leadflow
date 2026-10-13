# Productivity upgrade

The upgrade builds on the assignment's persistent leads, discussion history, and reminders. It addresses everyday sales work: deciding whom to contact, understanding an opportunity, keeping its next action current, and handing data to tools already in use.

## Sources of inspiration

Reviewed official product pages on 13 October 2026. These are product references, not endorsements or claims of feature parity. LeadFlow's code and interface are its own implementation.

| Reference | Relevant pattern | LeadFlow implementation |
| --- | --- | --- |
| [Pipedrive features](https://www.pipedrive.com/en/features) | Visual pipeline management and activity-based selling | Six-stage pipeline with direct stage changes, per-stage pagination, counts, and estimated values |
| [HubSpot CRM](https://www.hubspot.com/products/crm) | Editable contact records, communication history, task management | Rich contact profiles and a unified history with Note, Call, Email, and Meeting activity types |
| [Close features](https://www.close.com/features) | Lead management and follow-up-focused sales workflows | Combined attention filters, explicit next steps, and independent reminder scheduling |

## Features and exact behavior

- **Pipeline:** switch between list and board without leaving the workspace. Each lane loads 20 leads at a time; its count and amount totals include every matching lead, including unloaded pages. A labelled stage selector supports keyboard and touch. Stage changes share the same version checks and server state as the original dialog.
- **Contact profiles:** edit name, company, phone, validated email, lead source, priority, estimated value, and currency. Empty optional fields clear explicitly. A stale profile cannot overwrite another session's changes: its draft stays visible until the user reloads and reviews the saved record.
- **Attention:** `No next step` means no scheduled follow-up. `Quiet 7+ days` means at least seven elapsed days since the latest logged activity, or creation if there is no activity. Editing a contact does not reset that clock. `Needs attention` combines those conditions with an overdue reminder. These views exclude Won, Lost, and archived leads. They are factual conditions, with explanations on each lead.
- **Priority:** Low, Normal, and High are explicitly chosen by the user. No inferred scoring or win probability is presented.
- **Values:** optional nonnegative amounts with two decimal places, in INR, USD, EUR, or GBP. PostgreSQL stores decimal values exactly. Totals are grouped by currency with no implied exchange rate or revenue prediction. Use PostgreSQL for production financial precision; SQLite uses numeric affinity internally.
- **Activity types:** Note, Call, Email, and Meeting classify records of completed activity. Selecting Email does not send a message; selecting Call does not place a call.
- **Reminders:** schedule or reschedule independently of a discussion, including shortcuts for tomorrow or seven days later at 9 AM in the browser's timezone. Closing or switching tabs checks for an unsaved reminder draft. Previous discussion reminders remain historical records.
- **Calendar:** download the current reminder as a standards-based `.ics` event lasting 15 minutes. Dates are UTC, text is escaped, and long UTF-8 lines are folded. The lead supplies a stable event UID and changing sequence number. Import into a calendar manually; subsequent LeadFlow edits require a new download. Handling of reimported events depends on the calendar application. There is no automatic synchronization or notification delivery service.
- **Export:** CSV includes all leads matching the current search/status/reminder/priority/attention/archive filters, across pages. It includes contact and opportunity fields, not discussion bodies. Exports exceeding 10,000 rows are rejected with a request to narrow filters. UTF-8, quoted cells, and spreadsheet-formula neutralization preserve interoperability. Formula-like text, including phone numbers beginning with `+`, receives a protective leading apostrophe.
- **Archive:** hides a lead from active views while preserving all history. Archived records remain available through the visibility filter and can be restored. This is reversible, not deletion; a calendar copy already downloaded is unaffected.

## Upgrade and scope

Migration `0002` adds fields with backward-compatible defaults: Normal priority, INR currency, active visibility, and Note activity type. Optional contact/value fields start empty. It preserves existing leads, versions, reminders, and discussion records. SQLite table rebuilds preserve the original status/version constraints and verify foreign-key integrity; PostgreSQL uses normal transactional schema changes. Back up the database before deployment. Downgrading removes the new fields, so restore a backup if their contents must be retained.

These improvements retain the shared-workspace security model. Individual accounts, ownership, team permissions, email delivery, telephony, automated sequences, and calendar OAuth integrations would require separate designs and credentials. No external communications are sent by this upgrade.

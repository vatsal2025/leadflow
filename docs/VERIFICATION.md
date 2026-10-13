# Verification record

Validated on **13 October 2026**. These are executed checks, not inferred results.

| Check | Result |
| --- | --- |
| Python API suite, SQLite, Windows/Python 3.13 | 62 passed |
| Same API suite against PostgreSQL 17 in a Linux Docker container | 62 passed |
| Production browser suite, desktop and mobile Chromium | 28 passed, including productivity workflows, accessibility, pagination, and full-board overflow |
| Next.js optimized production build | Passed locally and in the Linux container build |
| TypeScript, ESLint, Prettier | Passed |
| Ruff lint and formatting | Passed |
| Python runtime dependency audit | No known vulnerabilities reported |
| npm dependency audit, including development tools | No known vulnerabilities reported |
| Docker Compose build, migrations, startup, readiness | Passed; database, API, and web reported healthy |
| Seed script | Eight leads and fourteen discussions; repeat invocation does not duplicate or overwrite |
| Persistence across API/web restart | All eight lead records, including latest discussions and reminders, unchanged |
| Populated database upgrade | PostgreSQL migration through `0003` preserved all fields of eight existing leads and fourteen discussions; local backup captured before upgrade; row-level security enabled on all four application/migration tables |
| SQLite upgrade/downgrade with existing history | Passed, including foreign-key integrity and status/version/value constraints |
| Shared serverless login throttle | Concurrent independent connections admit exactly five attempts per window; reset and expiry verified on SQLite and PostgreSQL |
| Submission screenshots | Five real browser captures in `docs/screenshots/`, including the pipeline |
| Narrated product walkthrough | 167.05 seconds, 1920x1080 at 30fps, H.264/AAC; English narration and captions; full decode passed and final frames inspected |

The browser suite exercises the production frontend through the same-origin API proxy. It uses its own migrated SQLite database and an enabled password gate. Coverage includes login/logout and session persistence; creating a lead; saving discussions and follow-ups; changing status; reloading and confirming persistence; completing reminders without erasing history; search/status/reminder filters; failed-save draft retention; conflict recovery; keyboard focus restoration; pagination recovery when results shrink; and horizontal overflow checks. Both a 1440px desktop viewport and an iPhone-sized Chromium viewport are covered.

The productivity tests exercise rich profile edits, conflicts requiring explicit reload, typed activities, archive/restore with history preservation, combined priority/source/attention filters, pipeline stage changes and totals, per-stage pagination beyond 20 leads, CSV downloads, and independent reminder scheduling with real calendar downloads. A full, unfiltered board regression checks both document width and mobile viewport width while keeping horizontal scrolling inside the board.

Accessibility scans use axe's WCAG 2 A/AA and WCAG 2.1 AA rules on the login, workspace, add-lead dialog, and timeline. The scan runs with reduced motion enabled so animation frames do not distort color-contrast measurements. The suite also checks focus behavior explicitly. These automated checks are useful evidence, not a substitute for a full manual assistive-technology audit.

Additional axe scans cover the profile editor and pipeline. Keyboard checks include arrow navigation between the lead information tabs. Screenshots are captured from the running Compose application and inspected visually.

API coverage includes UTC serialization, IANA timezone boundaries, 23/25-hour daylight-saving days, reminder ordering before pagination, literal wildcard search, deterministic history ordering, validation failures, transaction rollback on stale edits, retry idempotency, CSRF controls, login throttling, tampered/expired cookies, secure production configuration, migration upgrade/downgrade, and repeatable seeds.

New API checks cover decimal amounts, email/priority/currency validation, explicit clearing of optional fields, new-field idempotency, archive visibility, attention thresholds and closed-lead exclusion, totals across pages and currencies, shared export filters, spreadsheet-formula neutralization, the 10,000-row export limit, authenticated downloads, and escaped UTF-8 calendar events with UTC times and stable identities.

The public [GitHub Actions workflow](https://github.com/vatsal2025/leadflow/actions/workflows/ci.yml) independently runs the SQLite and PostgreSQL suites, frontend checks, browser tests, dependency audits, and a full Compose smoke test from a clean Linux checkout.

Vercel projects, domains, and private production settings have been prepared. Cloud deployment is not yet verified: Supabase provisioning is awaiting Vercel's marketplace account confirmation. See [deployment status](DEPLOYMENT.md). The video records a real isolated demo workspace and describes hosted deployment support without claiming that the cloud release is already live.

## Scope of verification

- Browser execution uses Chromium desktop/mobile emulation; Safari, Firefox, and physical phones were not separately tested.
- Docker verification uses the documented local demonstration configuration. A public HTTPS deployment, external backup system, and domain have not been provisioned by this repository.
- No formal load test or independent penetration test is claimed. Authentication is one shared workspace password; multi-tenant access control is outside the assessment's scope.
- Security audit results reflect the advisory databases at validation time. Deployment operators must continue applying dependency and base-image updates.

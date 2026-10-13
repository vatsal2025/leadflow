# Verification record

Validated on **13 October 2026**. These are executed checks, not inferred results.

| Check | Result |
| --- | --- |
| Python API suite, SQLite, Windows/Python 3.13 | 38 passed |
| Same API suite against PostgreSQL 17 in a Linux Docker container | 38 passed |
| Production browser suite, desktop and mobile Chromium | 16 passed, including accessibility and pagination recovery |
| Next.js optimized production build | Passed locally and in the Linux container build |
| TypeScript, ESLint, Prettier | Passed |
| Ruff lint and formatting | Passed |
| Python runtime dependency audit | No known vulnerabilities reported |
| npm dependency audit, including development tools | No known vulnerabilities reported |
| Docker Compose build, migrations, startup, readiness | Passed; database, API, and web reported healthy |
| Seed script | Eight leads and fourteen discussions; repeat invocation does not duplicate or overwrite |
| Persistence across API/web restart | All eight lead records, including latest discussions and reminders, unchanged |
| Submission screenshots | Four real browser captures in `docs/screenshots/` |

The browser suite exercises the production frontend through the same-origin API proxy. It uses its own migrated SQLite database and an enabled password gate. Coverage includes login/logout and session persistence; creating a lead; saving discussions and follow-ups; changing status; reloading and confirming persistence; completing reminders without erasing history; search/status/reminder filters; failed-save draft retention; conflict recovery; keyboard focus restoration; pagination recovery when results shrink; and horizontal overflow checks. Both a 1440px desktop viewport and an iPhone-sized Chromium viewport are covered.

Accessibility scans use axe's WCAG 2 A/AA and WCAG 2.1 AA rules on the login, workspace, add-lead dialog, and timeline. The scan runs with reduced motion enabled so animation frames do not distort color-contrast measurements. The suite also checks focus behavior explicitly. These automated checks are useful evidence, not a substitute for a full manual assistive-technology audit.

API coverage includes UTC serialization, IANA timezone boundaries, 23/25-hour daylight-saving days, reminder ordering before pagination, literal wildcard search, deterministic history ordering, validation failures, transaction rollback on stale edits, retry idempotency, CSRF controls, login throttling, tampered/expired cookies, secure production configuration, migration upgrade/downgrade, and repeatable seeds.

The public [GitHub Actions workflow](https://github.com/vatsal2025/leadflow/actions/workflows/ci.yml) independently runs the SQLite and PostgreSQL suites, frontend checks, browser tests, dependency audits, and a full Compose smoke test from a clean Linux checkout.

## Scope of verification

- Browser execution uses Chromium desktop/mobile emulation; Safari, Firefox, and physical phones were not separately tested.
- Docker verification uses the documented local demonstration configuration. A public HTTPS deployment, external backup system, and domain have not been provisioned by this repository.
- No formal load test or independent penetration test is claimed. Authentication is one shared workspace password; multi-tenant access control is outside the assessment's scope.
- Security audit results reflect the advisory databases at validation time. Deployment operators must continue applying dependency and base-image updates.

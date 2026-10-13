# Assignment and delivery audit

Checked against all three pages of the supplied assignment PDF on 13 October 2026. The source PDF is kept private because it contains email correspondence. This checklist records the requirements, the implemented behavior, and where to inspect the evidence.

## Required application flows

| PDF requirement | Result | Evidence |
| --- | --- | --- |
| One-screen LeadFlow workspace; login optional | Complete. The live app opens directly without login. Lead creation, history, and editing use dialogs. | [Live app](https://leadflow-vatsal.vercel.app), [workspace](../frontend/src/components/workspace.tsx) |
| Lead list shows name, status badge, last discussion, and time since discussion | Complete, including the no-discussion state. | [Workspace](../frontend/src/components/workspace.tsx), [workflow tests](../frontend/tests/workflow.spec.ts) |
| Filter New, Contacted, Qualified, Proposal Sent, Won, and Lost | Complete. All six statuses are supported by the UI, API validation, and persistence. | [Schemas](../backend/app/schemas.py), [API tests](../backend/tests/test_api.py) |
| Today's follow-ups pinned at the top | Complete. Ordering applies before pagination and uses the viewer's timezone. | `test_today_pinned_before_pagination_in_user_timezone` in [API tests](../backend/tests/test_api.py) |
| Clicking a lead opens a timeline dialog, not a separate page | Complete. | [Timeline](../frontend/src/components/timeline.tsx), [workflow tests](../frontend/tests/workflow.spec.ts) |
| Full discussion history in reverse chronological order | Complete. Older entries can be loaded without losing the latest-first order. | History pagination/tie-breaking test in [API tests](../backend/tests/test_api.py) |
| Bottom form adds a discussion with optional follow-up date/time | Complete. The dialog uses one scrolling content area so the form and reminder controls remain reachable on short screens. | [Timeline](../frontend/src/components/timeline.tsx), [dialog tests](../frontend/tests/dialog.spec.ts) |
| Saving a discussion updates the lead's follow-up and list immediately | Complete. Note and reminder changes are transactional; the list refreshes after success. | Discussion/list tests in [API tests](../backend/tests/test_api.py) and [browser workflows](../frontend/tests/workflow.spec.ts) |
| Status updates from the dialog persist | Complete, including reload verification and protection from stale edits. | [Workflow tests](../frontend/tests/workflow.spec.ts), [API tests](../backend/tests/test_api.py) |
| Add lead: required name, optional company/phone, default New status | Complete. | [Add-lead dialog](../frontend/src/components/add-lead.tsx), create/default/validation tests in [API tests](../backend/tests/test_api.py) |

## Every listed bonus

| PDF bonus | Result | Evidence |
| --- | --- | --- |
| Search leads by name | Complete; search also covers company, email, and source. | [Workflow tests](../frontend/tests/workflow.spec.ts), [query implementation](../backend/app/lead_queries.py) |
| Overdue follow-ups highlighted in red | Complete in the list and timeline, with overdue wording as well as color. | [Timeline](../frontend/src/components/timeline.tsx), [styles](../frontend/src/app/globals.css), [screenshots](screenshots/) |
| Docker Compose setup | Complete: database, API, and web services, migrations, health checks, and persistent database volume. | [compose.yaml](../compose.yaml), [README setup](../README.md#run-with-docker), CI container smoke test |
| Seed script with at least five leads and discussions | Complete: eight fictional leads and fourteen discussions, covering all six statuses. Re-running preserves existing records. | [Seed script](../backend/app/seed.py), [verification record](VERIFICATION.md) |
| Filters | Complete: status and follow-up filters, plus priority, attention, and archive visibility filters. | [Product decisions](PRODUCT_DECISIONS.md), [productivity browser tests](../frontend/tests/productivity.spec.ts) |

## Submission and code quality

| Requirement | Result | Evidence |
| --- | --- | --- |
| Public GitHub repository | Complete. | [vatsal2025/leadflow](https://github.com/vatsal2025/leadflow) |
| `.env.example` lists required variables | Complete, including local, production, database, and serverless settings. Password is optional. | [.env.example](../.env.example), [configuration table](../README.md#configuration) |
| README with working setup steps | Complete: Windows/local setup, Docker, database migrations, seed data, checks, and deployment. | [README](../README.md), [deployment guide](DEPLOYMENT.md) |
| Video / screenshots of working flow | Complete: a 2:47 English narrated 1080p walkthrough, captions, poster, and six browser screenshots. | [Watch on Google Drive](https://drive.google.com/file/d/1zipQsRm-RT7pSH17aVuU-XLjd_XPhM_f/view), [screenshots](screenshots/), [video sources](video/README.md) |
| Meaningful commit history | Complete. Commits separate API, frontend, deployment, productivity, and UI work. VATSAL is the sole author and committer. | [Commit history](https://github.com/vatsal2025/leadflow/commits/main/) |
| Clean frontend component structure | Complete: workspace, timeline, profiles, reminder tools, pipeline, and shared UI components. | [Frontend components](../frontend/src/components/) |
| Correct API status codes and clean error handling | Complete: validation, missing resources, conflicts, rejected origins, size limits, safe error messages, and optional-login errors are covered. | [API](../backend/app/main.py), [API tests](../backend/tests/test_api.py) |
| Stack choice | Next.js + FastAPI. The PDF permits any stack and spells its preference “NextJs + FastAI”; the README explicitly documents this implementation's choice. | [README](../README.md) |

## Additional features requested during development

All implemented: six-stage visual pipeline with pagination and currency totals; editable contact profiles; priorities; lead sources; estimated deal values; needs-attention/no-next-step/quiet views; typed Note/Call/Email/Meeting activities; standalone scheduling and quick dates; calendar downloads; filtered CSV export; archive/restore; responsive layouts; accessible draft-discard confirmations; single-scroll dialogs; direct access without a password; and a live Vercel/Supabase deployment.

[Product decisions](PRODUCT_DECISIONS.md) documents the Pipedrive, HubSpot, and Close inspiration and the exact scope. Activity labels do not send email or place calls, and calendar downloads do not imply automatic calendar synchronization.

## Executed verification

The audited source commit is `af24afa77062e1e481b34717a4c815d1603d50ff`. Its [GitHub Actions run](https://github.com/vatsal2025/leadflow/actions/runs/38433033323) passed all four jobs: SQLite API checks, PostgreSQL API checks, frontend/browser checks, and Docker smoke tests. The current suites contain 63 API tests per database and 34 desktop/mobile browser tests. Fresh-browser hosted checks also verified password-free access and persisted create/edit operations; the temporary test record was removed afterward.

The walkthrough passed a full decode check: 167.05 seconds, 1920x1080, 30fps, H.264/AAC. It demonstrates the actual application using isolated demo data. It was recorded before the later dialog styling and password-removal refinements; those refinements are visible in the current app and regression checks. See [verification scope](VERIFICATION.md) for the precise limits of the checks.

## Video playback delivery

Complete: [watch the video on Google Drive](https://drive.google.com/file/d/1zipQsRm-RT7pSH17aVuU-XLjd_XPhM_f/view). It is uploaded to the owner's Drive under `LeadFlow/LeadFlow-Product-Walkthrough.mp4` and shared for viewing by anyone with the link. The `/view` URL opens the player instead of starting a download. The uploaded file is 8,422,149 bytes and its MD5 checksum matches the original. A fresh signed-out browser opened the viewer, started playback, and advanced beyond three seconds with no media error or download triggered. The original GitHub release assets remain optional downloads for reviewers who want local copies.

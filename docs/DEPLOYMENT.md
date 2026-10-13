# Hosted deployment

LeadFlow uses two Vercel projects: `leadflow-crm` for Next.js and `leadflow-api` for FastAPI. The source roots are `frontend/` and `backend/`. Both are configured for Mumbai (`bom1`). Python is pinned to 3.13 and Node.js to the 24 LTS major.

## Current release state

The live workspace now opens directly without a password, as requested by the owner. `APP_PASSWORD` is unset in production. Visitors can read and edit the shared demo records through the application API; Supabase credentials remain private and its direct anonymous Data API remains restricted by RLS.

**Live and verified on 13 October 2026:** [leadflow-vatsal.vercel.app](https://leadflow-vatsal.vercel.app), with API origin `https://leadflow-api-vatsal.vercel.app`. The free Supabase resource `leadflow-db` is provisioned in Mumbai and connected only to the API's production environment. Migration `0003` is applied, with eight fictional demo leads and fourteen discussions seeded. The application uses the transaction pooler over TLS; migrations used the session pooler.

The public HTTPS app passed browser login, protected-data and origin checks, secure cookie checks, create/activity/status/profile persistence, follow-up scheduling, real calendar/CSV downloads, archive/restore, pipeline rendering, accessibility scanning, and logout. Anonymous Supabase Data API requests returned no rows from any of the four protected tables. Production secrets and the workspace password are excluded from Git and release assets.

## Database and release procedure

1. In the Vercel account that owns these projects, complete the Supabase marketplace installation. Select the Free plan, database name `leadflow-db`, and Mumbai region. Connect the resource to **the API project only**. Do not publish database credentials or a service-role key in frontend environment variables.
2. Use the exact connection strings supplied by Supabase. Use the transaction pooler for the application and a direct or session-pooler connection for migrations, as appropriate for network reachability. Never construct the pooler hostname from a region name. Use TLS (`sslmode=require` or certificate-verified TLS), and use the SQLAlchemy `postgresql+psycopg://` scheme.
3. Back up an existing database before migration. From `backend`, with the migration connection set privately as `DATABASE_URL`, run `python -m alembic upgrade head`. Run `python -m app.seed --timezone Asia/Kolkata` only when intentionally preparing demonstration data. Migrations must run as a release step, not on every serverless invocation.
4. Set API production variables: `DATABASE_URL`, `APP_ENV=production`, `SERVERLESS=true`, `COOKIE_SECURE=true`, `PUBLIC_ORIGIN=https://leadflow-vatsal.vercel.app`, and `API_HOSTNAME=leadflow-api-vatsal.vercel.app`. Leave `APP_PASSWORD` unset for the public demo. Optional login can be enabled with a password of at least 16 characters and a random `SESSION_SECRET` of at least 32 characters. Store secrets in Vercel's environment settings. Keep migrations' administrative credentials separate from any restricted application role used in production.
5. Set frontend production `API_INTERNAL_URL=https://leadflow-api-vatsal.vercel.app` before the build. Deploy the API from `backend` with `vercel deploy --prod`, then deploy the frontend from `frontend` with the same command. Both directories contain their Vercel configuration. Local Vercel links are ignored by Git.
6. Verify the actual HTTPS release: database readiness; direct access without a login form for the public demo; create, discuss, edit, archive and restore; calendar/CSV downloads; and reload persistence. If optional login is enabled, also verify unauthenticated API rejection, secure cookies, and logout. Check the browser console and Vercel logs. Confirm the hosted database's anonymous REST access cannot read CRM tables. Only then describe the release as live.

The backend's `pyproject.toml` contains only local lint/test settings and is excluded from the Vercel upload so the builder installs the pinned `requirements.txt`. If Windows denies access to a local cache while uploading, deploy a clean checkout of the same source; never upload `.env` files, test databases, or private tooling. Sensitive Vercel variables are omitted when exported with `env pull`; use a separately secured migration connection instead of treating those exported blanks as the deployed values.

## Serverless safeguards

- A single database-backed login window is shared by all instances. Its atomic upsert permits five attempts per 60-second window; successful login resets it. No untrusted forwarded IP header can bypass the counter. This shared-password design favors protection against distributed password guessing; abusive attempts can temporarily delay legitimate logins.
- Each serverless instance has a one-connection pool, no overflow, a finite wait timeout, pre-ping, and connection recycling. Psycopg automatic prepared statements are disabled for transaction-pooler compatibility.
- Migration `0003` enables PostgreSQL row-level security on leads, discussions, login windows, and the migration-version table, with no anonymous public policies. The private backend connection must have the required privileges; do not enable public read policies for these tables.
- Database errors return safe responses; secrets stay in server-side environment variables. The public frontend calls the API through its same-origin proxy. Session cookies are Secure, HttpOnly, and SameSite=Strict in production.

Supabase's free plan is suitable for an assessment/demo and is subject to the provider's current quotas and inactivity behavior. An always-on business deployment should select capacity, backup retention, and availability commitments deliberately. No paid plan has been authorized or provisioned here.

References: [Vercel FastAPI](https://vercel.com/docs/frameworks/backend/fastapi), [Vercel Python runtime](https://vercel.com/docs/functions/runtimes/python), [Supabase connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres).

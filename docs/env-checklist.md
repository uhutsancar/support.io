# `.env.production` checklist

Plan v10 INF-04. Every variable a production (or staging) server reads, and
what happens when it is missing. The template with comments is
[`.env.production.example`](../.env.production.example); the checks are
`backend/src/config/productionChecks.ts` (tested in
`backend/tests/operations.e2e.test.ts`). The owner fills the values from the
password manager [SAHİP]; nothing here is ever committed with a value.

## Refused at boot — the server does not start

| Variable | Rule |
|---|---|
| `APP_DOMAIN`, `APP_IMAGE`, `POSTGRES_IMAGE`, `REDIS_PASSWORD` | Compose refuses to start without them (`:?` in docker-compose.prod.yml) |
| `JWT_SECRET` | ≥ 32 random characters, not the example |
| `JWT_SECRET_PREVIOUS` | only during a rotation (runbook §8); when set, ≥ 32 characters |
| `DB_PASSWORD` | not empty, not the example |
| `REDIS_PASSWORD` | ≥ 24 characters, and carried in `REDIS_URL` (compose builds it) |
| `CORS_ORIGINS`, `APP_BASE_URL` | built by compose from `APP_DOMAIN`; must be `https://` |
| `MAIL_PROVIDER` | `smtp` (`console` is refused), with `SMTP_HOST` and `MAIL_FROM` |
| `UPLOAD_STORAGE` | `s3` with `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and `AWS_REGION` or `S3_ENDPOINT`; `local` only with `ALLOW_LOCAL_UPLOADS=true` (DR-04) |
| `BILLING_ENABLED=true` | then `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `PADDLE_CLIENT_TOKEN`, `PADDLE_PRICE_PRO` |

## Warned at boot — runs, but something is lost

| Variable | Without it |
|---|---|
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET` | no bot check on sign-up (SEC-06) |
| `SENTRY_DSN` | errors only in the server log (OBS-01); panel and widget errors reach it through `/api/telemetry`, so no `VITE_SENTRY_DSN` is needed |
| `ALERT_WEBHOOK_URL` | the watchdog tells nobody (OBS-04) |
| `BACKUP_REMOTE`, `BACKUP_AGE_RECIPIENT` | backups stay on the server (DR-01) |
| `BACKUP_PING_URL` | a missed backup night goes unnoticed |
| `SECURITY_CONTACT_EMAIL` | security.txt names `security@<domain>` |
| `OPS_REPORT_EMAIL` | no weekly product report (OBS-07) |
| `GEMINI_TIER` | `free`: no assistant answers for visitors from the EEA, UK, CH (AI-02, KARAR-AI-1) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | no push notifications on phones or closed panels (PRD-09); `npm run push:keys` makes a pair, `VAPID_SUBJECT` is optional |
| `S3_ACL` other than empty/`private` | warned: files must stay private (SEC-08) |
| `MAIL_ALLOWLIST_DOMAINS` set | warned: right for staging only (INF-03) |
| `SITE_NOINDEX=true` | warned: right for staging only (MKT-02) |

## Optional

Tuning and switches with sensible defaults: `DB_POOL_MAX`,
`DB_STATEMENT_TIMEOUT_MS`, `PG_SHARED_BUFFERS`, `PG_EFFECTIVE_CACHE_SIZE`,
`PG_MAX_CONNECTIONS`, the `*_MEM_LIMIT` / `BACKEND_CPUS` limits,
`REDIS_MAXMEMORY`, `API_RATE_MAX`, `AUTH_RATE_MAX`, `SHUTDOWN_GRACE_MS`,
`GEMINI_MODEL`, `GEMINI_RPM`, `GEMINI_RPD`, `GEMINI_COST_PER_ANSWER`,
`ASSISTANT_KILL_SWITCH`, `SENTRY_ENVIRONMENT`, `WIDGET_TELEMETRY_SAMPLE`,
`METRICS_TOKEN`, `LOG_REMOTE`, `SECURITY_TXT_EXPIRES`, the yearly Paddle
prices, `BILLING_PAST_DUE_GRACE_DAYS`, `BACKUP_VERIFY`,
`BACKUP_VERIFY_PING_URL`, visitor counts on the public pages (`ANALYTICS_SCRIPT_URL` +
`ANALYTICS_WEBSITE_ID`, a self-hosted Umami; KARAR-MKT-3, name it in the Privacy
Policy first), and point-in-time recovery: `PG_ARCHIVE_MODE` with
the `WALG_*` values (disaster-recovery.md).

## Secrets the backend alone holds

`GEMINI_API_KEY`, `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `SMTP_PASS`,
`AWS_SECRET_ACCESS_KEY`, `WALG_*` keys, `JWT_SECRET*`, `DB_PASSWORD`,
`REDIS_PASSWORD`, `TURNSTILE_SECRET`, `VAPID_PRIVATE_KEY`. None of them reaches the panel, the
widget, a log or an error message; the only values built into the panel
image are public (`VITE_*`: the support widget's site key, contact
addresses, the status page URL).

## Built into the image — GitHub repository variables

The release workflow (`.github/workflows/release.yml`) passes these as build
arguments; they are public and the same for staging and production. Set them
under Settings → Secrets and variables → Actions → Variables [SAHİP].

| Variable | Becomes | Without it |
|---|---|---|
| `SUPPORT_SITE_KEY` | `VITE_SUPPORT_SITE_KEY` | the marketing site has no chat bubble of its own (MKT-04 live demo). The key is a site in the owner's own Support.io account; its messages land in that inbox |
| `SUPPORT_EMAIL` | `VITE_SUPPORT_EMAIL` | the site shows `destek@support.io` |
| `SECURITY_EMAIL` | `VITE_SECURITY_EMAIL` | the site shows `security@support.io` |
| `STATUS_PAGE_URL` | `VITE_STATUS_PAGE_URL` | no status link in the footer (OBS-06) |

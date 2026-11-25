# Supbort.io

Live chat and an AI assistant for any website. A business adds one `<script>`
tag to its site; visitors write from the chat bubble, the assistant answers
common questions from the site's own FAQ, and the team handles everything else
from one shared inbox.

The repository holds three parts: the API and real-time server (`backend/`),
the marketing site and admin panel (`admin-panel/`), and the chat bubble that
runs on customer sites (`backend/src/widget/`).

## Features

| Area | What it does |
|---|---|
| Chat bubble | One-line install, isolated from the host page with Shadow DOM, 8 languages, pre-chat and offline forms, ratings, transcripts by e-mail, file sharing, visitor identity verification |
| AI assistant | Answers only from the site's FAQ and added knowledge sources (pages, PDFs), cites what it used, masks personal data, hands over to an agent when it has no answer or the visitor asks for a person |
| Inbox | Real-time conversations, guaranteed delivery, assignment, internal notes, tags, snooze, merge, bulk actions, Turkish-aware search, keyboard shortcuts |
| Team | Roles and permissions, e-mail invitations, departments and routing, team chat, desktop and mobile notifications (Web Push) |
| Automation | Rule engine, proactive messages, saved replies, business hours, SLA tracking |
| Insight | Analytics, agent performance, weekly summary e-mail, CSV export, live visitors, CRM deal pipeline, audit log |
| Help center | Public FAQ pages per site, rendered by the server |
| Integrations | Slack, Telegram, webhooks, a public REST API with API keys, WordPress plugin, Shopify extension, Google Tag Manager template |
| Account | E-mail verification, Google sign-in, two-factor authentication (TOTP), password reset, data export, account and data deletion |
| Billing | Monthly and yearly subscriptions through Paddle, free trial, plan limits enforced on the server, invoices, referral program |

### Plans

| | Free | Pro | Enterprise |
|---|---|---|---|
| Sites | 1 | 3 | 25 |
| Agents | 1 | 5 | 20 |
| Conversations / month | 100 | 2,000 | 20,000 |
| Assistant answers / month | 50 | 1,000 | 5,000 |
| Price / month | 0 TL | 490 TL | 1,449 TL |

Limits and features are defined in one place: `backend/src/domain/plans.ts`.

## Stack

| Layer | Technology |
|---|---|
| API | Node.js 22, TypeScript, Express, Socket.IO with the Redis adapter, pino |
| Database | PostgreSQL 16 with versioned SQL migrations (`backend/src/db/migrations`) |
| Cache | Redis 7 |
| Panel and site | React 18, Vite, Tailwind CSS, Radix UI, Motion, i18next (Turkish and English) |
| Chat bubble | Dependency-free TypeScript, minified with esbuild |
| Files | S3-compatible storage (AWS S3, Cloudflare R2, MinIO) or local disk |
| Infrastructure | Docker Compose, Caddy, GitHub Actions, GHCR |
| Services | Paddle (billing), Google Gemini (assistant), SMTP, Cloudflare Turnstile, Sentry-compatible error tracking |

## Quick start with Docker

Requires Docker with Compose.

```bash
echo "JWT_SECRET=$(openssl rand -base64 48)" > backend/.env

docker compose up -d
docker compose exec backend npm run db:seed   # optional demo data
```

The database is migrated when the backend starts.

| Address | What |
|---|---|
| `http://localhost` | Site, panel and API through Caddy |
| `http://localhost:5000` | The API directly |
| `http://localhost:5173` | The panel's Vite dev server |

Demo account: `owner@demo.support.io` / `Demo1234!`. In development e-mails are
not sent; they are printed to the backend log (`MAIL_PROVIDER=console`).

Host ports can be changed in a `.env` file at the repository root:

```bash
POSTGRES_PORT=5433
BACKEND_PORT=5050
ADMIN_PORT=5173
PROXY_PORT=80
REDIS_PORT=6381
```

## Without Docker

Requires Node.js 22 and PostgreSQL 16. Redis 7 is optional; without it the API
runs as a single process.

```bash
npm run install:all
```

`backend/.env`:

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/supportio
JWT_SECRET=at-least-32-random-characters
REDIS_URL=redis://localhost:6379
```

```bash
cd backend && npm run dev        # API on port 5000
cd admin-panel && npm run dev    # panel on port 3002
```

In development the panel calls the API at `http://localhost:5000`; set
`VITE_API_URL` in `admin-panel/.env.development` to point it elsewhere.

## Environment variables

No `.env` file is committed, examples included. The tables list the settings
you will usually touch; tuning values (rate limits, timeouts, pool sizes) have
their defaults in code.

### backend/.env

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | Required. The key session, widget and link signatures are derived from (32+ characters) |
| `DATABASE_URL` | PostgreSQL connection. Falls back to `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSL` |
| `REDIS_URL` | Socket.IO adapter and shared cache; needed to run more than one API process |
| `PORT` | API port, 5000 by default |
| `APP_BASE_URL` | The panel's address; links in e-mails use it |
| `CORS_ORIGINS` | Comma-separated origins allowed to call the API. Required in production |
| `MAIL_PROVIDER` | `console` or `smtp`, with `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` |
| `UPLOAD_STORAGE` | `local` or `s3`, with `S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`; `S3_ENDPOINT` and `S3_PUBLIC_URL` for R2 or MinIO |
| `GEMINI_API_KEY` | Enables the AI assistant; live chat works without it. Tuned with `GEMINI_MODEL`, `GEMINI_RPM`, `GEMINI_RPD`, `GEMINI_TIER` |
| `BILLING_ENABLED` | `true` opens checkout in the panel. Paddle: `PADDLE_ENV`, `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `PADDLE_CLIENT_TOKEN`, `PADDLE_PRICE_PRO`, `PADDLE_PRICE_PRO_YEARLY`, `PADDLE_PRICE_ENTERPRISE`, `PADDLE_PRICE_ENTERPRISE_YEARLY` |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Web Push; generate with `npm run push:keys` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in; the button is hidden without them |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET` | Bot protection on the sign-up form |
| `SENTRY_DSN` | Sentry-compatible error tracking |

### admin-panel

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | API address. Empty in production, where the panel and API share an origin |
| `VITE_SUPPORT_SITE_KEY` | The marketing site's own chat bubble. Demo key in development: `demo-site-key-0000-1111-2222` |
| `VITE_PUBLIC_APP_ORIGIN` | The public address shown in install snippets |
| `VITE_SUPPORT_EMAIL`, `VITE_SECURITY_EMAIL`, `VITE_STATUS_PAGE_URL` | Contact details shown on the site |

### Root .env

Compose host ports (above) and optional Paddle sandbox values in development.
In production the server's `.env.production` takes its place;
`docker-compose.prod.yml` lists every variable it passes on.

## Installing the chat bubble

```html
<script src="https://app.example.com/widget.js" data-site-key="YOUR_SITE_KEY" async></script>
```

The panel shows each site's own snippet. Platform-specific guides live on the
site at `/en/documentation` (`/dokumantasyon` in Turkish) and the API reference
at `/en/documentation/api`. `/widget/v4/widget.js` pins the major version.

## Commands

### Repository root

| Command | What it does |
|---|---|
| `npm run install:all` | Installs backend and panel dependencies |
| `npm run check` | Typecheck and lint in both packages |
| `npm run format` | Formats both packages with Prettier |

### backend

| Command | What it does |
|---|---|
| `npm run dev` | Builds the widget and starts the API in watch mode |
| `npm run build`, `npm start` | Production build and start |
| `npm run build:widget` | Rebuilds only the chat bubble (not watched by `dev`) |
| `npm run db:migrate` | Applies pending migrations |
| `npm run db:seed` | Creates the demo tenant |
| `npm run db:schema` | Regenerates `schema.sql` from the migrations |
| `npm run plan:set -- <email> <FREE\|PRO\|ENTERPRISE>` | Sets an organization's plan by hand |
| `npm run org:list`, `npm run org:stats` | Lists organizations; product numbers and estimated MRR |
| `npm run site:disable -- <site> --reason "…"` | Blocks a site's widget for abuse (`--enable` lifts it) |
| `npm run secrets:rotate` | Re-seals stored secrets after a `JWT_SECRET` change |
| `npm run assistant:kill -- on\|off\|status` | Stops or resumes the assistant on every site |
| `npm run referrals:due` | Lists referral rewards still to give |
| `npm run push:keys` | Generates a VAPID key pair for Web Push |
| `npm run assistant:eval` | Scores the assistant's answers against sample questions |
| `npm run loadtest`, `npm run reconnect-storm` | Load and reconnect tests against the Compose stack |

Each CLI command has a `:prod` variant that runs the compiled code inside the
production container, for example `npm run plan:set:prod`.

### admin-panel

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on port 3002 |
| `npm run build` | Typecheck, icons, production build and the public page list |
| `npm run icons` | Regenerates the favicon, app icons and social preview image |

## Tests

```bash
cd backend && npm run test:compose   # API end-to-end suite against the Compose stack
cd e2e && npm ci && npm test         # Playwright browser tests
```

The backend suite creates fresh tenants and calls a running API; run it while
nothing else is loading that API. The browser tests drive the panel and a
stand-in customer website in two separate browsers: sign-up, e-mail
verification, onboarding, a visitor's message, the agent's reply, upgrades,
team invitations, the assistant, the mobile widget and accessibility.
`E2E_APP_URL` points them at another stack.

## Integrations

| Folder | What |
|---|---|
| `integrations/wordpress` | WordPress plugin with a settings page and Turkish translation |
| `integrations/shopify` | Shopify theme app extension |
| `integrations/gtm` | Google Tag Manager template |

Release packages are stamped with the production domain:

```bash
node integrations/release.mjs app.example.com   # writes integrations/dist/
```

## Production

One server behind Cloudflare: Caddy, a single backend container, PostgreSQL
with WAL-G continuous archiving, and Redis, the last two reachable only on the
Docker network.

| File | Role |
|---|---|
| `docker-compose.prod.yml` | Production services, resource limits, health checks |
| `docker-compose.prod.build.yml` | Override for building the image locally |
| `Caddyfile.prod` | TLS, security headers, Cloudflare IP ranges |
| `backend/Dockerfile.prod` | Multi-stage build bundling the panel, widget and API into one image |
| `docker/postgres` | PostgreSQL image with WAL-G |
| `scripts/bootstrap-server.sh` | Sets up and hardens a fresh Ubuntu server and installs the cron jobs |
| `scripts/deploy.sh`, `scripts/rollback.sh` | Deploys a signed image by digest and rolls back |
| `scripts/smoke.sh` | Post-deploy checks against the live site |
| `scripts/backup-postgres.sh`, `scripts/restore-postgres.sh`, `scripts/walg-backup.sh` | Nightly dumps, restore tests, base backups |
| `scripts/watchdog.sh`, `scripts/ship-logs.sh` | Health alerts and log archiving |
| `scripts/ufw-cloudflare.sh` | Opens ports 80 and 443 to Cloudflare only |

The backend refuses to start in production while a required setting is
missing or still a placeholder, and lists every problem at once
(`backend/src/config/productionChecks.ts`).

## CI/CD

| Workflow | What it does |
|---|---|
| `ci.yml` | Typecheck, lint, formatting, schema and translation checks, dependency audit, backend e2e with coverage, Playwright, Lighthouse, size budgets, image build with a Trivy scan, gitleaks |
| `codeql.yml` | Static security analysis |
| `release.yml` | Builds, scans, pushes to GHCR and signs the image (Sigstore) from `main` and `v*` tags |
| `deploy.yml` | Automatic staging deploys, production deploys after approval |
| `image-scan.yml` | Weekly vulnerability scan of the running images |

## Project layout

```
backend/
  src/
    server.ts        entry point
    routes/          REST endpoints
    socket/          Socket.IO events for the panel and the widget
    services/        business logic (assistant, billing, automation, mail…)
    models/          model layer over PostgreSQL
    db/              connection pool, migrations, queries, seed
    middleware/      auth, permissions, rate limits, CSP, uploads
    widget/          the chat bubble and its translations
    cli/             admin commands
  scripts/           build, schema, load-test and test helpers
  tests/             API end-to-end suite
admin-panel/
  src/
    pages/           marketing pages and panel screens
    components/      UI components
    locales/         Turkish and English copy
  scripts/           icons, public page list, translation checks
e2e/                 Playwright tests
integrations/        WordPress, Shopify, GTM
docker/              production PostgreSQL image
scripts/             server setup, deploys, backups
```

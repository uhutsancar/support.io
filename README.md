# Support.io

Live chat and an AI assistant for any website. Visitors write from a chat
bubble added with one line of code; the AI assistant answers common questions
from the site's own FAQ and hands everything else to the team, who answer
from one shared inbox.

## What is in it

- **Chat bubble** — one `<script>` tag on any site (HTML, WordPress, Shopify,
  React, Next.js, Vue, Angular…). Isolated from the host page's styles,
  signed visitor sessions, allowed origins per site.
- **AI assistant** — answers from the site's public FAQ only, cites the entry
  it relied on, never sends personal data, and hands over to a person when it
  has no answer, when the visitor asks, or when the service is unavailable.
  Monthly answers and depth depend on the plan.
- **Inbox** — real-time conversations, reliable delivery (idempotent sends,
  acknowledgements, reconnect catch-up), assignment, internal notes, files.
- **Team** — roles, invitations by e-mail, departments and routing,
  automation rules, proactive messages, team chat.
- **Insight** — reports, agent performance, live visitors, deals, audit logs.
- **SaaS** — e-mail verification and password reset, plans with limits and a
  monthly conversation quota enforced on the server, Paddle billing.

## Run it locally

```bash
cp .env.example .env                  # host ports, optional Paddle sandbox values
cp backend/.env.example backend/.env  # JWT_SECRET, optional S3 and GEMINI_API_KEY
docker compose up -d
docker compose exec backend npm run db:seed   # optional demo tenant
```

Everything comes up behind Caddy at **http://localhost** (backend on
`BACKEND_PORT`, PostgreSQL on 5433). The demo tenant signs in as
`owner@demo.support.io` / `Demo1234!`. Mails are printed to the backend log
(`MAIL_PROVIDER=console`).

Without Docker: PostgreSQL 16 and Redis 7 running, then `npm run dev` in
`backend/` and in `admin-panel/`.

## Install the bubble on a site

```html
<script src="https://app.example.com/widget.js" data-site-key="YOUR_SITE_KEY" async></script>
```

Copy-ready code per platform is in the setup guide at `/dokumantasyon`
(`/en/documentation`); the panel shows each site's own snippet.

## Tests and checks

```bash
cd backend && npm run test:compose     # e2e suite against the compose stack
npm run check                          # typecheck + lint, both packages (repo root)
(cd backend && npm run format:check) && (cd admin-panel && npm run format:check)
```

CI (`.github/workflows/ci.yml`) runs all of these, the suite against a fresh
PostgreSQL and Redis, the production image build and a secret scan.
`release.yml` publishes `ghcr.io/<owner>/supportio:sha-<7>` from `main`.

## Production

Single VPS behind Cloudflare, Caddy in front of one backend container,
PostgreSQL and Redis on the Docker network only. Install, deploy, rollback,
backups, restore tests, Paddle setup and secret rotation are in
**[docs/production-runbook.md](docs/production-runbook.md)**; the settings
contract is `.env.production.example`.

## Documentation

| File | What |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | How the backend is put together |
| [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) | Folders, modules, environment variables (Turkish) |
| [SECURITY.md](SECURITY.md) | Security model |
| [FILE_UPLOAD_SECURITY.md](FILE_UPLOAD_SECURITY.md) | Upload rules |
| [docs/production-runbook.md](docs/production-runbook.md) | Operating it |
| [docs/IS_LISTESI.md](docs/IS_LISTESI.md) | Work list and status (Turkish) |

## Stack

Node.js 22, Express, Socket.IO (Redis adapter), PostgreSQL 16 with versioned
migrations, Redis 7, React 18 + Vite + Tailwind, Caddy, Docker Compose,
Paddle, Google Gemini (AI assistant).

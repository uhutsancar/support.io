# Support.io — production runbook

How the service is installed, deployed, rolled back, backed up and restored.
Everything here runs on one VPS behind Cloudflare:

```text
Internet → Cloudflare (DNS, proxy) → Caddy :443 → backend:3000
                                          (panel + site + /api + /socket.io + /widget.js)
                                     → postgres:5432, redis:6379 (Docker network only)
```

Files on the server, in `/opt/supportio`:

```text
docker-compose.prod.yml   Caddyfile.prod   .env.production (chmod 600)
scripts/deploy.sh  rollback.sh  smoke.sh  backup-postgres.sh  restore-postgres.sh
```

Steps marked **[you]** need an account, a payment or a decision only the
owner can make; nothing in the repository does them.

---

## 1. One-time server setup

1. **[you]** Rent a VPS: Ubuntu 24.04, 2 vCPU / 4 GB is enough for the first
   customers (4 vCPU / 8 GB if staging shares the machine). Note its IP.
2. Log in as root once, then:

   ```bash
   adduser deploy && usermod -aG sudo deploy
   mkdir -p /home/deploy/.ssh && cp ~/.ssh/authorized_keys /home/deploy/.ssh/
   chown -R deploy:deploy /home/deploy/.ssh
   timedatectl set-timezone UTC
   apt update && apt -y upgrade && apt -y install unattended-upgrades ufw rclone age curl
   ```

3. After logging in as `deploy` with the key works, in `/etc/ssh/sshd_config`:
   `PermitRootLogin no`, `PasswordAuthentication no`, then `systemctl restart ssh`.
4. Firewall — only SSH, HTTP and HTTPS:

   ```bash
   ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp && ufw enable
   ```

   Docker publishes ports past UFW, which is why PostgreSQL and Redis have no
   `ports:` in the compose file. Never add them.
5. Docker Engine and the Compose plugin from Docker's apt repository
   (docs.docker.com/engine/install/ubuntu), then `usermod -aG docker deploy`.
6. `sudo mkdir -p /opt/supportio && sudo chown deploy: /opt/supportio`, copy
   `docker-compose.prod.yml`, `Caddyfile.prod` and `scripts/` there.
7. `cp .env.production.example /opt/supportio/.env.production`, fill it in,
   `chmod 600 .env.production`. The backend refuses to start and lists what is
   missing while anything required is empty or still the example.
8. GHCR access for pulling the image: **[you]** create a GitHub token with
   `read:packages`, then `docker login ghcr.io -u <github-user>`.

## 2. Cloudflare and HTTPS

1. **[you]** Add the domain to Cloudflare; point the registrar's nameservers
   at it.
2. DNS: `A app <VPS IP>`, **DNS only (grey cloud)** for the first start.
3. First start (section 3). Caddy obtains a Let's Encrypt certificate.
4. Switch the record to **Proxied (orange cloud)**, then SSL/TLS →
   **Full (strict)**. Never Flexible.
5. Network → WebSockets: on. Cache Rules: bypass `/api/*` and `/socket.io/*`;
   `/widget/v4/*` may be cached long.
6. `Caddyfile.prod` trusts the visitor IP only from Cloudflare's ranges.
   Re-check https://www.cloudflare.com/ips/ before each release and update
   `trusted_proxies` if they changed.
7. HSTS is one day (`max-age=86400`). Raise it to a year only after a few
   weeks of Full (strict) without trouble; `preload` only as a deliberate
   decision.

Later, optionally: allow 80/443 only from Cloudflare's IPs. HTTP-01
certificate renewal then fails — switch Caddy to the DNS-01 challenge or a
Cloudflare Origin CA certificate first.

## 3. First start

```bash
cd /opt/supportio
./scripts/deploy.sh ghcr.io/<owner>/supportio:sha-<7 chars>
```

The image tag comes from the "Release image" workflow summary on GitHub. The
first deploy creates the schema. Then create the first account from the
sign-up page. To give an organization a plan by hand during the beta (it
writes a PLAN_CHANGED audit row):

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml   exec backend npm run plan:set:prod -- owner@example.com ENTERPRISE
```

## 4. Deploy and rollback

```bash
./scripts/deploy.sh ghcr.io/<owner>/supportio:sha-1a2b3c4
```

Backup → switch `APP_IMAGE` (the previous one is kept in `.last-release`) →
pull → migrations once → restart → wait for `/ready` → smoke test. Any
failing step stops the deploy.

```bash
./scripts/rollback.sh            # the image from before the last deploy
./scripts/rollback.sh <image>    # a specific one
```

Migrations are not reversed by a rollback. That is why a release never drops
a column the previous release still reads: drops ship one release later.

Smoke test on its own: `./scripts/smoke.sh https://app.example.com`.

## 5. Backups

- `scripts/backup-postgres.sh`: `pg_dump -Fc` → checksum → encrypted with
  `age` for `BACKUP_AGE_RECIPIENT` → `rclone` to `BACKUP_REMOTE` → local copy
  removed. Non-zero exit on any failure.
- **[you]** Create the off-site bucket (Cloudflare R2, Backblaze B2, Hetzner)
  and an rclone remote for it (`rclone config`), with a lifecycle rule:
  7 daily, 4 weekly, 3 monthly.
- **[you]** `age-keygen -o supportio-backup.key` on your own computer; put
  the public key in `BACKUP_AGE_RECIPIENT`, keep the private key off the
  server (password manager).
- Cron, nightly at 03:00 UTC:

  ```cron
  0 3 * * * /opt/supportio/scripts/backup-postgres.sh >> /var/log/supportio-backup.log 2>&1
  ```

  Set `BACKUP_PING_URL` (healthchecks.io or similar) to hear about a night
  that did not run.
- With `UPLOAD_STORAGE=local`, the `uploads_data` volume needs backing up too.

## 6. Restore

Once a month, prove the backups work:

```bash
rclone copy <remote>/supportio_<ts>.dump.age /tmp/ && rclone copy <remote>/supportio_<ts>.dump.age.sha256 /tmp/
BACKUP_AGE_IDENTITY=~/supportio-backup.key ./scripts/restore-postgres.sh /tmp/supportio_<ts>.dump.age
```

It restores into a scratch database, prints the latest migration and row
counts, and drops it. To replace the live database (an incident only):
`... restore-postgres.sh <file> --into-production` — it stops the backend and
asks for the database name.

## 7. Paddle

1. **[you]** Paddle sandbox account → Catalog: a product "Support.io" with
   prices for Pro (monthly 490 TRY, yearly) and Enterprise (monthly 1449 TRY,
   yearly). Note the `pri_…` ids.
2. **[you]** Developer tools → Authentication: an API key (server) and a
   client-side token (browser).
3. **[you]** Notifications → new destination
   `https://app.example.com/api/billing/paddle/webhook`, events
   `subscription.*` (created, activated, updated, canceled, past_due, paused,
   resumed, trialing). Copy its secret key.
4. Fill `PADDLE_*` in `.env.production`, set `BILLING_ENABLED=true`, deploy.
5. Sandbox acceptance: buy Pro with a test card, see the plan change on the
   billing page; cancel from the customer portal; replay an event from the
   Paddle dashboard (it must be a no-op).
6. Live: repeat 1–3 in the live account, `PADDLE_ENV=production`.

**Troubleshooting webhooks** (`docker compose … logs backend | grep billing`):

| Symptom | Meaning |
|---|---|
| 400 in Paddle's delivery log | Signature rejected: wrong `PADDLE_WEBHOOK_SECRET`, or the server clock is off by more than a few seconds (`timedatectl`). |
| 503 | `PADDLE_WEBHOOK_SECRET` is empty on the server. |
| `…: ignored` | The event is not about a subscription, the price id is not one of `PADDLE_PRICE_*`, or the checkout reference did not match (not started from the panel). |
| `…: stale` | An older event arrived after a newer one; correctly not applied. |
| `…: duplicate` | Paddle retried an event already applied. |
| 500 | The database write failed; Paddle retries by itself. |

## 8. Rotating secrets

- `JWT_SECRET`: change it and deploy. Every session, widget session and
  unfinished checkout reference becomes invalid; users sign in again.
- `DB_PASSWORD`: `ALTER USER support_user PASSWORD '…'` in psql, then the
  same value in `.env.production`, then `docker compose … up -d backend`.
- Paddle keys and webhook secret: create the new one in Paddle, update
  `.env.production`, `up -d backend`, then revoke the old one.
- `GEMINI_API_KEY`: create a new key in Google AI Studio, update, `up -d
  backend`, delete the old key. Stay on the free tier (no billing account).
- A secret ever committed to Git is rotated at once; history is rewritten
  only with the owner's approval.

## 9. Everyday commands

```bash
C="docker compose --env-file .env.production -f docker-compose.prod.yml"
$C ps                                  # what is running
$C logs -f --tail 200 backend          # application log
curl -s https://app.example.com/ready  # {"status":"ready"}
$C exec postgres psql -U support_user supportchat   # database shell
$C exec backend npm run db:migrate:prod             # migrations by hand
df -h /var/lib/docker                  # disk (alert at 80%)
```

Logs rotate at 20 MB × 5 files per container. Do not put
`docker system prune -a` in cron; prune old images by hand after a
successful deploy (`docker image prune` keeps the ones in use).

## 10. Staging

Same VPS, separate Compose project and data:

```bash
mkdir -p /opt/supportio-staging && cd /opt/supportio-staging
# its own .env.production with APP_DOMAIN=staging.example.com,
# its own DB_PASSWORD / JWT_SECRET, PADDLE_ENV=sandbox
docker compose -p supportio-staging --env-file .env.production -f docker-compose.prod.yml up -d
```

Caddy on the production project can only bind 80/443 once: either run
staging on another machine, or add a `staging.example.com` site block to
`Caddyfile.prod` pointing at the staging backend over a shared network.

## 11. Scaling later (not needed now)

One VPS → a bigger VPS → PostgreSQL on its own host → several backend
processes (the Redis adapter is already there; set `SLA_SWEEPER=off` on all
but one, run migrations as a single job, sticky sessions if long-polling is
on) → managed Redis.

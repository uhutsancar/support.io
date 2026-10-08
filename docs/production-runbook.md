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
caddy/tls.d/  caddy/origin/   (only with a Cloudflare Origin CA certificate)
scripts/deploy.sh  rollback.sh  smoke.sh  backup-postgres.sh  restore-postgres.sh
        bootstrap-server.sh  ufw-cloudflare.sh
```

Steps marked **[you]** need an account, a payment or a decision only the
owner can make; nothing in the repository does them.

---

## 1. One-time server setup

1. **[you]** Rent a VPS: Ubuntu 24.04, 2 vCPU / 4 GB is enough for the first
   customers (4 vCPU / 8 GB if staging shares the machine). Turn on disk
   encryption if the provider offers it. Note its IP.
2. Log in as root once, then:

   ```bash
   adduser deploy && usermod -aG sudo deploy
   mkdir -p /home/deploy/.ssh && cp ~/.ssh/authorized_keys /home/deploy/.ssh/
   chown -R deploy:deploy /home/deploy/.ssh
   ```

3. Log in as `deploy` with the key (check it works before going on), copy the
   repository's `scripts/` to the server and run

   ```bash
   sudo ./scripts/bootstrap-server.sh
   ```

   It is safe to run again. It sets up automatic security updates with
   reboots only on Sunday 04:00 UTC, fail2ban for SSH, chrony, SSH with keys
   only and no root login, UFW (SSH, HTTP, HTTPS), the Docker daemon settings
   (live restore, rotated logs, no userland proxy, no new privileges), a 2 GB
   swap file and `/opt/supportio` owned by `deploy`.

   Docker publishes ports past UFW, which is why PostgreSQL and Redis have no
   `ports:` in the compose file. Never add them.
4. Docker Engine and the Compose plugin from Docker's apt repository
   (docs.docker.com/engine/install/ubuntu), then `usermod -aG docker deploy`.
   If Docker was installed after step 3, run the script once more so it
   writes `/etc/docker/daemon.json`.
5. Copy `docker-compose.prod.yml`, `Caddyfile.prod` and `scripts/` to
   `/opt/supportio`.
6. `cp .env.production.example /opt/supportio/.env.production`, fill it in,
   `chmod 600 .env.production`. The backend refuses to start and lists what is
   missing while anything required is empty or still the example.
7. GHCR access for pulling the image: **[you]** create a GitHub token with
   `read:packages`, then `docker login ghcr.io -u <github-user>`.
8. Recommended once things run: SSH only over Tailscale or WireGuard
   (`ufw delete allow 22/tcp`, then allow 22 on the tailnet interface only),
   so port 22 is not on the internet at all.

## 2. Cloudflare and HTTPS

1. **[you]** Add the domain to Cloudflare; point the registrar's nameservers
   at it. Turn on DNSSEC (and add the DS record at the registrar).
2. DNS: `A app <VPS IP>`, **DNS only (grey cloud)** for the first start.
3. First start (section 3). Caddy obtains a Let's Encrypt certificate.
4. Switch the record to **Proxied (orange cloud)**, then in SSL/TLS:
   **Full (strict)** (never Flexible), Always Use HTTPS on, Minimum TLS
   version 1.2, TLS 1.3 on.
5. Network → WebSockets: on.
6. Caching → Cache Rules: bypass `/api/*` and `/socket.io/*`; cache
   `/widget/v4/*` and `/assets/*` at the edge (they are versioned).
7. Security:
   - WAF → the free Cloudflare managed ruleset on.
   - Rate limiting rule: `/api/auth/*`, 20 requests a minute per IP, block
     for a minute. The application has its own limits; this one stops a
     flood before it reaches the server.
   - Bot Fight Mode **off**: it challenges the widget's requests and sockets
     on customers' sites. Sign-up is protected by Turnstile instead
     (`TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET`).
8. CAA records: `0 issue "letsencrypt.org"` and the CAs Cloudflare lists for
   its edge certificates (SSL/TLS → Edge Certificates shows them).
9. `Caddyfile.prod` trusts the visitor IP only from Cloudflare's ranges.
   Re-check https://www.cloudflare.com/ips/ before each release and update
   `trusted_proxies` if they changed.
10. HSTS is one day (`max-age=86400`). Raise it to a year only after a few
    weeks of Full (strict) without trouble; `preload` only as a deliberate
    decision.

### Origin lock: 80/443 from Cloudflare only

Without it, anyone who learns the server's address can skip Cloudflare's WAF
and rate limits. Let's Encrypt cannot renew once the ports are closed to it,
so the certificate comes from Cloudflare first:

1. **[you]** SSL/TLS → Origin Server → Create Certificate (RSA, the domain
   and `*.domain`, 15 years). On the server:

   ```bash
   mkdir -p /opt/supportio/caddy/origin /opt/supportio/caddy/tls.d
   # paste the certificate and the key
   nano /opt/supportio/caddy/origin/origin.pem
   nano /opt/supportio/caddy/origin/origin.key
   chmod 600 /opt/supportio/caddy/origin/origin.key
   echo 'tls /etc/caddy/origin/origin.pem /etc/caddy/origin/origin.key'      > /opt/supportio/caddy/tls.d/origin.caddy
   docker compose --env-file .env.production -f docker-compose.prod.yml up -d proxy
   ./scripts/smoke.sh https://<domain>
   ```

   The Origin CA certificate is trusted by Cloudflare only — fine, because
   the record is proxied. Removing `origin.caddy` goes back to Let's Encrypt.
2. Then:

   ```bash
   sudo ./scripts/ufw-cloudflare.sh --dry-run   # read what it will write
   sudo ./scripts/ufw-cloudflare.sh --apply
   ```

   It allows 80/443 from Cloudflare's ranges in UFW and adds the same rule to
   Docker's `DOCKER-USER` chain (Docker's published ports bypass UFW).
3. Test from a machine outside Cloudflare:
   `curl -m 5 -k https://<server IP>/health` must time out;
   `curl https://<domain>/health` must answer `{"status":"ok"}`;
   `sudo iptables -L DOCKER-USER -n -v` shows the drop rule counting.
   Undo with `--revert`. Re-run `--apply` when Cloudflare's ranges change.
4. Later (P2): Authenticated Origin Pulls (mTLS between Cloudflare and Caddy).

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
docker compose --env-file .env.production -f docker-compose.prod.yml   exec backend node dist/cli/updatePlan.js owner@example.com ENTERPRISE
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

A moment in time (WAL-G), the burned-server drill and the targets are in
[disaster-recovery.md](disaster-recovery.md). The nightly dump:

Once a month, prove the backups work:

```bash
rclone copy <remote>/supportio_<ts>.dump.age /tmp/ && rclone copy <remote>/supportio_<ts>.dump.age.sha256 /tmp/
BACKUP_AGE_IDENTITY=~/supportio-backup.key ./scripts/restore-postgres.sh /tmp/supportio_<ts>.dump.age
```

It restores into a scratch database, prints the latest migration and row
counts, fails if the migration is not the live one, and drops it.

The same check runs **every Sunday by itself**: `backup-postgres.sh`
restores the night's plain dump into a scratch database before encrypting it
(`BACKUP_VERIFY=weekly`; `always` or `off` also work), records the time in
`/var/lib/supportio/status/backup-verify-last-success` and pings
`BACKUP_VERIFY_PING_URL`. The watchdog alarms when no restore test has passed
for 8 days. The private key never has to be on the server for it. To replace the live database (an incident only):
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
5. Sandbox acceptance: every scenario in `docs/billing-acceptance.md`
   (purchase, plan changes and the downgrade on-hold rules, failed payment,
   cancellation, replay, bad signature, portal, who sends which mail).
6. Live: repeat 1–3 in the live account, `PADDLE_ENV=production`.

**Troubleshooting webhooks** (`docker compose … logs backend | grep billing`):

| Symptom | Meaning |
|---|---|
| 400 in Paddle's delivery log | Signature rejected (`paddle webhook rejected` in the log, `supportio_billing_webhook_rejected_total` up): wrong `PADDLE_WEBHOOK_SECRET`, or the server clock is off by more than a few seconds (`timedatectl`). |
| 503 | `PADDLE_WEBHOOK_SECRET` is empty on the server. |
| `…: ignored` | The event is not about a subscription, the price id is not one of `PADDLE_PRICE_*`, or the checkout reference did not match (not started from the panel). |
| `…: stale` | An older event arrived after a newer one; correctly not applied. |
| `…: duplicate` | Paddle retried an event already applied. |
| 500 | The database write failed; Paddle retries by itself. |
| `paddle price differs from domain/plans.ts` | A `PADDLE_PRICE_*` amount was changed in Paddle; the pricing page already shows Paddle's figure. Bring `domain/plans.ts` in line in the next release. |

## 8. Rotating secrets

- `JWT_SECRET` — without signing anybody out (plan v10 SEC-18):
  1. In `.env.production` set `JWT_SECRET_PREVIOUS` to the current value
     and `JWT_SECRET` to a new one (`openssl rand -hex 48`). Deploy.
     Everything signed or sealed with the old secret is still accepted —
     panel and widget sessions, e-mail links, attachment links, checkout
     references, IP blocks, sealed site and authenticator secrets — and
     everything new uses the new one.
  2. `docker compose -f docker-compose.prod.yml exec backend npm run
     secrets:rotate:prod -- --dry-run`, then without `--dry-run`. It
     re-seals every stored secret under the new key and prints how many
     accounts still hold recovery codes from the old key; those keep working
     until step 3, so ask those users to create new codes (Settings →
     Security).
  3. After 7 days (the longest session), empty `JWT_SECRET_PREVIOUS` and
     deploy. Old sessions and links now fail; IP-based visitor blocks made
     before the rotation stop matching by address (they still match by
     visitor id).
  If the old secret leaked, skip the overlap: set the new `JWT_SECRET`
  with `JWT_SECRET_PREVIOUS` empty. Everybody signs in again, sealed
  secrets read as "not configured" and owners generate new ones.
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
$C exec backend node dist/db/migrate.js               # migrations by hand
df -h /var/lib/docker                  # disk (alert at 80%)

# support operations (each writes an audit row where it changes something)
$C exec backend node dist/cli/listOrganizations.js acme       # find a workspace
$C exec backend node dist/cli/orgStats.js 30                   # product numbers, last 30 days
$C exec backend node dist/cli/updatePlan.js owner@x.com PRO    # beta / support case
$C exec backend node dist/cli/disableSite.js <site key> --reason "phishing"  # block for abuse (--enable lifts)
$C exec backend node dist/cli/assistantKill.js on               # AI assistant off everywhere (off / status)
```

Logs rotate at 20 MB × 5 files per container. Do not put
`docker system prune -a` in cron; prune old images by hand after a
successful deploy (`docker image prune` keeps the ones in use).

### When Redis is down

Redis only carries rate-limit counters, a short cache and the Socket.IO
adapter. While it is down, the API, logins and messages keep working; rate
limits are counted per process, and `/ready` stays `ready` with one
`Redis unreachable` line in the log. When it is back, the log shows
`Redis is back` and `[redis:pub] / [redis:sub] yeniden bağlandı`; nothing
needs a restart. A backend that *started* while Redis was down runs without
the adapter until its next restart, which only matters with more than one
backend process.

The drill (run on staging, last run 2026-10-06 on the dev stack: 19/19
message and widget-session tests passed both with Redis stopped and after
it came back):

```bash
$C stop redis
curl -s https://app.example.com/ready          # still {"status":"ready"}
# send a widget message, answer it from the panel
$C start redis
$C logs --since 1m backend | grep -i redis     # "Redis is back"
```

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

**When.** Not before the staging measurements (docs/load-test.md) say so,
and then when either holds for a week of normal traffic:

- CPU of the server above 60 % most of the day, or
- message acknowledgement p95 above 500 ms
  (`supportio_operation_seconds{operation="message.insert"}` plus the
  socket round trip), or event-loop p99 above 100 ms
  (`supportio_event_loop_delay_seconds`).

**In this order**, each step only when the previous one is used up:

1. **A bigger VPS** (vertical): 4 vCPU / 8 GB. Raise `PG_SHARED_BUFFERS`
   to 1 GB and `PG_EFFECTIVE_CACHE_SIZE` to 3 GB, `BACKEND_CPUS` to 3.
   No code change.
2. **PostgreSQL on its own** — a managed service, chosen with the data
   residency decision (Türkiye or EU; KARAR-INF-1). `DB_HOST`, `DB_SSL=true`,
   restore the latest backup there (§6), switch, keep the old one a week.
3. **Two backend processes** on the same or a second machine: the Redis
   adapter already carries broadcasts between them. `SLA_SWEEPER=off` on all
   but one; migrations stay a single job in `deploy.sh`; sticky sessions
   only if long-polling is used (the widget prefers websockets). Caddy:
   `reverse_proxy backend1:3000 backend2:3000 { lb_policy least_conn;
   health_uri /ready }` — this also gives deploys without downtime (one
   process at a time).
4. **Managed Redis** once two processes depend on it (with a password and
   TLS).

Connection budget at every step: `DB_POOL_MAX` × backend processes + the
backup + a psql session ≤ `max_connections` (50 now: 20 + spare).

# Disaster recovery

What we promise to lose at most, how long it takes to come back, and the
steps — from a dropped table to a server that is gone.

## Targets (KARAR-DR-1) — [you] accept them

|                            | Target                                                                           | Means                                                                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **RPO** (data we may lose) | **≤ 15 minutes** once WAL-G is on; **≤ 24 hours** in the closed beta before that | with `PG_ARCHIVE_MODE=on` WAL is shipped at least every 5 min (`archive_timeout=300`); without it, the nightly dump is the latest copy |
| **RTO** (time to be back)  | **≤ 2 hours** on a new server                                                    | the drill below, timed on staging                                                                                                      |

Default until you decide: the 24 h RPO is accepted for the closed beta only;
paid launch waits for WAL-G and a timed drill.

## What is backed up where

| What                 | How                                                                                          | Where                             | Kept                                       |
| -------------------- | -------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------ |
| Database, nightly    | `pg_dump` → age-encrypted (`scripts/backup-postgres.sh`)                                     | `BACKUP_REMOTE`                   | 7 daily, 4 weekly, 3 monthly (bucket rule) |
| Database, continuous | WAL-G base backup weekly + WAL every ≤ 5 min, libsodium-encrypted (`scripts/walg-backup.sh`) | `WALG_S3_PREFIX` (its own bucket) | 4 base backups ≈ a month                   |
| Restore test         | the night's dump restored into a scratch database every Sunday                               | —                                 | watchdog alarm after 8 days without a pass |
| Attachments, logos   | S3/R2 with **versioning** and a 30-day rule for deleted objects — [you] bucket setting       | upload bucket                     |                                            |
| Certificates         | Caddy obtains them again; an Origin CA certificate is kept in the password manager           |                                   |                                            |
| Secrets              | the password manager (below)                                                                 |                                   |                                            |
| Logs                 | `scripts/ship-logs.sh`, daily                                                                | `LOG_REMOTE`                      | 30 days                                    |

Two independent database backups in two formats on purpose: a fault in
one tool or one bucket does not take both.

## Turning WAL-G on — [you] once

1. A bucket (or prefix) of its own, e.g. R2 `supportio-wal`, with a key that
   can write only there.
2. `openssl rand -hex 32` → `WALG_LIBSODIUM_KEY`. **Store it in the password
   manager now**: the archive cannot be read without it.
3. In `.env.production`: `POSTGRES_IMAGE` (from the release workflow's
   summary), `WALG_S3_PREFIX`, `WALG_AWS_ACCESS_KEY_ID`,
   `WALG_AWS_SECRET_ACCESS_KEY`, `WALG_AWS_ENDPOINT`, `PG_ARCHIVE_MODE=on`.
4. `docker compose ... up -d postgres` (a restart: archive_mode needs one),
   then the first base backup by hand: `./scripts/walg-backup.sh`.
5. Cron, Sunday 02:30 UTC: `30 2 * * 0 /opt/supportio/scripts/walg-backup.sh >> /var/log/supportio-walg.log 2>&1`
6. Check the archive works: `docker compose ... exec postgres psql -U support_user -c "SELECT archived_count, failed_count, last_archived_time FROM pg_stat_archiver"` — `failed_count` 0, `last_archived_time` within minutes.

The image is the official `postgres:16.15-trixie` plus a checksum-verified
WAL-G v3.0.9 (`docker/postgres/Dockerfile`), built, scanned and signed by the
release workflow. It is the same Debian base the development stack runs.
A database that ran on the earlier Alpine image moves over with a dump and
restore (the two sort text differently), not by reusing its volume.

## Restoring to a moment (PITR)

A table dropped at 14:05, data wrong since 14:00: restore to 13:59.

1. Note the target time in UTC. Stop the backend: `docker compose ... stop backend`.
2. Keep the current data aside (do not delete it yet):
   ```bash
   docker compose ... stop postgres
   docker volume create supportio_postgres_before_restore
   docker run --rm -v supportio_postgres_prod_data:/from -v supportio_postgres_before_restore:/to \
     alpine sh -c 'cp -a /from/. /to/'
   ```
3. Empty the data volume, fetch the base backup, set the target, start:
   ```bash
   docker run --rm -v supportio_postgres_prod_data:/d alpine sh -c 'rm -rf /d/* /d/.[!.]*'
   docker compose ... run --rm --no-deps --user postgres --entrypoint bash postgres -c "
     wal-g backup-fetch /var/lib/postgresql/data LATEST &&
     touch /var/lib/postgresql/data/recovery.signal &&
     printf \"restore_command = 'wal-g wal-fetch %%f %%p'\nrecovery_target_time = '2026-10-07 13:59:00+00'\nrecovery_target_action = 'promote'\n\" >> /var/lib/postgresql/data/postgresql.auto.conf"
   docker compose ... up -d postgres
   ```
   (`LATEST` must be a base backup older than the target; `wal-g backup-list`
   shows them, and a name can replace `LATEST`.)
4. When `SELECT pg_is_in_recovery()` is `f`, check the data, then
   `docker compose ... up -d backend` and `./scripts/smoke.sh https://<domain>`.
5. Take a new base backup (`./scripts/walg-backup.sh`): after a recovery the
   timeline changed. Remove the set-aside volume after a week.

The same procedure in throwaway containers, with a local archive instead of
a bucket, is `./scripts/pitr-drill.sh` — it archives, takes a base backup,
writes, remembers a moment, writes more, restores to that moment and checks
the rows. Run on 2026-10-07 against the image: passed (150 rows of the
moment, not the 180 written after it).

Without WAL-G, the nightly dump is the restore (runbook §6,
`restore-postgres.sh --into-production`).

## "The server burned down" — the drill (DR-05)

Once on staging, timed; the time is the RTO evidence. Then yearly.

| Step |                                                                                                                                                       | Typical   |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 1    | New VPS, runbook §1 (`bootstrap-server.sh`, Docker)                                                                                                   | 20 min    |
| 2    | `.env.production` from the password manager; `docker login ghcr.io`                                                                                   | 5 min     |
| 3    | Copy `docker-compose.prod.yml`, `Caddyfile.prod`, `scripts/` (from the repository)                                                                    | 5 min     |
| 4    | `docker compose ... up -d postgres redis`                                                                                                             | 2 min     |
| 5    | Database: WAL-G `backup-fetch LATEST` + replay to the end (steps above, no target time), or the latest dump (`restore-postgres.sh --into-production`) | 10–40 min |
| 6    | `./scripts/deploy.sh <the image running before>`                                                                                                      | 5 min     |
| 7    | Cloudflare: the `A` record to the new IP (proxied, so no TTL wait); Origin CA files from the password manager if used                                 | 5 min     |
| 8    | `./scripts/smoke.sh https://<domain>`, sign in, send a widget message                                                                                 | 10 min    |
| 9    | Cron jobs (backup, WAL-G, watchdog, logs), uptime checks point at the domain already                                                                  | 10 min    |

Write down: date, who, each step's time, what was unclear — and fix the
documents the same day.

## Secrets kept off the server (DR-06) — [you]

A "Support.io Prod" vault in a password manager (Bitwarden, 1Password),
shared with one more trusted person, holding:

- the whole `.env.production`
- the age **private** key for the dumps (`BACKUP_AGE_RECIPIENT`'s pair)
- `WALG_LIBSODIUM_KEY`
- the Cloudflare Origin CA certificate and key (if used)
- the bucket keys (backups, WAL, uploads, logs), Paddle, SMTP and the
  AI provider key, the GitHub token for GHCR
- the registrar, Cloudflare, server provider and Paddle account logins with
  their two-step recovery codes

Without the vault the backups exist but cannot be read; without the second
person the business stops when one person is unreachable.

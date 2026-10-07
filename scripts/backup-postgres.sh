#!/usr/bin/env bash
# Nightly PostgreSQL backup, encrypted and copied off the server (plan §15).
#
#   pg_dump -Fc  ->  sha256  ->  age (or gpg) encryption  ->  rclone to
#   off-site storage  ->  the local copy deleted
#
# Settings, from .env.production:
#
#   BACKUP_REMOTE         rclone destination, e.g. r2:supportio-backups/postgres
#                         (required: a backup kept only on this server is not
#                         a backup). "local" keeps it here and says so loudly.
#   BACKUP_AGE_RECIPIENT  age public key (age1...) the dump is encrypted for;
#   BACKUP_GPG_RECIPIENT  or a gpg key id instead. One of them is required.
#   BACKUP_DIR            working directory, default /var/backups/supportio
#   BACKUP_PING_URL       optional; called on success (healthchecks.io style)
#   BACKUP_VERIFY         weekly (default: Sundays), always, or off — restore
#                         the night's plain dump into a scratch database
#                         before it is encrypted (DR-03, restore-postgres.sh)
#   BACKUP_VERIFY_PING_URL optional; called when a verification passes
#   BACKUP_STATUS_DIR     where the time of the last success is written, read
#                         by the API's /internal/metrics and scripts/watchdog.sh;
#                         default /var/lib/supportio/status
#
# Retention (7 daily, 4 weekly, 3 monthly) is the bucket's lifecycle rule.
# Exits non-zero on any failure and never prints a secret.
#
# Cron (UTC):  0 3 * * *  /opt/supportio/scripts/backup-postgres.sh >> /var/log/supportio-backup.log 2>&1
set -euo pipefail

ROOT="${SUPPORTIO_ROOT:-/opt/supportio}"
cd "$ROOT"
ENV_FILE=.env.production

# A variable missing from the file is empty, not an error: without `|| true`
# grep finding nothing ends the script under pipefail, without a word.
env_value() { { grep -E "^$1=" "$ENV_FILE" 2>/dev/null || true; } | tail -n1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }

DB_NAME="$(env_value DB_NAME)"; DB_NAME="${DB_NAME:-supportchat}"
DB_USER="$(env_value DB_USER)"; DB_USER="${DB_USER:-support_user}"
REMOTE="$(env_value BACKUP_REMOTE)"
AGE_RECIPIENT="$(env_value BACKUP_AGE_RECIPIENT)"
GPG_RECIPIENT="$(env_value BACKUP_GPG_RECIPIENT)"
PING_URL="$(env_value BACKUP_PING_URL)"
VERIFY="$(env_value BACKUP_VERIFY)"; VERIFY="${VERIFY:-weekly}"
VERIFY_PING_URL="$(env_value BACKUP_VERIFY_PING_URL)"
DIR="$(env_value BACKUP_DIR)"; DIR="${DIR:-/var/backups/supportio}"
STATUS_DIR="$(env_value BACKUP_STATUS_DIR)"; STATUS_DIR="${STATUS_DIR:-/var/lib/supportio/status}"

[[ -n "$REMOTE" ]] || { echo "BACKUP_REMOTE is not set (use an rclone remote, or 'local' explicitly)" >&2; exit 1; }
[[ -n "$AGE_RECIPIENT" || -n "$GPG_RECIPIENT" ]] || { echo "set BACKUP_AGE_RECIPIENT or BACKUP_GPG_RECIPIENT" >&2; exit 1; }

mkdir -p "$DIR"
chmod 700 "$DIR"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP="$DIR/supportio_${TS}.dump"
trap 'rm -f "$DUMP"' EXIT

docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml exec -T postgres \
  pg_dump -Fc -U "$DB_USER" "$DB_NAME" > "$DUMP"
[[ -s "$DUMP" ]] || { echo "pg_dump produced an empty file" >&2; exit 1; }
SUM="$(sha256sum "$DUMP" | cut -d' ' -f1)"

# Weekly, the plain dump is restored into a scratch database and checked
# before it is encrypted: the private key never needs to be on this server.
mkdir -p "$STATUS_DIR"
[[ -f "$STATUS_DIR/backup-verify-due" ]] || echo $(( $(date -u +%s) + 8 * 86400 )) > "$STATUS_DIR/backup-verify-due"
if [[ "$VERIFY" == "always" || ( "$VERIFY" == "weekly" && "$(date -u +%u)" == "7" ) ]]; then
  if "$ROOT/scripts/restore-postgres.sh" "$DUMP"; then
    date -u +%s > "$STATUS_DIR/backup-verify-last-success"
    [[ -n "$VERIFY_PING_URL" ]] && curl -fsS --max-time 10 "$VERIFY_PING_URL" > /dev/null || true
  else
    echo "backup verification FAILED; the dump is still encrypted and copied" >&2
    VERIFY_FAILED=1
  fi
fi

if [[ -n "$AGE_RECIPIENT" ]]; then
  OUT="$DUMP.age"
  age -r "$AGE_RECIPIENT" -o "$OUT" "$DUMP"
else
  OUT="$DUMP.gpg"
  gpg --batch --yes --trust-model always -r "$GPG_RECIPIENT" -o "$OUT" --encrypt "$DUMP"
fi
echo "$SUM  $(basename "$DUMP")" > "$OUT.sha256"

if [[ "$REMOTE" == "local" ]]; then
  echo "WARNING: BACKUP_REMOTE=local — this backup exists only on this server" >&2
else
  rclone copy "$OUT" "$REMOTE" --no-traverse
  rclone copy "$OUT.sha256" "$REMOTE" --no-traverse
  rm -f "$OUT" "$OUT.sha256"
fi

date -u +%s > "$STATUS_DIR/backup-last-success"
[[ -n "$PING_URL" ]] && curl -fsS --max-time 10 "$PING_URL" > /dev/null || true
echo "backup ok: $(basename "$OUT") (sha256 of the dump: $SUM)"
[[ -z "${VERIFY_FAILED:-}" ]] || exit 1

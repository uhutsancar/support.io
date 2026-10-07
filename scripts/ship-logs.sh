#!/usr/bin/env bash
# Keeps a day of container logs off the server (plan v10 OBS-05,
# KARAR-OBS-3 option b). Docker keeps only 20 MB × 5 per container and loses
# them with the container; this copies the last 24 hours, gzipped, to the
# same kind of bucket as the backups. Keep 30 days with the bucket's
# lifecycle rule.
#
# The logs hold no passwords, tokens, cookies, keys or message text, and
# e-mail addresses are masked (backend/src/config/logger.ts); they still
# hold request paths and request ids, so the bucket is private.
#
# Settings, from .env.production:
#   LOG_REMOTE   rclone destination, e.g. r2:supportio-logs
#
# Cron (UTC):  15 0 * * *  /opt/supportio/scripts/ship-logs.sh >> /var/log/supportio-logs.log 2>&1
set -euo pipefail

ROOT="${SUPPORTIO_ROOT:-/opt/supportio}"
cd "$ROOT"
ENV_FILE=.env.production
# A variable missing from the file is empty, not an error (see backup-postgres.sh).
env_value() { { grep -E "^$1=" "$ENV_FILE" 2>/dev/null || true; } | tail -n1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }

REMOTE="$(env_value LOG_REMOTE)"
[[ -n "$REMOTE" ]] || { echo "LOG_REMOTE is not set; nothing shipped" >&2; exit 1; }

DAY="$(date -u -d 'yesterday' +%F)"
FILE="$(mktemp -d)/supportio-${DAY}.log.gz"
trap 'rm -rf "$(dirname "$FILE")"' EXIT

docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml logs \
  --no-color --timestamps --since 24h | gzip -9 >"$FILE"
[[ -s "$FILE" ]] || { echo "no logs captured" >&2; exit 1; }

rclone copy "$FILE" "$REMOTE/$(date -u -d 'yesterday' +%Y/%m)/" --no-traverse
echo "logs shipped: $(basename "$FILE") ($(du -h "$FILE" | cut -f1))"

#!/usr/bin/env bash
# Weekly WAL-G base backup and retention (plan v10 DR-02). With continuous
# WAL archiving on (PG_ARCHIVE_MODE=on), any moment since the oldest kept
# base backup can be restored (docs/disaster-recovery.md). The nightly
# pg_dump (backup-postgres.sh) stays: a second, independent backup.
#
# Cron (UTC):  30 2 * * 0  /opt/supportio/scripts/walg-backup.sh >> /var/log/supportio-walg.log 2>&1
#
#   WALG_RETAIN_FULL   base backups kept (default 4: a month of history)
set -euo pipefail

ROOT="${SUPPORTIO_ROOT:-/opt/supportio}"
cd "$ROOT"
ENV_FILE=.env.production
C=(docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml)
# A variable missing from the file is empty, not an error (see backup-postgres.sh).
env_value() { { grep -E "^$1=" "$ENV_FILE" 2>/dev/null || true; } | tail -n1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }

if [[ "$(env_value PG_ARCHIVE_MODE)" != "on" ]]; then
  echo "PG_ARCHIVE_MODE is not on; nothing to do"
  exit 0
fi
RETAIN="$(env_value WALG_RETAIN_FULL)"; RETAIN="${RETAIN:-4}"
STATUS_DIR="$(env_value BACKUP_STATUS_DIR)"; STATUS_DIR="${STATUS_DIR:-/var/lib/supportio/status}"

"${C[@]}" exec -T --user postgres postgres wal-g backup-push /var/lib/postgresql/data
"${C[@]}" exec -T --user postgres postgres wal-g delete retain FULL "$RETAIN" --confirm
"${C[@]}" exec -T --user postgres postgres wal-g backup-list | tail -n 5

mkdir -p "$STATUS_DIR"
date -u +%s > "$STATUS_DIR/walg-last-backup"
echo "walg base backup ok"

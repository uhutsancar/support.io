#!/usr/bin/env bash
# Restores a backup into a scratch database and checks it (plan §15).
#
#   ./scripts/restore-postgres.sh <file.dump[.age|.gpg]> [--into-production]
#
# By default the dump goes into a new database named restore_check_<time>,
# which is then checked (tables present, the latest migration recorded,
# row counts) and dropped. That is the monthly restore test; a backup is not
# trusted until this has passed.
#
# --into-production replaces the live database. It stops the backend first
# and asks for the database name to be typed back. Take a fresh backup first.
#
#   BACKUP_AGE_IDENTITY  the age private key file, for .age files
set -euo pipefail

FILE="${1:?usage: $0 <file.dump[.age|.gpg]> [--into-production]}"
MODE="${2:-check}"
ROOT="${SUPPORTIO_ROOT:-/opt/supportio}"
cd "$ROOT"
ENV_FILE=.env.production
C="docker compose --env-file $ENV_FILE -f docker-compose.prod.yml"
env_value() { grep -E "^$1=" "$ENV_FILE" | tail -n1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
DB_NAME="$(env_value DB_NAME)"; DB_NAME="${DB_NAME:-supportchat}"
DB_USER="$(env_value DB_USER)"; DB_USER="${DB_USER:-support_user}"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
DUMP="$WORK/restore.dump"
case "$FILE" in
  *.age) age -d -i "${BACKUP_AGE_IDENTITY:?set BACKUP_AGE_IDENTITY to the age key file}" -o "$DUMP" "$FILE" ;;
  *.gpg) gpg --batch --yes -o "$DUMP" --decrypt "$FILE" ;;
  *) cp "$FILE" "$DUMP" ;;
esac
if [[ -f "$FILE.sha256" ]]; then
  expected="$(cut -d' ' -f1 "$FILE.sha256")"
  actual="$(sha256sum "$DUMP" | cut -d' ' -f1)"
  [[ "$expected" == "$actual" ]] || { echo "checksum mismatch" >&2; exit 1; }
  echo "checksum ok"
fi

psql() { $C exec -T postgres psql -U "$DB_USER" -v ON_ERROR_STOP=1 "$@"; }

if [[ "$MODE" == "--into-production" ]]; then
  read -r -p "This replaces database '$DB_NAME'. Type its name to continue: " answer
  [[ "$answer" == "$DB_NAME" ]] || { echo "aborted"; exit 1; }
  $C stop backend
  psql -d postgres -c "DROP DATABASE IF EXISTS \"$DB_NAME\" WITH (FORCE)" -c "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_USER\""
  $C exec -T postgres pg_restore -U "$DB_USER" -d "$DB_NAME" --no-owner < "$DUMP"
  $C start backend
  echo "restored into $DB_NAME; check /ready and log in before announcing it"
  exit 0
fi

TARGET="restore_check_$(date -u +%Y%m%d%H%M%S)"
psql -d postgres -c "CREATE DATABASE \"$TARGET\" OWNER \"$DB_USER\""
cleanup_db() { psql -d postgres -c "DROP DATABASE IF EXISTS \"$TARGET\" WITH (FORCE)" > /dev/null || true; rm -rf "$WORK"; }
trap cleanup_db EXIT

$C exec -T postgres pg_restore -U "$DB_USER" -d "$TARGET" --no-owner < "$DUMP"

echo "restored into $TARGET; checking"
psql -d "$TARGET" -At -c "SELECT 'latest migration: ' || max(version) FROM schema_migrations"
psql -d "$TARGET" -At -c "SELECT 'organizations: ' || count(*) FROM organizations"
psql -d "$TARGET" -At -c "SELECT 'conversations: ' || count(*) FROM conversations"
psql -d "$TARGET" -At -c "SELECT 'messages: ' || count(*) FROM messages"
echo "restore test passed"

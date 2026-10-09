#!/usr/bin/env bash
# Point-in-time recovery drill (plan v10 DR-02, DR-05), on any machine with
# Docker, in throwaway containers: nothing touches a real database.
#
#   1. a PostgreSQL from the given image archives its WAL with WAL-G to a
#      local volume (encrypted with libsodium, compressed)
#   2. 100 rows, a base backup, 50 rows, a remembered moment T, 30 more rows
#   3. a fresh container fetches the base backup and replays WAL up to T
#   4. it must hold exactly the 150 rows of moment T
#
#   ./scripts/pitr-drill.sh [image]     default: supportio-postgres:walg-test
#
# The same steps, with WALG_S3_PREFIX and the bucket's keys instead of a
# local volume, are the production restore (docs/disaster-recovery.md).
set -euo pipefail

IMAGE="${1:-supportio-postgres:walg-test}"
RUN="pitr$$"
STORE="${RUN}-store"
DATA="${RUN}-data"
KEY="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
WALG_ENV=(-e WALG_FILE_PREFIX=/walg -e "WALG_LIBSODIUM_KEY=$KEY" -e WALG_LIBSODIUM_KEY_TRANSFORM=hex
  -e WALG_COMPRESSION_METHOD=lz4)

cleanup() {
  docker rm -f "${RUN}-primary" "${RUN}-restore" >/dev/null 2>&1 || true
  docker volume rm "$STORE" "$DATA" >/dev/null 2>&1 || true
}
trap cleanup EXIT

sql() { docker exec "$1" psql -U postgres -d drill -Atc "$2"; }
wait_ready() {
  for _ in $(seq 1 60); do
    docker exec "$1" pg_isready -U postgres >/dev/null 2>&1 && return 0
    sleep 1
  done
  echo "$1 did not start" >&2
  docker logs --tail 30 "$1" >&2
  return 1
}

docker volume create "$STORE" >/dev/null
docker volume create "$DATA" >/dev/null
docker run --rm --user root -v "$STORE:/walg" "$IMAGE" chown postgres:postgres /walg

echo "== primary, archiving with WAL-G"
docker run -d --name "${RUN}-primary" -e POSTGRES_PASSWORD=drill -e POSTGRES_DB=drill \
  "${WALG_ENV[@]}" -v "$STORE:/walg" "$IMAGE" \
  -c archive_mode=on -c 'archive_command=wal-g wal-push %p' -c archive_timeout=60 >/dev/null
wait_ready "${RUN}-primary"
sleep 2
wait_ready "${RUN}-primary"

sql "${RUN}-primary" "CREATE TABLE t (id int, at timestamptz DEFAULT now())"
sql "${RUN}-primary" "INSERT INTO t (id) SELECT generate_series(1, 100)"
docker exec --user postgres "${RUN}-primary" wal-g backup-push /var/lib/postgresql/data 2>&1 | tail -1
sql "${RUN}-primary" "INSERT INTO t (id) SELECT generate_series(101, 150)"
sleep 2
TARGET="$(sql "${RUN}-primary" "SELECT now()")"
sleep 2
sql "${RUN}-primary" "INSERT INTO t (id) SELECT generate_series(151, 180)"
sql "${RUN}-primary" "SELECT pg_switch_wal()" >/dev/null
# Wait until the segment holding the last rows is archived.
for _ in $(seq 1 30); do
  failed="$(sql "${RUN}-primary" "SELECT failed_count FROM pg_stat_archiver")"
  archived="$(sql "${RUN}-primary" "SELECT archived_count FROM pg_stat_archiver")"
  (( archived >= 2 )) && break
  sleep 1
done
echo "archived WAL segments: $archived (failed attempts: $failed)"
echo "rows now: $(sql "${RUN}-primary" "SELECT count(*) FROM t"), target time: $TARGET"
docker stop "${RUN}-primary" >/dev/null

echo "== restore to the target time in a fresh container"
docker run --rm --user root -v "$DATA:/var/lib/postgresql/data" "$IMAGE" \
  chown postgres:postgres /var/lib/postgresql/data
docker run --rm --user postgres "${WALG_ENV[@]}" -v "$STORE:/walg" \
  -v "$DATA:/var/lib/postgresql/data" "$IMAGE" \
  bash -c "wal-g backup-fetch /var/lib/postgresql/data LATEST &&
    touch /var/lib/postgresql/data/recovery.signal &&
    printf \"restore_command = 'wal-g wal-fetch %%f %%p'\nrecovery_target_time = '%s'\nrecovery_target_action = 'promote'\n\" '$TARGET' >> /var/lib/postgresql/data/postgresql.auto.conf" 2>&1 | tail -1
docker run -d --name "${RUN}-restore" "${WALG_ENV[@]}" -v "$STORE:/walg" \
  -v "$DATA:/var/lib/postgresql/data" "$IMAGE" >/dev/null
wait_ready "${RUN}-restore"
for _ in $(seq 1 60); do
  [[ "$(sql "${RUN}-restore" "SELECT pg_is_in_recovery()" 2>/dev/null)" == "f" ]] && break
  sleep 1
done

rows="$(sql "${RUN}-restore" "SELECT count(*) FROM t")"
last="$(sql "${RUN}-restore" "SELECT max(id) FROM t")"
echo "restored rows: $rows (max id $last)"
if [[ "$rows" == "150" && "$last" == "150" ]]; then
  echo "PITR drill passed: the database is as it was at $TARGET"
else
  echo "PITR drill FAILED: expected 150 rows" >&2
  docker logs --tail 40 "${RUN}-restore" >&2
  exit 1
fi

#!/usr/bin/env bash
# Deploys one image to the production stack (plan §14.3).
#
#   ./scripts/deploy.sh ghcr.io/<owner>/supportio:sha-1a2b3c4
#
# Runs on the VPS from /opt/supportio. Every step must succeed or the deploy
# stops where it is, with the previous containers still running:
#
#   1. a database backup (scripts/backup-postgres.sh)
#   2. APP_IMAGE in .env.production switched, the previous one remembered
#      in .last-release for scripts/rollback.sh
#   3. the image pulled, the migrations run once
#   4. the stack restarted and /ready awaited
#   5. the smoke test
#
# Migrations must stay backward compatible with the previous release (no
# drops in the same release), so a rollback after step 3 is still safe.
set -euo pipefail

NEW_IMAGE="${1:-}"
if [[ -z "$NEW_IMAGE" || "$NEW_IMAGE" == *":latest" || "$NEW_IMAGE" != *:* ]]; then
  echo "usage: $0 <image:tag>   (an exact tag such as sha-1a2b3c4, never latest)" >&2
  exit 2
fi

ROOT="${SUPPORTIO_ROOT:-/opt/supportio}"
cd "$ROOT"
exec 9>/tmp/supportio-deploy.lock
flock -n 9 || { echo "another deploy is running" >&2; exit 1; }

ENV_FILE=.env.production
[[ -f "$ENV_FILE" ]] || { echo "$ROOT/$ENV_FILE is missing" >&2; exit 1; }
C="docker compose --env-file $ENV_FILE -f docker-compose.prod.yml"

PREV_IMAGE="$(grep -E '^APP_IMAGE=' "$ENV_FILE" | cut -d= -f2- || true)"
DOMAIN="$(grep -E '^APP_DOMAIN=' "$ENV_FILE" | cut -d= -f2-)"

echo "==> backup"
./scripts/backup-postgres.sh

echo "==> switching $PREV_IMAGE -> $NEW_IMAGE"
if grep -qE '^APP_IMAGE=' "$ENV_FILE"; then
  sed -i "s|^APP_IMAGE=.*|APP_IMAGE=${NEW_IMAGE}|" "$ENV_FILE"
else
  echo "APP_IMAGE=${NEW_IMAGE}" >> "$ENV_FILE"
fi
echo "PREV_IMAGE=${PREV_IMAGE}" > .last-release
echo "DEPLOYED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> .last-release

echo "==> pull"
$C pull backend

echo "==> migrations"
$C run --rm --no-deps backend node dist/db/migrate.js

echo "==> restart"
$C up -d --remove-orphans

echo "==> waiting for /ready"
for i in $(seq 1 45); do
  if $C exec -T backend node -e "fetch('http://127.0.0.1:3000/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    break
  fi
  if [[ "$i" == 45 ]]; then
    echo "backend never became ready; roll back with ./scripts/rollback.sh" >&2
    $C logs --tail 80 backend >&2 || true
    exit 1
  fi
  sleep 2
done

echo "==> smoke test"
./scripts/smoke.sh "https://${DOMAIN}"
echo "deployed ${NEW_IMAGE}"

#!/usr/bin/env bash
# Deploys one image to the production stack (plan §14.3).
#
#   ./scripts/deploy.sh ghcr.io/<owner>/supportio@sha256:<64 hex>
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
if [[ ! "$NEW_IMAGE" =~ ^ghcr\.io/[a-z0-9_.-]+/[a-z0-9_.-]+@sha256:[0-9a-f]{64}$ ]]; then
  echo "usage: $0 <ghcr-image@sha256:digest>" >&2
  exit 2
fi

ROOT="${SUPPORTIO_ROOT:-/opt/supportio}"
cd "$ROOT"
exec 9>/tmp/supportio-deploy.lock
flock -n 9 || { echo "another deploy is running" >&2; exit 1; }

ENV_FILE=.env.production
[[ -f "$ENV_FILE" ]] || { echo "$ROOT/$ENV_FILE is missing" >&2; exit 1; }
C="docker compose --env-file $ENV_FILE -f docker-compose.prod.yml"

env_value() { grep -E "^$1=" "$ENV_FILE" | tail -n1 | cut -d= -f2-; }
COSIGN_CERTIFICATE_IDENTITY="$(env_value COSIGN_CERTIFICATE_IDENTITY)"
[[ -n "$COSIGN_CERTIFICATE_IDENTITY" ]] || {
  echo "COSIGN_CERTIFICATE_IDENTITY is required" >&2
  exit 1
}
command -v cosign >/dev/null || { echo "cosign is required on the deploy host" >&2; exit 1; }

echo "==> verify signature and exact GitHub Actions identity"
cosign verify \
  --certificate-identity "$COSIGN_CERTIFICATE_IDENTITY" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  "$NEW_IMAGE" >/dev/null

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
export DB_USER="$(env_value DB_MIGRATION_USER)"
export DB_PASSWORD="$(env_value DB_MIGRATION_PASSWORD)"
[[ -n "$DB_USER" && -n "$DB_PASSWORD" ]] || {
  echo "DB_MIGRATION_USER and DB_MIGRATION_PASSWORD are required" >&2
  exit 1
}
$C run --rm --no-deps -e DB_USER -e DB_PASSWORD backend node dist/db/migrate.js

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

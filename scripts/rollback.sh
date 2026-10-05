#!/usr/bin/env bash
# Returns to the image that ran before the last deploy (plan §14.4).
#
#   ./scripts/rollback.sh            the image recorded in .last-release
#   ./scripts/rollback.sh <image>    a specific earlier image
#
# Migrations are not reversed: they are written to stay compatible with the
# previous release, which is what makes this safe.
set -euo pipefail

ROOT="${SUPPORTIO_ROOT:-/opt/supportio}"
cd "$ROOT"
exec 9>/tmp/supportio-deploy.lock
flock -n 9 || { echo "a deploy is running" >&2; exit 1; }

ENV_FILE=.env.production
C="docker compose --env-file $ENV_FILE -f docker-compose.prod.yml"

TARGET="${1:-}"
if [[ -z "$TARGET" ]]; then
  [[ -f .last-release ]] || { echo "no .last-release; pass the image to return to" >&2; exit 1; }
  TARGET="$(grep -E '^PREV_IMAGE=' .last-release | cut -d= -f2-)"
fi
[[ -n "$TARGET" ]] || { echo "the previous image is unknown; pass it explicitly" >&2; exit 1; }

CURRENT="$(grep -E '^APP_IMAGE=' "$ENV_FILE" | cut -d= -f2-)"
echo "==> rolling back $CURRENT -> $TARGET"
sed -i "s|^APP_IMAGE=.*|APP_IMAGE=${TARGET}|" "$ENV_FILE"
echo "PREV_IMAGE=${CURRENT}" > .last-release
echo "ROLLED_BACK_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> .last-release

$C pull backend
$C up -d --remove-orphans

for i in $(seq 1 45); do
  if $C exec -T backend node -e "fetch('http://127.0.0.1:3000/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    break
  fi
  [[ "$i" == 45 ]] && { echo "backend never became ready" >&2; $C logs --tail 80 backend >&2 || true; exit 1; }
  sleep 2
done

DOMAIN="$(grep -E '^APP_DOMAIN=' "$ENV_FILE" | cut -d= -f2-)"
./scripts/smoke.sh "https://${DOMAIN}"
echo "rolled back to ${TARGET}"

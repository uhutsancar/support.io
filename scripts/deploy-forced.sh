#!/usr/bin/env bash
# The only thing the CI deploy key may run (plan v10 INF-03).
#
# In ~deploy/.ssh/authorized_keys on the server, the key GitHub Actions uses
# is pinned to this script:
#
#   command="/opt/supportio/scripts/deploy-forced.sh",restrict ssh-ed25519 AAAA… ci-deploy
#
# so whatever the client asks for arrives here in SSH_ORIGINAL_COMMAND, and
# only "deploy <exact image>" is ever run — no shell, no other command, no
# port forwarding (restrict).
set -euo pipefail

request="${SSH_ORIGINAL_COMMAND:-}"
pattern='^deploy (ghcr\.io/[a-z0-9._-]+/supportio:sha-[0-9a-f]{7,40})$'
if [[ ! "$request" =~ $pattern ]]; then
  echo "refused: only 'deploy ghcr.io/<owner>/supportio:sha-<commit>' is allowed" >&2
  logger -t supportio-deploy "refused: ${request:0:200}" 2>/dev/null || true
  exit 1
fi
image="${BASH_REMATCH[1]}"
logger -t supportio-deploy "deploying $image" 2>/dev/null || true
exec "$(dirname "$(readlink -f "$0")")/deploy.sh" "$image"

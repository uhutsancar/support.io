#!/usr/bin/env bash
# The minimum a live deployment must answer (plan §14.3, v10 SEC-11):
#
#   /health            200
#   /ready             200
#   /                  an HTML page (the SPA, not a JSON stub)
#   /widget.js         served as JavaScript
#   /api/auth/me       401 without a session
#   security headers   HSTS, nosniff, CSP with a report endpoint, Referrer-
#                      and Permissions-Policy present; Server and
#                      X-Powered-By absent
#   security.txt       /.well-known/security.txt answers 200
#
#   ./scripts/smoke.sh https://app.example.com
set -euo pipefail

BASE="${1:?usage: $0 https://your-domain}"
BASE="${BASE%/}"
fail=0

check() {
  local name="$1" ok="$2"
  if [[ "$ok" == "yes" ]]; then echo "  ok    $name"; else echo "  FAIL  $name"; fail=1; fi
}

code() { curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$1"; }
ctype() { curl -s -o /dev/null -w '%{content_type}' --max-time 15 "$1"; }

echo "smoke test: $BASE"
[[ "$(code "$BASE/health")" == 200 ]] && check "/health 200" yes || check "/health 200" no
[[ "$(code "$BASE/ready")" == 200 ]] && check "/ready 200" yes || check "/ready 200" no
[[ "$(ctype "$BASE/")" == text/html* ]] && check "/ serves HTML" yes || check "/ serves HTML" no
[[ "$(ctype "$BASE/widget.js")" == *javascript* ]] && check "/widget.js is JavaScript" yes || check "/widget.js is JavaScript" no
[[ "$(code "$BASE/api/auth/me")" == 401 ]] && check "/api/auth/me 401 without a session" yes || check "/api/auth/me 401 without a session" no
[[ "$(code "$BASE/.well-known/security.txt")" == 200 ]] && check "/.well-known/security.txt 200" yes || check "/.well-known/security.txt 200" no

# Headers of the panel's own page, lower-cased, one per line.
headers="$(curl -s -D - -o /dev/null --max-time 15 "$BASE/" | tr -d '\r' | tr '[:upper:]' '[:lower:]')"
has() { grep -q "^$1:" <<<"$headers"; }

for name in strict-transport-security x-content-type-options content-security-policy referrer-policy permissions-policy; do
  has "$name" && check "header $name present" yes || check "header $name present" no
done
grep -q '^content-security-policy:.*report-uri' <<<"$headers" &&
  check "CSP names a report endpoint" yes || check "CSP names a report endpoint" no
for name in server x-powered-by; do
  has "$name" && check "header $name absent" no || check "header $name absent" yes
done

exit "$fail"

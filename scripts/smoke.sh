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

# --- plan v10 TST-05 -------------------------------------------------------

widget_headers="$(curl -s -D - -o /dev/null --max-time 15 "$BASE/widget/v4/widget.js" | tr -d '\r' | tr '[:upper:]' '[:lower:]')"
grep -q '^http/[0-9.]* 200' <<<"$widget_headers" && check "/widget/v4/widget.js 200" yes || check "/widget/v4/widget.js 200" no
grep -q '^content-type:.*javascript' <<<"$widget_headers" &&
  check "/widget/v4/widget.js is JavaScript" yes || check "/widget/v4/widget.js is JavaScript" no
grep -q '^cache-control:.*max-age=300' <<<"$widget_headers" &&
  check "/widget/v4/widget.js short cache" yes || check "/widget/v4/widget.js short cache" no
hash="$(curl -s --max-time 15 "$BASE/widget-version.json" | grep -o '"hash":"[0-9a-f]\{12\}"' | cut -d'"' -f4 || true)"
if [[ -n "$hash" ]]; then
  curl -s -D - -o /dev/null --max-time 15 "$BASE/widget/v4/widget.$hash.js" | tr '[:upper:]' '[:lower:]' |
    grep -q '^cache-control:.*immutable' &&
    check "hashed widget immutable" yes || check "hashed widget immutable" no
fi

plans="$(curl -s --max-time 15 "$BASE/api/plans")"
[[ "$(ctype "$BASE/api/plans")" == application/json* && "$plans" == *'"plans"'* ]] &&
  check "/api/plans JSON" yes || check "/api/plans JSON" no

handshake="$(curl -s --max-time 15 "$BASE/socket.io/?EIO=4&transport=polling")"
[[ "$handshake" == 0\{* ]] && check "socket polling handshake" yes || check "socket polling handshake" no

robots="$(curl -s --max-time 15 "$BASE/robots.txt")"
if grep -qF "Sitemap: $BASE/sitemap.xml" <<<"$robots"; then
  check "robots.txt names this domain" yes
  curl -s --max-time 15 "$BASE/sitemap.xml" | grep -qF "<loc>$BASE/" &&
    check "sitemap.xml on this domain" yes || check "sitemap.xml on this domain" no
elif grep -qx 'Disallow: /' <<<"$robots"; then
  check "robots.txt: nothing indexed (staging, SITE_NOINDEX)" yes
else
  check "robots.txt names this domain" no
fi

[[ "$(code "$BASE/internal/metrics")" == 404 ]] &&
  check "/internal/metrics 404 from outside" yes || check "/internal/metrics 404 from outside" no

exit "$fail"

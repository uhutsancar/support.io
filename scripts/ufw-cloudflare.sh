#!/usr/bin/env bash
# Lets ports 80 and 443 accept connections from Cloudflare only (plan v10
# SEC-13). Anyone who finds the server's address and skips Cloudflare — and
# with it the WAF, the rate limits and the TLS settings — gets no answer.
#
# Two layers, because Docker publishes Caddy's ports past UFW:
#   UFW          80/tcp, 443/tcp and 443/udp allowed from Cloudflare's ranges
#                only (for anything the host itself listens on)
#   DOCKER-USER  the chain Docker consults before its own rules: traffic to a
#                container's 80/443 that does not come from Cloudflare (or
#                from the Docker networks themselves) is dropped. Written to
#                /etc/ufw/after.rules and after6.rules between markers, so
#                `ufw reload` keeps it and --revert removes it.
#
# Before running it: Caddy must have a Cloudflare Origin CA certificate
# (runbook §2) — a Let's Encrypt renewal cannot reach the server any more —
# and the DNS record must be proxied (orange cloud).
#
#   sudo ./scripts/ufw-cloudflare.sh --dry-run   print what would be written
#   sudo ./scripts/ufw-cloudflare.sh --apply     write it and reload UFW
#   sudo ./scripts/ufw-cloudflare.sh --revert    back to 80/443 open to all
#
# Testing it (runbook §2): from a machine outside Cloudflare,
#   curl -m 5 -k https://<server IP>/health     → times out
#   curl -m 5 https://<your domain>/health      → {"status":"ok"}
# and `sudo iptables -L DOCKER-USER -n -v` shows the drops counting up.
#
# Cloudflare's ranges change rarely; run --apply again after a change
# (https://www.cloudflare.com/ips/), e.g. monthly from cron.
set -euo pipefail

MODE="${1:-}"
case "$MODE" in --dry-run | --apply | --revert) ;; *)
  echo "usage: $0 --dry-run | --apply | --revert" >&2
  exit 2
  ;;
esac

BEGIN='# BEGIN SUPPORTIO-CLOUDFLARE'
END='# END SUPPORTIO-CLOUDFLARE'
RULES4=/etc/ufw/after.rules
RULES6=/etc/ufw/after6.rules

if [[ "$MODE" != "--dry-run" && "$(id -u)" -ne 0 ]]; then
  echo "run as root (sudo)" >&2
  exit 1
fi

# Removes our block from a rules file, leaving the rest as it was.
strip_block() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  sed -i "/^$BEGIN\$/,/^$END\$/d" "$file"
}

if [[ "$MODE" == "--revert" ]]; then
  strip_block "$RULES4"
  strip_block "$RULES6"
  # The comment marks every rule this script added.
  while read -r num; do
    ufw --force delete "$num" >/dev/null
  done < <(ufw status numbered | grep 'supportio-cloudflare' | sed -E 's/^\[ *([0-9]+)\].*/\1/' | sort -rn)
  ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp
  ufw reload
  # Docker refills DOCKER-USER with a bare RETURN on its own restart; do it now.
  if iptables -F DOCKER-USER 2>/dev/null; then iptables -A DOCKER-USER -j RETURN; fi
  if ip6tables -F DOCKER-USER 2>/dev/null; then ip6tables -A DOCKER-USER -j RETURN; fi
  echo "reverted: 80/443 are open to everyone again"
  exit 0
fi

fetch() {
  local list
  list="$(curl -fsS --max-time 20 "$1")"
  # A truncated or empty answer must never become an empty allow list.
  if [[ "$(wc -l <<<"$list")" -lt 5 ]] || grep -qvE '^[0-9a-fA-F:.]+/[0-9]+$' <<<"$list"; then
    echo "unexpected answer from $1; nothing changed" >&2
    exit 1
  fi
  echo "$list"
}

V4="$(fetch https://www.cloudflare.com/ips-v4)"
V6="$(fetch https://www.cloudflare.com/ips-v6)"

# The DOCKER-USER block for one address family.
docker_block() {
  local ranges="$1" private="$2"
  echo "$BEGIN"
  echo '*filter'
  echo ':DOCKER-USER - [0:0]'
  echo '-A DOCKER-USER -m conntrack --ctstate RELATED,ESTABLISHED -j RETURN'
  for net in $private; do
    echo "-A DOCKER-USER -s $net -j RETURN"
  done
  for net in $ranges; do
    echo "-A DOCKER-USER -s $net -p tcp -m multiport --dports 80,443 -j RETURN"
    echo "-A DOCKER-USER -s $net -p udp --dport 443 -j RETURN"
  done
  echo '-A DOCKER-USER -p tcp -m multiport --dports 80,443 -j DROP'
  echo '-A DOCKER-USER -p udp --dport 443 -j DROP'
  echo '-A DOCKER-USER -j RETURN'
  echo 'COMMIT'
  echo "$END"
}

BLOCK4="$(docker_block "$V4" '10.0.0.0/8 172.16.0.0/12 192.168.0.0/16 127.0.0.0/8')"
BLOCK6="$(docker_block "$V6" 'fc00::/7 ::1/128')"

if [[ "$MODE" == "--dry-run" ]]; then
  echo "UFW: allow 80/tcp, 443/tcp, 443/udp from $(wc -l <<<"$V4") IPv4 and $(wc -l <<<"$V6") IPv6 Cloudflare ranges; remove the open 80/443 rules"
  echo
  echo "== $RULES4"
  echo "$BLOCK4"
  echo
  echo "== $RULES6"
  echo "$BLOCK6"
  exit 0
fi

# Keep SSH reachable whatever happens below.
ufw allow 22/tcp >/dev/null

# Allow Cloudflare first, then close the open rules, so there is no moment
# with nothing allowed.
for net in $V4 $V6; do
  ufw allow proto tcp from "$net" to any port 80,443 comment 'supportio-cloudflare' >/dev/null
  ufw allow proto udp from "$net" to any port 443 comment 'supportio-cloudflare' >/dev/null
done
for rule in 80/tcp 443/tcp 443/udp 80 443; do
  ufw --force delete allow "$rule" >/dev/null 2>&1 || true
done

strip_block "$RULES4"
strip_block "$RULES6"
printf '\n%s\n' "$BLOCK4" >>"$RULES4"
printf '\n%s\n' "$BLOCK6" >>"$RULES6"
ufw reload

echo "applied: 80/443 accept Cloudflare only ($(wc -l <<<"$V4") IPv4, $(wc -l <<<"$V6") IPv6 ranges)"
echo "now test from outside Cloudflare: curl -m 5 -k https://<server IP>/health must time out"

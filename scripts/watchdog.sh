#!/usr/bin/env bash
# Threshold alarms without an external service (plan v10 OBS-04). Run from
# cron every five minutes; each problem is sent to ALERT_WEBHOOK_URL at most
# once an hour, and once more when it clears.
#
#   disk        a filesystem holding / or Docker's data above DISK_ALERT_PCT (80)
#   memory      used memory (without cache) above MEM_ALERT_PCT (90)
#   services    a compose service not running, or running but unhealthy
#   ready       the API's /ready does not answer 200 (asked inside the network)
#   backup      the last successful backup is older than 26 hours, or unknown
#   database    PostgreSQL connections above DB_CONN_ALERT_PCT (80) of max
#   certificate the certificate on :443 expires within 14 days
#
# Settings, from .env.production:
#   ALERT_WEBHOOK_URL   receives POST {"text": "…", "content": "…"}: a Slack
#                       incoming webhook, a Discord webhook, or Telegram's
#                       https://api.telegram.org/bot<token>/sendMessage?chat_id=<id>.
#                       Empty: problems are only printed (cron log).
#   APP_DOMAIN          for the certificate check
#
# Cron (UTC):
#   */5 * * * *  /opt/supportio/scripts/watchdog.sh >> /var/log/supportio-watchdog.log 2>&1
#
#   ./scripts/watchdog.sh --test   sends one test alert and exits
set -uo pipefail

ROOT="${SUPPORTIO_ROOT:-/opt/supportio}"
cd "$ROOT" || exit 1
ENV_FILE=.env.production
STATE_DIR="${WATCHDOG_STATE_DIR:-/var/lib/supportio/watchdog}"
STATUS_DIR="${BACKUP_STATUS_DIR:-/var/lib/supportio/status}"
REPEAT_SECONDS=3600

env_value() { grep -E "^$1=" "$ENV_FILE" 2>/dev/null | tail -n1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }

WEBHOOK="$(env_value ALERT_WEBHOOK_URL)"
DOMAIN="$(env_value APP_DOMAIN)"
DB_USER="$(env_value DB_USER)"; DB_USER="${DB_USER:-support_user}"
DB_NAME="$(env_value DB_NAME)"; DB_NAME="${DB_NAME:-supportchat}"
DISK_PCT="${DISK_ALERT_PCT:-80}"
MEM_PCT="${MEM_ALERT_PCT:-90}"
DB_PCT="${DB_CONN_ALERT_PCT:-80}"
HOST="$(hostname)"
C=(docker compose --env-file "$ENV_FILE" -f docker-compose.prod.yml)

mkdir -p "$STATE_DIR"

json_escape() { sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | tr '\n' ' '; }

send() {
  local text="[supportio ${HOST}] $1"
  echo "$(date -u +%FT%TZ) $text"
  [[ -n "$WEBHOOK" ]] || return 0
  local body
  body="$(printf '%s' "$text" | json_escape)"
  curl -fsS --max-time 10 -H 'Content-Type: application/json' \
    -d "{\"text\":\"$body\",\"content\":\"$body\"}" "$WEBHOOK" >/dev/null ||
    echo "$(date -u +%FT%TZ) could not reach ALERT_WEBHOOK_URL" >&2
}

# problem <check> <message>: alerts now, then at most once an hour.
problem() {
  local file="$STATE_DIR/$1" now
  now="$(date +%s)"
  if [[ -f "$file" ]] && (( now - $(cat "$file") < REPEAT_SECONDS )); then return; fi
  echo "$now" >"$file"
  send "PROBLEM $1: $2"
}

# fine <check>: says once that a problem cleared.
fine() {
  local file="$STATE_DIR/$1"
  if [[ -f "$file" ]]; then
    rm -f "$file"
    send "OK $1: back to normal"
  fi
}

if [[ "${1:-}" == "--test" ]]; then
  send "test alert from scripts/watchdog.sh — the webhook works"
  exit 0
fi

# disk
worst=0; where=""
for path in / /var/lib/docker; do
  [[ -e "$path" ]] || continue
  pct="$(df -P "$path" | awk 'NR==2 {gsub("%","",$5); print $5}')"
  if (( pct > worst )); then worst=$pct; where=$path; fi
done
if (( worst > DISK_PCT )); then problem disk "${where} is ${worst}% full (limit ${DISK_PCT}%)"; else fine disk; fi

# memory (MemAvailable counts reclaimable cache as free)
total="$(awk '/^MemTotal:/ {print $2}' /proc/meminfo)"
avail="$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)"
used=$(( (total - avail) * 100 / total ))
if (( used > MEM_PCT )); then problem memory "${used}% of memory in use (limit ${MEM_PCT}%)"; else fine memory; fi

# services (Docker itself not answering is a problem too)
if listing="$("${C[@]}" ps -a --format '{{.Service}} {{.State}} {{.Health}}' 2>/dev/null)" &&
  [[ -n "$listing" ]]; then
  bad="$(awk '$2 != "running" || ($3 != "" && $3 != "healthy") {print $1 " (" $2 ($3 != "" ? ", " $3 : "") ")"}' <<<"$listing" | paste -sd ' ' -)"
  if [[ -n "$bad" ]]; then problem services "not healthy: $bad"; else fine services; fi
else
  problem services "docker compose ps did not answer"
fi

# ready, from inside the network
if "${C[@]}" exec -T backend node -e \
  "fetch('http://127.0.0.1:3000/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
  >/dev/null 2>&1; then
  fine ready
else
  problem ready "/ready does not answer 200"
fi

# backup age
if [[ -f "$STATUS_DIR/backup-last-success" ]]; then
  age=$(( $(date +%s) - $(cat "$STATUS_DIR/backup-last-success") ))
  if (( age > 26 * 3600 )); then
    problem backup "last successful backup $(( age / 3600 )) hours ago"
  else
    fine backup
  fi
else
  problem backup "no successful backup recorded ($STATUS_DIR/backup-last-success)"
fi

# database connections
db_pct="$("${C[@]}" exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -tAc \
  "SELECT count(*) * 100 / current_setting('max_connections')::int FROM pg_stat_activity" 2>/dev/null | tr -d '[:space:]')"
if [[ -z "$db_pct" ]]; then
  problem database "PostgreSQL did not answer"
elif (( db_pct > DB_PCT )); then
  problem database "${db_pct}% of max_connections in use (limit ${DB_PCT}%)"
else
  fine database
fi

# certificate
if [[ -n "$DOMAIN" ]]; then
  end="$(echo | openssl s_client -connect 127.0.0.1:443 -servername "$DOMAIN" 2>/dev/null |
    openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)"
  if [[ -z "$end" ]]; then
    problem certificate "no certificate answered on :443 for $DOMAIN"
  else
    days=$(( ($(date -d "$end" +%s) - $(date +%s)) / 86400 ))
    if (( days < 14 )); then problem certificate "expires in $days days ($end)"; else fine certificate; fi
  fi
fi

exit 0

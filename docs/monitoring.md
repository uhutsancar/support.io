# Monitoring

How you hear about a problem before a customer does. Three layers, each
useful without the others:

- **Outside**: an uptime service checks the public addresses every minute.
- **On the server**: `scripts/watchdog.sh` checks disk, memory, services,
  backups, the database and the certificate every five minutes.
- **In the application**: error tracking (Sentry-compatible, optional) and
  `/internal/metrics` for a scraper on the Docker network.

Replace `app.example.com` with the real domain everywhere below.

## Uptime checks (outside) — [you]

Create these in UptimeRobot, Better Stack or healthchecks.io (free tiers are
enough). Alert by e-mail plus Telegram, Slack or SMS.

| Check                                                        | Every | Expect                                                                                           |
| ------------------------------------------------------------ | ----- | ------------------------------------------------------------------------------------------------ |
| `https://app.example.com/health`                             | 1 min | 200, body `{"status":"ok"}`                                                                      |
| `https://app.example.com/ready`                              | 1 min | 200, body `{"status":"ready"}` (503 means the database is not answering or a deploy is draining) |
| `https://app.example.com/widget/v4/widget.js`                | 5 min | 200, `content-type: application/javascript`                                                      |
| `https://app.example.com/socket.io/?EIO=4&transport=polling` | 5 min | 200, body starts with `0{"sid":` (the realtime handshake)                                        |
| `https://app.example.com/`                                   | 5 min | 200, HTML; keyword `Support.io`                                                                  |
| Backup heartbeat (healthchecks.io)                           | daily | `BACKUP_PING_URL` pinged by `backup-postgres.sh`; alert if missing for 26 h                      |

A public status page (`status.app.example.com`) can come from the same
service; link it from the panel footer and the docs once it exists.

## On the server: watchdog

```bash
# once, to check the webhook
/opt/supportio/scripts/watchdog.sh --test
# cron (crontab -e as deploy)
*/5 * * * *  /opt/supportio/scripts/watchdog.sh >> /var/log/supportio-watchdog.log 2>&1
```

`ALERT_WEBHOOK_URL` in `.env.production` receives `{"text": …, "content": …}`
(Slack and Discord webhooks read one of them; for Telegram use
`https://api.telegram.org/bot<token>/sendMessage?chat_id=<chat id>`).

| Check       | Alerts when                                                           |
| ----------- | --------------------------------------------------------------------- |
| disk        | `/` or `/var/lib/docker` above 80 % (`DISK_ALERT_PCT`)                |
| memory      | used memory, cache excluded, above 90 % (`MEM_ALERT_PCT`)             |
| services    | a compose service not running or not healthy, or Docker not answering |
| ready       | `/ready` inside the network is not 200                                |
| backup      | the last successful backup is older than 26 h, or none is recorded    |
| database    | PostgreSQL connections above 80 % of `max_connections`                |
| certificate | the certificate on :443 expires within 14 days                        |

Each problem is sent once, repeated at most hourly while it lasts, and
followed by one "back to normal". State lives in
`/var/lib/supportio/watchdog/`.

## Error tracking

Optional. Set `SENTRY_DSN` to a project in Sentry's **EU region**
(sentry.io → new project → Node.js → copy the DSN), or to a self-hosted
GlitchTip. Without it nothing is sent anywhere.

What leaves the server, and nothing else: the error's type, message and
stack with e-mail addresses masked and tokens and keys removed, relative file
names, method and path without the query, the request id, environment and
release (the git sha). No cookies, headers, bodies, IP addresses, user ids or
message text. The panel and the widget report through our own API, not a
third-party script. At most 30 events a minute per process.

Sentry is a sub-processor: add it to the privacy policy's list
(`docs/legal/kvkk-transfer-checklist.md`).

## Metrics

`GET /internal/metrics` (Prometheus text) answers only on the Docker network:
Caddy returns 404 for `/internal/*`, and the route refuses anything that came
through a proxy. From the server:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml \
  exec backend node -e "fetch('http://127.0.0.1:3000/internal/metrics').then(r=>r.text()).then(console.log)"
```

| Metric                                                                    | Watch for                                                     |
| ------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `supportio_event_loop_delay_seconds{quantile="0.99"}`                     | above 0.1 s for minutes: the process is saturated             |
| `supportio_db_pool_connections{state="waiting"}`                          | above 0 for minutes: raise `DB_POOL_MAX` or find a slow query |
| `supportio_operation_seconds{operation="message.insert",quantile="0.95"}` | above 0.3 s                                                   |
| `supportio_sockets{namespace="widget"}`                                   | sudden drops: a widget or proxy problem                       |
| `supportio_assistant_calls_total{outcome!="ok"}`                          | rising: quota or outage; visitors are handed to people        |
| `supportio_assistant_available`                                           | 0 while it should answer: model check or kill switch          |
| `supportio_mail_total{outcome="failed"}`                                  | above 0: SMTP problem                                         |
| `supportio_backup_last_success_timestamp_seconds`                         | older than 26 h                                               |

With `METRICS_TOKEN` set, send `Authorization: Bearer <token>`. A dashboard
later (Grafana Cloud free tier with Grafana Alloy) can scrape the same
address; until then the watchdog is the alarm.

## Logs

The containers log JSON lines, 20 MB × 5 per container, gone with the
container. `scripts/ship-logs.sh` copies the last day, gzipped, to
`LOG_REMOTE` (an rclone remote such as `r2:supportio-logs`; private bucket,
30-day lifecycle rule):

```bash
15 0 * * *  /opt/supportio/scripts/ship-logs.sh >> /var/log/supportio-logs.log 2>&1
```

Every API answer carries `X-Request-Id`; an unexpected failure's answer has
it in the body, and the panel shows its first eight characters as
"Destek kodu". Find the request:

```bash
docker compose ... logs backend | grep '"requestId":"<code>'
```

Logs hold no passwords, tokens, cookies, API keys or message text, and
e-mail addresses are masked.

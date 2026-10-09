# Load test

`backend/scripts/loadtest.ts` (plan §18). Run it against an idle stack:

```bash
docker compose up -d
cd backend && npm run loadtest                       # 100, 500, 1000 sockets
npm run loadtest -- --stages 200 --rate 20 --seconds 30
```

Each stage connects N visitors the way the widget does (`POST
/api/widget/session` → `/widget` socket → join) and keeps them connected.
With all of them online it sends a burst of messages (default 50 per second
for 10 seconds, spread over the visitors); each message counts once the
server acknowledges it, which happens after the database write.

Measured:

| where  | what                                                                                                         |
| ------ | ------------------------------------------------------------------------------------------------------------ |
| client | connect + join time, acknowledgement time, errors                                                            |
| server | message insert time, event-loop delay, CPU and RSS of the process (`GET /api/dev/metrics`, development only) |
| Docker | CPU and memory of the backend and postgres containers, sampled mid-burst                                     |

## What the numbers are not

They describe the machine they were taken on, not production capacity.
The load generator ran on the same laptop as the stack, the backend ran in
development mode (`tsx`, one process, `DB_POOL_MAX` 20) and every container
shared one Docker Desktop VM. Before quoting a capacity, run the same script
against staging on the production VPS.

The profile is heavier than real traffic in one way: at 500 and 1000
sockets each message is a visitor's first, so every one opens a
conversation (department routing, quota, ticket number, auto-assignment).
At 100 sockets one message in five opens a conversation.

## 2026-10-06, development stack

Intel i5-10300H (4 cores / 8 threads), 16 GB; Docker Desktop VM with 8 vCPU
and 7.7 GB; PostgreSQL 16, Redis 7. 50 messages/s for 10 s per stage.

| sockets | connect + join p50 / p95 |  ACK p50 / p95 / p99 | insert p50 / p95 | event loop p99 / max | errors |
| ------: | -----------------------: | -------------------: | ---------------: | -------------------: | -----: |
|     100 |           1132 / 2076 ms |    36 / 666 / 727 ms |      5.9 / 61 ms |           35 / 68 ms |      0 |
|     500 |           1016 / 1397 ms |   299 / 612 / 704 ms |       25 / 58 ms |           40 / 74 ms |      0 |
|    1000 |            924 / 1139 ms | 298 / 1512 / 1587 ms |      25 / 122 ms |          42 / 148 ms |      0 |

Backend process: about one core on average, RSS 163 → 250 MB from 100 to
1000 sockets. Postgres container: 47–120 % CPU during the bursts.

### What the first run found

The first run, with the same profile, broke down from 500 sockets: 55 of
500 visitors could not connect, 216 of 500 messages timed out, and at
1000 sockets alone the acknowledgement p95 was 4.1 s. `pg_stat_activity`
during the burst showed two rows every new conversation waited on:

- the single ticket-number counter, updated inside the intake transaction
  and so locked until each opener, on any organization, had committed;
- the organization's monthly usage row, locked at the start of the same
  transaction while every message of the organization was also counting on
  it, each waiter holding a pool connection.

The ticket number is now taken in its own statement before the transaction
and the usage row is counted last, so it stays locked only for the commit
(`services/conversationIntake.ts`). The table above is after that change;
the backend suite, which covers the exact quota under concurrent openers,
passes unchanged.

### Where the time goes now

Connect + join is about 1 s at the median because 50 visitors are
connecting at once: a widget session costs about seven queries (site,
verification, widget settings, FAQs, availability, plan). One visitor alone
connects in about 50 ms.

## 2026-10-07, reconnect storm, development stack

`backend/scripts/reconnect-storm.ts` (plan v10 PERF-06): visitors and agent
sockets are connected, the backend restarts as in a deploy, each visitor
writes once during the outage and re-sends under the same `clientMessageId`
until acknowledged — as the widget does — and the database is checked
afterwards. The clients use the widget's back-off: 1 s to 30 s, ±50 % jitter.

```bash
cd backend
npx tsx scripts/test-compose.ts scripts/reconnect-storm.ts \
  --visitors 300 --agents 20 --restart "docker compose -f ../docker-compose.yml restart backend"
```

Same laptop, development mode (the dev container rebuilds the widget and
starts through `tsx` on every start):

|                                    |                                                                 |
| ---------------------------------- | --------------------------------------------------------------- |
| clients                            | 300 visitors, 20 agent sockets                                  |
| `/ready` not 200                   | 46.9 s                                                          |
| visitors back                      | p50 52.0 s, p95 71.7 s, spread 42.9–73.1 s                      |
| agents back                        | p50 52.0 s, p95 72.6 s                                          |
| never back                         | 0                                                               |
| backend CPU, 30 s after            | avg 233 %, max 404 % (several cores; includes the dev start-up) |
| messages written during the outage | 300 sent, **0 lost, 0 stored twice**                            |

What it shows: nobody is left behind, the jitter spreads the return over
half a minute instead of one second, and the at-least-once re-send with the
unique `clientMessageId` keeps messages exactly once. What it does not
show: the downtime of a production deploy. Most of the 47 s is the
development container's start (widget build, `tsx` transpiling); the
production image starts `node dist/server.js` and runs migrations before
the switch (`scripts/deploy.sh`). The target — **≤ 15 s and no message
lost** — is to be measured on staging (below).

## Staging runs — [you] provide the server, then

Not run yet; no capacity sentence before these exist (plan v10 PERF-05,
PERF-06, PERF-07). The load generator runs on a **separate machine**, the
staging stack in production mode (`docker-compose.prod.yml`, `NODE_ENV=production`)
with `API_RATE_MAX`, `SOCKET_*` and `WIDGET_SESSION_RATE_MAX` raised for the
generator's address only for the duration.

| Run                 | Command                                                                                                                     | Record                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Load (PERF-05)      | `npm run loadtest -- --stages 100,500,1000,2000 --rate 50 --seconds 60`, then `--rate 100`                                  | CPU, RAM, event-loop p99, DB p95, ACK p95, errors per stage                                                  |
| Reconnect (PERF-06) | `reconnect-storm.ts --visitors 1000 --agents 20 --restart "ssh staging 'cd /opt/supportio && ./scripts/deploy.sh <image>'"` | downtime, return spread, CPU in the first 30 s, lost / doubled                                               |
| Soak (PERF-07)      | 300 visitors connected, 200 messages a minute, 24 h (`loadtest.ts --stages 300 --rate 3.4 --seconds 86400`)                 | RSS curve (`/internal/metrics`, every minute), event loop, DB connections; pass: RSS growth < 20 %, 0 errors |

During and after a run, the slowest queries (pg_stat_statements is loaded
in `docker-compose.prod.yml`):

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
SELECT round(mean_exec_time::numeric, 1) AS ms, calls, left(query, 120)
  FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 20;
```

Each one above 50 ms gets `EXPLAIN (ANALYZE, BUFFERS)` and, if an index
helps, a new migration. Then the capacity sentence, from these numbers only:
"On a 2 vCPU / 4 GB server: X concurrent visitors, Y messages a second,
acknowledgement p95 Z ms."

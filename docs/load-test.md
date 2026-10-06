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

| where  | what |
|--------|------|
| client | connect + join time, acknowledgement time, errors |
| server | message insert time, event-loop delay, CPU and RSS of the process (`GET /api/dev/metrics`, development only) |
| Docker | CPU and memory of the backend and postgres containers, sampled mid-burst |

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

| sockets | connect + join p50 / p95 | ACK p50 / p95 / p99 | insert p50 / p95 | event loop p99 / max | errors |
|--------:|-------------------------:|--------------------:|-----------------:|---------------------:|-------:|
| 100  | 1132 / 2076 ms | 36 / 666 / 727 ms   | 5.9 / 61 ms  | 35 / 68 ms  | 0 |
| 500  | 1016 / 1397 ms | 299 / 612 / 704 ms  | 25 / 58 ms   | 40 / 74 ms  | 0 |
| 1000 | 924 / 1139 ms  | 298 / 1512 / 1587 ms | 25 / 122 ms | 42 / 148 ms | 0 |

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

# Self-hosted assistant (Trendyol Asure 12B)

Support.io's AI runs on your own GPU: the model is downloaded once, served by
one vLLM container in 4-bit, and nothing — prompts, answers, customer data —
leaves the machine. There is no fallback to any hosted model: when the model
is down, conversations go to a person.

## What it does

| Where | What |
| --- | --- |
| Widget, site in **automatic replies** mode | Answers greetings, answers from the site's FAQ, looks up a signed-in customer's order in the shop's own system, politely declines anything out of scope, hands over to a person when asked, on a complaint, an action request, missing information or any doubt |
| Panel, **copilot** (and auto) mode | Summary, suggested reply, tone rewrite, translation, analysis, ask the knowledge base — suggestions only, never sent by themselves |

A site's mode is chosen in the panel: **Sites → AI settings** (off / copilot /
automatic replies). New and migrated sites start off.

## Hardware

One NVIDIA GPU with 12–16 GB of VRAM, 16 GB of RAM (32 GB recommended), about
40 GB of disk. On Windows, Docker Desktop with the WSL2 backend and the NVIDIA
driver. A smaller card does not fit the 12B model even in 4-bit; the app then
runs with AI off.

If the model does not fit, change these in `docker-compose.yml`, in this order,
and nothing else: `--max-num-seqs 2`, then `--max-model-len 3072`, then add
`--enforce-eager`.

## Setup

```bash
cp .env.example .env
```

In `.env`:

```dotenv
COMPOSE_PROFILES=ai
AI_ENABLED=true
AI_API_KEY=<openssl rand -hex 32>
AI_MODEL_REVISION=df1164d37f47080ba5fbc1ff4defa0c7a1a218a5
```

Download once (the model is under the Gemma Terms of Use, see `NOTICE`):

```bash
npm run ai:download          # prints AI_MODEL=asure-12b-df1164d
```

Put the printed `AI_MODEL` in `.env`, then:

```bash
docker compose up -d
```

Loading takes a few minutes. The panel shows "Model loading…" and enables the
AI controls by itself when it is ready; `GET /api/ai/status` says the same.

To free the GPU: `docker compose stop llm`, or remove `ai` from
`COMPOSE_PROFILES`. Chat and the inbox keep working.

## Settings

All in the root `.env`; `backend/.env` holds none of them.

| Variable | Default | |
| --- | --- | --- |
| `AI_ENABLED` | `false` | Platform switch |
| `AI_API_KEY` | — | Shared by the backend and vLLM, ≥ 32 characters |
| `AI_MODEL` | — | Model directory and served name |
| `AI_MODEL_REVISION` | — | Commit SHA to download; never `main` |
| `AI_AUTO_REPLY_ENABLED` | `false` | Platform switch for widget answers |
| `AI_BASE_URL` | `http://llm:8000/v1` | |
| `AI_TIMEOUT_MS` | `20000` | One model call |
| `AI_CONCURRENCY` | `2` | Model calls in flight per backend process |
| `AI_QUEUE_MAX_WAIT_MS` | `8000` | Longer than this → handoff |
| `ORDER_LOOKUP_TIMEOUT_MS` | `3000` | One call to a shop's order service |
| `HF_TOKEN` | — | Only if the download needs it; never in production |

A missing or wrong value turns AI off with one line in the log; the backend
still starts.

## What a shop has to do

### 1. Identify signed-in customers

In the panel, **Sites → AI settings → Integrations → Generate key**. The key is
shown once; keep it on your server. For a signed-in customer your server
computes

```
userHash = HMAC_SHA256(key, userId)   // hex
```

and the page calls

```js
SupportChat.identify({ userId, userHash, name, email });
```

Support.io accepts the id only when the hash checks out; otherwise the visitor
is anonymous. Orders are only ever looked up for a verified customer.

Rotating `JWT_SECRET` makes the stored keys unreadable (they are sealed with a
key derived from it): generate both keys again afterwards.

### 2. Answer order lookups

Give the service URL (https only; internal addresses are refused), generate the
signing key, switch the lookup on, and use **Test connection**. Support.io
sends:

```http
POST https://shop.example.com/support-io/orders
Content-Type: application/json
X-SupportIO-Timestamp: 1790000000
X-SupportIO-Signature: sha256=<hex HMAC_SHA256(signingKey, timestamp + "." + body)>

{"userId": "u_123", "orderNumber": "12345"}
```

`orderNumber` is `null` when the customer did not give one. Your service must
check the signature and that the timestamp is within five minutes, and return
only that user's orders:

```json
{"orders": [{"orderNumber": "12345", "status": "shipped", "statusText": "Kargoya verildi",
  "placedAt": "2026-09-20", "carrier": "Örnek Kargo", "trackingNumber": "TR123",
  "trackingUrl": "https://kargo.example.com/TR123", "estimatedDelivery": "2026-09-25"}]}
```

Any other field is dropped before the model sees it. No redirects, JSON only,
at most 64 KB, answered within 3 seconds.

## Demo

```bash
docker compose exec backend npm run db:seed -- --reset
docker compose exec -d backend npm run demo:orders
```

The demo site is wired to the demo order service. On `/demo?siteKey=demo-site-key-0000-1111-2222`
the developer panel's **Demo müşteri olarak giriş yap** signs in a customer with
orders (development only).

## Benchmark

```bash
AI_BASE_URL=http://127.0.0.1:8000/v1 npm run ai:bench      # add -- --e2e, -- --baseline
```

100 fictional scenarios in `golden/`, one at a time, then 20 requests at
concurrency 1, 2 and 4; under 15 minutes. The HTML report is written to
`.artifacts/reports/` (not committed).

## Production

Same `llm` service in `docker-compose.prod.yml`, without a published port.
Copy the model directory with `rsync` over SSH and check it against its
`manifest.json`; the production server never downloads. Roll out: database
backup → deploy with `AI_ENABLED=false` → start the model → `AI_ENABLED=true`,
sites on copilot → `AI_AUTO_REPLY_ENABLED=true` and one pilot site on auto.
To stop answers at once: `AI_AUTO_REPLY_ENABLED=false`.

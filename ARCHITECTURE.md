# Architecture

How this codebase is laid out, and why. Read this before adding a file — most
"where does this go?" questions are answered by the layer it belongs to.

The shape below is the result of a refactor whose goal was that a developer new
to the project can open any file and tell what it does without reading three
others first. Where a decision looks unusual, the file itself says why; this
document is the map, not the reasoning.

---

## The two workspaces

```
backend/        the API, the realtime server, and the embeddable widget
admin-panel/    the dashboard agents work in, and the marketing site
demo/           a static page for trying the widget locally
```

They are separate npm projects with separate `tsconfig`s and separate lint
configs. `package.json` at the root only delegates.

---

## backend/src — the layers

Each layer may use the ones below it and must not reach upward.

```
routes/  socket/       ← delivery: HTTP endpoints, socket events
services/              ← what the product does
domain/                ← the vocabulary: statuses, roles, SLA policy
models/                ← one file per table, declared not written
db/                    ← the relational runtime and hand-written SQL
config/                ← secrets, sessions, tokens, connections
http/  realtime/        ← the shared kernels the delivery layer is built on
```

### `domain/` — the vocabulary

`constants.ts` declares every status, priority, role, plan and message type
exactly once, with the runtime list and the TypeScript union derived from the
same literal. `types.ts` describes the shapes stored inside `json` columns.

Before this existed, the conversation statuses were spelled out as string
literals in the model, three routes, the socket handler and the automation
validator. Adding one meant finding every copy. Import from `../domain`.

### `models/` — the tables

Each file calls `defineModel(...)` with its columns, child tables and
references. It declares; it does not implement. The runtime that turns a
declaration into SQL is `db/model.ts`.

An enum column takes its list from `domain/constants.ts`, never a fresh literal.

### `db/` — storage

`model.ts` is the runtime: filters compile to indexed `WHERE` clauses, embedded
arrays become joins, references resolve with one batched query per path.
`queries.ts`, `inboxQueries.ts` and `analyticsQueries.ts` hold the hand-written
SQL for the places where a per-row access pattern would become an N+1.

A filter value of `undefined` throws rather than being dropped. That is
deliberate: dropping it widens the query in exactly the direction that leaks
data across tenants.

### `services/` — what the product does

Domain operations that more than one delivery path needs, or that are too large
to sit inside a handler:

| file | responsibility |
|---|---|
| `conversationIntake.ts` | opening a conversation from a visitor's first message |
| `departmentRouting.ts` | which department that message belongs to |
| `departmentStats.ts` | the SLA and workload counters a department keeps |
| `autoAssignment.ts` | choosing an agent, and handing work on when they go away |
| `slaSweeper.ts` | the **single** background SLA pass |
| `escalation.ts` | warnings and breach notifications |
| `conversationSla.ts` | recomputing SLA without letting one bad row break a page |
| `automationEngine.ts` / `automationTrigger.ts` | customer-defined rules |
| `proactiveEngine.ts` | visitor-behaviour triggers |
| `faqAutoResponse.ts` | answering from the FAQ before an agent arrives |
| `auditService.ts` | the audit trail, generated from one table of events |
| `identity.ts` | verifying the `userHash` a shop signs a signed-in customer with |
| `orderLookup.ts` | the signed, SSRF-guarded call to a shop's order service |
| `aiService.ts` | the agent copilot: summary, draft, tone, translation, analysis, knowledge answer |
| `ai/` | the self-hosted model: `vllmProvider` (the only backend, with the per-process concurrency limit), `prompts` (every instruction, versioned), `knowledge` (FAQ retrieval), `replyPolicy` (the rules checked in code before and after the model), `autoReply` (the widget's automatic answer, handoff and take-over) |

**The assistant.** A site in `auto` mode is answered by the model inside the
process that received the visitor's message — no queue. `composeReply()` is the
pure decision (pre-check → model → policy → optional order lookup); `answer()`
gathers its inputs and `deliver()` writes the reply in a short transaction that
re-checks, under a row lock, that nobody took the conversation over in the
meantime. `conversations.response_owner` says who answers now, independent of
who the conversation is assigned to. Setup and the shop contract: `ai/README.md`.

### `http/` — the HTTP kernel

Everything a route needs in order to contain only its own logic.

```ts
router.use(auth, requireOrganization);

router.get('/:siteId', asyncHandler(async (req, res) => {
  const site = await loadOwnedSite(req, req.params.siteId);
  res.json({ site });
}));
```

- **`asyncHandler`** — Express 4 does not await a handler, so a rejected promise
  inside one hangs the request. Wrapping once removes the try/catch that was
  repeated in 58 handlers.
- **`errors.ts`** — one error model. A handler reports failure by throwing:
  `badRequest`, `forbidden`, `notFound`, `conflict`, `unavailable`.
  `describeError` decides what the client is told, and never lets database text
  reach it.
- **`errorHandler`** — the last middleware. Must be registered after every route
  *and* after the static handlers.
- **`guards.ts`** — request-scoped authorization. `requireOrganization` is
  middleware; `orgId(req)` reads the tenant; `loadOwnedSite`,
  `loadOwnedConversation`, `loadOwnedDepartment`, `loadOwnedTeamMember` and
  `requireSiteOwnership` resolve a row *and* check it belongs to the caller,
  throwing `notFound` for every way the answer can be no.

A resource belonging to another tenant answers **404, not 403** — a 403 confirms
the id exists, which is what someone walking ids is trying to learn.

### `realtime/` — what the server tells the panel

`rooms.ts` builds the room names both sides agree on. `notifier.ts` turns each
broadcast into a named method with a typed payload, so a rename is a compile
error rather than a message delivered to an empty room.

Routes get one with `notifyAdmin(req)`, which returns `null` when there is no
socket server (a test, a script) so callers do not each write a null check.

### `socket/` — the realtime delivery layer

```
index.ts                  composition root: wiring only
auth.ts                   who is on an admin socket
context.ts                the authorised lookups every handler shares
handlers/widget.ts        the visitor's side
handlers/adminConversations.ts
handlers/adminPresence.ts
handlers/adminTeamChat.ts
types.ts                  the wire protocol
adapter.ts                the Redis adapter for multi-process deployments
```

`SocketContext` is the socket layer's equivalent of `http/guards.ts`:
`siteFor`, `conversationFor`, `widgetConversationFor`, `chatFor` and
`verifyAttachment`. A handler never queries by id on its own, and `ctx.guard`
wraps each listener so a throw cannot become an unhandled rejection.

### `config/` — the things that must be right

Sessions (`session.ts`), signed tokens (`tokens.ts`), password policy
(`passwords.ts`), CORS origins (`origins.ts`), the database pool (`pool.ts`).
Each file explains the decision it encodes. Read `tokens.ts` before touching
anything that signs or verifies.

### `widget/widget.ts`

The embeddable script, compiled by its own `tsconfig.widget.json` for the
browser. It runs on a customer's page, so it deliberately swallows errors rather
than throwing into their code or logging into their console — every one of those
catches says so.

---

## admin-panel/src

```
pages/                 one route each
components/            shared and feature-scoped markup
features/              feature-scoped hooks
contexts/              auth, socket, theme, language
hooks/                 useAsync, useAction
lib/                   format, statusStyles, color, session, runtime
services/              http.ts (transport) + api.ts (endpoints)
types/api.ts           the shapes the API returns
locales/               translations
```

### `services/`

`http.ts` owns the transport: credentials, the CSRF header, the short-lived GET
cache, the 401 redirect. `api.ts` is a list of endpoints and nothing else. A
write that invalidates reads declares it:

```ts
create: mutates('/sites', (data: Partial<Site>) => api.post('/sites', data))
```

### `hooks/useAsync.ts`

`useAsync` for loading, `useAction` for a user-triggered action. Both keep the
failure instead of discarding it, cancel on unmount, and ignore the result of a
superseded request. `errorMessage(error, fallback)` prefers what the API said
over a generic string — use it everywhere rather than reaching into
`error.response.data`.

### `lib/format.ts` and `lib/statusStyles.ts`

Formatters and Tailwind class tables, each declared once. `format.ts` turns
values into text; `statusStyles.ts` turns values into classes. Both distinguish
"never measured" (`—`) from zero, which the per-page copies they replaced did
not agree on.

### Types

`types/api.ts` is the single source for API shapes and editor form shapes. A
type declared inside a component body is invisible to every other file — put it
here, or export it from the component that owns it.

---

## Conventions

**Authorization fails closed.** A caller with no organization can read nothing.
Tenant filters go *inside* the query, never a comparison afterwards — loading a
row and then comparing skips the check entirely when the compared id is empty.

**Errors are reported, not swallowed.** An empty `catch` is indistinguishable
from a forgotten one. If ignoring a failure is right, say why in the block. The
linter enforces this (`no-empty` with `allowEmptyCatch: false`).

**A domain value is declared once.** Statuses, roles, plans, SLA defaults: add
to `domain/constants.ts` and import.

**Reads do not write.** SLA is computed in memory for display; persisting it is
the sweeper's job.

---

## Checks

```
npm run check     typecheck + lint, both workspaces
npm run lint
npm run format
npm run test:backend
```

Both workspaces compile under `strict` plus `noUnusedLocals`,
`noUnusedParameters`, `noImplicitReturns` and `useUnknownInCatchVariables`, and
both are lint-clean. The backend's end-to-end tests need the compose stack
running; see `backend/scripts/test-compose.ts`.

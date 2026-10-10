# Security remediation record

This record maps the 9 October 2026 review in the supplied `security.md` to
the implementation in this repository. The supplied document is treated as a
requirements and review artifact, not as executable authority. Production
deployment, production migrations, destructive data operations and live
attacks are outside this local implementation.

Baseline: `main` at `ab533a6878d040a8e101b484bc71ca787a669029`.

Local implementation verification completed on 10 October 2026.

## Finding status

| ID     | Implemented control                                                                                                                                                                                                                                                               | Primary evidence                                                                                                                                  |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-01 | Every admin and widget socket has expiry/max-life timers and periodic DB-backed reauthorization. Account, organization, site, role, seat, MFA and key changes publish room invalidations. Redis loss cannot permanently preserve access because local rechecks remain.            | `realtime/invalidation.ts`, `socket/context.ts`, `socket/auth.ts`, account/team/site deletion and mutation routes; socket/site-block/tenant tests |
| SEC-02 | Public account, member and agent DTOs use positive field lists. HTTP, socket participant data and streaming exports no longer serialize database rows by exclusion. Model JSON output also drops auth metadata.                                                                   | `security/accountDto.ts`, team/data-export routes, User/Team models; auth/team/tenant tests                                                       |
| SEC-03 | CRM read/write/delete, chat, upload/respond and seat permissions are explicit and shared by HTTP/socket paths.                                                                                                                                                                    | `middleware/rbac.ts`, deals/files/team-chat routes and socket handler; role and tenant tests                                                      |
| SEC-04 | Owner/admin access is organization-wide; restricted roles require explicit sites and an empty list means no access. Migration 0027 materializes the previous implicit access before policy activation.                                                                            | guards, socket context, scoped routes; migration 0027; tenant/team/plan tests                                                                     |
| SEC-05 | TOTP steps, recovery codes, disable and regeneration run inside PostgreSQL transactions with row locks.                                                                                                                                                                           | `services/mfa.ts`; parallel real-DB MFA tests                                                                                                     |
| SEC-06 | E-mail token consumption, address update, session-version bump and outstanding-token invalidation are one transaction; live sessions are invalidated after commit.                                                                                                                | `services/authTokens.ts`, account routes; parallel token and stale-session tests                                                                  |
| SEC-07 | User-authored regular expressions are no longer executed. Rules use bounded exact/prefix/contains semantics; legacy regex rules fail closed.                                                                                                                                      | proactive engine/routes; automation tests                                                                                                         |
| SEC-08 | OOXML ZIP directories, counts, sizes, required parts and relationships are bounded and checked. Macros, ActiveX, embeddings and external relationships fail closed. Images have pixel/frame limits and GIF is re-encoded to one frame. Legacy DOC/XLS is rejected without AV/CDR. | upload middleware; fake OOXML, signature and image tests                                                                                          |
| SEC-09 | Multipart ingress limits, process-wide upload concurrency, transactional daily site byte quotas, status records and orphan cleanup are present.                                                                                                                                   | upload middleware/files route, migrations 0025-0026, retention service/tests                                                                      |
| SEC-10 | A short-lived upload proof names the upload record, principal and widget session. First use atomically binds the record to a conversation; revoked/expired/deleted records cannot be opened. Attachment links last 15 minutes.                                                    | tokens/files/message intake, migration 0026; cross-visitor replay test                                                                            |
| SEC-11 | Widget configuration uses a strict nested schema, size/value/path bounds, no arbitrary CSS and own-property checks that reject prototype keys.                                                                                                                                    | `security/widgetConfigSchema.ts`, widget config routes/UI; widget schema test                                                                     |
| SEC-12 | CSRF values are HMAC-signed and bound to the session; unsafe cookie requests also require an allowed Origin. Unicode-safe constant-time comparison and production cookie/origin boot checks are present.                                                                          | session/origin/auth middleware; auth-security tests                                                                                               |
| SEC-13 | Outbound destinations use canonical IPv4/IPv6 classification, block special/mapped/translation/tunnel ranges, pin DNS results and refuse unsafe redirects.                                                                                                                        | `services/outboundUrl.ts`; outbound URL corpus                                                                                                    |
| SEC-14 | Remote PostgreSQL requires verified TLS with an explicit CA. URL SSL options cannot override policy. Production compose separates bootstrap/migration and runtime roles.                                                                                                          | DB pool/production checks, PostgreSQL init script and compose                                                                                     |
| SEC-15 | Release builds once, scans/signs the exact pushed digest and records the SBOM. Deploy accepts an immutable digest and verifies cosign issuer/identity before backup or migration.                                                                                                 | release/deploy workflows and `scripts/deploy.sh`                                                                                                  |
| SEC-16 | Existing and new knowledge is unapproved by default. Only owner-approved, site-scoped sources are retrieved for the model and content is redacted before egress.                                                                                                                  | migration 0025, knowledge routes/services, assistant tests                                                                                        |
| SEC-17 | Daily, global and monthly model budgets are reserved atomically before a provider request.                                                                                                                                                                                        | assistant service/config; quota and failure tests                                                                                                 |
| SEC-18 | Google link/unlink requires a password/MFA recent-auth proof bound to account, session version, unique session and exact purpose. Sessions carry a random `jti`, including two logins in the same second.                                                                         | recent-auth middleware/tokens/account/google routes and UI; Google tests                                                                          |
| SEC-19 | Sensitive production rate limits fail closed when Redis is unavailable. Socket connect/event/lifetime, dedupe memory and upload/export work have independent bounds.                                                                                                              | rate-limit/socket/server/export/upload code; outage/fuzz/reliability tests                                                                        |
| SEC-20 | Logging recursively redacts bounded objects, errors, headers, JWT/Bearer/cloud/provider/private-key patterns. Exports stream with backpressure, disconnect cancellation and row/byte caps. Push navigation stays same-origin.                                                     | logger/export/service worker; privacy/export/error tests                                                                                          |
| SEC-21 | Widget identity v1 is site/audience/time/nonce scoped. A nonce is atomically bound to its first widget session; reconnecting that session works, replay in another does not. Legacy identity is production-off by default.                                                        | identity service, migration 0030, widget/WordPress docs and tests                                                                                 |
| SEC-22 | Visitor-contact department lookup scopes on the site's organization and active department.                                                                                                                                                                                        | department routing query; tenant tests                                                                                                            |

## Database changes

| Migration | Purpose                                                                      | Rollout note                                                                                                                     |
| --------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 0025      | Knowledge approval state, assistant reservations and security support fields | Existing knowledge is deliberately unapproved; owners must review it.                                                            |
| 0026      | Upload records and principal/session/conversation lifecycle                  | Deploy code and schema together; pending legacy objects remain inaccessible through the new proof flow.                          |
| 0027      | Explicit site access semantics                                               | Materializes all then-current sites for restricted members whose old empty list meant all. Review future assignments explicitly. |
| 0028-0029 | Deterministic lower-case/Turkish FAQ search vectors                          | Rebuilds the generated search expression/index.                                                                                  |
| 0030      | Identity assertion nonce use and widget-session binding                      | Old assertion rows do not exist; only v1 assertions create uses.                                                                 |

All six migrations were applied to the local development PostgreSQL database
and `backend/src/db/schema.sql` was regenerated. They have not been run against
production.

## Verification record

Local verification uses synthetic test accounts and the repository's local
PostgreSQL database. No customer data or real provider messages are used.

- Targeted Google and widget suite after the final session/schema fixes:
  **28/28 passed**.
- Earlier targeted security suites covered atomic MFA/recovery use, parallel
  e-mail tokens, upload proof replay, identity assertion replay, RBAC/site
  scope, assistant/knowledge approval and tenant isolation.
- The final broad backend run executed **310 tests: 309 passed, 1 failed**.
  The sole failure is the Redis-backed global assistant kill-switch test:
  Redis is not installed/reachable in this environment and the operation
  intentionally failed closed. The same run includes the retention tests with
  `UPLOAD_STORAGE=local`, all of which passed.
- Backend and panel typecheck, lint and production builds passed. Shell syntax
  checks passed for the deploy and PostgreSQL role-init scripts. Both backend
  and panel `npm audit --omit=dev --json` reported zero known production
  dependency findings at the time of this run.

## Release gates that local code cannot close

The code remediation is not a claim that the production system is
"unbreakable". Release remains **no-go** until the responsible operator records
evidence for all applicable gates below:

- A two-replica staging run with real Redis proves cross-replica socket
  revocation, Redis outage/recovery and the assistant kill switch.
- An external quarantine AV/CDR service is integrated and fails closed before
  enabling archive uploads. Until then archives remain disabled and DOC/XLS
  remain rejected.
- Bounded upload/load/reconnect tests demonstrate memory, CPU, queue and tenant
  fairness under the intended production resource limits.
- The actual runtime DB role is shown unable to migrate/administer the cluster,
  and the staging remote DB certificate/CA/hostname path is verified.
- The registry artifact used by staging proves build digest = scanned digest =
  signed digest = deployed digest; rollback and migration failure are rehearsed.
- Authenticated browser tests cover stored/reflected/DOM XSS, CSS/URL contexts,
  CSRF, service-worker cache/account switching and real reverse-proxy headers.
- Current full-history secret scanning, dependency/dev-tool audit, container
  scan, SBOM review and time-bounded accepted risks are recorded.
- An independent authenticated staging penetration test covers tenant/site
  authorization, sockets, billing/business logic, files/parsers and resource
  exhaustion. A baseline unauthenticated scanner alone is insufficient.

These gates require infrastructure or independent review and must not be
silently converted into unit-test claims.

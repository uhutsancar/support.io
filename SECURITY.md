# Security

How Support.io protects accounts, conversations and the sites it runs on,
and how to report a vulnerability. Every value below is the one in the code;
the file that holds it is named so it can be checked.

## Reporting a vulnerability

Write to **security@support.io** (the address in
`/.well-known/security.txt`, which names the current one per deployment via
`SECURITY_CONTACT_EMAIL`). Tell us how to reproduce it and which address it
affects. Please do not open a public issue.

- We confirm receipt within **3 working days**.
- We aim to fix within **90 days** and ask you not to publish details before
  the fix is live. We will agree a disclosure date with you.
- Test only against your own account. Do not access other people's data, run
  load tests that degrade the service, or try social engineering.
- There is no bug bounty at the moment.

The same policy is in the terms of service, section "Güvenlik açığı
bildirimi" (`/kullanim-sartlari#guvenlik`).

## Sessions

- The panel's session is a signed token (HS256, its own derived key) in an
  **httpOnly** cookie `sc_session`, `SameSite=Lax`, `Secure` in production,
  valid for `SESSION_TTL_SECONDS` (default 7 days). JavaScript never sees it.
  (`config/session.ts`, `config/tokens.ts`)
- **CSRF**: double submit — a readable `sc_csrf` cookie must be echoed in the
  `X-CSRF-Token` header on every cookie-authenticated state-changing request.
- Every account has a `session_version`. Changing the password or the e-mail
  address, turning two-step sign-in on or off, or "sign out everywhere" bumps
  it, and every older session stops working at once.
- **Two-step sign-in**: TOTP (RFC 6238, 30-second steps, one step of drift,
  a code is accepted once) with ten single-use recovery codes stored as keyed
  hashes. An owner on the Enterprise plan can require it for the whole team;
  members without it reach only the set-up page and get no live socket.
  (`services/totp.ts`, `services/mfa.ts`)
- Sign-up is e-mail first: no session and no live widget until the address
  is confirmed. Disposable addresses are refused; Cloudflare Turnstile guards
  the form when `TURNSTILE_SITE_KEY` is set.

## Passwords

- bcrypt, cost **10** (`BCRYPT_COST`, `config/passwords.ts`); a hash at
  another cost is re-hashed at the next sign-in.
- At least 10 characters, at most 72 bytes (bcrypt ignores the rest), and not
  one of the 10 000 most common passwords (NIST SP 800-63B; no forced
  character classes). The list is in the repository; no password or hash
  leaves the server.
- A sign-in for an unknown address costs the same bcrypt comparison as a
  wrong password, so response time does not reveal which addresses exist.
- The account is locked for the window after `ACCOUNT_LOCK_MAX` (10) failed
  attempts in `ACCOUNT_LOCK_WINDOW_MS` (15 minutes); the lock is audited once.

## Rate limits

Counted in Redis (shared by every API process), per user when signed in,
otherwise per address (IPv6 per /56). Production defaults; each can be set by
its environment variable (`middleware/rateLimit.ts`):

| What | Default | Variable |
|---|---|---|
| Sign-in, per address | 100 / 15 min | `AUTH_RATE_MAX`, `AUTH_RATE_WINDOW_MS` |
| Sign-in, per account (lock) | 10 / 15 min | `ACCOUNT_LOCK_MAX`, `ACCOUNT_LOCK_WINDOW_MS` |
| Second sign-in step | 5 / 15 min | `MFA_RATE_MAX` |
| Sign-up | 20 / hour | `REGISTER_RATE_MAX`, `REGISTER_RATE_WINDOW_MS` |
| Password reset, per address / per account | 10 / 15 min, 5 / hour | `RESET_RATE_MAX`, `RESET_ACCOUNT_RATE_MAX` |
| Resending the verification mail | 5 / hour | `VERIFY_RESEND_RATE_MAX` |
| Password, e-mail and 2FA changes | 5 / hour | `ACCOUNT_RATE_MAX` |
| Whole API | 1 000 / 15 min | `API_RATE_MAX`, `API_RATE_WINDOW_MS` |
| Widget sessions | 300 / 15 min | `WIDGET_SESSION_RATE_MAX` |
| New sites, invitations | 20 / hour each | `SITE_CREATE_RATE_MAX`, `INVITE_RATE_MAX` |
| Socket connections: agent / widget | 30 / min, 60 / min | `SOCKET_ADMIN_CONNECT_RATE_MAX`, `SOCKET_WIDGET_CONNECT_RATE_MAX` |
| Socket events: visitor | 30 messages, 300 events / min | `SOCKET_VISITOR_MESSAGES_PER_MIN`, `SOCKET_VISITOR_EVENTS_PER_MIN` |
| Socket events: agent | 120 messages, 1 200 events / min | `SOCKET_AGENT_MESSAGES_PER_MIN`, `SOCKET_AGENT_EVENTS_PER_MIN` |
| CSP reports | 30 / min | `CSP_REPORT_RATE_MAX` |

A site in spam mode also holds a visitor nobody has answered yet to three
messages a minute and one link every five minutes.

## Tenant isolation

- Every query carries the caller's organization, read from the database, not
  from the token. Another tenant's record answers **404**, never 403, so ids
  cannot be probed. Agents can be limited to some sites; the same rule
  applies on REST and on the sockets (`http/guards.ts`, `socket/context.ts`).
- Roles (owner, admin, agent, viewer) map to permissions in one table
  (`middleware/rbac.ts`); plan features are checked on the server.
- `tests/tenantIsolation.e2e.test.ts` calls the routes and socket events with
  another tenant's ids and expects nothing back.

## The widget

- A page gets a **signed widget session** (24 hours, renewable) from
  `POST /api/widget/session` only from one of the site's allowed origins. The
  server mints the visitor id; nothing the page sends can name another site
  or visitor. Regenerating the site key ends every session at once.
- Sockets require the session and an allowed origin. Every socket event
  passes one schema (`socket/schema.ts`): only listed fields survive, each
  typed and bounded; unknown events are refused.
- No third-party script runs in the widget; it lives in a Shadow DOM.
- A shop can vouch for a signed-in customer with an HMAC of their id
  (`userHash`); an unsigned id is ignored.
- An agent can block a visitor for a period, by visitor id and a keyed hash
  of their address; the address itself is not stored with the block.

## Uploads

- 10 MB for chat files, 5 MB for logos. The type is read from the file's
  content signature, not its name or the declared type; images are decoded
  and re-encoded, which drops EXIF and anything appended. Archives are off
  unless `ALLOW_ARCHIVE_UPLOADS=true`. (`middleware/upload.ts`)
- Chat attachments are private: stored under the organization's prefix, opened
  through a 12-hour signed link that redirects to a 5-minute presigned
  storage URL. Only logos are public.
- Deleting a conversation, a visitor's data or a workspace deletes the files.

## The AI assistant

- One provider, Google Gemini, called only from the server; the key
  (`GEMINI_API_KEY`) is sent in a header, never in a URL, and never reaches
  the panel, the widget or the logs.
- Only the visitor's question and the site's public FAQ entries are sent.
  E-mail addresses and phone numbers are masked first; a question containing
  a card number, IBAN or Turkish ID number is not sent at all and goes to a
  person. The visitor's name, address and earlier messages are never sent.
  (`services/assistant/privacy.ts`)
- The assistant is off for a site until its owner switches it on.

## Data protection

- In transit: HTTPS only, behind Cloudflare (Full strict) to Caddy;
  `Strict-Transport-Security` is set at the edge.
- Headers: a strict Content Security Policy with a per-response nonce and a
  report endpoint, `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy`, no `Server` or `X-Powered-By` (`middleware/csp.ts`,
  `Caddyfile.prod`, checked by `scripts/smoke.sh`).
- Secrets a tenant stores (identity keys, authenticator secrets) are sealed
  with AES-256-GCM under a key derived from `JWT_SECRET`
  (`config/secretBox.ts`).
- Backups: nightly `pg_dump`, encrypted with **age** (or gpg) before it
  leaves the server (`scripts/backup-postgres.sh`).
- Retention: conversations are deleted with their attachments once past the
  plan's window (Free 90 days; Pro up to a year; Enterprise up to five
  years, chosen by the owner). Visitors' IP address and device details go 90
  days after their last visit; IP addresses in the audit trail after 90 days.
  An owner can erase one visitor's data in one step and export or delete the
  whole workspace.
- Logs carry no passwords, tokens, cookies, API keys or message text; e-mail
  addresses are masked (`config/logger.ts`, proven by
  `tests/logRedaction.e2e.test.ts`).
- The audit trail records sign-ins, security changes, plan changes, blocks,
  deletions and settings — what changed, never the content.

## Secrets and rotation

`JWT_SECRET` (at least 32 characters; the boot check refuses less or a
placeholder) is the root of every derived key. It can be rotated without
signing anybody out: `JWT_SECRET_PREVIOUS` keeps the old one trusted for
checking while `npm run secrets:rotate:prod` re-seals stored secrets
(`docs/production-runbook.md`, "Rotating secrets"). Database, Redis
(`REDIS_PASSWORD`), Paddle and Gemini credentials live only in the server's
environment file.

## Supply chain

Container images are pinned by digest and scanned (Trivy) in CI, signed with
cosign and shipped with an SBOM; dependencies are updated by Dependabot and
code is analysed by CodeQL. Accepted findings are listed with a reason in
`docs/security/accepted-risks.md`.

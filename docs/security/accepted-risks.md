# Accepted risks

Findings that are known, looked at and deliberately left in place, each with
the reason and the date by which it is looked at again. Anything listed in
`.trivyignore` must have its entry here; when an expiry passes, the scanners
report the finding again.

## Container images

### postgres:16.15-alpine — gosu built with Go 1.24.6

- **Findings**: 22 Go standard-library CVEs (1 critical, 21 high), among them
  CVE-2025-68121, CVE-2026-39821, CVE-2026-39822.
- **Where**: `/usr/local/bin/gosu` (1.19), which the official entrypoint uses
  once to drop from root to the `postgres` user before exec'ing the server.
- **Why accepted**: gosu opens no socket, parses no certificate, archive,
  URL or HTTP message and is gone after the `exec`; the affected packages
  (`net/http`, `crypto/tls`, `crypto/x509`, `archive/*`, `net/url`) are not on
  its code path. The gosu maintainers document the same reasoning
  (github.com/tianon/gosu, "CVEs"). PostgreSQL is reachable only on the
  Docker network.
- **Ends when**: the official image ships a gosu built with a patched Go
  (Dependabot moves the digest), or by **2027-01-15**.

### redis:7.4.11-alpine — OpenSSL 3.3.7-r1

- **Findings**: CVE-2026-75804, CVE-2026-84782 (high) in `libssl3` /
  `libcrypto3`, fixed in Alpine's 3.3.7-r2.
- **Why accepted**: Redis runs without TLS (`tls-port` is not set) on the
  Docker network only; no TLS handshake or certificate reaches the library.
- **Ends when**: the official image is rebuilt on the fixed package, or by
  **2026-11-15**.

## Development tooling (not in the image)

`npm audit` without `--omit=dev`, 2026-10-07:

| Package                         | Via                                                                                     | Severity | Why accepted                                                                                                                                                                                  |
| ------------------------------- | --------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| braces (all versions)           | backend: nodemon → chokidar 3; panel: tailwindcss 3 → chokidar / micromatch / fast-glob | high     | No fixed release exists. It parses glob patterns written in our own config files on a developer's machine, never input from a user. Goes away with tailwindcss 4 and a nodemon on chokidar 4. |
| postcss-selector-parser < 7.1.6 | panel: tailwindcss 3 → postcss-nested                                                   | moderate | Build-time only, on our own CSS. Same fix (tailwindcss 4).                                                                                                                                    |

Nothing in this table is installed in the production image
(`npm ci --omit=dev`), and CI fails on any high or critical advisory in the
production dependencies (`npm audit --omit=dev --audit-level=high`).

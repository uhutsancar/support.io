# Image scan results

What every image the production stack runs looked like on the day its digest
was pinned (plan v10 SUP-01…SUP-04). CI repeats the scan on every build
(`.github/workflows/ci.yml`, job `build`), before every release
(`release.yml`) and once a week (`image-scan.yml`); this page is the record
of the starting point.

Scanner: Trivy (`aquasec/trivy`, database of 2026-10-07) with
`--severity CRITICAL,HIGH --ignore-unfixed`; Docker Scout 1.25 for the
comparison with the old Caddy image. Accepted findings are listed with
their reasons in [accepted-risks.md](accepted-risks.md) and in `.trivyignore`.

## Pinned images (2026-10-07)

| Service      | Image                                                            | Fixable critical/high       | After accepted risks |
| ------------ | ---------------------------------------------------------------- | --------------------------- | -------------------- |
| proxy        | `caddy:2.11.7-alpine@sha256:d8542f48…5f75f`                      | 0                           | 0                    |
| postgres     | `postgres:16.15-alpine@sha256:721873c3…080ea`                    | 22 (gosu, Go 1.24.6 stdlib) | 0                    |
| redis        | `redis:7.4.11-alpine@sha256:858f009f…3b3499`                     | 2 (OpenSSL 3.3.7-r1)        | 0                    |
| backend      | `ghcr.io/<owner>/supportio` built from `backend/Dockerfile.prod` | 0                           | 0                    |
| (build only) | `node:22.23.3-alpine@sha256:0a7108bf…e402`                       | 9 (npm's bundled packages)  | not shipped          |

Development (`docker-compose.yml`) runs the same Caddy and Redis digests, and
PostgreSQL 16.15 on Debian (`16.15-trixie`): the existing development volume
was created with glibc collation, and an Alpine (musl) server would read its
text indexes in a different order. CI and production start empty and use the
Alpine image.

## Caddy: before and after

The image Docker Desktop had been running since February, `caddy:2`
(2.10.2, Alpine 3.22), and the one pinned now:

|                | `caddy:2` (2.10.2)                                                                                      | `caddy:2.11.7-alpine` |
| -------------- | ------------------------------------------------------------------------------------------------------- | --------------------- |
| Critical       | 25                                                                                                      | 0                     |
| High           | 86                                                                                                      | 0                     |
| Worst packages | curl 8.14.1, golang.org/x/crypto 0.40.0, OpenSSL 3.5.5, Go stdlib 1.25.0, smallstep/certificates 0.28.4 | —                     |
| Size           | 82.8 MB                                                                                                 | 25 MB                 |

`Caddyfile` and `Caddyfile.prod` both pass `caddy validate` on 2.11.7.

## Backend image: before and after

|                                          | before v10                | after v10                                                                                                 |
| ---------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------- |
| Base                                     | `node:22.23-alpine` (tag) | `node:22.23.3-alpine` (digest) for the builds, `alpine:3.24.2` (digest) + the node binary for the runtime |
| Fixable critical/high                    | 16 (1 critical, 15 high)  | 0                                                                                                         |
| npm / npx / yarn / corepack in the image | yes                       | no                                                                                                        |
| PID 1                                    | node                      | tini                                                                                                      |
| Size                                     | 327 MB                    | 294 MB                                                                                                    |

Support commands now run as `node dist/cli/<name>.js` (runbook §9).

## The hardened stack, checked on a local run

`docker-compose.prod.yml` brought up with `APP_DOMAIN=localhost` and the
image above (2026-10-07):

- `/ready` → `{"status":"ready"}`, `/` → HTML, `/widget.js` → JavaScript with
  `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`
- backend: root filesystem read-only (`EROFS`), `/tmp` writable, effective and
  bounding capability sets empty, `NoNewPrivs: 1`
- Redis: wrong password → `WRONGPASS`, no password → `NOAUTH`, `CONFIG` and
  `FLUSHALL` → unknown command; the backend connects with the password and
  logs the URL with the password masked
- Caddy obtains its certificate and serves with only `NET_BIND_SERVICE`

## Repeating the scan by hand

```bash
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  -v "$PWD/.trivyignore:/.trivyignore:ro" aquasec/trivy:latest image \
  --scanners vuln --severity CRITICAL,HIGH --ignore-unfixed \
  --ignorefile /.trivyignore <image>
```

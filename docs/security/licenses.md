# Licences of what ships

Plan v10 SUP-05, checked 8 October 2026 with
`npx license-checker@25.0.1 --production --summary` in `backend/` and
`admin-panel/` (production dependencies only — what the image contains).

| Package set | MIT | Apache-2.0 | ISC | BSD-2/3 | 0BSD / MIT-0 | Other |
|---|---:|---:|---:|---:|---:|---|
| backend | 144 | 30 | 5 | 3 | 2 | 1 × `Apache-2.0 AND LGPL-3.0-or-later` |
| admin-panel | 127 | 2 | 12 | 2 | 1 | `MIT AND ISC` (1), `UNLICENSED` (1: our own package) |

**No GPL or AGPL dependency.**

The one LGPL component is libvips inside sharp's prebuilt binary
(`@img/sharp-libvips-*`, used to check and resize uploaded pictures). It is
dynamically linked and unmodified, and Support.io is offered as a service:
the image is not distributed to customers (GHCR package private, SUP-06), so
the LGPL's distribution terms are not triggered. Should the image ever be
handed to a customer (an on-premises Enterprise deal), ship it with the
libvips licence text and an offer of its source, as the LGPL asks.

`@types/cookie-parser` sits in devDependencies (not shipped). Every install
uses `npm ci` against the lock files.

Run again before each release that adds a production dependency; a new
licence outside MIT, Apache-2.0, ISC, BSD, 0BSD, MIT-0 needs a look before it
merges.

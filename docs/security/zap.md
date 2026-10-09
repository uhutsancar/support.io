# ZAP baseline scans

Plan v10 TST-03. `.github/workflows/zap.yml` runs the OWASP ZAP baseline
scan against staging every Monday and can be started by hand (Actions → ZAP
baseline → Run workflow, optionally with another address) before a release.

## Setting it up [owner]

1. Repository variable `STAGING_URL` = `https://staging.<domain>`.
2. Repository secret `STAGING_BASIC_AUTH` = `user:password` of staging's
   basic auth (INF-03). The workflow sends it as an `Authorization` header;
   check on the first run that the report shows pages behind the login
   prompt (if every URL answers 401, the header did not reach ZAP and the
   secret needs checking).

## After a run

Download the `zap-baseline` artifact and write `docs/security/zap-<YYYY-MM-DD>.md`:

| Alert | Risk | URL(s) | Decision |
|---|---|---|---|
| … | High / Medium / Low / Info | … | fixed in `<commit>` · accepted (accepted-risks.md) · false positive (why) |

- High and Medium: fixed before the release, or accepted in
  `docs/security/accepted-risks.md` with a reason and a review date.
- Low and Informational: read; fix what is cheap.
- A false positive twice: add it to a `.zap/rules.tsv` with the reason, so
  the next report stays readable.

## What the baseline does not cover

It is passive: no injection, no authentication bypass, no business logic.
Those are covered by the automated tests (tenant isolation, IDOR template,
socket fuzzing, upload signatures, CSRF, SSRF guard — see
`docs/security/pentest-scope.md`, "Already tested in CI") and by the
independent penetration test (TST-04).

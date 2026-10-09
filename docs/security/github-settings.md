# GitHub repository settings

Plan v10 SUP-06. The owner applies these [SAHİP]; each is a click in the
repository's or the account's settings. Tick them off here with the date.

## Branch protection — `main`

Settings → Branches → Add rule (or Rulesets) for `main`:

- [ ] Require a pull request before merging (at least the owner's review
      for anything that touches `.github/`, `docker-compose.prod.yml`,
      `Caddyfile.prod`, migrations).
- [ ] Require status checks to pass: **checks**, **test**, **browser**, **secrets**,
      **build** (ci.yml) and **CodeQL**; require branches to be up to date.
- [ ] Block force pushes; block deletion.
- [ ] Require linear history (optional; keeps `git log` readable).
- [ ] Do not allow bypassing the above (applies to admins too).

## Security

Settings → Code security and analysis:

- [ ] Dependabot alerts **on**; Dependabot security updates **on**
      (version updates come from `.github/dependabot.yml`).
- [ ] Secret scanning **on**, and **push protection on** — a commit with a key
      in it is refused before it leaves the developer's machine.
- [ ] Code scanning: CodeQL (`.github/workflows/codeql.yml`) results visible.
- [ ] Private vulnerability reporting **on** (matches security.txt).

## Accounts

- [ ] Two-factor authentication required for everyone with access
      (organization setting, or each account's own if the repository is
      personal).
- [ ] Access by least privilege: write only for those who merge.

## Packages

- [ ] GHCR package `supportio` (and `supportio-postgres`) **private**. The
      servers pull with a token that can only `read:packages` (runbook §1).

## Environments (deploys, INF-03)

- [ ] `staging`: variable `DEPLOY_HOST`, secrets `DEPLOY_SSH_KEY`,
      `DEPLOY_KNOWN_HOSTS`; repository variable `STAGING_DEPLOY=true`.
- [ ] `production`: the same three for the production server, and the owner
      under **Required reviewers**; deployment branches limited to `main`.
- [ ] Repository variable `STAGING_URL` and secret `STAGING_BASIC_AUTH` for the
      weekly ZAP scan (docs/security/zap.md).

## Actions

- [ ] Settings → Actions → General: allow only actions pinned to a full
      commit SHA ("Require actions to be pinned to a full-length commit SHA"),
      workflow permissions **read** by default (each workflow asks for more
      where it needs it).

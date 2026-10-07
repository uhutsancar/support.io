# Incident response

What to do when something is wrong in production, in order. Written for
whoever is on call — today that is the owner. Commands assume
`cd /opt/supportio` and `C="docker compose --env-file .env.production -f docker-compose.prod.yml"`.

## Severity

| Level    | Means                                         | Examples                                                                         | Respond                                |
| -------- | --------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------- |
| **SEV1** | Chat is down for everyone, or data is exposed | `/ready` failing, widget not loading anywhere, sign-in broken, a leak            | at once, any hour                      |
| **SEV2** | One feature or some customers                 | the AI assistant down, e-mails not going out, uploads failing, one site's widget | within 1 hour, working hours + evening |
| **SEV3** | Cosmetic or a workaround exists               | a wrong translation, a slow report                                               | next working day                       |

A suspected personal-data breach is always SEV1 and also follows
[`legal/breach-procedure.md`](legal/breach-procedure.md) (72-hour clock).

## The first 15 minutes

1. **Acknowledge** the alert (watchdog / uptime / customer) and note the
   time — the timeline starts now.
2. **How bad?** Check from outside and inside:
   ```bash
   curl -s https://app.example.com/ready
   $C ps
   $C logs --since 15m backend | grep -E '"level":(50|60)' | tail -50
   ```
   Error tracking (if `SENTRY_DSN` is set) shows the newest errors with
   their request ids.
3. **What changed?** The last deploy (`scripts/deploy.sh` prints the image),
   a configuration change, Cloudflare, the provider's status page, Google's
   AI status, Paddle's status.
4. **Decide: roll back or fix forward.** If the problem began with a
   deploy, roll back first and investigate after:
   ```bash
   ./scripts/rollback.sh
   ./scripts/smoke.sh https://app.example.com
   ```
   A rollback never needs a database migration undone: migrations only add,
   and a column is dropped one release after it stops being used.
5. **Contain** what cannot wait:
   - AI assistant misbehaving or costing: `$C exec backend node dist/cli/assistantKill.js on`
   - One abusive site: `$C exec backend node dist/cli/disableSite.js <site key>`
   - A leaked secret: rotate it now (runbook §8; for `JWT_SECRET` skip the
     overlap so every session ends).
6. **Tell customers** if SEV1, or SEV2 lasting over 30 minutes: status page
   first, then e-mail to affected workspaces (templates below).

## Common failures

| Symptom                         | Look at                                                              | Usually                                                                          |
| ------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `/ready` 503                    | `$C logs postgres`, disk                                             | PostgreSQL down or the disk full; free space, `$C up -d postgres`                |
| Widget loads, messages hang     | `$C logs backend`, Redis                                             | Redis down (runbook "When Redis is down"); chat keeps working on one process     |
| Everyone signed out             | recent `JWT_SECRET` change                                           | expected after a rotation without overlap                                        |
| Assistant hands everything over | `assistantKill.js status`, metrics `supportio_assistant_calls_total` | quota or key; the conversations still reach people                               |
| No e-mails                      | `supportio_mail_total{outcome="failed"}`, SMTP provider              | credentials or sending limits                                                    |
| 502 from Cloudflare             | `$C ps proxy`, origin lock                                           | Caddy down, or Cloudflare's ranges changed (`scripts/ufw-cloudflare.sh --apply`) |

## Customer messages

**Turkish — incident**

> Konu: Support.io hizmetinde kesinti
>
> Merhaba, {saat} itibarıyla {etkilenen özellik} kullanılamıyor. Ekibimiz
> sorun üzerinde çalışıyor; güncel durumu {durum sayfası} adresinden
> izleyebilirsiniz. Bu süre içinde gelen mesajlar kaybolmaz; hizmet
> düzeldiğinde panelinizde görünür. Yaşattığımız aksaklık için özür dileriz.

**Turkish — resolved**

> Konu: Çözüldü — Support.io hizmetindeki kesinti
>
> Merhaba, {başlangıç}–{bitiş} arasında yaşanan {özellik} kesintisi çözüldü.
> Neden: {kısa neden}. Tekrarlanmaması için: {önlem}. Sorunuz olursa bu
> e-postayı yanıtlayabilirsiniz.

**English — incident**

> Subject: Support.io service disruption
>
> Hi, since {time} {affected feature} is unavailable. We are working on it;
> follow the status at {status page}. Messages sent meanwhile are not lost
> and will appear in your panel once service is restored. We apologise for
> the disruption.

**English — resolved**

> Subject: Resolved — Support.io service disruption
>
> Hi, the {feature} disruption between {start} and {end} is resolved. Cause:
> {short cause}. To prevent it: {measure}. Reply to this e-mail with any
> questions.

## After the incident

Within two working days for SEV1/SEV2, a short report in
`docs/incidents/YYYY-MM-DD-<slug>.md` (blameless):

```markdown
# <title> — <date>

- Severity: SEV1 / SEV2
- Duration: <start> – <end> (UTC), <minutes>
- Customers affected: <how many, which feature>
- Detected by: watchdog / uptime check / customer / error tracking

## Timeline (UTC)

- hh:mm …

## Cause

What happened, and why it was possible.

## What we did

Containment, fix, rollback.

## What changes

- [ ] <action>, owner, date
```

Review the actions at the next planning; an alert that came late or not at
all is itself an action.

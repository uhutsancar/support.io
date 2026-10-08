# Panel usability review

Plan v10 UX-05, 8 October 2026. What was checked in code and in the browser
tests, what was decided, and the session the owner runs with five beta
customers. Findings that became work carry the commit that closed them.

## First use, step by step

The path a new customer walks: sign up → confirm e-mail → onboarding (adds
the site) → install the code → first visitor message → invite the team →
add FAQs → switch the assistant on → pay.

Each step is now measured from the record it leaves, with nothing extra
tracked: `npm run org:stats` (and the Monday report) print, for the window's
sign-ups, how many reached each step and the median hours from sign-up
(`services/productStats.ts`, `funnel`). Example from the development data:

```
İlk kullanım (bu dönemin kayıtları; ulaşan, medyan saat)
  E-postasını doğruladı    %100 (2), 0 saat
  Site ekledi              %100 (2), 0 saat
  Kodu kurdu               %0 (0), - saat
  ...
```

The browser tests walk the same path end to end (`e2e/tests/first-chat.spec.ts`,
`early-message.spec.ts`).

## Checked

| Area | Result |
|---|---|
| Plan gates | Every locked page is wrapped in `PlanGate` in the router, and the matching API refuses with `PLAN_UPGRADE_REQUIRED` (`requireFeature`): departments, audit, visitors, CRM, automation, proactive; `export` through the role table; enforced 2FA (`security`) on its route. Consistent. |
| Over-limit states | A downgrade puts sites and seats on hold with a strip and a chooser on the billing page (BIL-04); a failed payment shows a red strip with the date (BIL-05). |
| Error messages | Server codes are translated in the panel (`hooks/useAsync.ts`, `TRANSLATED_CODES`); "e-mail not confirmed" at sign-in shows the resend action in place; plan limits open the upgrade dialog. Raw server text still reaches the user in a few places — tracked under UX-06. |
| Loading / empty / error | The list pages (sites, team, departments, FAQs, audit log, assigned, team chat, analytics, performance) show a loading state, an empty state with what to do next, and an error with a retry. |
| Accessibility | axe on the main panel and public pages, no serious or critical problem (UX-02). |
| Dates and times | Shown in Turkish format in the viewer's own time zone (the browser's). See the decision below. |

## Decisions

**KARAR-UX-1 — time zone.** (a) The viewer's device time zone (today) —
**chosen**: every agent sees times as their own clock shows them, which is
what a person replying in real time expects, and nothing is stored. (b) An
organization time zone setting: needed only when reports must cut days in a
fixed zone; revisit when a customer with agents in several zones asks.
Server-side day buckets in analytics use UTC; the report says so.

## The session with five beta customers [SAHİP]

Unguided: hand over the account, watch, do not help; 30 minutes each, screen
and voice recorded with consent.

1. Sign up and get the chat bubble onto your own site.
2. Answer a message from a visitor (the observer writes from a phone).
3. Invite a colleague and give them only one site.
4. Add three questions to the FAQ and switch the assistant on.
5. Find last week's number of conversations and the average first response.
6. Change the bubble's colour and hide it on your checkout page.
7. Find where to pay and where the invoices are.

Note for each task: done or not, time, where they hesitated, what they said.
The agent turns every hesitation seen twice into a task.

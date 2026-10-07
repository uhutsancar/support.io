// /.well-known/security.txt (RFC 9116; plan v10 SEC-10): where somebody who
// found a vulnerability writes to, in which languages, and the policy they
// can expect — the "Güvenlik açığı bildirimi" section of the terms.
//
// Built from APP_BASE_URL, so staging and production each name their own
// address. SECURITY_CONTACT_EMAIL must be a mailbox somebody reads
// (docs/production-runbook.md); without it the address is security@ on the
// panel's domain.
//
// Expires: RFC 9116 wants a date under a year ahead, which a hand-edited file
// forgets to move. SECURITY_TXT_EXPIRES pins one (an ISO date); otherwise it
// is always 180 days from today, which stays true as long as the contact
// address above is read.

import express from 'express';
import { appBaseUrl } from '../services/mail';
import type { Request, Response } from 'express';

const router = express.Router();

const DAY_MS = 24 * 60 * 60 * 1000;

/** The panel's origin: APP_BASE_URL, or in development the request's own. */
function baseUrl(req: Request): string {
  return appBaseUrl() || `${req.protocol}://${req.get('host')}`;
}

function expires(now = new Date()): string {
  const pinned = Date.parse(process.env.SECURITY_TXT_EXPIRES || '');
  const at = Number.isFinite(pinned) ? new Date(pinned) : new Date(now.getTime() + 180 * DAY_MS);
  at.setUTCHours(0, 0, 0, 0);
  return at.toISOString().replace('.000Z', 'Z');
}

export function securityTxt(base: string, now = new Date()): string {
  let host = 'localhost';
  try {
    host = new URL(base).hostname;
  } catch {
    /* keeps localhost */
  }
  const contact = (process.env.SECURITY_CONTACT_EMAIL || '').trim() || `security@${host}`;
  return [
    `Contact: mailto:${contact}`,
    `Expires: ${expires(now)}`,
    'Preferred-Languages: tr, en',
    `Canonical: ${base}/.well-known/security.txt`,
    `Policy: ${base}/kullanim-sartlari#guvenlik`,
    ''
  ].join('\n');
}

const send = (req: Request, res: Response) => {
  res
    .type('text/plain; charset=utf-8')
    .set('Cache-Control', 'public, max-age=86400')
    .send(securityTxt(baseUrl(req)));
};

router.get('/.well-known/security.txt', send);
// The older location some scanners still ask for.
router.get('/security.txt', (_req: Request, res: Response) => {
  res.redirect(301, '/.well-known/security.txt');
});

export default router;

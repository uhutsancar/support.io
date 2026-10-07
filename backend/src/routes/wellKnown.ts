// /.well-known/security.txt, /robots.txt and /sitemap.xml, all built from the
// domain this process runs on.
//
// security.txt (RFC 9116; plan v10 SEC-10): where somebody who
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

import fs from 'fs';
import path from 'path';
import express from 'express';
import { appBaseUrl } from '../services/mail';
import type { NextFunction, Request, Response } from 'express';

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

// ------------------------------------------------- robots and sitemap (MKT-01/02)
//
// Both from the domain this process runs on, so the same image answers for
// staging and production. The page list comes from the panel's build
// (admin-panel/scripts/public-pages.ts → dist/public-pages.json).
// SITE_NOINDEX=true (staging): nothing is to be indexed at all.

/** Paths no search engine should list (and that robots.txt disallows). */
export const PRIVATE_PREFIXES = [
  '/dashboard',
  '/onboarding',
  '/api/',
  '/invite/',
  '/reset-password',
  '/verify-email',
  '/confirm-email',
  '/forgot-password',
  '/rate'
];

const noindexEverywhere = () => String(process.env.SITE_NOINDEX).toLowerCase() === 'true';

const NL = String.fromCharCode(10);

function isPrivate(pathname: string): boolean {
  const bare = pathname.startsWith('/en/') ? pathname.slice(3) : pathname;
  return PRIVATE_PREFIXES.some((prefix) => bare.startsWith(prefix));
}

/** Sets X-Robots-Tag on private pages, and on everything when SITE_NOINDEX is on. */
export function robotsHeader(req: Request, res: Response, next: NextFunction): void {
  if (noindexEverywhere() || isPrivate(req.path))
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  next();
}

router.get('/robots.txt', (req: Request, res: Response) => {
  const base = baseUrl(req);
  const body = noindexEverywhere()
    ? ['User-agent: *', 'Disallow: /', ''].join(NL)
    : [
        'User-agent: *',
        'Allow: /',
        ...PRIVATE_PREFIXES.flatMap((p) => [`Disallow: ${p}`, `Disallow: /en${p}`]),
        '',
        `Sitemap: ${base}/sitemap.xml`,
        ''
      ].join(NL);
  res.type('text/plain; charset=utf-8').set('Cache-Control', 'public, max-age=3600').send(body);
});

const PAGES_FILE = path.join(__dirname, '../../../admin-panel/dist/public-pages.json');

interface PublicPages {
  builtAt: string;
  pages: Array<{ tr: string; en: string }>;
}

function publicPages(): PublicPages {
  try {
    return JSON.parse(fs.readFileSync(PAGES_FILE, 'utf8')) as PublicPages;
  } catch {
    // No panel build (development): the home pages at least.
    return { builtAt: new Date().toISOString(), pages: [{ tr: '/', en: '/en' }] };
  }
}

const xml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function sitemapXml(base: string, { builtAt, pages }: PublicPages): string {
  const lastmod = builtAt.slice(0, 10);
  const entry = (loc: string, pair: { tr: string; en: string }) =>
    [
      '  <url>',
      `    <loc>${xml(base + loc)}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
      `    <xhtml:link rel="alternate" hreflang="tr" href="${xml(base + pair.tr)}"/>`,
      `    <xhtml:link rel="alternate" hreflang="en" href="${xml(base + pair.en)}"/>`,
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${xml(base + pair.tr)}"/>`,
      '  </url>'
    ].join(NL);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...pages.flatMap((pair) => [entry(pair.tr, pair), entry(pair.en, pair)]),
    '</urlset>',
    ''
  ].join(NL);
}

router.get('/sitemap.xml', (req: Request, res: Response) => {
  if (noindexEverywhere()) {
    res.status(404).type('text/plain').send('Not found');
    return;
  }
  res
    .type('application/xml; charset=utf-8')
    .set('Cache-Control', 'public, max-age=3600')
    .send(sitemapXml(baseUrl(req), publicPages()));
});

export default router;

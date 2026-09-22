'use strict';

// Content Security Policy.
//
// Helmet's CSP was switched off wholesale (`contentSecurityPolicy: false`),
// which left the panel without a second line of defence. The session token
// lives in localStorage, so one injected <script> anywhere in the panel would
// be enough to read it and post it to an attacker. The policy here blocks both
// halves of that chain:
//
//   script-src 'self' 'nonce-…'  — an injected inline script does not run,
//                                  because the attacker cannot guess the nonce
//   connect-src 'self' …         — and even if something did run, it cannot
//                                  send the token anywhere but back to us
//
// Two policies are served, because the two surfaces have different needs:
//
//   panel + API  strict; the SPA shell gets a per-response nonce so its one
//                inline block (JSON-LD) keeps working without 'unsafe-inline'
//   /demo        relaxed; the developer playground is written with inline
//                handlers and holds no credentials, so loosening script-src
//                there costs nothing an attacker could use
//
// S3/CDN hosts are read from the environment: uploads are served from the
// bucket, and a policy that forgets them would hide every customer's logo.

import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

/** Hosts that uploaded files may be served from. */
function mediaHosts(): string[] {
  const hosts: string[] = [];
  const add = (value: string | undefined): void => {
    if (!value) return;
    try {
      hosts.push(new URL(value.includes('://') ? value : `https://${value}`).origin);
    } catch {
      /* yapılandırılmamış ya da bozuk değer politikayı bozmasın */
    }
  };
  add(process.env.S3_PUBLIC_URL);
  add(process.env.CDN_URL);
  if (process.env.S3_BUCKET && process.env.AWS_REGION) {
    add(`https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`);
  }
  return [...new Set(hosts)];
}

/** Origins the panel is allowed to call, beyond its own. */
function connectHosts(): string[] {
  const hosts = [...mediaHosts()];
  // Socket.IO yükseltmesi aynı kökene gider; tarayıcı yine de ws şeması ister.
  hosts.push('ws:', 'wss:');
  return hosts;
}

const STRICT_BASE = (nonce: string): string[] => [
  "default-src 'self'",
  `script-src 'self' 'nonce-${nonce}'`,
  // Inline style attributes are everywhere in a React tree (style={{…}}), and
  // they cannot carry a nonce. Styles cannot read localStorage, so this is the
  // one relaxation worth making.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  `img-src 'self' data: blob: ${mediaHosts().join(' ')}`.trim(),
  `connect-src 'self' ${connectHosts().join(' ')}`.trim(),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "worker-src 'self' blob:",
  'upgrade-insecure-requests'
];

// The playground is served from our origin but carries no session. Its inline
// handlers would each need a nonce, which buys nothing here.
const RELAXED = (): string[] => [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  `connect-src 'self' ${connectHosts().join(' ')}`.trim(),
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'"
];

/**
 * Attaches the nonce and the policy.
 *
 * `upgrade-insecure-requests` is left out over plain HTTP, otherwise a local
 * stack on http://localhost would rewrite its own requests to https and fail.
 */
export function contentSecurityPolicy(options: { isProduction: boolean }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const nonce = crypto.randomBytes(16).toString('base64');
    res.locals.cspNonce = nonce;

    // widget.js müşteri sitelerinde çalışır; oranın politikası bizim değil.
    // Kendi başlığımızı koymak yalnızca yanıltıcı olur.
    if (req.path === '/widget.js' || req.path.startsWith('/widget/') || req.path === '/embed.js') {
      return next();
    }

    const directives = req.path.startsWith('/demo') ? RELAXED() : STRICT_BASE(nonce);
    const policy = directives
      .filter((d) => options.isProduction || d !== 'upgrade-insecure-requests')
      .join('; ');

    res.setHeader('Content-Security-Policy', policy);
    next();
  };
}

/**
 * Stamps the SPA shell's inline blocks with this response's nonce.
 *
 * The built index.html carries a JSON-LD block. Without a nonce the strict
 * policy would drop it, and adding 'unsafe-inline' to keep it would defeat the
 * whole policy — so the tag is marked at serve time instead.
 */
export function withNonce(html: string, nonce: string): string {
  return html.replace(/<script(?![^>]*\bnonce=)/g, `<script nonce="${nonce}"`);
}

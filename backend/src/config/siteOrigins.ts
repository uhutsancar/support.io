'use strict';

// Which pages a site's widget may run on.
//
// Every site lists the exact origins (scheme://host[:port]) it embeds the
// widget on. A widget session is issued only to a page on one of them, and
// every later widget request and socket is checked against the same list, so
// a site key copied into somebody else's page — it is public, it sits in the
// page source — gets nowhere in a browser.
//
// Two more sources are always accepted, both from config/origins.ts: the
// platform's own origins (CORS_ORIGINS — the marketing site's own chat bubble
// and the panel's widget preview run there), and, outside production only,
// localhost and private LAN addresses.

import { isOriginAllowed } from './origins';

/** The most origins one site may list. */
export const MAX_SITE_ORIGINS = 20;

const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

/**
 * `scheme://host[:port]` in canonical form (lower-case host, no default port),
 * or null when the input is not exactly an origin. A path, query, fragment,
 * credentials or a wildcard are refused rather than dropped: someone who typed
 * `https://shop.example/checkout` should learn that only the origin counts.
 * A bare host is read as https.
 */
export function normalizeOrigin(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  let value = input.trim();
  if (!value || value.length > 300 || value.includes('*')) return null;
  if (!SCHEME.test(value)) value = `https://${value}`;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.username || url.password || !url.hostname) return null;
  // A bare origin parses with pathname "/", so a hand-typed trailing slash is
  // still accepted; anything longer is a path.
  if (url.pathname !== '/' || url.search || url.hash) return null;
  return url.origin;
}

/**
 * The origins a new site starts with, derived from its domain: the domain and
 * its www. twin (or the bare domain for a www. one). Lenient on purpose — a
 * domain typed with a path still yields its origin. Mirrors migration 0001.
 */
export function originsFromDomain(domain: unknown): string[] {
  if (typeof domain !== 'string') return [];
  const trimmed = domain.trim();
  const scheme = /^http:\/\//i.test(trimmed) ? 'http' : 'https';
  const host = trimmed
    .replace(SCHEME, '')
    .replace(/[/?#].*$/, '')
    .toLowerCase();
  const base = normalizeOrigin(`${scheme}://${host}`);
  if (!base) return [];
  const hostname = new URL(base).hostname;
  if (hostname === 'localhost' || /^[\d.]+$/.test(hostname) || hostname.startsWith('[')) {
    return [base];
  }
  const twin = hostname.startsWith('www.')
    ? base.replace('://www.', '://')
    : base.replace('://', '://www.');
  return [...new Set([base, twin])];
}

/**
 * A client-supplied origin list, normalised and de-duplicated. Returns the
 * entries that are not origins in `invalid`, for a 400 that names them.
 */
export function normalizeOriginList(input: unknown): { origins: string[]; invalid: string[] } {
  if (!Array.isArray(input)) return { origins: [], invalid: ['(not a list)'] };
  const origins: string[] = [];
  const invalid: string[] = [];
  for (const entry of input.slice(0, MAX_SITE_ORIGINS + 1)) {
    const origin = normalizeOrigin(entry);
    if (origin) origins.push(origin);
    else invalid.push(String(entry).slice(0, 100));
  }
  if (input.length > MAX_SITE_ORIGINS) invalid.push(`(more than ${MAX_SITE_ORIGINS})`);
  return { origins: [...new Set(origins)], invalid };
}

/**
 * The page a browser request came from: the Origin header, or failing that the
 * origin of the Referer. Null when neither is present — a non-browser client.
 * The literal "null" origin (sandboxed iframes, file://) is returned as-is and
 * matches nothing.
 */
export function requestOrigin(headers: Record<string, unknown>): string | null {
  const origin = headers.origin;
  if (typeof origin === 'string' && origin) return origin;
  const referer = headers.referer;
  if (typeof referer === 'string' && referer) {
    try {
      return new URL(referer).origin;
    } catch {
      return 'null';
    }
  }
  return null;
}

/** Whether a page on `origin` may use this site's widget. */
export function siteAcceptsOrigin(
  site: { allowedOrigins?: readonly string[] | null },
  origin: string
): boolean {
  if (!origin || origin === 'null') return false;
  const normalized = normalizeOrigin(origin);
  if (normalized && (site.allowedOrigins ?? []).includes(normalized)) return true;
  return isOriginAllowed(origin);
}

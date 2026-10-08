// Visitor counts for the public site (plan v10 MKT-04, KARAR-MKT-3).
//
// Off unless both variables are set. The recommended tool is a self-hosted
// Umami: it sets no cookie, keeps no visitor profile and runs on a server
// the owner controls, so no consent banner is needed for it. The script is
// put only on the public pages' <head> (seoHead.ts) and counts only them;
// the panel never reports the dashboard's addresses (admin-panel
// lib/siteAnalytics.ts). Before switching it on, the Privacy Policy names it
// (docs/legal/gizlilik-politikasi.md).
//
//   ANALYTICS_SCRIPT_URL   https://stats.example.com/script.js
//   ANALYTICS_WEBSITE_ID   the site's id in Umami (a UUID)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SiteAnalytics {
  /** Where the script comes from and where it reports: one origin. */
  origin: string;
  script: string;
  websiteId: string;
}

/** The configured analytics, or null when it is off or misconfigured. */
export function siteAnalytics(): SiteAnalytics | null {
  const script = String(process.env.ANALYTICS_SCRIPT_URL || '').trim();
  const websiteId = String(process.env.ANALYTICS_WEBSITE_ID || '').trim();
  if (!script || !websiteId || !UUID.test(websiteId)) return null;
  try {
    const url = new URL(script);
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) return null;
    return { origin: url.origin, script: url.href, websiteId };
  } catch {
    return null;
  }
}

/**
 * The tag for a public page's head. Page views are sent by the panel on each
 * public page (auto-track off), without the query string or the hash, and
 * not at all when the browser asks not to be tracked.
 */
export function analyticsTag(attr: (value: string) => string): string | null {
  const analytics = siteAnalytics();
  if (!analytics) return null;
  return (
    `<script defer src="${attr(analytics.script)}" data-website-id="${attr(analytics.websiteId)}"` +
    ' data-auto-track="false" data-do-not-track="true" data-exclude-search="true"' +
    ' data-exclude-hash="true"></script>'
  );
}

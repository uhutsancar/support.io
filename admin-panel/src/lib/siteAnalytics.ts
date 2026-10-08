// Counts a view of a public page (plan v10 MKT-04, KARAR-MKT-3).
//
// The server puts the analytics script on the public pages only, and only
// when the owner has switched it on (backend services/siteAnalytics.ts). It
// does not count by itself: the marketing pages call this on every page they
// show, so the dashboard, the sign-in pages and their addresses are never
// sent, even when someone arrives on the home page and then signs in.

interface Umami {
  track: (...args: unknown[]) => unknown;
}

declare global {
  interface Window {
    umami?: Umami;
  }
}

/** Sends one page view when the analytics script is on the page; otherwise nothing. */
export function countPageView(): void {
  const script = document.querySelector<HTMLScriptElement>('script[data-website-id]');
  if (!script) return;
  // After the page has set its title (react-helmet writes it a moment later).
  const send = () => window.setTimeout(() => window.umami?.track(), 300);
  if (window.umami) send();
  else script.addEventListener('load', send, { once: true });
}

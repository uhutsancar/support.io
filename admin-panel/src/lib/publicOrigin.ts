// The address customers paste into their own sites: where widget.js is served.
//
// In production the panel, the API and the widget share one origin, so the
// page's own origin is the answer. On a developer's machine the page runs on
// localhost, and a snippet reading "http://localhost:5000" is useless to
// anyone who copies it — it must never be shown as installation code.
// VITE_PUBLIC_APP_ORIGIN names the public address explicitly; without it, a
// local or private-network host shows the placeholder below instead.
//
// This is for display only. Code that actually loads the widget or talks to
// the API keeps using lib/runtime.ts.

const PLACEHOLDER_ORIGIN = 'https://app.support.io';

const LOCAL_HOST =
  /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|[^.]+\.local)$/i;

export function isLocalHost(hostname: string): boolean {
  return LOCAL_HOST.test(hostname);
}

export function publicOrigin(): string {
  const configured = String(import.meta.env.VITE_PUBLIC_APP_ORIGIN || '').trim();
  if (configured) return configured.replace(/\/+$/, '');
  const { origin, hostname } = window.location;
  return isLocalHost(hostname) ? PLACEHOLDER_ORIGIN : origin;
}

/** The websocket form of the same origin, for a Content-Security-Policy line. */
export function publicSocketOrigin(): string {
  return publicOrigin().replace(/^http/, 'ws');
}

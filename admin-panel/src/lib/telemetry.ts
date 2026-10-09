/**
 * The panel's uncaught errors go to our own API (plan v10 OBS-01), which
 * scrubs them and forwards them to error tracking when it is configured.
 * No third-party script in the panel. At most MAX_REPORTS per page load;
 * the path is sent without its query string (links carry tokens).
 */
import { API_BASE_URL } from './runtime';

const MAX_REPORTS = 10;
let sent = 0;

export function reportError(error: unknown): void {
  if (sent >= MAX_REPORTS) return;
  sent += 1;
  const e = error instanceof Error ? error : new Error(String(error));
  const body = JSON.stringify({
    type: e.name || 'Error',
    message: String(e.message || '').slice(0, 1000),
    stack: String(e.stack || '').slice(0, 4000),
    path: window.location.pathname,
    release: import.meta.env.VITE_APP_RELEASE || ''
  });
  try {
    // text/plain: no preflight; keepalive: the report survives a navigation.
    void fetch(`${API_BASE_URL}/telemetry/panel`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body,
      keepalive: true,
      credentials: 'omit'
    }).catch(() => undefined);
  } catch {
    /* reporting never breaks the page */
  }
}

/** Listens for errors nothing else caught. */
export function installErrorReporting(): void {
  window.addEventListener('error', (event) => reportError(event.error ?? event.message));
  window.addEventListener('unhandledrejection', (event) => reportError(event.reason));
}

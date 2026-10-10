/*
 * The panel's service worker (plan v10 PRD-09).
 *
 * Two jobs only:
 *   - push: shows the notification the server sent (a new conversation, an
 *     assignment, a message) and opens the conversation when it is tapped;
 *   - the shell: the built, hashed files are kept, so the installed app opens
 *     faster; without a network the dashboard says so and reloads itself
 *     once the connection is back (the panel lives on the API, so a stale
 *     copy of it would only pretend to work).
 *
 * Nothing else is cached: no /api, no socket, no widget, no uploads — every
 * answer from the server is always fresh. Pages always come from the network.
 */

const SHELL = 'supportio-shell-v1';
const MAX_ASSETS = 80;
const NEVER = ['/api/', '/socket.io', '/widget', '/uploads', '/internal', '/health', '/ready'];

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== SHELL).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

/** What the dashboard shows without a network; it reloads when the network is back. */
function offlinePage(english) {
  const text = english
    ? [
        'No connection',
        'Support.io opens again by itself as soon as the connection is back.',
        'Try again'
      ]
    : [
        'Bağlantı yok',
        'İnternet bağlantısı gelir gelmez Support.io kendiliğinden açılır.',
        'Tekrar dene'
      ];
  const html =
    '<!doctype html><html lang="' +
    (english ? 'en' : 'tr') +
    '"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1"><title>Support.io</title>' +
    '<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;' +
    'font-family:system-ui,sans-serif;background:#f9fafb;color:#111827;text-align:center;padding:24px}' +
    'h1{font-size:22px;margin:0 0 8px}p{color:#4b5563;margin:0 0 20px}' +
    'button{font:inherit;padding:10px 18px;border-radius:10px;border:0;background:#4F46E5;color:#fff}' +
    '</style></head><body><main><h1>' +
    text[0] +
    '</h1><p>' +
    text[1] +
    '</p>' +
    '<button onclick="location.reload()">' +
    text[2] +
    '</button></main>' +
    '<script>addEventListener("online",function(){location.reload()})</script></body></html>';
  return new Response(html, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

async function trim(cache) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_ASSETS))) {
    await cache.delete(key);
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER.some((prefix) => url.pathname.startsWith(prefix))) return;

  if (request.mode === 'navigate') {
    if (!url.pathname.startsWith('/dashboard') && !url.pathname.startsWith('/en/dashboard')) return;
    event.respondWith(fetch(request).catch(() => offlinePage(url.pathname.startsWith('/en/'))));
    return;
  }

  // Built files carry their content hash in the name: a kept copy is exact.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(SHELL).then(async (cache) => {
        const kept = await cache.match(request);
        if (kept) return kept;
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(request, response.clone());
          trim(cache);
        }
        return response;
      })
    );
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = {};
  }
  const url = safeDashboardPath(data.url);
  event.waitUntil(
    self.registration.showNotification(data.title || 'Support.io', {
      body: data.body || '',
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = safeDashboardPath(event.notification.data && event.notification.data.url);
  const target = new URL(path, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          return client
            .focus()
            .then((focused) => (focused.navigate ? focused.navigate(target) : focused));
        }
      }
      return self.clients.openWindow(target);
    })
  );
});

/** Only a same-origin dashboard route may become a notification navigation. */
function safeDashboardPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return '/dashboard';
  }
  try {
    const parsed = new URL(value, self.location.origin);
    const dashboard =
      parsed.pathname === '/dashboard' ||
      parsed.pathname.startsWith('/dashboard/') ||
      parsed.pathname === '/en/dashboard' ||
      parsed.pathname.startsWith('/en/dashboard/');
    return parsed.origin === self.location.origin && dashboard
      ? parsed.pathname + parsed.search + parsed.hash
      : '/dashboard';
  } catch (error) {
    return '/dashboard';
  }
}

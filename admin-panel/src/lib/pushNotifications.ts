// Push notifications on this device (plan v10 PRD-09): the service worker
// (public/sw.js) and the browser's push subscription, saved on the server for
// the signed-in account.
//
// Turned on from Settings → Notifications with a click (the browser asks for
// permission then, never on page load). The choice is remembered for this
// browser; on the next visit the subscription is saved again, so a renewed
// one or another account signing in on the same computer stays right. Signing
// out forgets it on the server.

import api from '../services/api';

const FLAG = 'supportio-push-device';

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** iPhone and iPad deliver push only to the panel added to the home screen. */
export function needsHomeScreen(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

const remembered = (): boolean => {
  try {
    return localStorage.getItem(FLAG) === '1';
  } catch {
    return false;
  }
};

const remember = (on: boolean): void => {
  try {
    if (on) localStorage.setItem(FLAG, '1');
    else localStorage.removeItem(FLAG);
  } catch {
    /* private window: the choice lasts this visit */
  }
};

/** Registers the service worker; quietly does nothing where it cannot. */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
  } catch (error) {
    console.error('[push] service worker registration failed', error);
    return null;
  }
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function serverKey(): Promise<string | null> {
  const { data } = await api.get<{ enabled: boolean; publicKey: string | null }>('/push/config', {
    cache: false
  });
  return data.enabled ? data.publicKey : null;
}

/** Whether the server can send push at all. */
export async function pushAvailable(): Promise<boolean> {
  if (!pushSupported()) return false;
  try {
    return Boolean(await serverKey());
  } catch {
    return false;
  }
}

async function save(subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON();
  await api.post('/push/subscriptions', { endpoint: json.endpoint, keys: json.keys });
}

/** Whether this browser is subscribed and remembered as such. */
export async function pushEnabledHere(): Promise<boolean> {
  if (!pushSupported() || !remembered() || Notification.permission !== 'granted') return false;
  const registration = await navigator.serviceWorker.getRegistration('/');
  return Boolean(await registration?.pushManager.getSubscription());
}

/** Turns push on for this browser; call it from a click. */
export async function enablePush(): Promise<'enabled' | 'denied' | 'unavailable'> {
  if (!pushSupported()) return 'unavailable';
  const key = await serverKey();
  if (!key) return 'unavailable';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';
  const registration = (await registerServiceWorker()) ?? null;
  if (!registration) return 'unavailable';
  await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(key)
    }));
  await save(subscription);
  remember(true);
  return 'enabled';
}

/** Turns push off for this browser and forgets it on the server. */
export async function disablePush(): Promise<void> {
  remember(false);
  if (!pushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  try {
    await api.delete('/push/subscriptions', { data: { endpoint: subscription.endpoint } });
  } finally {
    await subscription.unsubscribe().catch(() => undefined);
  }
}

/** On each visit to the panel: the worker, and the remembered subscription saved again. */
export async function resyncPush(): Promise<void> {
  const registration = await registerServiceWorker();
  if (!registration || !remembered() || Notification.permission !== 'granted') return;
  try {
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) await save(subscription);
  } catch (error) {
    console.error('[push] could not renew the subscription', error);
  }
}

/** Before signing out: this browser stops receiving the account's pushes. */
export async function forgetPushOnSignOut(): Promise<void> {
  if (!pushSupported() || !remembered()) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration('/');
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      await api.delete('/push/subscriptions', { data: { endpoint: subscription.endpoint } });
    }
  } catch {
    /* signing out goes ahead regardless */
  }
  remember(false);
}

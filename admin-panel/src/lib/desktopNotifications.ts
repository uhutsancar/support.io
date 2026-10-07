// Desktop notifications and the tab's unread count (plan v10 PRD-02).
//
// A notification is shown only while the panel is in the background and only
// for the events the agent chose (Settings → Notifications). Several open
// tabs receive the same socket event; the notification `tag` makes the
// browser keep one of them, and a BroadcastChannel stops the others from
// even trying within a few seconds.

const CHANNEL = 'supportio-notifications';
const recent = new Map<string, number>();
let channel: BroadcastChannel | null = null;

function shared(): BroadcastChannel | null {
  if (channel || typeof BroadcastChannel === 'undefined') return channel;
  channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (event) => {
    if (typeof event.data?.tag === 'string') recent.set(event.data.tag, Date.now());
  };
  return channel;
}

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  return notificationsSupported() ? Notification.permission : 'unsupported';
}

/** Asks for permission; call it from a click, never on page load. */
export async function requestNotificationPermission(): Promise<
  NotificationPermission | 'unsupported'
> {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.requestPermission();
}

/**
 * Shows a notification for an event, unless the tab is in front, permission
 * was not given, or another tab has just shown the same one.
 */
export function notifyDesktop({
  title,
  body,
  tag,
  onClick
}: {
  title: string;
  body: string;
  tag: string;
  onClick?: () => void;
}): void {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  if (typeof document !== 'undefined' && !document.hidden) return;
  const last = recent.get(tag) ?? 0;
  if (Date.now() - last < 5000) return;
  recent.set(tag, Date.now());
  shared()?.postMessage({ tag });
  try {
    const notification = new Notification(title, {
      body: body.slice(0, 180),
      tag,
      icon: '/icon-192.png',
      silent: false
    });
    notification.onclick = () => {
      window.focus();
      onClick?.();
      notification.close();
    };
  } catch {
    // Some browsers allow notifications only from a service worker.
  }
}

const BASE_TITLE_KEY = '__supportioBaseTitle';

/** "(3) Support.io" while there are unread messages, and a dot on the favicon. */
export function showUnreadInTab(count: number): void {
  if (typeof document === 'undefined') return;
  const w = window as unknown as Record<string, string>;
  const current = document.title.replace(/^\(\d+\+?\)\s+/, '');
  w[BASE_TITLE_KEY] = current;
  document.title = count > 0 ? `(${count > 99 ? '99+' : count}) ${current}` : current;
  setFaviconDot(count > 0);
}

let originalIcon: string | null = null;

function setFaviconDot(on: boolean): void {
  const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (!link) return;
  if (originalIcon === null) originalIcon = link.href;
  if (!on) {
    link.href = originalIcon;
    return;
  }
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(image, 0, 0, 64, 64);
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(50, 14, 13, 0, Math.PI * 2);
    ctx.fill();
    try {
      link.href = canvas.toDataURL('image/png');
    } catch {
      /* a tainted canvas: keep the plain icon */
    }
  };
  image.src = originalIcon;
}

// Web Push keys (plan v10 PRD-09). The panel's phones and desktops get a
// notification while the panel is closed, through the browser's push
// service; VAPID is how that service knows the messages come from us.
//
//   VAPID_PUBLIC_KEY    base64url, 65 bytes (P-256 point); the panel reads it
//   VAPID_PRIVATE_KEY   base64url, 32 bytes; the backend alone holds it
//   VAPID_SUBJECT       mailto: or https: contact the push services may use
//
// `npm run push:keys` prints a fresh pair. Without both keys push is off and
// everything else works as before.

const B64URL = /^[A-Za-z0-9_-]+$/;

const bytes = (value: string): number =>
  B64URL.test(value) ? Buffer.from(value, 'base64url').length : -1;

export interface PushConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export function pushConfig(): PushConfig | null {
  const publicKey = String(process.env.VAPID_PUBLIC_KEY || '').trim();
  const privateKey = String(process.env.VAPID_PRIVATE_KEY || '').trim();
  if (bytes(publicKey) !== 65 || bytes(privateKey) !== 32) return null;
  if (Buffer.from(publicKey, 'base64url')[0] !== 0x04) return null;
  const configured = String(process.env.VAPID_SUBJECT || '').trim();
  const fallback =
    process.env.SECURITY_CONTACT_EMAIL && process.env.SECURITY_CONTACT_EMAIL.includes('@')
      ? `mailto:${process.env.SECURITY_CONTACT_EMAIL}`
      : String(process.env.APP_BASE_URL || 'https://localhost');
  const subject = /^(mailto:|https:)/.test(configured) ? configured : fallback;
  return { publicKey, privateKey, subject };
}

// Cloudflare Turnstile on the sign-up form (plan v10 SEC-06).
//
// The browser solves a challenge and hands us a one-time token; we ask
// Cloudflare whether it is genuine. Turnstile is free, shows most people no
// puzzle and sets no tracking cookie, which is why it is used instead of a
// CAPTCHA or Bot Fight Mode (the latter would also challenge the widget's
// own requests).
//
//   TURNSTILE_SITE_KEY  public; the panel reads it from GET /api/auth/config
//   TURNSTILE_SECRET    server only
//
// With no secret configured the check is skipped — local development, the
// e2e suite — and production logs a warning at boot
// (config/productionChecks.ts).

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export function turnstileSiteKey(): string {
  return String(process.env.TURNSTILE_SITE_KEY || '').trim();
}

export function turnstileEnabled(): boolean {
  return Boolean(String(process.env.TURNSTILE_SECRET || '').trim() && turnstileSiteKey());
}

/**
 * Whether the token the browser sent proves a person solved the challenge.
 * True when Turnstile is not configured. A network failure counts as a
 * failed check: the form can be sent again, an open door cannot be closed.
 */
export async function verifyTurnstile(token: unknown, remoteIp?: string): Promise<boolean> {
  if (!turnstileEnabled()) return true;
  if (typeof token !== 'string' || !token || token.length > 2048) return false;
  const body = new URLSearchParams({
    secret: String(process.env.TURNSTILE_SECRET),
    response: token
  });
  if (remoteIp) body.set('remoteip', remoteIp);
  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return false;
    const result = (await res.json()) as { success?: boolean };
    return result.success === true;
  } catch (error) {
    console.warn(
      '[turnstile] verification request failed:',
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

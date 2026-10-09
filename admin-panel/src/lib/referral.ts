// A referral link's code (plan v10 PRD-23): read from ?ref= on arrival and
// kept for the browser session, so it survives a detour through the pricing
// page before signing up. Sent with the sign-up; the server ignores a code
// it does not know.

const KEY = 'sio_ref';

export function referralCode(search = window.location.search): string | null {
  const fromUrl = new URLSearchParams(search).get('ref');
  const code = fromUrl && /^[A-Za-z2-9]{8}$/.test(fromUrl) ? fromUrl.toUpperCase() : null;
  try {
    if (code) sessionStorage.setItem(KEY, code);
    return code ?? sessionStorage.getItem(KEY);
  } catch {
    return code;
  }
}

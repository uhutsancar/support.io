// The signing secret, read once per call so a process that starts before its
// environment is loaded still sees the value.
//
// Throwing rather than returning undefined keeps the failure inside the
// caller's try/catch, which is exactly where an unusable secret was already
// surfacing as an authentication failure.
export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return secret;
}

/**
 * The secret JWT_SECRET replaced, while a rotation is under way (plan v10
 * SEC-18): tokens, links and sealed values made with it are still accepted,
 * nothing new is made with it. Unset — or the same as JWT_SECRET — means
 * none.
 */
export function previousJwtSecret(): string | null {
  const previous = (process.env.JWT_SECRET_PREVIOUS || '').trim();
  return previous && previous !== process.env.JWT_SECRET ? previous : null;
}

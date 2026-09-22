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

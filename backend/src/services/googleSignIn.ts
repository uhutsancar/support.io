// Sign-in with Google (plan v10 PRD-14): OpenID Connect, authorization code
// flow with PKCE, a state bound to a short cookie and a nonce bound to the ID
// token. Google's ID token is verified here — its RS256 signature against
// Google's published keys, its issuer, its audience (our client id), its
// expiry and its nonce — and only a verified address is accepted.
//
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET   the OAuth client [SAHİP]
//
// Without both, the Google button is not shown and nothing here runs.
//
// GOOGLE_SIGN_IN_TRANSPORT=memory (development and CI only, never in
// production) swaps Google's three endpoints for a stand-in in this process:
// an account chooser page under /api/dev/google, a token endpoint that checks
// the PKCE verifier, and a signing key of its own. Everything after that —
// the token's verification, which account it opens — is the same code.

import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const GOOGLE = {
  authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
  token: 'https://oauth2.googleapis.com/token',
  jwks: 'https://www.googleapis.com/oauth2/v3/certs',
  issuers: ['https://accounts.google.com', 'accounts.google.com'] as [string, ...string[]]
};
const STAND_IN_ISSUER = 'https://stand-in-google.invalid';
const TIMEOUT_MS = 10_000;

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  standIn: boolean;
}

function standIn(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.GOOGLE_SIGN_IN_TRANSPORT === 'memory';
}

/** The OAuth client, or null when sign-in with Google is off. */
export function googleConfig(): GoogleConfig | null {
  const clientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || '').trim();
  if (standIn()) {
    return {
      clientId: clientId || 'stand-in.apps.googleusercontent.com',
      clientSecret: clientSecret || 'stand-in-secret',
      standIn: true
    };
  }
  if (!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(clientId) || clientSecret.length < 10) {
    return null;
  }
  return { clientId, clientSecret, standIn: false };
}

/** What one sign-in attempt keeps between the redirect and the callback. */
export interface GoogleAttempt {
  state: string;
  nonce: string;
  verifier: string;
}

export function newAttempt(): GoogleAttempt {
  const random = () => crypto.randomBytes(32).toString('base64url');
  return { state: random(), nonce: random(), verifier: random() };
}

const challengeOf = (verifier: string) =>
  crypto.createHash('sha256').update(verifier).digest('base64url');

/** Where the browser goes to choose a Google account. */
export function authorizeUrl(
  config: GoogleConfig,
  attempt: GoogleAttempt,
  redirectUri: string,
  appBase: string
): string {
  const url = new URL(config.standIn ? `${appBase}/api/dev/google/authorize` : GOOGLE.authorize);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: attempt.state,
    nonce: attempt.nonce,
    code_challenge: challengeOf(attempt.verifier),
    code_challenge_method: 'S256',
    prompt: 'select_account'
  }).toString();
  return url.toString();
}

/** The Google account an ID token vouches for. */
export interface GoogleIdentity {
  sub: string;
  email: string;
  name: string;
}

export class GoogleSignInError extends Error {}

// --------------------------------------------------------------- the keys

let keys = new Map<string, crypto.KeyObject>();
let keysFetchedAt = 0;

async function signingKey(kid: string): Promise<crypto.KeyObject> {
  const known = keys.get(kid);
  if (known) return known;
  // An unknown key id: Google has rotated. Fetch again, at most once a minute.
  if (Date.now() - keysFetchedAt < 60_000 && keys.size > 0) {
    throw new GoogleSignInError('unknown signing key');
  }
  const res = await fetch(GOOGLE.jwks, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new GoogleSignInError(`keys: HTTP ${res.status}`);
  const body = (await res.json()) as { keys?: Array<crypto.JsonWebKey & { kid?: string }> };
  const next = new Map<string, crypto.KeyObject>();
  for (const jwk of body.keys ?? []) {
    if (jwk.kid && jwk.kty === 'RSA')
      next.set(jwk.kid, crypto.createPublicKey({ key: jwk, format: 'jwk' }));
  }
  keys = next;
  keysFetchedAt = Date.now();
  const key = keys.get(kid);
  if (!key) throw new GoogleSignInError('unknown signing key');
  return key;
}

// ------------------------------------------------------------- the stand-in

// Made on first use: production never pays for a key it does not need.
let standInPair: crypto.KeyPairKeyObjectResult | null = null;
const standInKey = () =>
  (standInPair ??= crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }));
const STAND_IN_KID = 'stand-in-1';
interface StandInGrant {
  identity: GoogleIdentity & { emailVerified: boolean };
  clientId: string;
  redirectUri: string;
  nonce: string;
  challenge: string;
  expires: number;
}
const standInGrants = new Map<string, StandInGrant>();

/** The stand-in's account chooser hands out a code for the account picked. */
export function standInGrant(grant: Omit<StandInGrant, 'expires'>): string {
  const code = crypto.randomBytes(24).toString('base64url');
  standInGrants.set(code, { ...grant, expires: Date.now() + 60_000 });
  return code;
}

function standInToken(code: string, verifier: string, config: GoogleConfig, redirectUri: string) {
  const grant = standInGrants.get(code);
  standInGrants.delete(code);
  if (!grant || grant.expires < Date.now()) throw new GoogleSignInError('invalid_grant');
  if (grant.clientId !== config.clientId || grant.redirectUri !== redirectUri) {
    throw new GoogleSignInError('invalid_grant');
  }
  if (challengeOf(verifier) !== grant.challenge) throw new GoogleSignInError('invalid_grant: PKCE');
  return jwt.sign(
    {
      email: grant.identity.email,
      email_verified: grant.identity.emailVerified,
      name: grant.identity.name,
      nonce: grant.nonce
    },
    standInKey().privateKey,
    {
      algorithm: 'RS256',
      keyid: STAND_IN_KID,
      issuer: STAND_IN_ISSUER,
      audience: config.clientId,
      subject: grant.identity.sub,
      expiresIn: 300
    }
  );
}

// ------------------------------------------------------------ the exchange

/**
 * Trades the code for an ID token and returns the verified identity. Throws
 * GoogleSignInError for anything that is not a fresh, signed, verified,
 * ours-and-this-attempt's token.
 */
export async function identityFromCode(
  config: GoogleConfig,
  code: string,
  attempt: GoogleAttempt,
  redirectUri: string
): Promise<GoogleIdentity> {
  let idToken: string;
  if (config.standIn) {
    idToken = standInToken(code, attempt.verifier, config, redirectUri);
  } else {
    const res = await fetch(GOOGLE.token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: attempt.verifier
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    const body = (await res.json().catch(() => ({}))) as { id_token?: string; error?: string };
    if (!res.ok || !body.id_token)
      throw new GoogleSignInError(`token: ${body.error || res.status}`);
    idToken = body.id_token;
  }

  const header = jwt.decode(idToken, { complete: true })?.header;
  if (!header || header.alg !== 'RS256' || !header.kid) throw new GoogleSignInError('bad token');
  const key = config.standIn ? standInKey().publicKey : await signingKey(header.kid);
  let claims: jwt.JwtPayload;
  try {
    claims = jwt.verify(idToken, key, {
      algorithms: ['RS256'],
      audience: config.clientId,
      issuer: config.standIn ? STAND_IN_ISSUER : GOOGLE.issuers,
      clockTolerance: 60
    }) as jwt.JwtPayload;
  } catch (error) {
    throw new GoogleSignInError(`token: ${(error as Error).message}`);
  }
  if (typeof claims.nonce !== 'string' || claims.nonce !== attempt.nonce) {
    throw new GoogleSignInError('nonce');
  }
  if (typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 255) {
    throw new GoogleSignInError('subject');
  }
  // Only an address Google has verified identifies anyone.
  if (claims.email_verified !== true || typeof claims.email !== 'string') {
    throw new GoogleSignInError('email not verified');
  }
  const email = claims.email.trim().toLowerCase();
  const name = typeof claims.name === 'string' ? claims.name.trim() : '';
  return { sub: claims.sub, email, name };
}

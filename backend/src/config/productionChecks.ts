// What a production deployment must have before it starts (plan §13.5).
//
// Every check is here, in one function, and the server refuses to boot with
// the full list of what is wrong rather than the first item: an operator
// fixing .env.production should not have to restart six times to find six
// mistakes. Development never runs it.
//
// Each check names a variable and why; nothing here prints a secret.

import { billingConfigProblems } from './billing';

/** Values the example files ship with; a production server must not keep them. */
const PLACEHOLDER =
  /^(replace-with|change[-_]?me|changeme|your[-_]|example|supportchat$|password$|secret$)/i;

const value = (name: string) => String(process.env[name] || '').trim();

function looksPlaceholder(raw: string): boolean {
  return !raw || PLACEHOLDER.test(raw);
}

/** The password inside a connection URL, or '' when there is none. */
function urlPassword(url: string): string {
  try {
    return decodeURIComponent(new URL(url).password);
  } catch {
    return '';
  }
}

/** The database password, whether given on its own or inside DATABASE_URL. */
function databasePassword(): string {
  const url = value('DATABASE_URL');
  return url ? urlPassword(url) : value('DB_PASSWORD');
}

export function productionConfigProblems(): string[] {
  const problems: string[] = [];

  const jwt = value('JWT_SECRET');
  if (jwt.length < 32 || looksPlaceholder(jwt)) {
    problems.push('JWT_SECRET must be a random value of at least 32 characters');
  }
  // During a rotation (SEC-18) the old secret is still trusted for checking.
  const previous = value('JWT_SECRET_PREVIOUS');
  if (previous && (previous.length < 32 || looksPlaceholder(previous))) {
    problems.push('JWT_SECRET_PREVIOUS, when set, must be the old secret (32+ characters)');
  }
  if (!value('CORS_ORIGINS')) {
    problems.push('CORS_ORIGINS must list the panel’s origin');
  }
  if (looksPlaceholder(databasePassword())) {
    problems.push(
      'DB_PASSWORD (or the password in DATABASE_URL) is empty or still the example value'
    );
  }

  // Redis is reachable only on the Docker network and still asks for a
  // password (SEC-12), so a neighbour container cannot read or wipe it.
  const redisUrl = value('REDIS_URL');
  if (redisUrl) {
    const redisPassword = value('REDIS_PASSWORD') || urlPassword(redisUrl);
    if (redisPassword.length < 24 || looksPlaceholder(redisPassword)) {
      problems.push('REDIS_PASSWORD must be a random value of at least 24 characters');
    } else if (!urlPassword(redisUrl)) {
      problems.push('REDIS_URL must carry the password: redis://:<REDIS_PASSWORD>@redis:6379');
    }
  }

  const base = value('APP_BASE_URL');
  if (!/^https:\/\/[^/]+/.test(base)) {
    problems.push(
      'APP_BASE_URL must be the https:// address of the panel (links in e-mails use it)'
    );
  }

  const mail = value('MAIL_PROVIDER').toLowerCase() || 'smtp';
  if (mail === 'console') {
    problems.push(
      'MAIL_PROVIDER=console prints mails instead of sending them; use smtp in production'
    );
  } else if (!value('SMTP_HOST') || !value('MAIL_FROM')) {
    problems.push(
      'MAIL_PROVIDER=smtp needs SMTP_HOST and MAIL_FROM (and SMTP_USER/SMTP_PASS if the server asks)'
    );
  }

  for (const missing of billingConfigProblems()) {
    problems.push(`BILLING_ENABLED=true needs ${missing}`);
  }

  // Upload decision A (plan §12): files live in S3-compatible storage. Local
  // disk is a volume nothing backs up (DR-04), so it needs saying twice.
  if (value('UPLOAD_STORAGE') === 'local') {
    if (value('ALLOW_LOCAL_UPLOADS') !== 'true') {
      problems.push(
        'UPLOAD_STORAGE=local keeps attachments on a volume the backups do not cover; use s3, or set ALLOW_LOCAL_UPLOADS=true and back up the uploads volume yourself'
      );
    }
  } else {
    const bucket = value('S3_BUCKET') || value('AWS_BUCKET_NAME');
    const keys = value('AWS_ACCESS_KEY_ID') && value('AWS_SECRET_ACCESS_KEY');
    const region = value('AWS_REGION') || value('S3_REGION') || value('S3_ENDPOINT');
    if (!bucket || !keys || !region) {
      problems.push(
        'File uploads need S3-compatible storage: S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AWS_REGION (or S3_ENDPOINT for R2/Hetzner)'
      );
    }
  }

  return problems;
}

/**
 * What production can run without but should not: logged once at boot, never
 * fatal. Each line says what is missing and what it costs.
 */
export function productionConfigWarnings(): string[] {
  const warnings: string[] = [];
  if (!value('TURNSTILE_SECRET') || !value('TURNSTILE_SITE_KEY')) {
    warnings.push(
      'TURNSTILE_SITE_KEY / TURNSTILE_SECRET are empty: the sign-up form has no bot check (SEC-06)'
    );
  }
  return warnings;
}

/** Throws with every problem at once; the server calls it in production. */
export function assertProductionConfig(): void {
  const problems = productionConfigProblems();
  if (problems.length) {
    throw new Error(`Production configuration is incomplete:\n  - ${problems.join('\n  - ')}`);
  }
  for (const warning of productionConfigWarnings()) console.warn(`[config] ${warning}`);
}

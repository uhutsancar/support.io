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

/** The database password, whether given on its own or inside DATABASE_URL. */
function databasePassword(): string {
  const url = value('DATABASE_URL');
  if (url) {
    try {
      return decodeURIComponent(new URL(url).password);
    } catch {
      return '';
    }
  }
  return value('DB_PASSWORD');
}

export function productionConfigProblems(): string[] {
  const problems: string[] = [];

  const jwt = value('JWT_SECRET');
  if (jwt.length < 32 || looksPlaceholder(jwt)) {
    problems.push('JWT_SECRET must be a random value of at least 32 characters');
  }
  if (!value('CORS_ORIGINS')) {
    problems.push('CORS_ORIGINS must list the panel’s origin');
  }
  if (looksPlaceholder(databasePassword())) {
    problems.push(
      'DB_PASSWORD (or the password in DATABASE_URL) is empty or still the example value'
    );
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
  // disk inside the container is lost on every deploy.
  if (value('UPLOAD_STORAGE') !== 'local') {
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

/** Throws with every problem at once; the server calls it in production. */
export function assertProductionConfig(): void {
  const problems = productionConfigProblems();
  if (problems.length) {
    throw new Error(`Production configuration is incomplete:\n  - ${problems.join('\n  - ')}`);
  }
}

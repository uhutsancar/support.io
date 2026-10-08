// Re-sealing stored secrets after JWT_SECRET changes (plan v10 SEC-18).
//
// The rotation, as docs/production-runbook.md §8 lays it out:
//   1. JWT_SECRET_PREVIOUS = the old value, JWT_SECRET = a new one; deploy.
//      Sessions, links and sealed values made with the old one keep working.
//   2. npm run secrets:rotate:prod — every sealed value (site identity
//      secrets, authenticator secrets) is opened and sealed again under the
//      new key. Recovery codes cannot be re-hashed without the codes, so the
//      report counts the accounts still holding old ones.
//   3. After the overlap (7 days: the longest session), JWT_SECRET_PREVIOUS
//      is emptied and the old secret is gone.

import { query } from '../db/pool';
import { reseal, sealedWithCurrentKey } from '../config/secretBox';
import { recoveryCodeIsCurrent } from './mfa';

export interface RotationReport {
  /** Values now under the current key. */
  resealed: number;
  /** Values that already were. */
  current: number;
  /** Values no known key opens; left as they are (they read as not configured). */
  unreadable: number;
  /** Accounts with recovery codes hashed under the old key. */
  oldRecoveryCodes: number;
}

interface Sealed {
  table: string;
  id: string;
  value: string;
}

async function sealedValues(organizationId: string | null): Promise<Sealed[]> {
  const scoped = (column: string) => `($1::text IS NULL OR ${column} = $1)`;
  const { rows: sites } = await query<{ id: string; value: string }>(
    `SELECT id, integrations->>'identitySecret' AS value FROM sites
      WHERE integrations ? 'identitySecret' AND ${scoped('organization_id')}`,
    [organizationId]
  );
  const accounts: Sealed[] = [];
  for (const table of ['users', 'teams']) {
    // eslint-disable-next-line no-await-in-loop
    const { rows } = await query<{ id: string; value: string }>(
      `SELECT id, totp_secret_enc AS value FROM ${table}
        WHERE totp_secret_enc IS NOT NULL AND ${scoped('organization_id')}`,
      [organizationId]
    );
    accounts.push(...rows.map((r) => ({ table, ...r })));
  }
  // Slack addresses, Telegram tokens and webhook secrets (PRD-11).
  const { rows: integrations } = await query<{ id: string; value: string }>(
    `SELECT id, config AS value FROM integrations WHERE ${scoped('organization_id')}`,
    [organizationId]
  );
  return [
    ...sites.map((r) => ({ table: 'sites', ...r })),
    ...accounts,
    ...integrations.map((r) => ({ table: 'integrations', ...r }))
  ];
}

async function store({ table, id }: Sealed, value: string): Promise<void> {
  if (table === 'sites') {
    await query(
      `UPDATE sites SET integrations = jsonb_set(integrations, '{identitySecret}', to_jsonb($2::text))
        WHERE id = $1`,
      [id, value]
    );
  } else if (table === 'integrations') {
    await query('UPDATE integrations SET config = $2 WHERE id = $1', [id, value]);
  } else {
    await query(`UPDATE ${table} SET totp_secret_enc = $2 WHERE id = $1`, [id, value]);
  }
}

/**
 * Re-seals every stored secret under the current key. `dryRun` only counts;
 * `organizationId` limits it to one workspace (tests, a single customer).
 */
export async function rotateSealedSecrets({
  dryRun = false,
  organizationId = null
}: { dryRun?: boolean; organizationId?: string | null } = {}): Promise<RotationReport> {
  const report: RotationReport = { resealed: 0, current: 0, unreadable: 0, oldRecoveryCodes: 0 };
  for (const item of await sealedValues(organizationId)) {
    if (sealedWithCurrentKey(item.value)) {
      report.current += 1;
      continue;
    }
    const next = reseal(item.value);
    if (next === null) {
      report.unreadable += 1;
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    if (!dryRun) await store(item, next);
    report.resealed += 1;
  }
  for (const table of ['users', 'teams']) {
    // eslint-disable-next-line no-await-in-loop
    const { rows } = await query<{ codes: string[] }>(
      `SELECT recovery_codes AS codes FROM ${table}
        WHERE jsonb_array_length(recovery_codes) > 0
          AND ($1::text IS NULL OR organization_id = $1)`,
      [organizationId]
    );
    report.oldRecoveryCodes += rows.filter((r) =>
      r.codes.some((code) => !recoveryCodeIsCurrent(code))
    ).length;
  }
  return report;
}

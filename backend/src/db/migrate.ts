'use strict';

// Versioned schema migrations.
//
// The schema used to be one idempotent schema.sql that every boot ran in full.
// That works until a change cannot be written idempotently — dropping a column,
// backfilling data once, tightening a constraint that old rows violate — and it
// gives no record of what a database has actually been through.
//
// Now every change is a numbered file in ./migrations, applied once, in order,
// each inside its own transaction, and recorded in `schema_migrations`:
//
//   0000_baseline.sql    the schema at 0eef74f (idempotent, so a database that
//                        ran the old boot-time schema.sql takes it unchanged)
//   0001_....sql         every change since, never edited once released
//
// An advisory lock serialises concurrent runs (two processes booting at once,
// or a deploy's one-off migrate racing a container that still migrates on
// boot). Production runs `node dist/db/migrate.js` once per deploy and boots
// with MIGRATE_ON_BOOT=false; development keeps migrating on boot.
//
// schema.sql next to this file is generated from the migrations
// (`npm run db:schema`) as a readable whole; nothing executes it.

// Loads .env before any module below reads it; see src/config/env.ts.
import { isProduction } from '../config/env';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { pool } from './pool';
import type { PoolClient } from 'pg';

export const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

// Any positive constant works; it only has to be the same in every process.
const SCHEMA_LOCK_KEY = 815274301;

/** `0007_short_name.sql`: four digits, then a lower-case slug. */
const FILE_PATTERN = /^(\d{4})_[a-z0-9_]+\.sql$/;

export interface Migration {
  version: string;
  file: string;
  sql: string;
  checksum: string;
}

/** The migration files, in the order they apply. */
export function loadMigrations(dir: string = MIGRATIONS_DIR): Migration[] {
  const files = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  const seen = new Set<string>();
  return files.map((file) => {
    const match = FILE_PATTERN.exec(file);
    if (!match) throw new Error(`Migration file name not understood: ${file}`);
    const version = match[1];
    if (seen.has(version)) throw new Error(`Two migrations share version ${version}`);
    seen.add(version);

    // Line endings are normalised before hashing so a Windows checkout and the
    // Linux image agree on the checksum of the same file.
    const sql = fs.readFileSync(path.join(dir, file), 'utf8').replace(/\r\n/g, '\n');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');
    return { version, file, sql, checksum };
  });
}

async function ensureLedger(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     text PRIMARY KEY,
      name        text NOT NULL,
      checksum    text NOT NULL,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )`);
}

async function appliedLedger(client: PoolClient): Promise<Map<string, string>> {
  const { rows } = await client.query<{ version: string; checksum: string }>(
    'SELECT version, checksum FROM schema_migrations'
  );
  return new Map(rows.map((row) => [row.version, row.checksum]));
}

/**
 * A released migration must never change: the databases that already ran it
 * would silently differ from the ones that run the new text. In production
 * that refuses the boot; in development, where migrations are still being
 * written, it is a warning.
 */
function checkUnchanged(migrations: Migration[], applied: Map<string, string>): void {
  for (const migration of migrations) {
    const recorded = applied.get(migration.version);
    if (!recorded || recorded === migration.checksum) continue;
    const message = `Migration ${migration.file} was edited after it was applied`;
    if (isProduction) throw new Error(message);
    console.warn(`[migrate] ${message}; the database keeps the earlier version.`);
  }
}

async function withLock<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [SCHEMA_LOCK_KEY]);
    try {
      return await fn(client);
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [SCHEMA_LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}

/**
 * Applies every migration this database has not seen, oldest first.
 * Returns the versions it applied. A failure rolls back that one migration
 * and stops: the ones before it stay applied, nothing after it runs.
 */
export async function runMigrations({
  log = console.log
}: { log?: (line: string) => void } = {}): Promise<string[]> {
  const migrations = loadMigrations();
  return withLock(async (client) => {
    await ensureLedger(client);
    const applied = await appliedLedger(client);
    checkUnchanged(migrations, applied);

    const done: string[] = [];
    for (const migration of migrations) {
      if (applied.has(migration.version)) continue;
      try {
        // eslint-disable-next-line no-await-in-loop -- strictly one after another
        await client.query('BEGIN');
        // eslint-disable-next-line no-await-in-loop
        await client.query(migration.sql);
        // eslint-disable-next-line no-await-in-loop
        await client.query(
          'INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)',
          [migration.version, migration.file, migration.checksum]
        );
        // eslint-disable-next-line no-await-in-loop
        await client.query('COMMIT');
      } catch (error) {
        // eslint-disable-next-line no-await-in-loop
        await client.query('ROLLBACK').catch(() => {});
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`Migration ${migration.file} failed: ${reason}`);
      }
      log(`[migrate] applied ${migration.file}`);
      done.push(migration.version);
    }
    return done;
  });
}

/** The migrations this database still needs, without applying anything. */
export async function pendingMigrations(): Promise<string[]> {
  const migrations = loadMigrations();
  return withLock(async (client) => {
    await ensureLedger(client);
    const applied = await appliedLedger(client);
    checkUnchanged(migrations, applied);
    return migrations.filter((m) => !applied.has(m.version)).map((m) => m.file);
  });
}

/** Whether this process should migrate on boot (MIGRATE_ON_BOOT, default on). */
export function migrateOnBoot(): boolean {
  return String(process.env.MIGRATE_ON_BOOT ?? 'true').toLowerCase() !== 'false';
}

/** Kept for callers written against the old single-file schema. */
export const applySchema = runMigrations;

// Run directly: `npm run db:migrate` (tsx) or `node dist/db/migrate.js` (built image, no npm).
if (require.main === module) {
  runMigrations()
    .then((applied) => {
      console.log(
        applied.length
          ? `PostgreSQL migrations applied: ${applied.join(', ')}`
          : 'PostgreSQL schema is up to date.'
      );
      return pool.end();
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}

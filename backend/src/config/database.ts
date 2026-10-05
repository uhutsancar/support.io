// Opens the PostgreSQL connection, makes sure the schema is current and starts
// the log retention sweeps. Connection details are read from the environment
// only.
//
// Development migrates on boot. Production boots with MIGRATE_ON_BOOT=false:
// the deploy runs the migrations once, before the new containers start, and a
// server that finds one still pending refuses to start rather than run against
// a schema it was not written for.
import { pool, query } from '../db/pool';
import { migrateOnBoot, pendingMigrations, runMigrations } from '../db/migrate';
import { startRetentionSweeps } from '../db/retention';

/** The SQLSTATE and message behind whatever the driver threw. */
function describeDriverError(error: unknown): { code: string; message: string } {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  const message = error instanceof Error ? error.message : String(error);
  return { code, message };
}

const connectDB = async () => {
  try {
    if (!process.env.DATABASE_URL && !process.env.DB_HOST) {
      console.error(
        'PostgreSQL configuration missing: set DATABASE_URL or DB_HOST/DB_NAME/DB_USER/DB_PASSWORD'
      );
      process.exit(1);
    }

    await query('SELECT 1');
    if (migrateOnBoot()) {
      await runMigrations();
    } else {
      const pending = await pendingMigrations();
      if (pending.length) {
        console.error(
          `Pending migrations: ${pending.join(', ')}. ` +
            'Run `npm run db:migrate:prod` before starting this release.'
        );
        process.exit(1);
      }
    }
    startRetentionSweeps();

    pool.on('error', (err) => {
      console.error('PostgreSQL pool error:', err.message);
    });
  } catch (error) {
    // Narrowed rather than read off `unknown`: a driver that throws a string
    // would otherwise log "undefined" and hide the actual cause.
    const { code, message } = describeDriverError(error);
    console.error('PostgreSQL connection failed:', message);

    if (code === 'ECONNREFUSED') {
      console.error('The database refused the connection. Check DB_HOST and DB_PORT.');
    } else if (code === '28P01' || /password authentication/i.test(message)) {
      console.error('Authentication failed. Check DB_USER and DB_PASSWORD.');
    } else if (code === '3D000') {
      console.error('The database named in DB_NAME does not exist.');
    } else if (code === 'ENOTFOUND') {
      console.error('The database host could not be resolved.');
    }

    process.exit(1);
  }
};

// The database half of the readiness probe (GET /ready).
const isConnected = async () => {
  try {
    await query('SELECT 1');
    return true;
  } catch {
    return false;
  }
};

export { connectDB, isConnected };
export default connectDB;

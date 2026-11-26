// `npm run test:db-roles` — the production database contract on a real,
// throwaway PostgreSQL (needs Docker; touches no existing container or volume).
//
// The development stack connects as one superuser, which hides permission
// bugs. This starts the same PostgreSQL image with docker/postgres/init-roles.sh
// and checks, with three separate roles:
//
//   empty database   admin preparation → migrator → server as the runtime role
//                    → /ready → sign-up and e-mail verification through the API
//   existing data    sample conversation → preparation and migrator again →
//                    server again: rows, messages and the ledger unchanged
//   backup/restore   pg_dump as the read-only backup role → a new database →
//                    owners, migration version, conversation, runtime writes

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { Client } from 'pg';

const IMAGE =
  'postgres:16.15-trixie@sha256:65b16a8b326e0cfbdf33fa7e783f2a0cb352a61448616ccccfd616ef42aa0f65';
const BACKEND = path.join(__dirname, '..');
const INIT_SCRIPT = path.join(BACKEND, '..', 'docker', 'postgres', 'init-roles.sh');
const INIT_IN_CONTAINER = '/docker-entrypoint-initdb.d/010-supportio-roles.sh';
const NAME = `supportio-dbroles-${process.pid}`;
const DB = 'supportchat';
const RESTORED = 'restore_check';
const secret = () => crypto.randomBytes(12).toString('hex');
const roles = {
  admin: { user: 'support_admin', password: secret() },
  migrator: { user: 'support_migrator', password: secret() },
  runtime: { user: 'support_runtime', password: secret() },
  backup: { user: 'support_backup', password: secret() }
};
let port = 0;

function docker(args: string[], input?: Buffer): Buffer {
  const run = spawnSync('docker', args, { input, maxBuffer: 256 * 1024 * 1024 });
  if (run.status !== 0) {
    throw new Error(`docker ${args.slice(0, 3).join(' ')} failed: ${run.stderr.toString().trim()}`);
  }
  return run.stdout;
}

const url = (role: keyof typeof roles, db = DB) =>
  `postgresql://${roles[role].user}:${roles[role].password}@127.0.0.1:${port}/${db}`;

async function sql<T = Record<string, unknown>>(
  role: keyof typeof roles,
  text: string,
  params: unknown[] = [],
  db = DB
): Promise<T[]> {
  const client = new Client({ connectionString: url(role, db) });
  await client.connect();
  try {
    return (await client.query(text, params)).rows as T[];
  } finally {
    await client.end();
  }
}

async function sqlError(role: keyof typeof roles, text: string, db = DB): Promise<string> {
  try {
    await sql(role, text, [], db);
    return '';
  } catch (error) {
    return (error as { code?: string }).code ?? String(error);
  }
}

/** The environment a backend process gets: only this database, no providers. */
function backendEnv(role: keyof typeof roles, extra: Record<string, string> = {}) {
  return {
    ...process.env,
    NODE_ENV: 'development',
    DATABASE_URL: url(role),
    DB_HOST: '',
    REDIS_URL: '',
    JWT_SECRET: crypto.randomBytes(32).toString('hex'),
    UPLOAD_STORAGE: 'local',
    MAIL_PROVIDER: 'console',
    GEMINI_API_KEY: '',
    AWS_ACCESS_KEY_ID: '',
    AWS_SECRET_ACCESS_KEY: '',
    ...extra
  };
}

function runNode(script: string, args: string[], env: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, ['--import', 'tsx', script, ...args], {
    cwd: BACKEND,
    env,
    encoding: 'utf8',
    timeout: 120_000
  });
}

const migrate = () => runNode('src/db/migrate.ts', [], backendEnv('migrator'));

interface Server {
  process: ChildProcess;
  base: string;
  output: () => string;
}

async function startServer(): Promise<Server> {
  const serverPort = 40000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
    cwd: BACKEND,
    env: backendEnv('runtime', { PORT: String(serverPort), MIGRATE_ON_BOOT: 'false' })
  });
  let log = '';
  child.stdout?.on('data', (chunk) => (log += chunk));
  child.stderr?.on('data', (chunk) => (log += chunk));
  const base = `http://127.0.0.1:${serverPort}`;
  for (let i = 0; i < 120; i += 1) {
    if (child.exitCode !== null) break;
    const ready = await fetch(`${base}/ready`).catch(() => null);
    if (ready?.ok) return { process: child, base, output: () => log };
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  child.kill();
  throw new Error(`the server did not become ready:\n${log.slice(-2000)}`);
}

async function stopServer(server: Server) {
  if (server.process.exitCode !== null) return;
  const exited = new Promise((resolve) => server.process.once('exit', resolve));
  server.process.kill();
  await exited;
}

before(async () => {
  docker([
    'run',
    '-d',
    '--rm',
    '--name',
    NAME,
    '-e',
    `POSTGRES_DB=${DB}`,
    '-e',
    `POSTGRES_USER=${roles.admin.user}`,
    '-e',
    `POSTGRES_PASSWORD=${roles.admin.password}`,
    '-e',
    `DB_MIGRATION_USER=${roles.migrator.user}`,
    '-e',
    `DB_MIGRATION_PASSWORD=${roles.migrator.password}`,
    '-e',
    `DB_RUNTIME_USER=${roles.runtime.user}`,
    '-e',
    `DB_RUNTIME_PASSWORD=${roles.runtime.password}`,
    '-e',
    `DB_BACKUP_USER=${roles.backup.user}`,
    '-e',
    `DB_BACKUP_PASSWORD=${roles.backup.password}`,
    '-v',
    `${INIT_SCRIPT}:${INIT_IN_CONTAINER}:ro`,
    '-p',
    '127.0.0.1::5432',
    IMAGE
  ]);
  port = Number(docker(['port', NAME, '5432/tcp']).toString().trim().split(':').pop());
  // The entrypoint runs the init scripts on a socket-only server, then
  // restarts listening on TCP, so a TCP login means preparation is finished.
  for (let i = 0; i < 120; i += 1) {
    if (
      await sql('runtime', 'SELECT 1').then(
        () => true,
        () => false
      )
    )
      return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(docker(['logs', NAME]).toString().slice(-2000));
});

after(() => {
  spawnSync('docker', ['rm', '-f', NAME]);
});

test('empty database: prepared by the admin, migrated, served by the runtime role', async () => {
  const [extension] = await sql('admin', "SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'");
  assert.ok(extension, 'the admin preparation installs pg_trgm in the application database');

  const unmigrated = runNode(
    'src/server.ts',
    [],
    backendEnv('runtime', { PORT: '0', MIGRATE_ON_BOOT: 'false' })
  );
  assert.equal(unmigrated.status, 1, 'a server must not start on an unmigrated database');
  assert.match(unmigrated.stderr + unmigrated.stdout, /no schema_migrations table/);
  assert.doesNotMatch(unmigrated.stderr + unmigrated.stdout, /permission denied/);

  const migrated = migrate();
  assert.equal(migrated.status, 0, migrated.stderr);
  const [{ count }] = await sql<{ count: string }>(
    'admin',
    'SELECT count(*) FROM schema_migrations'
  );
  assert.ok(Number(count) > 30, `ledger has ${count} migrations`);

  const [migratorIs] = await sql<{ u: string }>('migrator', 'SELECT current_user AS u');
  const [runtimeIs] = await sql<{ u: string }>('runtime', 'SELECT current_user AS u');
  assert.equal(migratorIs.u, roles.migrator.user);
  assert.equal(runtimeIs.u, roles.runtime.user);
  assert.notEqual(migratorIs.u, runtimeIs.u);

  // The runtime role reads the ledger, never writes it, and creates nothing.
  assert.equal(await sqlError('runtime', 'SELECT count(*) FROM schema_migrations'), '');
  assert.equal(
    await sqlError('runtime', "INSERT INTO schema_migrations VALUES ('9999','x','x')"),
    '42501'
  );
  assert.equal(await sqlError('runtime', "UPDATE schema_migrations SET name = 'x'"), '42501');
  assert.equal(await sqlError('runtime', 'DELETE FROM schema_migrations'), '42501');
  assert.equal(await sqlError('runtime', 'CREATE TABLE intruder (id int)'), '42501');
  assert.equal(await sqlError('runtime', 'CREATE SCHEMA intruder'), '42501');
  const [flags] = await sql<{ rolsuper: boolean; rolcreatedb: boolean; rolcreaterole: boolean }>(
    'admin',
    'SELECT rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = $1',
    [roles.runtime.user]
  );
  assert.deepEqual(flags, { rolsuper: false, rolcreatedb: false, rolcreaterole: false });

  const server = await startServer();
  try {
    const email = `owner-${secret()}@example.test`;
    const registered = await fetch(`${server.base}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Role Check', email, password: 'Str0ng-Passw0rd!' })
    });
    assert.equal(registered.status, 201, await registered.text());
    const outbox = await (
      await fetch(`${server.base}/api/dev/outbox?to=${encodeURIComponent(email)}`)
    ).json();
    const link = JSON.stringify(outbox).match(/verify-email\?token=([^"&\\]+)/);
    assert.ok(link, 'verification mail in the dev outbox');
    const verified = await fetch(`${server.base}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: decodeURIComponent(link[1]) })
    });
    assert.equal(verified.status, 200, await verified.text());
    const [user] = await sql('admin', 'SELECT 1 FROM users WHERE email = $1', [email]);
    assert.ok(user, 'the runtime role wrote the account');
  } finally {
    await stopServer(server);
  }
});

let sampleMessage = '';
let sampleConversation = '';

test('existing database: preparation and migrations run again without touching data', async () => {
  const seeded = runNode('src/db/seed.ts', [], backendEnv('migrator'));
  assert.equal(seeded.status, 0, seeded.stderr);
  const [row] = await sql<{ conversation_id: string; content: string }>(
    'runtime',
    "SELECT conversation_id, content FROM messages WHERE sender_type = 'visitor' ORDER BY id LIMIT 1"
  );
  sampleConversation = row.conversation_id;
  sampleMessage = row.content;
  const snapshot = async () => ({
    ledger: await sql(
      'admin',
      'SELECT version, checksum, applied_at FROM schema_migrations ORDER BY version'
    ),
    counts: await sql(
      'admin',
      'SELECT (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM conversations) AS conversations, (SELECT count(*) FROM messages) AS messages'
    )
  });
  const before = await snapshot();

  docker(['exec', NAME, INIT_IN_CONTAINER]);
  const again = migrate();
  assert.equal(again.status, 0, again.stderr);
  assert.match(again.stdout, /up to date/);

  const server = await startServer();
  await stopServer(server);

  assert.deepEqual(await snapshot(), before);
  const [kept] = await sql<{ content: string }>(
    'runtime',
    'SELECT content FROM messages WHERE conversation_id = $1 AND content = $2',
    [sampleConversation, sampleMessage]
  );
  assert.ok(kept, 'the sample message survives');
});

test('backup restores into a new database that the roles can use', async () => {
  docker([
    'exec',
    NAME,
    'sh',
    '-c',
    `pg_dump -Fc -U ${roles.backup.user} -d ${DB} -f /tmp/backup.dump`
  ]);
  assert.equal(
    await sqlError('backup', "INSERT INTO schema_migrations VALUES ('9999','x','x')"),
    '42501',
    'the backup role only reads'
  );

  docker(['exec', NAME, 'createdb', '-U', roles.admin.user, RESTORED]);
  docker([
    'exec',
    NAME,
    'pg_restore',
    '-U',
    roles.admin.user,
    '-d',
    RESTORED,
    '--exit-on-error',
    '/tmp/backup.dump'
  ]);
  docker(['exec', NAME, INIT_IN_CONTAINER, RESTORED]);

  const latest = async (db: string) =>
    (
      await sql<{ v: string }>('admin', 'SELECT max(version) AS v FROM schema_migrations', [], db)
    )[0].v;
  assert.equal(await latest(RESTORED), await latest(DB));

  const [owner] = await sql<{ owner: string }>(
    'admin',
    "SELECT tableowner AS owner FROM pg_tables WHERE tablename = 'messages'",
    [],
    RESTORED
  );
  assert.equal(owner.owner, roles.migrator.user, 'tables keep their owner');

  const [message] = await sql(
    'runtime',
    'SELECT 1 FROM messages WHERE conversation_id = $1 AND content = $2',
    [sampleConversation, sampleMessage],
    RESTORED
  );
  assert.ok(message, 'the sample conversation is in the restored database');
  await sql(
    'runtime',
    `INSERT INTO messages (id, conversation_id, sender_type, sender_id, sender_name, content)
     VALUES ($1, $2, 'agent', 'restore-check', 'Restore check', 'written after restore')`,
    [crypto.randomBytes(12).toString('hex'), sampleConversation],
    RESTORED
  );
  assert.equal(
    await sqlError('runtime', 'CREATE TABLE intruder (id int)', RESTORED),
    '42501',
    'the runtime role stays restricted'
  );
});

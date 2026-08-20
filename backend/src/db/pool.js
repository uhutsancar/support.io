'use strict';

const { Pool } = require('pg');

// Connection details come exclusively from the environment. DATABASE_URL wins
// when present, otherwise the discrete DB_* variables are used.
function buildConfig() {
  // Havuz boyutu yük altında en kritik ayardır: eşzamanlı istek sayısı havuzu
  // aştığında istekler kuyrukta bekler ve gecikme doğrusal değil üstel büyür.
  // Kaba kural: (çekirdek sayısı × 2) + disk sayısı, ancak PostgreSQL'in
  // max_connections değerini süreç sayısıyla çarpıp aşmamak şartıyla.
  const base = {
    max: parseInt(process.env.DB_POOL_MAX, 10) || 20,
    min: parseInt(process.env.DB_POOL_MIN, 10) || 0,
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS, 10) || 30000,
    // Havuz doluyken yeni istek bu süre boyunca bekler. Eskiden 30sn idi:
    // yığılma anında istekler yarım dakika asılı kalıp istemci tarafında
    // zaman aşımına uğruyordu. Hızlı başarısızlık daha okunur bir davranış.
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS, 10) || 10000,
    // Tek bir kaçak sorgu havuzu süresiz tutmasın.
    statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT_MS, 10) || 15000,
    application_name: 'supportchat-backend'
  };

  // Managed providers require TLS, a local server usually rejects it. `DB_SSL`
  // overrides the guess when the default is wrong for a given deployment.
  const sslEnv = (process.env.DB_SSL || '').toLowerCase();
  let ssl = false;
  if (sslEnv === 'true' || sslEnv === 'require') ssl = { rejectUnauthorized: false };
  else if (sslEnv === 'false' || sslEnv === 'disable') ssl = false;
  else if (process.env.DATABASE_URL && /[?&]sslmode=(require|verify)/i.test(process.env.DATABASE_URL)) {
    ssl = { rejectUnauthorized: false };
  }

  if (process.env.DATABASE_URL) {
    return { ...base, connectionString: process.env.DATABASE_URL, ssl };
  }

  if (!process.env.DB_HOST || !process.env.DB_NAME) {
    throw new Error('PostgreSQL configuration missing: set DATABASE_URL or DB_HOST/DB_NAME/DB_USER/DB_PASSWORD');
  }

  return {
    ...base,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl
  };
}

// The pool is created on first use so that any entry point (server, migration
// script, one-off tooling) can load its .env before the configuration is read.
let poolInstance = null;

function getPool() {
  if (!poolInstance) {
    poolInstance = new Pool(buildConfig());
    poolInstance.on('error', (err) => {
      console.error('PostgreSQL idle client error:', err.message);
    });
  }
  return poolInstance;
}

// Callers keep using `pool.query(...)` / `pool.end()`; the proxy just defers
// construction until the first property access.
const pool = new Proxy({}, {
  get(_target, prop) {
    const instance = getPool();
    const value = instance[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  }
});

function query(text, params) {
  return getPool().query(text, params);
}

// Runs `fn` inside a transaction, rolling back on any error.
async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) { /* connection already gone */ }
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { pool, getPool, query, withTransaction };

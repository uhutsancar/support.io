// Connection details come exclusively from the environment. DATABASE_URL wins
// when present, otherwise the discrete DB_* variables are used.
import { Pool } from 'pg';
import type { PoolClient, PoolConfig, QueryResult, QueryResultRow } from 'pg';

function buildConfig(): PoolConfig {
  // Havuz boyutu yük altında en kritik ayardır, ama BÜYÜTMEK genelde çözüm
  // değildir. Havuz, veritabanını aşırı yüklenmeye karşı koruyan kuyruktur:
  // PostgreSQL'in paralel işleyebileceğinden fazla bağlantı açıldığında
  // sorgular birbiriyle CPU için yarışır ve kuyruk beklemesi sorgunun kendi
  // süresine eklenir.
  //
  // Ölçüldü (250 bin konuşma, 30 eşzamanlı temsilci + 40 eşzamanlı ziyaretçi):
  //
  //   DB_POOL_MAX=20  →  mesaj gönderme p95 = 1703 ms
  //   DB_POOL_MAX=50  →  mesaj gönderme p95 = 3666 ms
  //
  // Yani havuzu 2,5 katına çıkarmak gecikmeyi iki katına çıkardı. Yavaşlık
  // görüldüğünde önce sorgu sayısı ve sorgu maliyeti düşürülmeli; havuz en son
  // ve ölçerek değiştirilmelidir.
  //
  // Kaba kural: (çekirdek sayısı × 2) + disk sayısı, ancak toplam bağlantı
  // (süreç sayısı × DB_POOL_MAX) PostgreSQL'in max_connections değerini
  // aşmamak şartıyla.
  const base: PoolConfig = {
    max: parseInt(process.env.DB_POOL_MAX ?? '', 10) || 20,
    min: parseInt(process.env.DB_POOL_MIN ?? '', 10) || 0,
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS ?? '', 10) || 30000,
    // Havuz doluyken yeni istek bu süre boyunca bekler. Eskiden 30sn idi:
    // yığılma anında istekler yarım dakika asılı kalıp istemci tarafında
    // zaman aşımına uğruyordu. Hızlı başarısızlık daha okunur bir davranış.
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS ?? '', 10) || 10000,
    // Tek bir kaçak sorgu havuzu süresiz tutmasın.
    statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT_MS ?? '', 10) || 15000,
    application_name: 'supportchat-backend'
  };

  // Managed providers require TLS, a local server usually rejects it. `DB_SSL`
  // overrides the guess when the default is wrong for a given deployment.
  const sslEnv = (process.env.DB_SSL || '').toLowerCase();
  let ssl: PoolConfig['ssl'] = false;
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
    port: parseInt(process.env.DB_PORT ?? '', 10) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl
  };
}

// The pool is created on first use so that any entry point (server, migration
// script, one-off tooling) can load its .env before the configuration is read.
let poolInstance: Pool | null = null;

function getPool(): Pool {
  if (!poolInstance) {
    poolInstance = new Pool(buildConfig());
    poolInstance.on('error', (err: Error) => {
      console.error('PostgreSQL idle client error:', err.message);
    });
  }
  return poolInstance;
}

// Callers keep using `pool.query(...)` / `pool.end()`; the proxy just defers
// construction until the first property access.
const pool = new Proxy({} as Pool, {
  get(_target, prop: string | symbol) {
    const instance = getPool() as unknown as Record<string | symbol, unknown>;
    const value = instance[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  }
}) as Pool;

function query<R extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: readonly unknown[]
): Promise<QueryResult<R>> {
  return getPool().query<R>(text, params as unknown[]);
}

// Runs `fn` inside a transaction, rolling back on any error.
async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* connection already gone */ }
    throw error;
  } finally {
    client.release();
  }
}

export { pool, getPool, query, withTransaction };
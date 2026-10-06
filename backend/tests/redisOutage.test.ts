// Redis down: nothing that only uses it as a helper may wait for it (plan §18).
//
// In-process test, no API needed. Port 1 refuses connections, so the client
// keeps reconnecting in the background the whole time, which is the state a
// running server is in while Redis is stopped.
//
// The full outage drill (stop the container, run the message suites, start it
// again, watch the adapter resubscribe) is in docs/production-runbook.md.

import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { closeRedisClient, getRedisClient } from '../src/config/redis';
import { cached } from '../src/db/cache';

// Both are read when the client is created, not when the module loads.
process.env.REDIS_URL = 'redis://127.0.0.1:1';
process.env.REDIS_CONNECT_TIMEOUT_MS = '300';

after(async () => {
  await closeRedisClient();
});

async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const started = Date.now();
  const value = await fn();
  return [value, Date.now() - started];
}

test('the first call waits only for the connect timeout, later calls not at all', async () => {
  const [first, firstMs] = await timed(() => getRedisClient());
  assert.equal(first, null);
  assert.ok(firstMs < 2000, `first call took ${firstMs}ms`);

  const [second, secondMs] = await timed(() => getRedisClient());
  assert.equal(second, null);
  assert.ok(secondMs < 50, `second call took ${secondMs}ms`);
});

test('the cache goes straight to the source while Redis is down', async () => {
  let calls = 0;
  const [value, ms] = await timed(() =>
    cached('test:outage', 30, () => {
      calls += 1;
      return 42;
    })
  );
  assert.equal(value, 42);
  assert.equal(calls, 1);
  assert.ok(ms < 50, `cache read took ${ms}ms`);
});

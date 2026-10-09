'use strict';

// GET /internal/metrics (plan v10 OBS-03): Prometheus text for the Docker
// network only. Called on the backend's own port (as a scraper on the
// network would) it answers; through a proxy, or with X-Forwarded-For, it is
// a 404 like any unknown path.
//
// Needs the running API. Run: npm run test:compose

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE } from './helpers/widget';

test('the metrics answer on the internal port, in the Prometheus format', async () => {
  const res = await fetch(`${BASE}/internal/metrics`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /^text\/plain/);
  const text = await res.text();
  for (const name of [
    'supportio_up 1',
    'supportio_process_resident_memory_bytes',
    'supportio_event_loop_delay_seconds{quantile="0.99"}',
    'supportio_db_pool_connections{state="total"}',
    'supportio_sockets{namespace="widget"}',
    'supportio_assistant_model_state{state="ok"}'
  ]) {
    assert.ok(text.includes(name), name);
  }
  assert.match(text, /# TYPE supportio_process_cpu_seconds_total counter/);
  // Every sample line is "name{labels} number".
  for (const line of text.split('\n').filter((l) => l && !l.startsWith('#'))) {
    assert.match(line, /^[a-z_]+(\{[^}]*\})? -?[0-9.e+-]+$/, line);
  }
});

test('through a proxy it does not exist', async () => {
  const forwarded = await fetch(`${BASE}/internal/metrics`, {
    headers: { 'X-Forwarded-For': '203.0.113.9' }
  });
  assert.equal(forwarded.status, 404);
  assert.doesNotMatch(await forwarded.text(), /supportio_/);
});

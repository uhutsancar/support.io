'use strict';

// The vLLM provider against a local fake of the vLLM HTTP API.
//
// No GPU, no model and no network beyond 127.0.0.1: a tiny node:http server
// plays the model server and answers the way vLLM does, including the ways it
// fails. What this pins is the contract the rest of the backend relies on —
// which failure becomes which error code, that a cut-off answer is never
// passed on, that the process never has more calls in flight than it allows,
// and that a missing configuration switches AI off instead of crashing.

import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { VllmProvider } from '../src/services/ai/vllmProvider';
import { aiConfig, resetAIConfig } from '../src/config/ai';
import type { AIConfig } from '../src/config/ai';

const KEY = 'k'.repeat(40);
const MODEL = 'asure-12b-test';

type Handler = (req: http.IncomingMessage, body: string, res: http.ServerResponse) => void;

/** Starts a fake model server; `handler` decides every response. */
async function fakeServer(handler: Handler) {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => handler(req, body, res));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}/v1`,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      })
  };
}

function json(res: http.ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function completion(content: string, finishReason = 'stop') {
  return {
    model: MODEL,
    choices: [{ message: { role: 'assistant', content }, finish_reason: finishReason }],
    usage: { prompt_tokens: 12, completion_tokens: 3 }
  };
}

function provider(baseUrl: string, overrides: Partial<AIConfig> = {}) {
  return new VllmProvider({
    baseUrl,
    apiKey: KEY,
    model: MODEL,
    timeoutMs: 2000,
    concurrency: 2,
    queueMaxWaitMs: 500,
    autoReplyEnabled: false,
    orderLookupTimeoutMs: 3000,
    ...overrides
  });
}

const REQUEST = { prompt: 'Merhaba', maxTokens: 32, temperature: 0 };

async function expectCode(promise: Promise<unknown>, code: string, status?: number) {
  await assert.rejects(promise, (err: any) => {
    assert.equal(err.name, 'AIError');
    assert.equal(err.code, code);
    if (status !== undefined) assert.equal(err.status, status);
    return true;
  });
}

test('a completion is sent with the key, the limits and the schema, and read back', async (t) => {
  let seen: { auth?: string; body?: any } = {};
  const server = await fakeServer((req, body, res) => {
    seen = { auth: req.headers.authorization, body: JSON.parse(body) };
    json(res, 200, completion('{"decision":"small_talk"}'));
  });
  t.after(server.close);

  const result = await provider(server.baseUrl).complete({
    system: 'sistem',
    prompt: 'soru',
    maxTokens: 200,
    temperature: 0,
    responseSchema: { name: 'reply', schema: { type: 'object' } }
  });

  assert.equal(result.text, '{"decision":"small_talk"}');
  assert.deepEqual(result.usage, { inputTokens: 12, outputTokens: 3 });
  assert.equal(seen.auth, `Bearer ${KEY}`);
  assert.equal(seen.body.model, MODEL);
  assert.equal(seen.body.max_tokens, 200);
  assert.equal(seen.body.temperature, 0);
  assert.equal(seen.body.stream, false);
  assert.deepEqual(seen.body.messages, [
    { role: 'system', content: 'sistem' },
    { role: 'user', content: 'soru' }
  ]);
  assert.equal(seen.body.response_format.type, 'json_schema');
  assert.equal(seen.body.response_format.json_schema.name, 'reply');
});

test('each failure of the model server becomes its own error code', async (t) => {
  const cases: Array<[number, string, number]> = [
    [401, 'ai_auth_failed', 502],
    [403, 'ai_auth_failed', 502],
    [429, 'ai_busy', 429],
    [500, 'ai_unreachable', 503],
    [503, 'ai_unreachable', 503],
    [400, 'ai_bad_request', 502]
  ];
  let status = 200;
  const server = await fakeServer((_req, _body, res) =>
    json(res, status, { error: 'secret prompt echoed back' })
  );
  t.after(server.close);

  for (const [code, expected, httpStatus] of cases) {
    status = code;
    await expectCode(provider(server.baseUrl).complete(REQUEST), expected, httpStatus);
  }
});

test('the raw error body never reaches the error message', async (t) => {
  const server = await fakeServer((_req, _body, res) =>
    json(res, 400, { error: 'Müşterinin kart numarası 4111' })
  );
  t.after(server.close);

  await assert.rejects(provider(server.baseUrl).complete(REQUEST), (err: any) => {
    assert.doesNotMatch(err.message, /4111|kart/);
    return true;
  });
});

test('an empty, cut-off or unreadable answer is refused', async (t) => {
  let reply: () => [number, string] = () => [200, ''];
  const server = await fakeServer((_req, _body, res) => {
    const [status, text] = reply();
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(text);
  });
  t.after(server.close);

  reply = () => [200, JSON.stringify(completion('   '))];
  await expectCode(provider(server.baseUrl).complete(REQUEST), 'ai_bad_format');

  reply = () => [200, JSON.stringify(completion('{"decision":"ans', 'length'))];
  await expectCode(provider(server.baseUrl).complete(REQUEST), 'ai_bad_format');

  reply = () => [200, 'not json'];
  await expectCode(provider(server.baseUrl).complete(REQUEST), 'ai_bad_format');

  reply = () => [200, JSON.stringify({ choices: [] })];
  await expectCode(provider(server.baseUrl).complete(REQUEST), 'ai_bad_format');
});

test('a model that does not answer in time is a timeout', async (t) => {
  const server = await fakeServer(() => {
    /* never answers */
  });
  t.after(server.close);

  await expectCode(
    provider(server.baseUrl, { timeoutMs: 200 }).complete(REQUEST),
    'ai_timeout',
    504
  );
});

test('an unreachable model server is reported as unreachable', async () => {
  // Port 9 on loopback: nothing listens there.
  await expectCode(provider('http://127.0.0.1:9/v1').complete(REQUEST), 'ai_unreachable', 503);
});

test('the caller can abandon a call, and the slot is given back', async (t) => {
  const server = await fakeServer(() => {
    /* never answers */
  });
  t.after(server.close);

  const p = provider(server.baseUrl, { concurrency: 1, timeoutMs: 5000 });
  const controller = new AbortController();
  const pending = p.complete({ ...REQUEST, signal: controller.signal });
  setTimeout(() => controller.abort(), 50);
  await expectCode(pending, 'ai_aborted');

  // An already-abandoned request never takes a slot at all.
  const done = new AbortController();
  done.abort();
  await expectCode(p.complete({ ...REQUEST, signal: done.signal }), 'ai_aborted');
});

test('no more calls than the limit are in flight; a caller that waits too long is busy', async (t) => {
  let inFlight = 0;
  let peak = 0;
  const server = await fakeServer((_req, _body, res) => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    setTimeout(() => {
      inFlight--;
      json(res, 200, completion('tamam'));
    }, 150);
  });
  t.after(server.close);

  const p = provider(server.baseUrl, { concurrency: 2, queueMaxWaitMs: 2000 });
  const results = await Promise.all(Array.from({ length: 5 }, () => p.complete(REQUEST)));
  assert.equal(results.length, 5);
  assert.equal(peak, 2, 'the model server must never see more than the configured concurrency');

  // With one slot and a short wait, the third caller gives up instead of queueing.
  const tight = provider(server.baseUrl, { concurrency: 1, queueMaxWaitMs: 50 });
  const outcomes = await Promise.allSettled([
    tight.complete(REQUEST),
    tight.complete(REQUEST),
    tight.complete(REQUEST)
  ]);
  const busy = outcomes.filter(
    (o) => o.status === 'rejected' && (o.reason as { code?: string }).code === 'ai_busy'
  );
  assert.ok(busy.length >= 1, 'a caller that cannot get a slot in time must fail as busy');
});

test('status follows the model server: ready, warming up, unavailable', async (t) => {
  let mode: 'ready' | 'loading' | 'unlisted' = 'ready';
  const server = await fakeServer((_req, _body, res) => {
    if (mode === 'loading') return json(res, 503, {});
    json(res, 200, { data: [{ id: mode === 'ready' ? MODEL : 'something-else' }] });
  });
  t.after(server.close);

  assert.equal(await provider(server.baseUrl).state(), 'ready');
  mode = 'loading';
  assert.equal(await provider(server.baseUrl).state(), 'warming_up');
  mode = 'unlisted';
  assert.equal(await provider(server.baseUrl).state(), 'warming_up');
  assert.equal(await provider('http://127.0.0.1:9/v1').state(), 'unavailable');
});

test('AI stays off, without crashing, until it is configured correctly', (t) => {
  const keys = ['AI_ENABLED', 'AI_API_KEY', 'AI_MODEL', 'AI_BASE_URL'] as const;
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  t.after(() => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    resetAIConfig();
  });
  const configure = (values: Partial<Record<(typeof keys)[number], string>>) => {
    for (const k of keys) delete process.env[k];
    Object.assign(process.env, values);
    resetAIConfig();
    return aiConfig();
  };

  assert.equal(configure({}), null, 'off by default');
  assert.equal(configure({ AI_ENABLED: 'true', AI_MODEL: MODEL }), null, 'no key');
  assert.equal(
    configure({ AI_ENABLED: 'true', AI_API_KEY: 'short', AI_MODEL: MODEL }),
    null,
    'a short key is refused'
  );
  assert.equal(
    configure({ AI_ENABLED: 'true', AI_API_KEY: KEY, AI_MODEL: '../etc' }),
    null,
    'a model name that is not a plain directory is refused'
  );

  const config = configure({ AI_ENABLED: 'true', AI_API_KEY: KEY, AI_MODEL: MODEL });
  assert.ok(config);
  assert.equal(config.baseUrl, 'http://llm:8000/v1');
  assert.equal(config.concurrency, 2);
  assert.equal(config.queueMaxWaitMs, 8000);
  assert.equal(config.autoReplyEnabled, false);
});

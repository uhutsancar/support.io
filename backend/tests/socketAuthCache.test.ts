'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';
import { SocketContext } from '../src/socket/context';

test('packet authorization caches reads but can recheck every write', async () => {
  const previousRead = process.env.SOCKET_AUTH_FRESH_MS;
  const previousWrite = process.env.SOCKET_AUTH_WRITE_FRESH_MS;
  process.env.SOCKET_AUTH_FRESH_MS = '5000';
  process.env.SOCKET_AUTH_WRITE_FRESH_MS = '0';

  let middleware: ((packet: unknown[], next: (error?: Error) => void) => void) | null = null;
  let cleanup: () => void = () => {};
  let disconnected = false;
  const socket = {
    tokenExpiresAt: Date.now() + 60_000,
    use(fn: typeof middleware) {
      middleware = fn;
    },
    disconnect() {
      disconnected = true;
    },
    once(event: string, fn: () => void) {
      if (event === 'disconnect') cleanup = fn;
    }
  };
  const context = Object.create(SocketContext.prototype) as SocketContext;
  let checks = 0;
  context.socketIsCurrent = async () => {
    checks += 1;
    return true;
  };

  try {
    context.installLiveAuthorization(socket as never);
    const authorize = (event: string) =>
      new Promise<void>((resolve, reject) =>
        middleware!([event], (error) => (error ? reject(error) : resolve()))
      );
    await authorize('typing');
    await authorize('typing');
    assert.equal(checks, 1, 'read-like packets share the fresh check');
    await authorize('send-message');
    await authorize('send-message');
    assert.equal(checks, 3, 'zero write TTL rechecks each mutation');
    assert.equal(disconnected, false);
  } finally {
    cleanup();
    if (previousRead === undefined) delete process.env.SOCKET_AUTH_FRESH_MS;
    else process.env.SOCKET_AUTH_FRESH_MS = previousRead;
    if (previousWrite === undefined) delete process.env.SOCKET_AUTH_WRITE_FRESH_MS;
    else process.env.SOCKET_AUTH_WRITE_FRESH_MS = previousWrite;
  }
});

test('an expired token is rejected without a database check', async () => {
  const previousWrite = process.env.SOCKET_AUTH_WRITE_FRESH_MS;
  process.env.SOCKET_AUTH_WRITE_FRESH_MS = '0';
  let middleware: ((packet: unknown[], next: (error?: Error) => void) => void) | null = null;
  let disconnected = false;
  const socket = {
    tokenExpiresAt: Date.now() - 1,
    use(fn: typeof middleware) {
      middleware = fn;
    },
    disconnect() {
      disconnected = true;
    },
    once() {}
  };
  const context = Object.create(SocketContext.prototype) as SocketContext;
  let checks = 0;
  context.socketIsCurrent = async () => {
    checks += 1;
    return true;
  };
  context.installLiveAuthorization(socket as never);
  const error = await new Promise<Error | undefined>((resolve) =>
    middleware!(['send-message'], resolve)
  );
  assert.match(error?.message ?? '', /Authentication required/);
  assert.equal(checks, 0);
  assert.equal(disconnected, true);
  if (previousWrite === undefined) delete process.env.SOCKET_AUTH_WRITE_FRESH_MS;
  else process.env.SOCKET_AUTH_WRITE_FRESH_MS = previousWrite;
});

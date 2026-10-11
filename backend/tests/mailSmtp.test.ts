import test from 'node:test';
import assert from 'node:assert/strict';
import { smtpPoolOptions } from '../src/services/mail/smtp';

test('SMTP delivery uses a bounded, rate-limited connection pool', () => {
  const names = [
    'SMTP_MAX_CONNECTIONS',
    'SMTP_MAX_MESSAGES',
    'SMTP_RATE_DELTA_MS',
    'SMTP_RATE_LIMIT'
  ] as const;
  const before = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    delete process.env.SMTP_MAX_CONNECTIONS;
    delete process.env.SMTP_MAX_MESSAGES;
    delete process.env.SMTP_RATE_DELTA_MS;
    delete process.env.SMTP_RATE_LIMIT;
    assert.deepEqual(smtpPoolOptions(), {
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 10
    });

    process.env.SMTP_MAX_CONNECTIONS = '2';
    process.env.SMTP_RATE_LIMIT = '5';
    assert.equal(smtpPoolOptions().maxConnections, 2);
    assert.equal(smtpPoolOptions().rateLimit, 5);
  } finally {
    for (const name of names) {
      const value = before[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

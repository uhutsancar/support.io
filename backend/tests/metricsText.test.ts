'use strict';

// The Prometheus text of config/metrics.ts, in process: label values come
// out as they went in, and only a quote, a backslash or a line break — which
// would end the value early — is replaced.
//
// Run: npx tsx --test tests/metricsText.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import { increment, prometheusText } from '../src/config/metrics';

test('label values keep their letters; only what would break the line is replaced', () => {
  increment('supportio_mail_total', { outcome: 'sent' });
  increment('supportio_mail_total', { outcome: 'bad"value\\with\nbreak' });
  const lines = prometheusText([]).split('\n');
  assert.ok(lines.includes('supportio_mail_total{outcome="sent"} 1'), lines.join('\n'));
  assert.ok(lines.includes('supportio_mail_total{outcome="bad_value_with_break"} 1'));
});

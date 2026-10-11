'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';
import { reportBatchSize } from '../src/services/weeklyReport';

test('weekly report batch size is configurable and bounded', () => {
  const previous = process.env.WEEKLY_REPORT_BATCH_SIZE;
  try {
    delete process.env.WEEKLY_REPORT_BATCH_SIZE;
    assert.equal(reportBatchSize(), 200);
    process.env.WEEKLY_REPORT_BATCH_SIZE = '750';
    assert.equal(reportBatchSize(), 750);
    process.env.WEEKLY_REPORT_BATCH_SIZE = '0';
    assert.equal(reportBatchSize(), 1);
    process.env.WEEKLY_REPORT_BATCH_SIZE = '999999';
    assert.equal(reportBatchSize(), 2000);
    process.env.WEEKLY_REPORT_BATCH_SIZE = 'not-a-number';
    assert.equal(reportBatchSize(), 200);
  } finally {
    if (previous === undefined) delete process.env.WEEKLY_REPORT_BATCH_SIZE;
    else process.env.WEEKLY_REPORT_BATCH_SIZE = previous;
  }
});

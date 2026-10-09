// Runs the API for a coverage measurement (plan v10 TST-02).
//
// The e2e suite calls a running API, so the code it exercises runs in that
// process, not in the test runner. Started with NODE_V8_COVERAGE set, this
// process records what ran; it writes the record only when it exits cleanly,
// which a signal cannot promise on every platform (Windows ends a process
// without running its handlers). So it exits when COVERAGE_STOP_FILE appears:
//
//   NODE_V8_COVERAGE=/tmp/v8 COVERAGE_STOP_FILE=/tmp/stop-api \
//     node --import tsx scripts/coverage-api.ts &
//   …run the suite…
//   touch /tmp/stop-api
//   npx c8 report --temp-directory /tmp/v8 …
//
// Never used in production: the image runs dist/server.js.

import fs from 'fs';

const stopFile = process.env.COVERAGE_STOP_FILE;
if (!stopFile) {
  console.error('COVERAGE_STOP_FILE is required');
  process.exit(2);
}
if (fs.existsSync(stopFile)) fs.unlinkSync(stopFile);

void import('../src/server');

setInterval(() => {
  if (fs.existsSync(stopFile)) {
    fs.unlinkSync(stopFile);
    console.log('[coverage] stop file seen; exiting so the coverage is written');
    process.exit(0);
  }
}, 1000);

// `npm run scan:images` — scans every image this repository pins (Compose
// files and Dockerfiles) with Trivy, run as a container, for fixable HIGH and
// CRITICAL findings, honouring .trivyignore. Needs Docker and network access
// for the vulnerability database; needs no registry login. Exits 1 on findings.
//
// `npm run scan:images -- <image>` scans one image instead, e.g. a locally
// built `supportio-a-backend`.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TRIVY = 'aquasec/trivy:0.58.1';
const SOURCES = [
  'docker-compose.yml',
  'docker-compose.prod.yml',
  'backend/Dockerfile',
  'backend/Dockerfile.prod',
  'admin-panel/Dockerfile',
  'docker/postgres/Dockerfile'
];

const pinned = new Set();
for (const file of SOURCES) {
  for (const match of readFileSync(join(root, file), 'utf8').matchAll(
    /(?:image:|FROM|POSTGRES_IMAGE=)\s*([a-z0-9./-]+:[\w.-]+@sha256:[0-9a-f]{64})/g
  )) {
    pinned.add(match[1]);
  }
}
const images = process.argv.slice(2).length ? process.argv.slice(2) : [...pinned];

let failed = 0;
for (const image of images) {
  console.log(`\n== ${image}`);
  const scan = spawnSync(
    'docker',
    [
      'run',
      '--rm',
      '-v',
      '/var/run/docker.sock:/var/run/docker.sock',
      '-v',
      'supportio-trivy-cache:/root/.cache',
      '-v',
      `${join(root, '.trivyignore')}:/.trivyignore:ro`,
      TRIVY,
      'image',
      '--quiet',
      '--severity',
      'HIGH,CRITICAL',
      '--ignore-unfixed',
      '--ignorefile',
      '/.trivyignore',
      '--exit-code',
      '1',
      image
    ],
    { stdio: 'inherit', env: { ...process.env, MSYS_NO_PATHCONV: '1' } }
  );
  if (scan.status !== 0) failed += 1;
}
console.log(`\n${images.length - failed} of ${images.length} image(s) without open findings`);
process.exit(failed ? 1 : 0);

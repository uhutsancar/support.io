'use strict';

// A customer-given address may not reach our own network (plan v10 TST-03,
// SSRF): the cloud metadata address, loopback, private ranges, IPv6 and
// IPv4-mapped forms, odd ports and schemes, credentials in the URL, names
// that are ours, and a public-looking name that resolves inside (DNS
// rebinding). A public address passes and the connection is pinned to it.
// DNS is a stand-in here, so the test asks no real resolver.
//
// Run: npx tsx --test tests/outboundUrl.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  UnsafeUrlError,
  isPrivateAddress,
  pinnedLookup,
  safeOutboundUrl
} from '../src/services/outboundUrl';

const resolver = (table: Record<string, string[]>) => async (host: string) => {
  const found = table[host];
  if (!found) throw new Error('ENOTFOUND');
  return found.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));
};

const dns = resolver({
  'hooks.example.com': ['93.184.216.34'],
  'rebind.example.com': ['93.184.216.34', '10.0.0.5'],
  'inside.example.com': ['169.254.169.254'],
  'v6inside.example.com': ['::1']
});

test('private, loopback and metadata addresses are refused', async () => {
  for (const url of [
    'http://169.254.169.254/latest/meta-data/',
    'http://127.0.0.1/',
    'http://localhost/',
    'http://api.localhost/',
    'http://metadata.google.internal/computeMetadata/v1/',
    'http://10.1.2.3/',
    'http://172.20.0.4/',
    'http://192.168.1.1/',
    'http://100.64.0.1/',
    'http://0.0.0.0/',
    'http://[::1]/',
    'http://[fd00::1]/',
    'http://[fe80::1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://inside.example.com/',
    'http://v6inside.example.com/',
    // One public and one private answer: the private one would be used later.
    'https://rebind.example.com/hook'
  ]) {
    await assert.rejects(safeOutboundUrl(url, dns), UnsafeUrlError, url);
  }
});

test('odd schemes, ports, credentials and unknown names are refused', async () => {
  for (const url of [
    'ftp://hooks.example.com/',
    'file:///etc/passwd',
    'gopher://hooks.example.com/',
    'http://hooks.example.com:6379/',
    'http://hooks.example.com:22/',
    'https://user:pass@hooks.example.com/',
    'https://nowhere.example.com/',
    'not a url'
  ]) {
    await assert.rejects(safeOutboundUrl(url, dns), UnsafeUrlError, url);
  }
});

test('a public address passes, and the request connects to the checked address', async () => {
  const target = await safeOutboundUrl('https://hooks.example.com/support', dns);
  assert.equal(target.address, '93.184.216.34');
  assert.equal(target.url.pathname, '/support');
  assert.equal(isPrivateAddress('8.8.8.8'), false);
  assert.equal(isPrivateAddress('2606:4700::1111'), false);

  // The pinned lookup ignores the name: a request to any host name lands on
  // the address that was checked (here a local server, to observe it).
  const server = http.createServer((_req, res) => res.end('pinned'));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  try {
    const body = await new Promise<string>((resolve, reject) => {
      const req = http.request(
        {
          host: 'hooks.example.com',
          port,
          path: '/',
          lookup: pinnedLookup({
            url: new URL('http://x'),
            address: '127.0.0.1',
            family: 4
          }) as never
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => resolve(data));
        }
      );
      req.on('error', reject);
      req.end();
    });
    assert.equal(body, 'pinned');
  } finally {
    server.close();
  }
});

'use strict';

// Uploads (plan v10 SEC-07, SEC-08):
//
//  - the first bytes must match the declared type: a program called
//    photo.png is refused; SVG and, by default, archives are not taken
//  - images are re-encoded: EXIF (and with it GPS) does not survive
//  - an attachment is private: its stable address opens nothing, the link a
//    message carries is signed and expires, a tampered one is refused
//  - a logo is public
//
// The development Docker stack keeps uploads on the container's disk
// (UPLOAD_STORAGE=local in docker-compose.yml), so nothing here is written to
// a real bucket. Run: npm run test:compose

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { getPool } from '../src/db/pool';
import { BASE, joinAsVisitor, widgetToken } from './helpers/widget';
import { signUp } from './helpers/accounts';

function sessionCookie(res: { headers: Headers }): string {
  const match = /(?:^|,\s*)sc_session=([^;]+)/.exec(res.headers.get('set-cookie') || '');
  return match ? decodeURIComponent(match[1]) : '';
}

const stamp = () => `${Date.now()}${Math.floor(Math.random() * 100000)}`;

async function tenant() {
  const email = `owner${stamp()}@uploads.test`;
  const reg = await signUp({ name: 'Upload Owner', email, password: 'E2ePassw0rd!' });
  const token = sessionCookie(reg);
  const res = await fetch(`${BASE}/api/sites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: 'Uploads', domain: `u${stamp()}.example` })
  });
  assert.equal(res.status, 201);
  const site = ((await res.json()) as any).site;
  return { token, site };
}

async function visitorUpload(siteKey: string, bytes: Buffer | string, type: string, name: string) {
  const { token } = await widgetToken(siteKey);
  const form = new FormData();
  form.append('file', new Blob([bytes], { type }), name);
  const res = await fetch(`${BASE}/api/files/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Origin: 'http://localhost:3001' },
    body: form
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* empty */
  }
  return { status: res.status, body, token };
}

/** A small JPEG that carries EXIF with a camera make and GPS position. */
async function jpegWithExif(): Promise<Buffer> {
  return sharp({
    create: { width: 32, height: 24, channels: 3, background: { r: 200, g: 40, b: 40 } }
  })
    .jpeg()
    .withExif({
      IFD0: { Make: 'TestCamera', Model: 'Secret Model' },
      IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '41/1 0/1 0/1' }
    })
    .toBuffer();
}

test.after(async () => {
  await getPool().end();
});

test('a file whose bytes do not match its type is refused', async () => {
  const { site } = await tenant();
  // "MZ": the start of every Windows executable.
  const exe = Buffer.concat([
    Buffer.from('MZ\x90\x00\x03\x00\x00\x00', 'latin1'),
    Buffer.alloc(64)
  ]);
  const legacyOffice = Buffer.concat([
    Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    Buffer.alloc(64)
  ]);
  for (const [bytes, type, name] of [
    [exe, 'image/png', 'photo.png'],
    [exe, 'application/pdf', 'invoice.pdf'],
    [
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>'),
      'image/svg+xml',
      'a.svg'
    ],
    [Buffer.from('<html><script>alert(1)</script></html>'), 'image/jpeg', 'x.jpg'],
    [Buffer.from('PK\x03\x04rest-of-a-zip', 'latin1'), 'application/zip', 'files.zip'],
    [legacyOffice, 'application/msword', 'legacy.doc'],
    [legacyOffice, 'application/vnd.ms-excel', 'legacy.xls'],
    [
      Buffer.from('PK\x03\x04not-a-docx', 'latin1'),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'fake.docx'
    ],
    [
      Buffer.from('PK\x03\x04not-an-xlsx', 'latin1'),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'fake.xlsx'
    ],
    [Buffer.from('text\x00with a NUL', 'latin1'), 'text/plain', 'note.txt']
  ] as const) {
    // eslint-disable-next-line no-await-in-loop
    const res = await visitorUpload(site.siteKey, bytes, type, name);
    assert.equal(res.status, 400, `${name} (${type}) was accepted`);
    assert.equal(res.body.code, 'UNSUPPORTED_FILE_TYPE');
  }
});

test('an image is re-encoded without its EXIF, and stored privately', async () => {
  const { site } = await tenant();
  const original = await jpegWithExif();
  assert.ok((await sharp(original).metadata()).exif, 'the fixture must carry EXIF');

  const res = await visitorUpload(site.siteKey, original, 'image/jpeg', 'holiday.jpg');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const file = res.body.file;
  assert.match(file.filename, /^org\/[0-9a-f]{24}\/site\/[0-9a-f]{24}\/[0-9a-f-]{36}\.jpg$/);
  assert.ok(!file.filename.includes('holiday'), 'the uploader’s name became the key');
  assert.equal(file.mimeType, 'image/jpeg');

  // The stable address opens nothing on its own.
  const bare = await fetch(file.url);
  assert.equal(bare.status, 403);
  const tampered = await fetch(file.previewUrl.replace(/s=[^&]+/, 's=' + 'A'.repeat(32)));
  assert.equal(tampered.status, 403);
  const expired = await fetch(file.previewUrl.replace(/e=\d+/, 'e=1000'));
  assert.equal(expired.status, 403);

  // The signed link serves the image, and the image has no EXIF left.
  const served = await fetch(file.previewUrl);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get('content-type'), 'image/jpeg');
  assert.equal(served.headers.get('x-content-type-options'), 'nosniff');
  const meta = await sharp(Buffer.from(await served.arrayBuffer())).metadata();
  assert.equal(meta.exif, undefined, 'EXIF survived the upload');
  assert.equal(meta.width, 32);

  // The static /uploads mount does not serve private keys either.
  const throughStatic = await fetch(`${BASE}/uploads/${file.filename}`);
  assert.equal(throughStatic.status, 404);
});

test('a message carries a signed link to its attachment', async () => {
  const { site, token } = await tenant();
  const png = await sharp({
    create: { width: 8, height: 8, channels: 4, background: { r: 0, g: 0, b: 255, alpha: 1 } }
  })
    .png()
    .toBuffer();
  const visitor = await joinAsVisitor(site.siteKey, {}, { origin: 'http://localhost:3001' });
  const { token: widget } = visitor;
  const form = new FormData();
  form.append('file', new Blob([png], { type: 'image/png' }), 'dot.png');
  const uploaded = await fetch(`${BASE}/api/files/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${widget}`, Origin: 'http://localhost:3001' },
    body: form
  });
  assert.equal(uploaded.status, 200);
  const file = ((await uploaded.json()) as any).file;

  const sent: any = await new Promise((resolve) =>
    visitor.socket.emit(
      'send-message',
      {
        content: 'dot.png',
        messageType: 'image',
        fileData: file,
        clientMessageId: `up-${stamp()}`
      },
      resolve
    )
  );
  visitor.socket.close();
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.match(sent.message.fileData.url, /\/api\/files\/a\/org\/.+\?e=\d+&s=[A-Za-z0-9_-]{32}$/);

  // Possession of another visitor's proof does not move the upload into a
  // new principal/session/conversation on the same site.
  const other = await joinAsVisitor(site.siteKey, {}, { origin: 'http://localhost:3001' });
  const replay: any = await new Promise((resolve) =>
    other.socket.emit(
      'send-message',
      {
        content: 'stolen dot.png',
        messageType: 'image',
        fileData: file,
        clientMessageId: `replay-${stamp()}`
      },
      resolve
    )
  );
  other.socket.close();
  assert.equal(replay.ok, false, 'another visitor reused the upload proof');

  // The panel reads the same message with its own signed link.
  const listed = await fetch(
    `${BASE}/api/conversations/${site._id}/${sent.message.conversationId}/messages`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  assert.equal(listed.status, 200);
  const messages = ((await listed.json()) as any).messages;
  const withFile = messages.find((m: any) => m.fileData);
  const link = new URL(withFile.fileData.url, BASE);
  const opened = await fetch(link);
  assert.equal(opened.status, 200);
  assert.equal(opened.headers.get('content-type'), 'image/png');
});

test('plain text is taken and downloads instead of rendering', async () => {
  const { site } = await tenant();
  const res = await visitorUpload(
    site.siteKey,
    'Merhaba, siparişim nerede?\n',
    'text/plain',
    'not.txt'
  );
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const served = await fetch(res.body.file.previewUrl);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get('content-disposition'), 'attachment');
  assert.match(String(served.headers.get('content-type')), /^text\/plain/);
});

test('a logo is checked, re-encoded and public', async () => {
  const { site, token } = await tenant();
  const png = await sharp({
    create: { width: 16, height: 16, channels: 3, background: { r: 0, g: 160, b: 80 } }
  })
    .png()
    .withExif({ IFD0: { Make: 'LogoCamera' } })
    .toBuffer();
  const form = new FormData();
  form.append('logo', new Blob([png], { type: 'image/png' }), 'logo.png');
  const res = await fetch(`${BASE}/api/widget-config/site/${site._id}/logo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
  assert.equal(res.status, 200, await res.clone().text());
  const { logoUrl } = (await res.json()) as any;
  assert.match(logoUrl, /\/uploads\/logos\/logo-[0-9a-f-]{36}\.png$/);
  const served = await fetch(logoUrl);
  assert.equal(served.status, 200);
  assert.equal((await sharp(Buffer.from(await served.arrayBuffer())).metadata()).exif, undefined);

  const fake = new FormData();
  fake.append('logo', new Blob(['MZ-not-a-png'], { type: 'image/png' }), 'logo.png');
  const refused = await fetch(`${BASE}/api/widget-config/site/${site._id}/logo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fake
  });
  assert.equal(refused.status, 400);
});

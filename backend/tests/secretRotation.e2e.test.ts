'use strict';

// Rotating JWT_SECRET without signing everybody out (plan v10 SEC-18):
//
//  - with JWT_SECRET = new and JWT_SECRET_PREVIOUS = old, everything made
//    with the old secret still holds: panel and widget sessions, the widget's
//    site-key binding, signed attachment links, sealed secrets (also the
//    older v1 format), IP blocks; new tokens use the new secret
//  - once JWT_SECRET_PREVIOUS is emptied, the old ones stop
//  - secrets:rotate re-seals a workspace's identity and authenticator
//    secrets under the new key, counts the accounts with old recovery codes,
//    and leaves current values alone on a second run
//
// The secrets live in this process's environment and are switched here; the
// running API is used only to create the account.
//
// Run: npm run test:compose

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { getPool, query } from '../src/db/pool';
import { closeRedisClient } from '../src/config/redis';
import {
  derivedKey,
  keyId,
  newVisitorId,
  newWidgetSessionId,
  signSession,
  signWidgetSession,
  siteKeyMatches,
  siteKeyVersion,
  verifySession,
  verifyWidgetSession
} from '../src/config/tokens';
import { open, seal, sealedWithCurrentKey } from '../src/config/secretBox';
import { attachmentLinkValid, signedAttachmentUrl } from '../src/middleware/upload';
import { ipHash } from '../src/services/visitorBlocks';
import { rotateSealedSecrets } from '../src/services/secretRotation';
import { generateId } from '../src/db/objectId';
import { signUp } from './helpers/accounts';

const OLD = `old-${crypto.randomBytes(24).toString('hex')}`;
const NEW = `new-${crypto.randomBytes(24).toString('hex')}`;
const saved = { current: process.env.JWT_SECRET, previous: process.env.JWT_SECRET_PREVIOUS };

function use(current: string, previous?: string) {
  process.env.JWT_SECRET = current;
  if (previous) process.env.JWT_SECRET_PREVIOUS = previous;
  else delete process.env.JWT_SECRET_PREVIOUS;
}

test.after(async () => {
  process.env.JWT_SECRET = saved.current;
  if (saved.previous === undefined) delete process.env.JWT_SECRET_PREVIOUS;
  else process.env.JWT_SECRET_PREVIOUS = saved.previous;
  await closeRedisClient();
  await getPool().end();
});

/** A value sealed the way the code did before key ids (v1). */
function sealV1(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey('site-secrets'), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv, cipher.getAuthTag(), ciphertext]
    .map((p) => (typeof p === 'string' ? p : p.toString('base64url')))
    .join('.');
}

const linkParts = (url: string) => {
  const parsed = new URL(url);
  return { e: parsed.searchParams.get('e'), s: parsed.searchParams.get('s') };
};

test('during a rotation the old secret still verifies; afterwards it does not', () => {
  use(OLD);
  const session = signSession(
    { userId: generateId(), userType: 'user', organizationId: generateId(), sv: 0 },
    3600
  );
  const kv = siteKeyVersion('sk-rotation');
  const widget = signWidgetSession({
    siteId: generateId(),
    visitorId: newVisitorId(),
    sid: newWidgetSessionId(),
    kv
  });
  const fileKey = `org/${generateId()}/site/${generateId()}/${crypto.randomUUID()}.png`;
  const link = linkParts(signedAttachmentUrl(fileKey, 'http://localhost'));
  const sealed = seal('identity-secret');
  const legacy = sealV1('legacy-secret');
  const oldIpHash = ipHash('203.0.113.7');

  // Rotation under way.
  use(NEW, OLD);
  assert.equal(verifySession(session).sv, 0);
  assert.equal(verifyWidgetSession(widget.token).kv, kv);
  assert.equal(siteKeyMatches('sk-rotation', kv), true);
  assert.equal(attachmentLinkValid(fileKey, link.e, link.s), true);
  assert.equal(open(sealed), 'identity-secret');
  assert.equal(open(legacy), 'legacy-secret');
  assert.equal(sealedWithCurrentKey(sealed), false);
  // New things are made with the new secret, and verify.
  const fresh = signSession({ userId: generateId(), userType: 'user', sv: 1 }, 3600);
  assert.equal(verifySession(fresh).sv, 1);
  assert.equal(sealedWithCurrentKey(seal('x')), true);
  assert.notEqual(ipHash('203.0.113.7'), oldIpHash, 'new blocks store the new hash');
  assert.notEqual(siteKeyVersion('sk-rotation'), kv);

  // Rotation finished.
  use(NEW);
  assert.throws(() => verifySession(session), /invalid signature/);
  assert.throws(() => verifyWidgetSession(widget.token), /invalid signature/);
  assert.equal(siteKeyMatches('sk-rotation', kv), false);
  assert.equal(attachmentLinkValid(fileKey, link.e, link.s), false);
  assert.equal(open(sealed), null);
  assert.equal(open(legacy), null);
  assert.equal(verifySession(fresh).sv, 1);
});

test('secrets:rotate re-seals a workspace under the new key', async () => {
  // The account comes from the running API; its secrets are set here.
  const email = `owner${Date.now()}${Math.floor(Math.random() * 1e5)}@rotation.test`;
  const reg = await signUp({ name: 'Rotation Owner', email, password: 'E2ePassw0rd!' });
  assert.equal(reg.status, 201);
  const { rows } = await query<{ id: string; organization_id: string }>(
    'SELECT id, organization_id FROM users WHERE email = $1',
    [email]
  );
  const { id: userId, organization_id: org } = rows[0];
  const siteId = generateId();

  use(OLD);
  const oldKid = keyId(derivedKey('recovery-codes'));
  await query(
    `INSERT INTO sites (id, organization_id, name, domain, site_key, integrations)
     VALUES ($1, $2, 'Rotation', $3, $4, $5)`,
    [
      siteId,
      org,
      `${siteId}.test`,
      `rot-${siteId}`,
      JSON.stringify({ identitySecret: seal('site-identity') })
    ]
  );
  await query(`UPDATE users SET totp_secret_enc = $2, recovery_codes = $3 WHERE id = $1`, [
    userId,
    sealV1('JBSWY3DPEHPK3PXP'),
    JSON.stringify([`${oldKid}:${'a'.repeat(64)}`])
  ]);

  use(NEW, OLD);
  const dry = await rotateSealedSecrets({ organizationId: org, dryRun: true });
  assert.deepEqual(dry, { resealed: 2, current: 0, unreadable: 0, oldRecoveryCodes: 1 });
  const report = await rotateSealedSecrets({ organizationId: org });
  assert.deepEqual(report, { resealed: 2, current: 0, unreadable: 0, oldRecoveryCodes: 1 });
  const again = await rotateSealedSecrets({ organizationId: org });
  assert.deepEqual(again, { resealed: 0, current: 2, unreadable: 0, oldRecoveryCodes: 1 });

  // With the old secret gone, the re-sealed values still open.
  use(NEW);
  const site = await query<{ secret: string }>(
    `SELECT integrations->>'identitySecret' AS secret FROM sites WHERE id = $1`,
    [siteId]
  );
  assert.equal(open(site.rows[0].secret), 'site-identity');
  const user = await query<{ totp: string }>(
    'SELECT totp_secret_enc AS totp FROM users WHERE id = $1',
    [userId]
  );
  assert.equal(open(user.rows[0].totp), 'JBSWY3DPEHPK3PXP');
  assert.match(user.rows[0].totp, new RegExp(`^v2\\.${keyId(derivedKey('site-secrets'))}\\.`));
});

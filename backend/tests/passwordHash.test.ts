'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import {
  BCRYPT_COST,
  burnVerification,
  hashPassword,
  needsRehash,
  verifyPassword
} from '../src/config/passwords';

test('new password hashes use native scrypt and verify safely', async () => {
  const hash = await hashPassword('A-long-password-2026!');
  assert.match(hash, /^\$scrypt\$ln=17,r=8,p=1\$/);
  assert.equal(await verifyPassword('A-long-password-2026!', hash), true);
  assert.equal(await verifyPassword('wrong-password', hash), false);
  assert.equal(needsRehash(hash), false);
  assert.equal(await burnVerification('unknown-account-password'), false);
});

test('legacy bcrypt hashes remain valid and are marked for gradual migration', async () => {
  const legacy = await bcrypt.hash('Legacy-password-2026!', BCRYPT_COST);
  assert.equal(await verifyPassword('Legacy-password-2026!', legacy), true);
  assert.equal(await verifyPassword('wrong-password', legacy), false);
  assert.equal(needsRehash(legacy), true);
  assert.equal(await verifyPassword('anything', 'not-a-password-hash'), false);
  assert.equal(needsRehash('not-a-password-hash'), false);
});

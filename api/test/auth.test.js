// Team sign-ins: remembered sign-ins last longer, and a password change signs out other devices.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sign, verify, signedInBeforePasswordChange } from '../src/auth.js';

test('tokens record when they were issued', () => {
  const p = verify(sign({ kind: 'adult', sub: 'a1' }, 3600));
  assert.ok(Math.abs(p.iat - Date.now() / 1000) < 5);
  assert.equal(p.exp - p.iat, 3600);
});

test('a sign-in from before a password change no longer counts; one from after does', () => {
  const changed = new Date('2026-11-11T10:00:00Z');
  const t = Math.floor(changed.getTime() / 1000);
  assert.equal(signedInBeforePasswordChange({ iat: t - 60 }, changed), true);
  assert.equal(signedInBeforePasswordChange({ iat: t }, changed), false);
  assert.equal(signedInBeforePasswordChange({ iat: t + 60 }, changed), false);
  assert.equal(signedInBeforePasswordChange({}, changed), true, 'old tokens without iat are signed out too');
  assert.equal(signedInBeforePasswordChange({ iat: 1 }, null), false, 'never changed: nothing to check');
});

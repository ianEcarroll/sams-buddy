// Many families: admin check, sign-up validation, cost estimate, and Buddy speaking to each child by name.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPlatformAdmin, validateFamily, estimateCost, ageFrom, newInviteToken } from '../src/families.js';
import { systemFor } from '../src/coach/judge.js';

test('platform admins come from PLATFORM_ADMINS, case-insensitive', () => {
  const env = { PLATFORM_ADMINS: 'ian@example.com, other@example.com' };
  assert.equal(isPlatformAdmin('Ian@Example.com', env), true);
  assert.equal(isPlatformAdmin('ray@example.com', env), false);
  assert.equal(isPlatformAdmin('ian@example.com', {}), false);
});

test('sign-up needs a child name, adult name, email and a 10+ character password', () => {
  const now = new Date('2026-11-04T00:00:00Z');
  const ok = validateFamily({ learnerName: ' Maya ', birthYear: '2012', ownerName: 'Ana', email: 'Ana <ANA@Example.com>', password: 'longenough1' }, now);
  assert.deepEqual(ok.value, { learnerName: 'Maya', birthYear: 2012, ownerName: 'Ana', email: 'ana@example.com', password: 'longenough1' });
  assert.equal(validateFamily({ learnerName: 'Maya', birthYear: '', ownerName: 'Ana', email: 'ana@example.com', password: 'longenough1' }, now).value.birthYear, null);
  assert.match(validateFamily({ learnerName: '', ownerName: 'Ana', email: 'a@b.co', password: 'longenough1' }).error, /first name/);
  assert.match(validateFamily({ learnerName: 'Maya', birthYear: '2025', ownerName: 'Ana', email: 'a@b.co', password: 'longenough1' }, now).error, /year of birth/);
  assert.match(validateFamily({ learnerName: 'Maya', ownerName: 'Ana', email: 'nope', password: 'longenough1' }).error, /email/);
  assert.match(validateFamily({ learnerName: 'Maya', ownerName: 'Ana', email: 'a@b.co', password: 'short' }).error, /10 characters/);
});

test('cost estimate and age', () => {
  assert.equal(estimateCost({ buddyChars: 5400, responses: 20 }), 0.69);
  assert.equal(estimateCost({}), 0);
  assert.equal(ageFrom(2012, new Date('2026-11-04')), 14);
  assert.equal(ageFrom(null), null);
  assert.ok(newInviteToken().length >= 32);
});

test('the scoring instructions use the child\'s own name and age, never Sam', () => {
  const s = systemFor({ name: 'Maya', age: 14 });
  assert.match(s, /from Maya, a 14-year-old/);
  assert.doesNotMatch(s, /Sam|\bhe\b|\bhis\b/);
  assert.match(systemFor({ name: 'Leo' }), /a young person/);
});

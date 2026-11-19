// Waiting list for the TALVO website: sign-up checks, CORS, and who is told.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanSignup, corsHeaders, notifyList, notificationEmail } from '../src/waitlist.js';

test('a valid sign-up is lower-cased and trimmed; the role and source are kept when known', () => {
  assert.deepEqual(cleanSignup({ email: '  Ray@Example.COM ', role: 'parent', source: 'talvo-website' }), { email: 'ray@example.com', role: 'parent', source: 'talvo-website' });
  assert.equal(cleanSignup({ email: 'a@b.co', role: 'astronaut' }).role, null);
  assert.equal(cleanSignup({ email: 'a@b.co' }).source, 'website');
  assert.equal(cleanSignup({ email: 'a@b.co', source: '<script>x' }).source, 'scriptx');
});

test('bad addresses are refused with a friendly message', () => {
  for (const email of ['', 'nope', 'a@b', 'a b@c.com', '@c.com', `${'x'.repeat(250)}@c.com`, undefined, 42]) {
    assert.match(cleanSignup({ email }).error, /valid email/);
  }
  assert.match(cleanSignup(null).error, /valid email/);
});

test('the hidden field catches bots, whatever the address', () => {
  assert.deepEqual(cleanSignup({ email: 'a@b.co', company: 'Acme' }), { spam: true });
});

test('CORS: any website by default, only the listed ones when WAITLIST_ORIGINS is set', () => {
  assert.equal(corsHeaders('https://x.com', {})['access-control-allow-origin'], '*');
  const env = { WAITLIST_ORIGINS: 'https://growwithtalvo.com, https://www.growwithtalvo.com/' };
  assert.equal(corsHeaders('https://growwithtalvo.com', env)['access-control-allow-origin'], 'https://growwithtalvo.com');
  assert.equal(corsHeaders('https://www.growwithtalvo.com', env)['access-control-allow-origin'], 'https://www.growwithtalvo.com');
  assert.equal(corsHeaders('https://evil.example', env)['access-control-allow-origin'], undefined);
  assert.equal(corsHeaders(undefined, env)['access-control-allow-origin'], undefined);
});

test('notifications go to WAITLIST_NOTIFY, else the platform admins, and skip anything that is not an address', () => {
  assert.deepEqual(notifyList({ WAITLIST_NOTIFY: 'a@x.com, b@x.com', PLATFORM_ADMINS: 'c@x.com' }), ['a@x.com', 'b@x.com']);
  assert.deepEqual(notifyList({ PLATFORM_ADMINS: 'c@x.com' }), ['c@x.com']);
  assert.deepEqual(notifyList({ WAITLIST_NOTIFY: 'nobody' }), []);
  assert.deepEqual(notifyList({}), []);
});

test('the notification says who joined and how many are on the list', () => {
  const m = notificationEmail({ email: 'ray@example.com', role: 'therapist', total: 1 });
  assert.match(m.subject, /\(1 so far\)/);
  assert.match(m.text, /ray@example.com joined the TALVO waiting list \(therapist\)/);
  assert.match(m.text, /1 person has signed up/);
  assert.match(notificationEmail({ email: 'a@b.co', role: null, total: 5 }).text, /no role given/);
});

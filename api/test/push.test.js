// Practice reminders: when one is due, and what happens when a device has gone away.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import webpush from 'web-push';
import { reminderDue, localNow, sendPush, reminderMessage } from '../src/push.js';

const at = (iso) => new Date(iso);
const base = { timeZone: 'Europe/Paris', reminderTime: '16:30', lastReminderOn: null, lastPracticeAt: null };

test('local time follows the learner time zone', () => {
  assert.deepEqual(localNow(at('2026-11-03T15:45:00Z'), 'Europe/Paris'), { date: '2026-11-03', time: '16:45' });
});

test('due after the chosen local time, not before', () => {
  assert.equal(reminderDue({ ...base, now: at('2026-11-03T15:29:00Z') }), false); // 16:29 Paris
  assert.equal(reminderDue({ ...base, now: at('2026-11-03T15:30:00Z') }), true);  // 16:30 Paris
});

test('only once a day', () => {
  assert.equal(reminderDue({ ...base, now: at('2026-11-03T17:00:00Z'), lastReminderOn: '2026-11-03' }), false);
  assert.equal(reminderDue({ ...base, now: at('2026-11-04T16:00:00Z'), lastReminderOn: '2026-11-03' }), true);
});

test('skipped if Sam already practised today', () => {
  assert.equal(reminderDue({ ...base, now: at('2026-11-03T17:00:00Z'), lastPracticeAt: '2026-11-03T07:10:00Z' }), false);
  assert.equal(reminderDue({ ...base, now: at('2026-11-03T17:00:00Z'), lastPracticeAt: '2026-11-02T18:00:00Z' }), true);
});

test('no time set means no reminder', () => {
  assert.equal(reminderDue({ ...base, reminderTime: '', now: at('2026-11-03T20:00:00Z') }), false);
});

test('sends the reminder, and reports a dropped subscription as gone', async () => {
  const keys = webpush.generateVAPIDKeys();
  process.env.VAPID_PUBLIC_KEY = keys.publicKey; process.env.VAPID_PRIVATE_KEY = keys.privateKey;
  const sub = { endpoint: 'https://push.example/abc', p256dh: 'p', auth: 'a' };
  let got;
  assert.equal(await sendPush(sub, reminderMessage('Sam'), { send: async (s, body) => { got = { s, body: JSON.parse(body) }; } }), 'sent');
  assert.equal(got.s.endpoint, 'https://push.example/abc');
  assert.match(got.body.body, /Hi Sam/);
  assert.equal(await sendPush(sub, {}, { send: async () => { throw Object.assign(new Error('gone'), { statusCode: 410 }); } }), 'gone');
  await assert.rejects(sendPush(sub, {}, { send: async () => { throw Object.assign(new Error('boom'), { statusCode: 500 }); } }));
});

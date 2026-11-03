// Practice emails: who receives them, and what they say.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recipientsFor, practiceEmail, sendEmail } from '../src/email.js';

const team = [
  { name: 'Ray', email: 'ray@example.com', role: 'parent', email_after_practice: true },
  { name: 'Ms Lee', email: 'lee@example.com', role: 'teacher', email_after_practice: true },
  { name: 'Ian', email: 'ian@example.com', role: 'teacher', email_after_practice: false },
];

test('only members who asked, and only roles Sam shares records with', () => {
  const consent = { agreed_at: '2026-11-01', can_view: { parent: true, teacher: false } };
  assert.deepEqual(recipientsFor(team, consent).map((a) => a.name), ['Ray']);
});

test('no emails before Sam has made his privacy choices', () => {
  assert.deepEqual(recipientsFor(team, { agreed_at: null, can_view: { parent: true } }), []);
  assert.deepEqual(recipientsFor(team, null), []);
});

test('email lists each item with result, goal and support code', () => {
  const records = [
    { item_label: 'Wipe the table', plan_goal: 'instructions', success: true, support_code: 'I', sam_response: 'First I get the cloth, then I wipe the table', review_note: '' },
    { item_label: 'Put the shopping away', plan_goal: 'instructions', success: false, support_code: 'M', sam_response: 'put the bread', review_note: 'Needed one cue for the order.' },
  ];
  const m = practiceEmail({ learnerName: 'Sam', adultName: 'Ray', activityTitle: 'Two-step jobs', records, reason: 'completed', appUrl: 'https://buddy.example/' });
  assert.equal(m.subject, 'Sam practised: Two-step jobs (1 of 2 met the target)');
  assert.match(m.text, /Wipe the table — Met the target/);
  assert.match(m.text, /Support: M \(One cue\)/);
  assert.match(m.text, /https:\/\/buddy\.example\/adult\//);
  assert.doesNotMatch(m.text, /stopped before the end/);
});

test('practice-only items are not counted, early stops are mentioned, html is escaped', () => {
  const records = [{ item_label: '<b>cup</b>', plan_goal: 'other', success: null, support_code: 'I', sam_response: 'a cup', review_note: '' }];
  const m = practiceEmail({ learnerName: 'Sam', adultName: 'Ray', activityTitle: 'Kitchen', records, reason: 'finished' });
  assert.equal(m.subject, 'Sam practised: Kitchen');
  assert.match(m.text, /Practice only \(not counted\)/);
  assert.match(m.text, /Sam stopped before the end/);
  assert.ok(m.html.includes('&lt;b&gt;cup&lt;/b&gt;') && !m.html.includes('<b>cup</b>'));
});

test('sends through Resend with the configured sender', async () => {
  process.env.RESEND_API_KEY = 're_test'; process.env.EMAIL_FROM = 'Buddy <buddy@example.com>';
  let call;
  const fetchImpl = async (url, opts) => { call = { url, opts }; return { ok: true, json: async () => ({ id: 'x' }) }; };
  await sendEmail({ to: 'ray@example.com', subject: 's', text: 't', html: 'h' }, { fetchImpl });
  assert.equal(call.url, 'https://api.resend.com/emails');
  assert.equal(call.opts.headers.authorization, 'Bearer re_test');
  assert.deepEqual(JSON.parse(call.opts.body).to, ['ray@example.com']);
});

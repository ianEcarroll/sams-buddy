// Editor tools: new-name questions, the reset email.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keywordJudge } from '../src/coach/judge.js';
import { resetEmail } from '../src/email.js';

const title = (text) => keywordJudge({ mode: 'listen', item: { kind: 'title', question: 'New name?', story: 'A crow took it.' }, elements: ['answer'], text });

test('basic checker: any real name counts for "give it a new name"; not knowing does not', () => {
  assert.ok(title('The sneaky crow').met.answer);
  assert.ok(title('Tink').met.answer);
  for (const t of ["I don't know", 'dunno', 'no idea', '']) assert.ok(!title(t).met.answer, t);
});

test('reset email: link, time limit, and what to do if it wasn\'t you', () => {
  const m = resetEmail({ name: 'Ray', link: 'https://app.growwithbuddy.com/adult/#reset=abc', minutes: 60 });
  assert.match(m.subject, /Reset your Buddy password/);
  for (const part of [m.text, m.html]) {
    assert.ok(part.includes('https://app.growwithbuddy.com/adult/#reset=abc'));
    assert.match(part, /60 minutes/);
    assert.match(part, /ignore this email/);
  }
  assert.ok(!resetEmail({ name: '<b>x</b>', link: 'l', minutes: 1 }).html.includes('<b>x</b>'), 'name is escaped');
});

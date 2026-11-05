// The child's interests: cleaned on save, and given to Buddy's AI as conversation material.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanInterests, MAX_INTERESTS } from '../src/families.js';
import { systemFor, makeClaudeJudge } from '../src/coach/judge.js';
import { createSession } from '../src/coach/engine.js';
import { MODES } from '../src/coach/modes.js';

test('interests are split, trimmed, de-duplicated and capped', () => {
  assert.deepEqual(cleanInterests(' drumming,  marching band\nGym; Disney , drumming,, '), ['drumming', 'marching band', 'Gym', 'Disney']);
  assert.deepEqual(cleanInterests(['Tinker Bell', 'tinker bell', '"paper" characters']), ['Tinker Bell', 'paper characters']);
  assert.equal(cleanInterests('x'.repeat(80))[0].length, 40);
  assert.equal(cleanInterests(Array.from({ length: 30 }, (_, i) => `thing ${i}`)).length, MAX_INTERESTS);
  assert.deepEqual(cleanInterests(undefined), []);
  assert.deepEqual(cleanInterests(''), []);
});

test('the assessment prompt mentions interests only when the family gave some', () => {
  assert.match(systemFor({ name: 'Sam', interests: ['drumming', 'Disney'] }), /Sam enjoys: drumming, Disney/);
  assert.doesNotMatch(systemFor({ name: 'Sam' }), /enjoys/);
});

test("Buddy's conversation reply rules include the child's interests", async () => {
  let sent;
  const fetchImpl = async (url, opts) => {
    sent = JSON.parse(opts.body);
    return { ok: true, json: async () => ({ content: [{ type: 'tool_use', input: { elements: [{ element: 'turn', supplied: true, evidence: 'I like it' }], events_in_order: 'not_applicable', help_request: 'none', transcript_seems_garbled: false, relevant_to_topic: true, reply: 'Nice!' } }] }) };
  };
  const judge = makeClaudeJudge({ apiKey: 'k', model: 'm', fetchImpl });
  await judge({ mode: 'conversation', item: { topic: 'music' }, elements: ['turn'], text: 'I like it', learner: { name: 'Sam', age: 15, interests: ['drumming'] } });
  const userText = sent.messages[0].content;
  assert.match(userText, /Things Sam enjoys: drumming/);
  assert.match(userText, /Don't force it/);
  assert.match(sent.system, /Sam enjoys: drumming/);
});

test('a practice session carries the interests through to the judge', () => {
  const activity = { id: 'a', title: 'Chat', mode: 'conversation', content: { items: [{ topic: 'music', opener: 'I love music.' }] } };
  const { state } = createSession({ activity, learnerName: 'Sam', learnerInterests: ['drumming'] });
  assert.deepEqual(state.learnerInterests, ['drumming']);
});

test('every module has a Buddy name, a tagline and its plain activity name', () => {
  const names = Object.values(MODES).map((m) => m.label);
  assert.deepEqual(names.sort(), ['Chat Buddy', 'Explain Buddy', 'Listen Buddy', 'Memory Buddy', 'Story Buddy', 'Think Buddy']);
  for (const m of Object.values(MODES)) { assert.ok(m.tagline); assert.ok(m.activityName); }
});

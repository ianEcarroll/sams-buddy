// "Buddy will say…" in the activity editor comes from the real engine, for every module.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previewLines } from '../src/coach/engine.js';
import { MODES, STARTER_SCENARIOS } from '../src/coach/modes.js';

const texts = (p) => p.lines.map((l) => l.text);

test('Think: the situation and the question, no movie phrase', () => {
  const p = previewLines({ mode: 'think', item: STARTER_SCENARIOS.items[0] });
  assert.ok(texts(p).includes("You arrive at the gym for your 4 o'clock session. You wait by the door, where your trainer usually meets you. It is now ten past four."));
  assert.ok(!texts(p).includes('Make a movie in your mind.'));
  assert.equal(texts(p).at(-1), 'What would you do?');
  assert.ok(p.simple);
});

test('Talk: the opener, or "Let\'s talk about…" when there is none', () => {
  assert.deepEqual(texts(previewLines({ mode: 'conversation', item: { topic: 'Tinker Bell', opener: 'I watched Tinker Bell at the weekend.' } })), ['I watched Tinker Bell at the weekend.']);
  assert.deepEqual(texts(previewLines({ mode: 'conversation', item: { topic: 'football' } })), ["Let's talk about football."]);
});

test('Listen: the instruction in order, with First / Then / Finally', () => {
  const p = previewLines({ mode: 'task', item: { steps: ['get the cloth', 'wipe the table'] } });
  assert.ok(texts(p).some((t) => /^First, get the cloth\. .*wipe the table/.test(t)));
});

test('Memory: asks for the number of things the team chose', () => {
  const p = previewLines({ mode: 'recall', item: { when: 'at the weekend', target: 2, memories: [] } });
  assert.match(texts(p).at(-1), /two things you did at the weekend/i);
});

test('every module gives something to show, even with a nearly empty item', () => {
  for (const mode of Object.keys(MODES)) {
    const p = previewLines({ mode, item: {} });
    assert.ok(Array.isArray(p.lines), mode);
  }
});

test('blank lines are left out', () => {
  const p = previewLines({ mode: 'think', item: { scenario: '' } });
  assert.ok(p.lines.every((l) => l.text.trim()));
});

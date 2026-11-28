// Story: the place gets the right small word, and a hint after the model gives the whole answer (Foxy check, 28 Nov).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placePhrase } from '../src/coach/modes.js';
import { createSession, respond, control } from '../src/coach/engine.js';
import { keywordJudge } from '../src/coach/judge.js';
import { libraryById } from '../src/library.js';

test('place phrases', () => {
  assert.equal(placePhrase('street').phrase, 'in the street');
  assert.equal(placePhrase('the park').phrase, 'in the park');
  assert.equal(placePhrase('beach').phrase, 'at the beach');
  assert.equal(placePhrase('football pitch').phrase, 'on the football pitch');
  assert.equal(placePhrase('the road').prep, 'on the');
  assert.equal(placePhrase('school').phrase, 'at school');
});

test('a hint after the model is a whole answer, not the same model again', async () => {
  const lib = libraryById('tell-easy');
  const activity = { ...lib, id: 'x', content: { ...lib.content, items: [lib.content.items[0]] } };
  const { state } = createSession({ activity, quickStart: true });
  const judge = async (a) => keywordJudge(a);
  let last;
  for (let i = 0; i < 5; i++) last = control(state, 'hint').turn;
  const texts = last.lines.map((l) => l.text);
  assert.ok(texts.some((t) => /^Here is a whole answer/.test(t)), texts.join(' | '));
  assert.ok(!texts.includes('Sure, here is a hint.'));
  assert.ok(!JSON.stringify(state).includes('at the street'));
  void judge; void respond;
});

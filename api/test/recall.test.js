// Memory Buddy, Remember My Day: real experiences, "What else?" once, then broad → specific → photo clues.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, respond } from '../src/coach/engine.js';
import { keywordJudge } from '../src/coach/judge.js';
import { MODES } from '../src/coach/modes.js';

const judge = async (a) => keywordJudge(a);
const say = (state, text) => respond(state, { text }, { judge });
const weekend = {
  id: 'r', title: 'My weekend', mode: 'recall', plan_goal: 'other',
  content: { items: [{
    when: 'at the weekend', target: 3,
    memories: [
      { event: 'went to the gym with Dad', broad_clue: 'Think about Saturday morning.', specific_clue: 'You went somewhere to exercise.', image_id: 'img-gym' },
      { event: 'played drums at band practice', broad_clue: 'Think about Saturday afternoon.', specific_clue: 'You made music with other people.' },
      { event: 'watched a Disney film', broad_clue: 'Think about Sunday evening.' },
    ],
  }] },
};

test('asks for three things after "Make a movie in your mind"', () => {
  const { turn } = createSession({ activity: weekend });
  const t = turn.lines.map((l) => l.text);
  assert.ok(t.includes('Make a movie in your mind.'));
  assert.equal(t.at(-1), 'Tell me three things you did at the weekend.');
  assert.deepEqual(turn.ui.cueCard.labels, ['1', '2', '3']);
});

test('three things on his own: complete, no support', async () => {
  let { state } = createSession({ activity: weekend });
  const { turn } = await say(state, 'I went to the gym and I played the drums and we watched a film');
  assert.match(turn.lines[0].text, /remembered three things you did/);
  const rec = state.completed[0];
  assert.equal(rec.support_code, 'I');
  assert.match(rec.review_note, /Remembered 3 of 3: 3 on their own/);
});

test('"What else?" once is free; then broad clue, specific clue and the photo', async () => {
  let { state } = createSession({ activity: weekend });
  let { turn } = await say(state, 'I played drums');
  assert.match(turn.lines[0].text, /remembered one thing/);
  assert.equal(turn.lines.at(-1).text, 'What else do you remember doing?');
  assert.equal(state.item.supportGiven.length, 0, '"What else?" is not counted as support');
  ({ turn } = await say(state, 'I am not sure'));
  assert.equal(turn.lines.at(-1).text, 'Think about Saturday morning.', 'broad clue for the first listed thing not yet remembered');
  ({ turn } = await say(state, 'Um'));
  assert.equal(turn.lines.at(-1).text, 'You went somewhere to exercise.');
  ({ turn } = await say(state, 'I forget'));
  assert.equal(turn.lines.at(-1).text, 'Look at this photo. What were you doing?');
  assert.deepEqual(turn.ui.images, ['img-gym']);
  ({ turn } = await say(state, 'I went to the gym'));
  assert.equal(turn.lines.at(-1).text, 'Anything else you remember?', 'a fresh "what else" for the third');
  ({ turn } = await say(state, 'We watched a film'));
  const rec = state.completed[0];
  assert.equal(rec.support_code, 'F', 'the photo counts as full support');
  assert.match(rec.review_note, /Remembered 3 of 3: 1 on their own, 2 after a clue/);
  assert.match(rec.review_note, /Needed a photo/);
});

test('things the family did not list still count, and repeats do not', async () => {
  let { state } = createSession({ activity: weekend });
  await say(state, 'I went to the beach');
  assert.equal(state.item.recalled.length, 1);
  await say(state, 'I went to the beach');
  assert.equal(state.item.recalled.length, 1, 'the same thing twice counts once');
  assert.equal(state.item.recalled[0].known, -1);
});

test('Memory Buddy covers both its practice types', () => {
  assert.equal(MODES.recall.label, 'Memory Buddy');
  assert.equal(MODES.listen.label, 'Memory Buddy');
  assert.notEqual(MODES.recall.activityName, MODES.listen.activityName);
});

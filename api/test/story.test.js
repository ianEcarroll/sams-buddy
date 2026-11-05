// Story Buddy: First → Next → Then → Finally organiser, optional who and ending, and fading the organiser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, respond } from '../src/coach/engine.js';
import { keywordJudge } from '../src/coach/judge.js';
import { storyOrdinal } from '../src/coach/modes.js';

const judge = async (a) => keywordJudge(a);
const say = (state, text) => respond(state, { text }, { judge });
const band = (organiser) => ({
  id: 's', title: 'Band concert', mode: 'story', plan_goal: 'narrative',
  content: { organiser, items: [{
    intro: "Let's tell the story of your band concert.",
    who: 'Dad, the band', setting: 'school hall',
    events: ['we got changed into our uniforms', 'we marched onto the stage', 'I played the drums', 'everyone clapped'],
    keywords: [['changed', 'uniform', 'uniforms'], ['marched', 'stage'], ['played', 'drums', 'drum'], ['clapped', 'clap']],
    outcome: 'we went for pizza',
  }] },
});

test('organiser words: First → Next → Then → Finally', () => {
  assert.deepEqual([0, 1, 2, 3].map((i) => storyOrdinal(i, 4)), ['first', 'next', 'then', 'finally']);
  assert.deepEqual([0, 1, 2].map((i) => storyOrdinal(i, 3)), ['first', 'next', 'finally']);
  assert.deepEqual([0, 1].map((i) => storyOrdinal(i, 2)), ['first', 'finally']);
});

test('the organiser shows Who, Where, the four steps and How it ended, lighting up as Sam tells it', async () => {
  let { state, turn } = createSession({ activity: band() });
  assert.deepEqual(turn.ui.cueCard.labels, ['Who', 'Where', 'First', 'Next', 'Then', 'Finally', 'How it ended']);
  assert.match(turn.lines.at(-1).text, /who was there, where it happens, then what happens first, next, then and finally, and how it ended/);
  ({ turn } = await say(state, 'Dad came to the school hall. First we got changed into our uniforms.'));
  assert.deepEqual(turn.ui.cueCard.lit, [true, true, true, false, false, false, false]);
});

test('asks for who and how it ended when they are missing', async () => {
  let { state } = createSession({ activity: band() });
  let { turn } = await say(state, 'At the school hall we got changed into our uniforms, then we marched onto the stage, then I played the drums and finally everyone clapped.');
  assert.equal(turn.lines.at(-1).element, 'who');
  ({ turn } = await say(state, 'Dad was there'));
  assert.equal(turn.lines.at(-1).element, 'ending');
  assert.equal(turn.lines.at(-1).text, 'Remember to say how it ended.');
  ({ turn } = await say(state, 'We went for pizza'));
  assert.equal(state.done, true);
});

test('"only if stuck": no organiser at first, it appears after the first cue, and is recorded as a visual aid', async () => {
  let { state, turn } = createSession({ activity: band('when_stuck') });
  assert.equal(turn.ui.cueCard, null);
  ({ turn } = await say(state, 'I played the drums'));
  assert.ok(turn.ui.cueCard, 'shown once Buddy gives a cue');
  assert.equal(turn.ui.cueCard.lit[4], true, 'what he already said is lit');
});

test('"only if stuck": a complete story told without help has no visual aid', async () => {
  const { state } = createSession({ activity: band('when_stuck') });
  await say(state, 'Dad and the band were at the school hall. First we got changed into our uniforms, next we marched onto the stage, then I played the drums and finally everyone clapped. At the end we went for pizza.');
  const r = state.completed[0];
  assert.equal(r.support_code, 'I');
  assert.ok(!r.visual_aids.includes('Organiser'));
  assert.equal(r.success, true);
});

test('"off": never shown', async () => {
  let { state, turn } = createSession({ activity: band('off') });
  ({ turn } = await say(state, 'I played the drums'));
  assert.equal(turn.ui.cueCard, null);
});

test('stories without who/ending work as before', () => {
  const act = band();
  delete act.content.items[0].who;
  delete act.content.items[0].outcome;
  const { turn } = createSession({ activity: act });
  assert.deepEqual(turn.ui.cueCard.labels, ['Where', 'First', 'Next', 'Then', 'Finally']);
});

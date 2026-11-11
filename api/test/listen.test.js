// Listen to a Story: story → I'm ready → questions → score → optional retry of missed questions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, respond, control, finish } from '../src/coach/engine.js';
import { keywordJudge } from '../src/coach/judge.js';
import { STARTER_STORIES } from '../src/coach/modes.js';

const judge = async (a) => keywordJudge(a);
const say = (state, text) => respond(state, { text }, { judge });
const act = () => ({ id: 'l1', mode: 'listen', title: STARTER_STORIES[0].title, goal: '', plan_goal: 'other', content: { items: structuredClone(STARTER_STORIES[0].items) } });
const texts = (t) => t.lines.map((l) => l.text);

test('reads the story, then waits for I\'m ready', () => {
  const { turn } = createSession({ activity: act() });
  assert.ok(texts(turn).some((t) => t.includes('Neverland')));
  assert.match(texts(turn).at(-1), /press I'm ready/);
  assert.equal(turn.expect, 'ready');
});

test('all five right first time ends the item with full marks', async () => {
  const { state } = createSession({ activity: act() });
  let { turn } = control(state, 'start_questions');
  assert.match(texts(turn).at(-1), /Question 1 of 5\. Where does the story happen\?/);
  for (const a of ['In Neverland', 'a silver thimble', 'Peter Pan', 'a crow', 'she glows gold']) ({ turn } = await say(state, a));
  assert.ok(texts(turn).some((t) => /all 5 right/.test(t)));
  assert.equal(state.done, true);
  const r = state.completed[0];
  assert.equal(r.score_correct, 5); assert.equal(r.score_first, 5); assert.equal(r.support_code, 'I');
});

test('misses are counted, retry replays the story and asks only the missed ones', async () => {
  const { state } = createSession({ activity: act() });
  control(state, 'start_questions');
  let turn;
  for (const a of ['Neverland', 'a hat', 'Peter', 'a dog', 'she glows']) ({ turn } = await say(state, a));
  assert.ok(texts(turn).some((t) => t === 'You got 3 out of 5 right. Good listening.'));
  assert.equal(turn.expect, 'choice');
  ({ turn } = control(state, 'listen_retry'));
  assert.ok(texts(turn).some((t) => /story again/.test(t)));
  assert.equal(turn.expect, 'ready');
  ({ turn } = control(state, 'start_questions'));
  assert.match(texts(turn).at(-1), /Question 1 of 2\. What was Tinker Bell's favourite thing\?/);
  await say(state, 'the thimble');
  ({ turn } = await say(state, 'a crow'));
  assert.ok(texts(turn).some((t) => /all 5 right now/.test(t)));
  const r = state.completed[0];
  assert.equal(r.score_first, 3); assert.equal(r.score_correct, 5);
  assert.equal(r.support_code, 'M');
  assert.equal(r.after_support.length, 2);
});

test('saying no to a retry finishes and records what was missed', async () => {
  const { state } = createSession({ activity: act() });
  control(state, 'start_questions');
  for (const a of ['Neverland', 'a hat', 'Peter', 'a crow', 'glows']) await say(state, a);
  control(state, 'listen_finish');
  const r = state.completed[0];
  assert.equal(r.score_correct, 4);
  assert.match(r.review_note, /Still to get: Q2/);
});

test('a clue is given on request and the answer then counts as supported', async () => {
  const { state } = createSession({ activity: act() });
  control(state, 'start_questions');
  const { turn } = control(state, 'hint');
  assert.match(texts(turn)[0], /magical island/);
  await say(state, 'Neverland');
  for (const a of ['thimble', 'Peter', 'crow', 'glows']) await say(state, a);
  const r = state.completed[0];
  assert.equal(r.score_first, 4); assert.equal(r.score_correct, 5);
});

test('stopping partway saves a partial record', async () => {
  const { state } = createSession({ activity: act() });
  control(state, 'start_questions');
  await say(state, 'Neverland');
  const { records } = finish(state, 'finished');
  assert.equal(records[0].score_correct, 1);
  assert.equal(records[0].success, null);
});

test('an activity with two stories moves to the second story and waits again', async () => {
  const a = act(); a.content.items.push(structuredClone(STARTER_STORIES[1].items[0]));
  const { state } = createSession({ activity: a });
  control(state, 'start_questions');
  let turn;
  for (const x of ['Neverland', 'thimble', 'Peter', 'crow', 'glows']) ({ turn } = await say(state, x));
  assert.equal(turn.expect, 'ready');
  assert.ok(texts(turn).some((t) => t.includes('Corner Café')));
});

test('the offer gives three choices and "just the questions" skips the story', async () => {
  const { state } = createSession({ activity: act() });
  control(state, 'start_questions');
  let turn;
  for (const a of ['Neverland', 'a hat', 'Peter', 'a dog', 'she glows']) ({ turn } = await say(state, a));
  assert.match(texts(turn).at(-1), /hear the story again and try the 2 you missed\? Or you can try them again straight away, or finish\./);
  ({ turn } = control(state, 'listen_retry_questions'));
  assert.ok(!texts(turn).some((t) => t.includes('Neverland')), 'story not read again');
  assert.match(texts(turn).at(-1), /Question 1 of 2\./);
  await say(state, 'the thimble');
  ({ turn } = await say(state, 'a crow'));
  const r = state.completed[0];
  assert.equal(r.score_first, 3); assert.equal(r.score_correct, 5);
  assert.ok(!JSON.stringify(r).includes('Heard the story again'), 'retrying without the story is not counted as hearing it again');
});

test('saying "just the questions" out loud also skips the story', async () => {
  const { state } = createSession({ activity: act() });
  control(state, 'start_questions');
  for (const a of ['Neverland', 'a hat', 'Peter', 'a crow', 'glows']) await say(state, a);
  const { turn } = await say(state, 'just the questions please');
  assert.match(texts(turn).at(-1), /Question 1 of 1\./);
});

test('after the story is read again, Buddy asks to press I\'m ready to answer again', async () => {
  const { state } = createSession({ activity: act() });
  control(state, 'start_questions');
  for (const a of ['Neverland', 'a hat', 'Peter', 'a crow', 'glows']) await say(state, a);
  const { turn } = control(state, 'listen_retry');
  assert.equal(texts(turn).at(-1), "When you're ready to answer the question again, press I'm ready.");
});

test('the team sets how many retries: none means the item ends after the first round', async () => {
  const a = act(); a.content.listen_retries = 0;
  const { state } = createSession({ activity: a });
  control(state, 'start_questions');
  let turn;
  for (const x of ['Neverland', 'a hat', 'Peter', 'a crow', 'glows']) ({ turn } = await say(state, x));
  assert.notEqual(turn.expect, 'choice');
  assert.equal(state.done, true);
});

test('one retry allowed: the second round with misses ends without another offer', async () => {
  const a = act(); a.content.listen_retries = 1;
  const { state } = createSession({ activity: a });
  control(state, 'start_questions');
  for (const x of ['Neverland', 'a hat', 'Peter', 'a crow', 'glows']) await say(state, x);
  let { turn } = control(state, 'listen_retry_questions');
  ({ turn } = await say(state, 'a hat'));
  assert.notEqual(turn.expect, 'choice');
  assert.equal(state.done, true);
});

test('answers get a warm, neutral thanks (never a bare "Okay.")', async () => {
  const { state } = createSession({ activity: act(), learnerName: 'Maya' });
  control(state, 'start_questions');
  const acks = [];
  for (const a of ['Neverland', 'a hat', 'Peter', 'a dog']) { const { turn } = await say(state, a); acks.push(turn.lines.find((l) => l.kind === 'ack').text); }
  assert.ok(!acks.includes('Okay.'));
  assert.ok(acks.includes('Thanks, Maya.'));
});

test('no correct answers: no "0 out of 5"', async () => {
  const { state } = createSession({ activity: act() });
  control(state, 'start_questions');
  let turn;
  for (const a of ['x', 'y', 'z', 'w', 'v']) ({ turn } = await say(state, a));
  assert.ok(!texts(turn).some((t) => /0 out of/.test(t)));
  assert.ok(texts(turn).includes('Those questions were tricky.'));
});

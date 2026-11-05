// Listen Buddy on screen: tap a shape, tap a box; when a step goes wrong Buddy works out whether it was
// doing (said it back right), remembering (needed to hear it again) or understanding (needed to see it).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, respond, act, control } from '../src/coach/engine.js';
import { keywordJudge } from '../src/coach/judge.js';
import { STARTER_FOLLOW, followInstruction } from '../src/coach/modes.js';
import { PLAN_GOALS } from '../src/coach/goals.js';

const judge = async (a) => keywordJudge(a);
const say = (state, text) => respond(state, { text }, { judge });
const one = (item) => ({ id: 'f', title: 'Shapes', mode: 'follow', plan_goal: 'instructions', content: { items: [item] } });
const [twoStep, touchMove, ray] = STARTER_FOLLOW.items;

test("Ray's example reads as one instruction: First … Then … Finally", () => {
  assert.equal(followInstruction(ray), 'First, touch the red circle. Then, put it on the left of the blue square. Finally, tell me which one is on the left.');
  const { turn } = createSession({ activity: one(ray) });
  assert.equal(turn.expect, 'board');
  assert.deepEqual(turn.ui.board.pos, { 'blue-square': 2 }, 'blue square starts in box 3');
  assert.ok(turn.lines.some((l) => l.text === 'Listen to all of it first.'));
});

test("Ray's example done right: touch, place, then say — code I", async () => {
  let { state } = createSession({ activity: one(ray) });
  let { turn } = act(state, { type: 'token', token: 'red-circle' });
  assert.equal(turn.expect, 'board');
  ({ turn } = act(state, { type: 'box', box: 0 }));
  assert.equal(turn.expect, 'response', 'the last step is spoken');
  ({ turn } = await say(state, 'The red circle'));
  const rec = state.completed[0];
  assert.equal(rec.support_code, 'I');
  assert.equal(rec.success, true);
  assert.match(rec.review_note, /Step 1 \(touch the red circle\): done on their own\./);
  assert.match(rec.review_note, /Step 3 \(tell me which one is on the left\): done on their own\./);
});

test('doing: wrong box, but says the step back correctly', async () => {
  let { state } = createSession({ activity: one(twoStep) });
  act(state, { type: 'token', token: 'red-circle' });
  let { turn } = act(state, { type: 'box', box: 2 });
  assert.equal(turn.lines.at(-1).text, 'What did I ask you to do?');
  assert.equal(turn.expect, 'response');
  assert.deepEqual(turn.ui.board.pos, {}, 'the wrong move is not kept');
  ({ turn } = await say(state, 'Put the red circle in box one'));
  assert.equal(turn.lines.at(-1).text, "Yes, that's right. Have another go.");
  act(state, { type: 'token', token: 'red-circle' });
  act(state, { type: 'box', box: 0 });
  act(state, { type: 'token', token: 'blue-square' });
  act(state, { type: 'box', box: 1 });
  const rec = state.completed[0];
  assert.match(rec.review_note, /Step 1 \(put the red circle in box 1\): understood and remembered it \(said it back correctly\) but did something different at first/);
  assert.equal(rec.success, false, 'goal 2 needs no prompt');
});

test('remembering: cannot say it back, gets it right after hearing it again', async () => {
  let { state } = createSession({ activity: one(twoStep) });
  act(state, { type: 'token', token: 'blue-square' });
  act(state, { type: 'box', box: 0 });
  const { turn } = await say(state, "I don't know");
  assert.equal(turn.lines.at(-1).text, 'Listen again: put the red circle in box 1.');
  act(state, { type: 'token', token: 'red-circle' });
  act(state, { type: 'box', box: 0 });
  act(state, { type: 'token', token: 'blue-square' });
  act(state, { type: 'box', box: 1 });
  assert.match(state.completed[0].review_note, /needed to hear it again \(remembering\)/);
});

test('understanding: still wrong after hearing it again, so it is shown on screen; then Buddy shows it', async () => {
  let { state } = createSession({ activity: one(touchMove) });
  act(state, { type: 'token', token: 'yellow-star' });
  await say(state, 'um');
  let { turn } = act(state, { type: 'token', token: 'purple-heart' });
  assert.equal(turn.lines.at(-1).text, 'Here it is on the screen: touch the green triangle.');
  assert.equal(turn.ui.board.showStep, 'Touch the green triangle.');
  ({ turn } = act(state, { type: 'token', token: 'green-triangle' }));
  assert.equal(turn.ui.board.showStep, null);
  ({ turn } = act(state, { type: 'box', box: 2 }));
  assert.match(state.completed[0].review_note, /Step 1 \(touch the green triangle\): needed to see it on the screen \(understanding\)/);
  assert.match(state.completed[0].review_note, /Step 2 \(put the green triangle in box 3\): done on their own|Step 2/);
});

test('Repeat replays the whole instruction and is counted', async () => {
  let { state } = createSession({ activity: one(twoStep) });
  const { turn } = control(state, 'repeat');
  assert.equal(turn.lines[1].text, followInstruction(twoStep));
  act(state, { type: 'token', token: 'red-circle' });
  act(state, { type: 'box', box: 0 });
  act(state, { type: 'token', token: 'blue-square' });
  act(state, { type: 'box', box: 1 });
  assert.match(state.completed[0].review_note, /Asked to hear the instruction again once/);
});

test('"next to" and "left of" are checked against where the other shape is', () => {
  let { state } = createSession({ activity: one(twoStep) });
  act(state, { type: 'token', token: 'red-circle' });
  act(state, { type: 'box', box: 0 });
  act(state, { type: 'token', token: 'blue-square' });
  const { turn } = act(state, { type: 'box', box: 3 });
  assert.equal(turn.lines.at(-1).text, 'What did I ask you to do?', 'box 4 is not next to box 1');
});

test('tapping a box with no shape chosen, or talking during a tap step, is not counted as a try', async () => {
  let { state } = createSession({ activity: one(twoStep) });
  let { turn } = act(state, { type: 'box', box: 0 });
  assert.equal(turn.lines[0].text, 'Touch a shape first, then touch a box.');
  ({ turn } = await say(state, 'the red one'));
  assert.equal(turn.lines[0].text, 'Touch a shape, then touch a box.');
  assert.equal(state.item.attempts, 0);
});

test('Listen Buddy on screen counts toward plan goal 2', () => {
  assert.ok(PLAN_GOALS.instructions.modes.includes('follow'));
});

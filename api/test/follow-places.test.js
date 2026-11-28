// Follow on Screen with real places instead of numbered boxes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, respond, act } from '../src/coach/engine.js';
import { keywordJudge } from '../src/coach/judge.js';
import { followInstruction } from '../src/coach/modes.js';
import { LIBRARY, activityFromLibrary } from '../src/library.js';

const judge = async (a) => keywordJudge(a);
const set = (id) => ({ id: 'f', status: 'ready', plan_goal: 'instructions', ...activityFromLibrary(LIBRARY.find((x) => x.id === id)) });

test('instructions name the places, with "on" for a table', () => {
  const [shop, , , ] = LIBRARY.find((x) => x.id === 'follow-places-2').content.items;
  assert.equal(followInstruction(shop), 'First, put the milk in the fridge. Then, put the cereal in the cupboard.');
  const unpack = LIBRARY.find((x) => x.id === 'follow-places-3').content.items[0];
  assert.match(followInstruction(unpack), /put the bread on the table\.$/);
});

test('the board shows the places, and tapping them completes the steps', () => {
  const { state, turn } = createSession({ activity: set('follow-places-2'), quickStart: true });
  const b = turn.ui.board;
  assert.equal(b.boxes, 3);
  assert.deepEqual(b.places.map((p) => p.name), ['the fridge', 'the cupboard', 'the freezer']);
  act(state, { type: 'token', token: 'obj-milk' });
  let t = act(state, { type: 'box', box: 0 }).turn;
  assert.ok(state.item.met.step_0);
  act(state, { type: 'token', token: 'obj-cereal' });
  t = act(state, { type: 'box', box: 1 }).turn;
  assert.ok(state.completed.length === 1 || state.item.met.step_1, JSON.stringify(t.lines.map((l) => l.text)));
  assert.ok(!/\bbox \d/.test(JSON.stringify(t.lines)), 'no "box 2" wording with real places');
  assert.equal(act(state, { type: 'box', box: 3 }).turn.lines.length, 0, 'a fourth box does not exist');
});

test('a "tell me" step about a place is answered by speaking', async () => {
  const { createSession: cs } = await import('../src/coach/engine.js');
  const a = set('follow-places-3'); a.content.items = [a.content.items[1]];
  const s = cs({ activity: a, quickStart: true }).state;
  act(s, { type: 'token', token: 'obj-towel' }); act(s, { type: 'box', box: 0 });
  act(s, { type: 'token', token: 'obj-shoes' }); const t = act(s, { type: 'box', box: 2 }).turn;
  assert.equal(t.expect, 'response', 'the last step is answered by speaking');
  await respond(s, { text: 'the towel' }, { judge });
  assert.ok(s.completed.length === 1, 'done');
});

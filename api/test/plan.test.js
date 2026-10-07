// Plan tracking: support codes (I/M/P/F) and whether each opportunity met the goal's criterion.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, respond, finish } from '../src/coach/engine.js';
import { keywordJudge } from '../src/coach/judge.js';
import { supportCode, successFor } from '../src/coach/goals.js';
import { spoonActivity, storyActivity, taskActivity, convActivity } from './fixtures.js';

const judge = async (a) => keywordJudge(a);
const say = (state, text) => respond(state, { text }, { judge });
const withGoal = (a, plan_goal) => ({ ...structuredClone(a), plan_goal });

test('support code follows the plan: none → I, one cue → M, several → P, any model → F', () => {
  assert.equal(supportCode([]), 'I');
  assert.equal(supportCode([{ level: 1 }]), 'M');
  assert.equal(supportCode([{ level: 0 }, { level: 1 }]), 'P');
  assert.equal(supportCode([{ level: 0 }, { level: 3 }]), 'F');
});

test('success rules: instructions need I; narrative allows one cue; other is never counted', () => {
  assert.equal(successFor('instructions', { complete: true, code: 'I' }), true);
  assert.equal(successFor('instructions', { complete: true, code: 'M' }), false);
  assert.equal(successFor('narrative', { complete: true, code: 'M' }), true);
  assert.equal(successFor('narrative', { complete: false, code: 'I' }), false);
  assert.equal(successFor('other', { complete: true, code: 'I' }), null);
  assert.equal(successFor('narrative', { complete: true, code: 'I', stopped: true }), null);
});

test('a complete independent story under goal 3 is a success with code I', async () => {
  const { state } = createSession({ activity: withGoal(storyActivity, 'narrative') });
  await say(state, 'At the park, the boy builds a kite. Then the wind lifts it. Last, the kite spins and spins.');
  const r = state.completed[0];
  assert.equal(r.plan_goal, 'narrative');
  assert.equal(r.support_code, 'I');
  assert.equal(r.success, true);
  assert.ok(r.visual_aids.includes('Cue card'));
});

test('an item that needed several cues is coded P and does not meet an I-only goal', async () => {
  const act = withGoal(spoonActivity, 'instructions');
  const { state } = createSession({ activity: act });
  await say(state, 'Spoon, for eating.');
  await say(state, 'Spoon.');
  await say(state, 'It is a kind of utensil.');
  const r = state.completed[0];
  assert.equal(r.support_code, 'P');
  assert.equal(r.success, false);
});

test('goal 1: asking about an unclear instruction without a prompt is a success', async () => {
  const { state } = createSession({ activity: withGoal(taskActivity, 'unexpected') });
  await say(state, "Sorry, I don't understand.");
  await say(state, 'First get the cloth and spray, then wipe each table, then put the chairs in.');
  const r = state.completed[0];
  assert.equal(r.support_code, 'I');
  assert.equal(r.success, true);
});

test('activities without a goal are recorded as "other" and not counted', async () => {
  const { state } = createSession({ activity: spoonActivity });
  await say(state, 'A spoon is a utensil for eating.');
  assert.equal(state.completed[0].plan_goal, 'other');
  assert.equal(state.completed[0].success, null);
});

test('stopping early is not counted as an opportunity', async () => {
  const { state } = createSession({ activity: withGoal(storyActivity, 'narrative') });
  await say(state, 'At the park the boy builds a kite.');
  const { records } = finish(state, 'finished');
  assert.equal(records[0].success, null);
});

test('conversation records Sam\'s relevant turns', async () => {
  const { state } = createSession({ activity: withGoal(convActivity, 'conversation') });
  await say(state, 'I watched that film too with my brother.');
  const { records } = finish(state, 'finished');
  assert.equal(records[0].sam_turns, 1);
});

// Think Buddy: a situation, "what would you do?", then "why?" and "what if that doesn't work?" as follow-ups.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, respond } from '../src/coach/engine.js';
import { keywordJudge, helpFor, detectHelp } from '../src/coach/judge.js';
import { MODES, STARTER_SCENARIOS, THINK_FOLLOW_UPS } from '../src/coach/modes.js';
import { PLAN_GOALS } from '../src/coach/goals.js';

const judge = async (a) => keywordJudge(a);
const say = (state, text) => respond(state, { text }, { judge });
const gym = { id: 't', title: 'Everyday surprises', mode: 'think', plan_goal: 'unexpected', content: { items: [STARTER_SCENARIOS.items[0]] } };

test('opens with the situation, the team phrase and "What would you do?"', () => {
  const { turn } = createSession({ activity: gym });
  const t = turn.lines.map((l) => l.text);
  assert.ok(t.includes("You arrive at the gym for your session, but your trainer isn't there."));
  assert.ok(t.includes('Make a movie in your mind.'));
  assert.equal(t.at(-1), 'What would you do?');
  assert.deepEqual(turn.ui.cueCard.labels, ['Problem', 'What I’d do', 'Why', 'If not']);
});

test('asks "why?" and "what if?" as follow-ups, not as support, then records an independent success', async () => {
  let { state } = createSession({ activity: gym });
  let { turn } = await say(state, "My trainer isn't there so I'd ask the person at the front desk");
  assert.equal(turn.lines.at(-1).kind, 'prompt');
  assert.equal(state.item.supportGiven.length, 0, 'a follow-up question is not a cue');
  // "so I'd" already gave a reason, so the next follow-up is the plan B one
  assert.equal(turn.lines.at(-1).text, THINK_FOLLOW_UPS.backup);
  ({ turn } = await say(state, "If that doesn't work I would call my dad"));
  const rec = state.completed[0];
  assert.equal(rec.support_code, 'I');
  assert.equal(rec.success, true);
  assert.match(rec.review_note, /All parts given independently/);
});

test('asks "why?" when no reason is given', async () => {
  let { state } = createSession({ activity: gym });
  const { turn } = await say(state, "I'd ask the staff at the front desk.");
  assert.equal(turn.lines.at(-1).text, THINK_FOLLOW_UPS.reason);
});

test('"I\'d ask for help" is an answer in Think Buddy, not a help request', async () => {
  assert.equal(helpFor('think', detectHelp('I need help so I would ask my coach')), 'none');
  assert.equal(helpFor('think', detectHelp("I don't understand")), 'dont_understand');
  assert.equal(helpFor('task', detectHelp('I need help')), 'need_help');
  let { state } = createSession({ activity: gym });
  const { turn } = await say(state, 'I would ask my coach for help because he knows');
  assert.ok(state.item.met.action, 'counted as a safe action');
  assert.ok(!state.item.help.length, 'not recorded as a help request');
  assert.equal(turn.lines.at(-1).text, THINK_FOLLOW_UPS.backup);
});

test('a cue is given when no safe action is offered, and goal 1 then records the support', async () => {
  let { state } = createSession({ activity: gym });
  let { turn } = await say(state, 'Hmm.');
  const cue = turn.lines.find((l) => l.kind === 'cue');
  assert.ok(cue, 'one cue');
  ({ turn } = await say(state, "The trainer isn't there. I'd ask the front desk because they know, and if that doesn't work I'd call my mum"));
  const rec = state.completed[0];
  assert.notEqual(rec.support_code, 'I');
  assert.equal(rec.success, false, 'goal 1 needs no adult prompt');
});

test('an unsafe idea is not accepted and is flagged for the team', async () => {
  let { state } = createSession({ activity: gym });
  await say(state, "I'd leave on my own without telling anyone");
  assert.ok(!state.item.met.action);
  await say(state, "I'd ask the person at the front desk because they can help, and if that doesn't work I'd call my dad");
  const rec = state.completed[0];
  assert.match(rec.review_note, /may not be safe: "I'd leave on my own/);
  assert.equal(rec.success, false);
});

test('Think Buddy is linked to plan goal 1 and has three starter situations', () => {
  assert.ok(PLAN_GOALS.unexpected.modes.includes('think'));
  assert.equal(MODES.think.label, 'Think Buddy');
  assert.equal(STARTER_SCENARIOS.items.length, 3);
  for (const it of STARTER_SCENARIOS.items) { assert.ok(it.scenario && it.problem && it.good_actions.length); }
});

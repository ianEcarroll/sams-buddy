// The first practice of the day greets Sam and explains the buttons; later ones go straight to the task.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession } from '../src/coach/engine.js';

const activity = { id: 'c', title: 'Name the group', mode: 'category', plan_goal: 'other', content: { items: [{ kind: 'name', group: 'animals', target: 3, accepted: ['dog', 'cat', 'horse'] }] } };
const think = { id: 't', title: 'Surprises', mode: 'think', plan_goal: 'other', content: { items: [{ problem: 'Your bus is late.', question: 'What do you do?' }] } };

test('full start greets Sam; quick start does not', () => {
  for (const a of [activity, think]) {
    const full = createSession({ activity: a, settings: { explain_buttons: true }, learnerName: 'Sam' }).turn.lines;
    const quick = createSession({ activity: a, settings: { explain_buttons: true }, learnerName: 'Sam', quickStart: true }).turn.lines;
    assert.ok(full.some((l) => l.kind === 'welcome'), `${a.mode}: full start has a welcome`);
    assert.ok(!quick.some((l) => l.kind === 'welcome'), `${a.mode}: quick start has no welcome`);
    assert.ok(quick.length > 0 && quick.length < full.length, `${a.mode}: quick start still asks the question`);
  }
});

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

test('Talk: a repeated topic is skipped, a new one gets a bridge, and the picture is not shown with the question invitation', async () => {
  const talk = { id: 'x', title: 'Chat', mode: 'conversation', plan_goal: 'conversation', content: { practise_questions: true, items: [
    { topic: 'fall', opener: 'Who do you do things with in the fall?', image_id: 'sym:pumpkin', example_comment: 'I like leaves.', example_question: 'What do you like?' },
    { topic: 'Fall', opener: 'What is your favourite thing to do in the fall?', image_id: 'sym:pumpkin', example_comment: 'a', example_question: 'b' },
    { topic: 'music', opener: 'What music do you like?', example_comment: 'a', example_question: 'b' }] } };
  const { state } = createSession({ activity: talk, settings: { turns_per_topic: 1 }, learnerName: 'Sam' });
  const { respond } = await import('../src/coach/engine.js');
  const judge = async () => ({ met: { turn: 'x' }, relevant: true, connection: false, question: true, help: null, reply: 'Nice.' });
  const t = await respond(state, { text: 'I like cousins' }, { judge });
  const said = t.turn.lines.map((l) => l.text);
  assert.ok(!said.some((x) => /favourite thing to do in the fall/.test(x)), 'the repeated fall topic is skipped');
  assert.ok(said.some((x) => /What music do you like/.test(x)), 'moves on to the new topic');
  assert.ok(t.turn.lines.some((l) => l.kind === 'intro'), 'with a short bridge');
});

test('Talk: the topic picture is not shown with the question invitation', async () => {
  const { respond } = await import('../src/coach/engine.js');
  const talk = { id: 'y', title: 'Chat', mode: 'conversation', plan_goal: 'conversation', content: { practise_questions: true, items: [
    { topic: 'fall', opener: 'Who do you do things with in the fall?', image_id: 'sym:pumpkin', example_comment: 'I like leaves.', example_question: 'What do you like?' }] } };
  const { state } = createSession({ activity: talk, settings: { turns_per_topic: 4 }, learnerName: 'Sam' });
  const judge = async () => ({ met: { turn: 'x' }, relevant: true, connection: false, question: false, help: null, reply: 'Nice.' });
  await respond(state, { text: 'with my cousin' }, { judge });
  const t = await respond(state, { text: 'we play pool' }, { judge });
  assert.ok(t.turn.lines.some((l) => l.kind === 'cue' || l.kind === 'model'), 'the question invitation is given');
  assert.ok(!JSON.stringify(t.turn).includes('pumpkin'), 'no unrelated picture');
});

test('Think: cues link to what Sam said and to the situation', async () => {
  const { respond } = await import('../src/coach/engine.js');
  const think = { id: 'z', title: 'Gym', mode: 'think', plan_goal: 'other', content: { items: [{ title: 'Gym', scenario: "You arrive at the gym for your session, but your trainer isn't there.", question: 'What would you do?', problem: 'the trainer is not there', good_actions: ['go to reception'] }] } };
  const { state } = createSession({ activity: think, settings: {}, learnerName: 'Sam' });
  const act = async () => ({ met: { action: 'Go to the reception' }, help: null, unsafe: false, relevant: true });
  const t1 = await respond(state, { text: 'Go to the reception' }, { judge: act });
  const said1 = t1.turn.lines.map((l) => l.text).join(' | ');
  assert.ok(!/Is this what you expected/.test(said1), said1);
  assert.ok(/Now let's look at the situation/.test(said1) && /Is everything here the way you expected/.test(said1), said1);
  const none = async () => ({ met: {}, help: 'dont_understand', unsafe: false, relevant: false });
  const t2 = await respond(state, { text: "I don't know what you mean" }, { judge: none });
  const said2 = t2.turn.lines.map((l) => l.text).join(' | ');
  assert.ok(/trainer isn't there/.test(said2) && !/What could you do\?/.test(said2), said2);
  const prob = async () => ({ met: { problem: 'The coach is not there' }, help: null, unsafe: false, relevant: true });
  const t3 = await respond(state, { text: 'The coach is not there' }, { judge: prob });
  const said3 = t3.turn.lines.map((l) => l.text).join(' | ');
  assert.ok(/You said: "Go to the reception"\. Why do you think that is a good idea/.test(said3), said3);
});

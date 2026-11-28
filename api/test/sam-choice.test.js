// Talk: the learner chooses the first topic (by tapping or saying it).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, respond, control } from '../src/coach/engine.js';
import { keywordJudge } from '../src/coach/judge.js';
import { LIBRARY, activityFromLibrary } from '../src/library.js';

const judge = async (a) => keywordJudge(a);
const talk = () => ({ id: 'c', status: 'ready', plan_goal: 'conversation', ...activityFromLibrary(LIBRARY.find((x) => x.title === 'Talk: hobbies and games')) });

test('Foxy offers two topics, preferring the learner\'s interests (the instrument opener mentions the guitar), and waits for a choice', () => {
  const { state, turn } = createSession({ activity: talk(), learnerInterests: ['guitar', 'music'], quickStart: true });
  assert.equal(turn.expect, 'topic');
  assert.match(turn.lines.at(-1).text, /^What would you like to talk about first: playing an instrument, or /i);
  assert.equal(turn.ui.topics.length, 2);
  assert.ok(state.choosing);
});

test('tapping a topic starts it; the others follow in order', () => {
  const { state } = createSession({ activity: talk(), quickStart: true });
  const second = state.activity.content.items[state.choosing[1]].topic;
  const { turn } = control(state, 'topic_1');
  assert.equal(state.activity.content.items[0].topic, second);
  assert.match(turn.lines[0].text, new RegExp(`let's talk about ${second}`, 'i'));
  assert.equal(state.activity.content.items.length, 4);
  assert.equal(state.choosing, null);
});

test('saying a topic picks it; anything else starts with the first; Help during the choice asks again', async () => {
  let { state } = createSession({ activity: talk(), quickStart: true });
  const name = state.activity.content.items[state.choosing[1]].topic;
  assert.match(control(state, 'hint').turn.lines[0].text, /^You choose/);
  await respond(state, { text: `um ${name} please` }, { judge });
  assert.equal(state.activity.content.items[0].topic, name);
  ({ state } = createSession({ activity: talk(), quickStart: true }));
  const first = state.activity.content.items[state.choosing[0]].topic;
  const { turn } = await respond(state, { text: 'dunno' }, { judge });
  assert.match(turn.lines[0].text, new RegExp(`Let's start with ${first}`));
});

test('one topic: no choice', () => {
  const a = talk(); a.content.items = a.content.items.slice(0, 1);
  assert.notEqual(createSession({ activity: a, quickStart: true }).turn.expect, 'topic');
});

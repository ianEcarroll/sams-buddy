// Talk: the first hint repeats only Foxy's most recent question, never an earlier one the learner already answered.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, respond } from '../src/coach/engine.js';

test('the first Talk hint does not re-ask the opener once Foxy has replied', async () => {
  const activity = { id: 'a', title: 'Chat', mode: 'conversation', plan_goal: 'conversation', content: { items: [
    { topic: 'the weekend', opener: 'I went for a walk. What did you do at the weekend?', example_comment: 'I went to the gym.' }] } };
  const { state } = createSession({ activity, quickStart: true });
  let n = 0;
  const judge = async () => (++n === 1 ? { met: { turn: 'x' }, relevant: true, reply: 'That sounds fun.' } : { met: {}, relevant: false, reply: '' });
  await respond(state, { text: 'I went to the pumpkin patch' }, { judge });
  const { turn } = await respond(state, { text: 'um' }, { judge });
  assert.ok(!turn.lines.some((l) => /What did you do at the weekend\?/.test(l.text)), turn.lines.map((l) => l.text).join(' | '));
});

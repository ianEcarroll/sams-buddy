// Explain Buddy, How do you…?: the smallest useful cue for one missing part; Sam's first answer is kept.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, respond } from '../src/coach/engine.js';
import { keywordJudge } from '../src/coach/judge.js';
import { MODES, STARTER_EXPLAIN } from '../src/coach/modes.js';

const judge = async (a) => keywordJudge(a);
const say = (state, text) => respond(state, { text }, { judge });
const paper = {
  id: 'e', title: 'Paper characters', mode: 'explain', plan_goal: 'other',
  content: { items: [{
    question: 'Tell me how you make one of your paper characters.',
    points: [
      { text: 'draw the character on paper', keywords: ['draw', 'drew'], question: 'What do you do first, before you cut?' },
      { text: 'cut it out with scissors', keywords: ['cut', 'scissors'], question: 'What do you use to cut it out?', starter: 'I cut it out with ___.' },
      { text: 'colour it in', keywords: ['colour', 'color', 'paint'], question: 'What do you do after you cut it out?' },
    ],
  }] },
};

test('asks the question after "Make a movie in your mind"', () => {
  const { turn } = createSession({ activity: paper });
  const t = turn.lines.map((l) => l.text);
  assert.ok(t.includes('Make a movie in your mind.'));
  assert.equal(t.at(-1), 'Tell me how you make one of your paper characters.');
});

test("Ray's example: \"Cut paper.\" gets one small cue, not a rewrite; the improvement is acknowledged", async () => {
  let { state } = createSession({ activity: paper });
  let { turn } = await say(state, 'Cut paper.');
  assert.equal(turn.lines[0].text, 'You made a good start.');
  const cues = turn.lines.filter((l) => l.kind === 'cue' || l.kind === 'model');
  assert.equal(cues.length, 1, 'one cue only');
  assert.equal(cues[0].text, 'Can you tell me more about how you do it?');
  assert.ok(!turn.lines.some((l) => /draw the character on paper/.test(l.text)), 'does not hand him the answer');
  ({ turn } = await say(state, 'Um I cut it'));
  assert.equal(turn.lines.at(-1).text, 'What do you do first, before you cut?', 'then the team\'s question for the missing part');
  ({ turn } = await say(state, 'I draw it first and then I colour it'));
  const rec = state.completed[0];
  assert.match(rec.sam_response, /^Cut paper\./, "Sam's first answer is kept first in the record");
  assert.equal(rec.support_code, 'P');
  assert.match(rec.review_note, /Part 1 needed a specific cue/);
});

test('a complete explanation first time: code I, no cues', async () => {
  let { state } = createSession({ activity: paper });
  const { turn } = await say(state, 'I draw the character, cut it out with scissors and then colour it in.');
  assert.match(turn.lines[0].text, /explained every part clearly/);
  assert.equal(state.completed[0].support_code, 'I');
});

test('Explain Buddy covers both its practice types and ships three starter questions', () => {
  assert.equal(MODES.explain.label, 'Explain Buddy');
  assert.equal(MODES.object.label, 'Explain Buddy');
  assert.equal(STARTER_EXPLAIN.items.length, 3);
  for (const it of STARTER_EXPLAIN.items) assert.ok(it.question && it.points.length >= 3);
});

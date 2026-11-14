import { test } from 'node:test';
import assert from 'node:assert/strict';
import { draftStepQuestions } from '../src/coach/draft.js';

const steps = ['Lay the jumper flat.', 'Fold the sleeves in.', ''];
const fake = (out, seen = {}) => async (url, opts) => {
  seen.body = JSON.parse(opts.body);
  return { ok: true, json: async () => ({ content: [{ type: 'tool_use', input: { steps: out } }] }) };
};

test('drafts one entry per written step, for the chosen skill', async () => {
  const seen = {};
  const d = await draftStepQuestions({ apiKey: 'k', model: 'm', task: 'Fold a jumper', steps, skill: 'reasoning', fetchImpl: fake([
    { question: 'Why do we lay it flat?', answer: 'so it folds neatly', clue: 'Think about wrinkles.', model: 'We lay it flat so it folds neatly.' },
    { question: 'Why fold the sleeves in?', answer: 'so it is a neat shape', clue: 'Think about the shape.', model: 'So it is a neat rectangle.' },
  ], seen) });
  assert.equal(d.length, 2);
  assert.equal(d[0].question, 'Why do we lay it flat?');
  assert.match(seen.body.messages[0].content, /Reasoning/);
  assert.match(seen.body.messages[0].content, /2\. Fold the sleeves in\./);
});

test('missing entries come back blank; bad skill and no steps are refused', async () => {
  const d = await draftStepQuestions({ apiKey: 'k', model: 'm', steps, skill: 'memory', fetchImpl: fake([{ question: 'What do you do first?' }]) });
  assert.deepEqual(d[1], { question: '', answer: '', clue: '', model: '' });
  await assert.rejects(() => draftStepQuestions({ apiKey: 'k', model: 'm', steps, skill: 'nope', fetchImpl: fake([]) }), /skill/);
  await assert.rejects(() => draftStepQuestions({ apiKey: 'k', model: 'm', steps: ['', ' '], skill: 'memory', fetchImpl: fake([]) }), /steps/);
});

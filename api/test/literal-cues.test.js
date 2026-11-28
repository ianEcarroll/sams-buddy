// Hints and prompts for literal thinkers (student review, 27 Nov): concrete, one idea at a time, no raw topic names.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, respond, control } from '../src/coach/engine.js';
import { keywordJudge } from '../src/coach/judge.js';
import { STARTER_SCENARIOS } from '../src/coach/modes.js';
import { LIBRARY, activityFromLibrary } from '../src/library.js';

const judge = async (a) => keywordJudge(a);
const lib = (title) => ({ id: 'x', status: 'ready', plan_goal: 'other', ...activityFromLibrary(LIBRARY.find((x) => x.title === title)) });

test('Think: the plan cue first, then the team\'s concrete clue, and the model shows noticing and asking', async () => {
  const item = { ...STARTER_SCENARIOS.items[0], first_clue: 'Can you see your trainer?' };
  const { state } = createSession({ activity: { id: 't', title: 'x', mode: 'think', plan_goal: 'unexpected', content: { items: [item] } } });
  const r0 = (await respond(state, { text: 'um' }, { judge })).turn.lines.at(-1).text;
  assert.equal(r0, 'STOP. THINK. Is this expected? If you are unsure, ASK.');
  assert.equal(control(state, 'hint').turn.lines.at(-1).text, 'Can you see your trainer?');
  control(state, 'hint');
  assert.match(control(state, 'hint').turn.lines.at(-1).text, /^The problem is the trainer is not there\. So I would ask/);
});

test('Talk: no cue pastes the topic name into a sentence; the first cue repeats Foxy\'s question', async () => {
  const { state } = createSession({ activity: lib('Talk: school and learning') });
  control(state, 'topic_0');
  const t = (await respond(state, { text: 'um' }, { judge })).turn.lines.at(-1).text;
  assert.equal(t, 'Take your time. Which one do you like best?');
  const all = [t, control(state, 'hint').turn.lines.at(-1).text, control(state, 'hint').turn.lines.at(-1).text];
  assert.ok(!all.some((x) => /favourite subject/.test(x)), all.join(' | '));
});

test('Talk library openers are open questions, not yes/no', () => {
  for (const x of LIBRARY.filter((l) => l.mode === 'conversation')) {
    for (const it of x.content.items) {
      const q = it.opener.match(/[^.!?]*\?$/)?.[0].trim() || '';
      assert.ok(!/^(Do|Did|Are|Is|Have|Has|Can|Will) /.test(q), `${it.topic}: "${q}"`);
    }
  }
});

test('Story and Describe prompts are short questions, one idea each', () => {
  const s = createSession({ activity: lib('Tell a story: three pictures') }).turn.lines.at(-1).text;
  assert.ok(s.split('?').every((part) => part.split(' ').length <= 12), s);
  const d = createSession({ activity: lib('Describe: in the kitchen') }).turn.lines.at(-1).text;
  assert.equal(d, 'What is it? What group is it in? What is it used for?');
});

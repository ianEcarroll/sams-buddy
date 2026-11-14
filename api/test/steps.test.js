// Task Buddy: Step by Step — a real task one step at a time, one skill per activity, a five-level support ladder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, respond, control, finish } from '../src/coach/engine.js';
import { keywordJudge } from '../src/coach/judge.js';
import { STARTER_STEPS, stepCoach } from '../src/coach/modes.js';

const judge = async (a) => keywordJudge(a);
const texts = (t) => t.lines.filter((l) => l.kind !== 'welcome').map((l) => l.text);
const say = (state, text) => respond(state, { text }, { judge });
const STEPS = [
  { text: 'Put the jumper on the table. Smooth out any wrinkles.', image_id: 'sym:jumper' },
  { text: 'Fold both sleeves across the middle.', image_id: 'sym:fold-clothes-to' },
  { text: 'Fold the bottom up towards the neck.', image_id: 'sym:fold-clothes-to' },
];
const act = (content = {}) => ({ id: 's1', mode: 'steps', title: 'Fold a jumper', plan_goal: 'instructions', content: { items: [{ title: 'Fold a jumper', steps: structuredClone(STEPS) }], run: 'practice', ...content } });
const start = (content) => createSession({ activity: act(content), learnerName: 'Sam', settings: { explain_buttons: false } });

test('understanding (default): step, then the question, then "Now do it" and the Done button', async () => {
  const { state, turn } = start();
  const t = texts(turn);
  assert.equal(t[0], "Today's task is: Fold a jumper. We'll do it one step at a time. After each step, press Done.");
  assert.equal(t[1], 'Step 1.');
  assert.equal(t[2], STEPS[0].text);
  assert.equal(t[3], 'What did I ask you to do?');
  assert.equal(turn.expect, 'response');
  assert.equal(turn.ui.step.n, 1); assert.equal(turn.ui.step.total, 3);
  // Words and picture stay hidden while Buddy asks about the step (showing them is the visual-support level).
  assert.equal(turn.ui.step.text, null); assert.deepEqual(turn.ui.images, []);
  let { turn: t2 } = await say(state, 'put the jumper on the table');
  assert.equal(t2.ui.step.text, STEPS[0].text); assert.deepEqual(t2.ui.images, ['sym:jumper']);
  assert.deepEqual(texts(t2), ["That's right.", "Now do it, and press Done when you've finished."]);
  assert.equal(t2.expect, 'done');
  ({ turn: t2 } = control(state, 'step_done'));
  assert.equal(texts(t2)[0], 'Step 2.');
  assert.equal(texts(t2)[1], STEPS[1].text);
});

test('the whole task: last step lead, then "tell me all the steps", then a record', async () => {
  const { state } = start();
  const answers = ['the table', 'the sleeves', 'the bottom'];
  let turn;
  for (let i = 0; i < 3; i += 1) {
    ({ turn } = await say(state, answers[i]));
    ({ turn } = control(state, 'step_done'));
    if (i === 1) assert.equal(texts(turn)[0], 'Step 3, the last step.');
  }
  assert.deepEqual(texts(turn), ["You've done all the steps.", 'Now tell me all the steps you followed, from beginning to end.']);
  ({ turn } = await say(state, 'First I put the jumper on the table, then the sleeves across the middle, then the bottom up to the neck'));
  assert.match(texts(turn)[0], /^You told me every step, in order\. Well done\./);
  assert.equal(state.done, true);
  const r = state.completed[0];
  assert.equal(r.item_label, 'Fold a jumper');
  assert.equal(r.support_code, 'I');
  assert.equal(r.score_first, 3); assert.equal(r.score_total, 3);
  assert.match(r.review_note, /Do it for real, practising understanding\./);
  assert.match(r.review_note, /Told 3 of 3 steps from beginning to end, in order\./);
  assert.equal(r.success, true);
});

test('memory: Buddy asks for the step before saying it; the picture and words stay hidden', async () => {
  const { state, turn } = start({ skill: 'memory' });
  const t = texts(turn);
  assert.equal(t.at(-1), 'What is the first thing you need to do?');
  assert.ok(!t.includes(STEPS[0].text), 'not said yet');
  assert.equal(turn.ui.step.text, null);
  assert.deepEqual(turn.ui.images, []);
  const { turn: t2 } = await say(state, 'put the jumper on the table');
  assert.deepEqual(texts(t2), ["That's right.", STEPS[0].text, "Now do it, and press Done when you've finished."]);
  assert.equal(t2.ui.step.text, STEPS[0].text);
});

test('the five-level ladder: broad clue → specific clue → visual support → model → carry on', async () => {
  const { state } = start({ skill: 'memory' });
  const steps = [];
  let turn;
  for (const wrong of ['pizza', 'pizza', 'pizza', 'pizza']) { ({ turn } = await say(state, wrong)); steps.push(turn); }
  assert.equal(steps[0].lines[0].level, 'broad clue');
  assert.equal(steps[0].lines[0].text, 'Think about how this task starts.');
  assert.equal(steps[1].lines[0].level, 'specific clue');
  assert.match(steps[1].lines[0].text, /^It starts like this: Put the jumper…/);
  assert.equal(steps[2].lines[0].level, 'visual support');
  assert.equal(steps[2].ui.step.visual, true);
  assert.equal(steps[2].ui.step.text, STEPS[0].text, 'visual support shows the step on screen');
  assert.equal(steps[3].lines[0].level, 'model');
  assert.equal(steps[3].lines[0].kind, 'model');
  ({ turn } = await say(state, 'pizza'));
  assert.equal(texts(turn)[0], "Thanks. Let's carry on.");
  assert.equal(turn.expect, 'done');
  finish(state);
  const r = state.completed[0];
  assert.equal(r.support_code, 'F');
  assert.match(r.review_note, /Most support needed: Step 1: model\./);
});

test('expressive: do the step first, press Done, then "Tell me what you just did."', async () => {
  const { state, turn } = start({ skill: 'expressive' });
  assert.equal(texts(turn).at(-1), "Do it now, and press Done when you've finished.");
  assert.equal(turn.expect, 'done');
  const { turn: t2 } = control(state, 'step_done');
  assert.deepEqual(texts(t2), ['Tell me what you just did.']);
  const { turn: t3 } = await say(state, 'I put the jumper on the table and smoothed it');
  assert.equal(texts(t3)[0], "That's right.");
  assert.equal(texts(t3)[1], 'Step 2.');
});

test('Help me while doing a step: the step goes up on screen and is recorded as visual support', async () => {
  const { state } = start({ skill: 'expressive' });
  const { turn } = control(state, 'hint');
  assert.deepEqual(texts(turn), ["Here's the step on the screen.", STEPS[0].text, "Press Done when you've finished."]);
  assert.equal(turn.ui.step.visual, true);
  finish(state);
  assert.match(state.completed[0].review_note, /Looked at the step on screen while doing it: Step 1\./);
  assert.equal(state.completed[0].support_code, 'M');
});

test('saying "done" works like the Done button; other speech gets a gentle reminder', async () => {
  const { state } = start({ skill: 'expressive' });
  let { turn } = await say(state, 'hmm');
  assert.match(texts(turn)[0], /Press Done when you've finished this step/);
  ({ turn } = await say(state, "I'm done"));
  assert.deepEqual(texts(turn), ['Tell me what you just did.']);
});

test('no questions and no retell: just the steps and Done', async () => {
  const { state, turn } = start({ ask_steps: false, ask_end: false });
  assert.equal(turn.expect, 'done');
  let t;
  for (let i = 0; i < 3; i += 1) ({ turn: t } = control(state, 'step_done'));
  assert.equal(texts(t)[0], "You've done all the steps. Well done.");
  assert.equal(state.done, true);
  assert.equal(state.completed[0].score_total, null);
});

test('Independence mode: the whole task alone, Done, then explain it; Help me shows all the steps', async () => {
  const { state, turn } = start({ run: 'independence' });
  assert.deepEqual(texts(turn), ["Today's task is: Fold a jumper.", "This time, do all the steps on your own. If you get stuck, press Help me. When you've finished everything, press Done."]);
  assert.equal(turn.expect, 'done');
  assert.equal(turn.ui.stepList, null);
  let { turn: t } = control(state, 'hint');
  assert.equal(texts(t)[0], 'Here are the steps. Look at the screen.');
  assert.equal(t.ui.stepList.length, 3);
  ({ turn: t } = control(state, 'step_done'));
  assert.deepEqual(texts(t), ["You've finished.", 'Now tell me all the steps you followed, from beginning to end.']);
  ({ turn: t } = await say(state, 'I put it on the table, folded the sleeves and folded the bottom up'));
  const r = state.completed[0];
  assert.match(r.review_note, /^Independence mode\. Looked at the steps on screen during the task\./);
  assert.equal(r.score_total, null);
});

test('Independence mode without help: "all on your own" and recorded as no support', async () => {
  const { state } = start({ run: 'independence' });
  const { turn } = control(state, 'step_done');
  assert.equal(texts(turn)[0], "You've finished, all on your own.");
  await say(state, 'I put it on the table, folded the sleeves and folded the bottom up');
  assert.match(state.completed[0].review_note, /Did the whole task without help\./);
  assert.equal(state.completed[0].support_code, 'I');
});

test('retell missing steps: one cue, then thanks', async () => {
  const { state } = start({ ask_steps: false });
  for (let i = 0; i < 3; i += 1) control(state, 'step_done');
  let { turn } = await say(state, 'the sleeves');
  assert.equal(texts(turn)[0], 'Think about the very first thing.');
  ({ turn } = await say(state, 'I put the jumper on the table'));
  // Still one missing: a stronger clue (the missing step's opening words), then an honest ending.
  assert.equal(texts(turn)[0], 'Step 3 starts like this: Fold the bottom\u2026');
  ({ turn } = await say(state, 'um'));
  assert.equal(texts(turn)[0], 'Thanks. You told me 2 of the 3 steps.');
  assert.match(state.completed[0].review_note, /Told 2 of 3 steps .*with a clue\./);
});

test("the team's own question, clues and model for the chosen skill replace Buddy's", () => {
  const a = act({ skill: 'reasoning' });
  a.content.items[0].steps[0].q = { reasoning: { question: 'Why flat?', answer: 'so it folds neatly', clue: 'Think about creases.' } };
  const c = stepCoach(a, a.content.items[0], 0);
  assert.equal(c.question, 'Why flat?');
  assert.equal(c.ladder[1], 'Think about creases.');
  assert.equal(c.ladder[3], 'One reason: so it folds neatly.');
  assert.equal(stepCoach(act({ skill: 'reasoning' }), act().content.items[0], 0).question, 'Why do we do that step?');
});

test('basic checker for step answers', () => {
  const j = (skill, text) => !!keywordJudge({ mode: 'steps', elements: ['answer'], text, item: { step: STEPS[1].text, skill, example_answer: 'so they do not hang out' } }).met.answer;
  assert.ok(j('understanding', 'the sleeves'));
  assert.ok(!j('understanding', "I don't know"));
  assert.ok(j('reasoning', 'so they do not hang out'));
  assert.ok(j('reasoning', 'because it looks neater'));
  assert.ok(!j('reasoning', 'yes'));
  assert.ok(j('independence', 'it looks like the picture'));
});

test('the five starter tasks open with the walk-through and use symbols', () => {
  assert.equal(STARTER_STEPS.length, 5);
  for (const a of STARTER_STEPS) {
    const { turn } = createSession({ activity: { id: 'x', mode: 'steps', title: a.title, content: { items: a.items, skill: 'understanding' } }, settings: { explain_buttons: false } });
    assert.ok(texts(turn).includes('Make a movie in your mind.'), a.title);
    assert.ok(a.items[0].steps.every((x) => /^sym:[a-z0-9-]+$/.test(x.image_id)), a.title);
  }
  const jumper = STARTER_STEPS[0].items[0].steps;
  assert.equal(jumper.length, 7);
  assert.equal(jumper[5].q.understanding.model, 'The jumper is size M, so it goes in the M basket.');
});

// ---- Learn the steps (the default): walk-through with pictures, then questions by number, no Done button.
const learn = (content) => createSession({ activity: act({ run: 'learn', ...content }), learnerName: 'Sam', settings: { explain_buttons: false } });

test('learn: "Make a movie in your mind", every step by number with its picture, then I\'m ready', () => {
  const { state, turn } = learn();
  const t = texts(turn);
  assert.deepEqual(t.slice(0, 6), ["Today's task is: Fold a jumper.", 'Make a movie in your mind.', 'Listen to all 3 steps first.',
    `Step 1. ${STEPS[0].text}`, `Step 2. ${STEPS[1].text}`, `Step 3. ${STEPS[2].text}`]);
  assert.equal(turn.expect, 'ready');
  assert.equal(turn.ui.stepList.length, 3);
  assert.equal(turn.ui.stepList[1].image, 'sym:fold-clothes-to');
  assert.equal(turn.lines.find((l) => l.text.startsWith('Step 2.')).step, 1);
  assert.equal(state.item.steps.phase, 'walk');
});

test('learn: after I\'m ready the screen clears and Buddy asks by number; no Done button', async () => {
  const { state } = learn({ skill: 'memory' });
  let { turn } = control(state, 'start_questions');
  assert.deepEqual(texts(turn), ["Let's see what you remember.", 'What is step 1?']);
  assert.equal(turn.expect, 'response');
  assert.equal(turn.ui.stepList, null);
  assert.deepEqual(turn.ui.images, []);
  assert.equal(turn.ui.step.text, null);
  ({ turn } = await say(state, 'put the jumper on the table'));
  assert.deepEqual(texts(turn), ["That's right.", 'What is step 2?']);
  assert.notEqual(turn.expect, 'done');
});

test('learn: the team\'s own question gets a "Step N." lead; visual support is the picture only', async () => {
  const a = act({ run: 'learn' });
  a.content.items[0].steps[0].q = { understanding: { question: 'Where should you put the jumper?' } };
  const { state } = createSession({ activity: a, learnerName: 'Sam', settings: { explain_buttons: false } });
  let { turn } = control(state, 'start_questions');
  assert.deepEqual(texts(turn).slice(1), ['Step 1.', 'Where should you put the jumper?']);
  ({ turn } = await say(state, 'no idea really'));
  ({ turn } = await say(state, 'no idea really'));
  ({ turn } = await say(state, 'no idea really'));
  assert.equal(texts(turn)[0], 'Look at the picture.');
  assert.deepEqual(turn.ui.images, ['sym:jumper']);
  assert.equal(turn.ui.step.text, null);
});

test('learn: an honest summary at the end, with no "tell me all the steps" unless switched on', async () => {
  const { state } = learn({ skill: 'memory' });
  control(state, 'start_questions');
  await say(state, 'put the jumper on the table');
  await say(state, 'no idea really');
  await say(state, 'fold both sleeves across');
  const { turn } = await say(state, 'fold the bottom up');
  const t = texts(turn);
  assert.ok(t.includes("That's all 3 steps. You answered 2 on your own and 1 with some help."), t.join(' | '));
  assert.ok(!t.some((x) => /tell me all the steps/i.test(x)));
  assert.match(state.completed[0].review_note, /^Learn the steps, practising memory\./);
});

test('practice mode: the step\'s words are not captioned when its question follows straight away', () => {
  const { turn } = start();
  assert.equal(turn.lines.find((l) => l.text === STEPS[0].text).noCaption, true);
});

test('telling the steps: help gets stronger each time instead of repeating the same clue', () => {
  const { state } = start({ ask_steps: false });
  for (let i = 0; i < 3; i += 1) control(state, 'step_done');
  assert.equal(texts(control(state, 'dont_understand').turn)[0], 'Think about the very first thing.');
  assert.equal(texts(control(state, 'hint').turn)[0], 'Step 1 starts like this: Put the jumper…');
  assert.match(texts(control(state, 'hint').turn)[0], /^First, put the jumper on the table\. Then, fold both sleeves/);
});

test('telling the steps: "every step" after a clue is not praised as on their own', async () => {
  const { state } = start({ ask_steps: false });
  for (let i = 0; i < 3; i += 1) control(state, 'step_done');
  await say(state, 'fold both sleeves across the middle and fold the bottom up towards the neck');
  const { turn } = await say(state, 'I put the jumper on the table');
  assert.equal(texts(turn)[0], 'You told me every step, with a clue.');
});

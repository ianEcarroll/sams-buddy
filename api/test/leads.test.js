// Every module leads into its items the same conversational way (tester feedback: less robotic).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, control, respond, itemLead } from '../src/coach/engine.js';
import { keywordJudge } from '../src/coach/judge.js';
import { STARTER_SCENARIOS, STARTER_STORIES } from '../src/coach/modes.js';

const texts = (t) => t.lines.filter((l) => l.kind !== 'welcome').map((l) => l.text);
const start = (activity) => createSession({ activity, learnerName: 'Sam', settings: { explain_buttons: false } });
const judge = async (a) => keywordJudge(a);

test('the same lead pattern in every module, in its own word', () => {
  const lead = (mode, i, total) => itemLead({ mode, itemIndex: i, activity: { content: { items: Array(total).fill({}) } } });
  for (const [mode, noun] of [['think', 'situation'], ['object', 'picture'], ['follow', 'instruction'], ['explain', 'question'], ['task', 'job'], ['story', 'story'], ['conversation', 'topic'], ['listen', 'story']]) {
    assert.equal(lead(mode, 0, 4), `Here's the first ${noun}.`);
    assert.equal(lead(mode, 1, 4), `On to the next ${noun}.`);
    assert.equal(lead(mode, 2, 4), `Here's the next ${noun}.`);
    assert.equal(lead(mode, 3, 4), `And here's the last ${noun}.`);
    assert.equal(lead(mode, 0, 1), null, 'one item on its own: no lead');
  }
  assert.equal(itemLead({ mode: 'think', itemIndex: 1, activity: { content: { items: [{}, {}] } } }), "And here's the last situation.");
});

test('Think Buddy: "Here\'s the first situation." with several; plain "Here\'s a situation." with one', () => {
  const many = { id: 't', mode: 'think', title: 'x', content: structuredClone(STARTER_SCENARIOS) };
  const t1 = texts(start(many).turn);
  assert.equal(t1[0], "Here's the first situation.");
  assert.ok(!t1.includes("Here's a situation."), 'not both');
  const one = { id: 't', mode: 'think', title: 'x', content: { items: [structuredClone(STARTER_SCENARIOS.items[0])] } };
  assert.equal(texts(start(one).turn)[0], "Here's a situation.");
});

test('moving to the next story uses the lead (no flat "Here\'s the next one.")', async () => {
  const s0 = structuredClone(STARTER_STORIES[0].items[0]);
  const content = { items: [s0, structuredClone(s0), structuredClone(s0)], listen_retries: 0 };
  const { state, turn } = start({ id: 'l', mode: 'listen', title: 'x', content });
  assert.equal(texts(turn)[0], "Here's the first story.");
  const leadsSeen = [];
  for (let n = 0; n < 2; n += 1) {
    control(state, 'start_questions');
    let t;
    for (let q = 0; q < s0.questions.length; q += 1) ({ turn: t } = await respond(state, { text: 'zzz' }, { judge }));
    leadsSeen.push(texts(t));
  }
  assert.ok(leadsSeen[0].includes("On to the next story."));
  assert.ok(leadsSeen[1].includes("And here's the last story."));
  assert.ok(!leadsSeen.flat().includes("Here's the next one."));
});

test('Remember My Day: "Here\'s the first question." comes right before the question, after the movie line', () => {
  const two = (mode, items) => createSession({ activity: { id: 'x', mode, title: 'T', content: { items } }, learnerName: 'Sam', settings: { explain_buttons: false } });
  for (const [mode, items, q] of [
    ['recall', [{ when: 'at the weekend', count: 3 }, { when: 'at school', count: 2 }], 'Tell me three things you did at the weekend.'],
  ]) {
    const t = two(mode, items).turn.lines.filter((l) => l.kind !== 'welcome').map((l) => l.text);
    const i = t.indexOf('Make a movie in your mind.');
    assert.ok(i >= 0, mode);
    assert.match(t[i + 1], /^Here's the first/, mode);
    assert.equal(t[i + 2], q, mode);
  }
});

test('Explain Buddy: "Here\'s the first question." then the question, no movie line', () => {
  const { turn } = createSession({ activity: { id: 'x', mode: 'explain', title: 'T', content: { items: [{ question: 'Tell me how you make a sandwich.', parts: ['bread'] }, { question: 'Tell me how you brush your teeth.', parts: ['brush'] }] } }, learnerName: 'Sam', settings: { explain_buttons: false } });
  assert.deepEqual(turn.lines.filter((l) => l.kind !== 'welcome').map((l) => l.text), ["Here's the first question.", 'Tell me how you make a sandwich.']);
});

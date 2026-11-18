// Memory test: naming the members of a group (and adding a word that fits a list).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, respond, finish } from '../src/coach/engine.js';
import { keywordJudge } from '../src/coach/judge.js';
import { MODES, STARTER_CATEGORY } from '../src/coach/modes.js';

const judge = async (a) => keywordJudge(a);
const say = (state, text) => respond(state, { text }, { judge });
const ANIMALS = ['dog', 'cat', 'horse', 'cow', 'pig', 'lion', 'elephant'];
const name = { id: 'c', title: 'Name the group', mode: 'category', plan_goal: 'other', content: { items: [{ kind: 'name', group: 'animals', target: 3, accepted: ANIMALS }] } };
const add = { id: 'a', title: 'Add a word', mode: 'category', plan_goal: 'other', content: { items: [{ kind: 'add', group: 'animals', given: ['dog', 'cat', 'horse'], accepted: ANIMALS }] } };

test('the mode exists and the starters are valid', () => {
  assert.ok(MODES.category);
  assert.equal(STARTER_CATEGORY.length, 2);
  for (const a of STARTER_CATEGORY) for (const it of a.items) assert.ok(it.group && it.accepted.length > 5);
  assert.deepEqual(STARTER_CATEGORY[1].items.map((i) => i.group), ['animals', 'fruit', 'Disney movies']);
});

test('name kind: Foxy names the group and shows one box per word asked for', () => {
  const { turn } = createSession({ activity: name });
  assert.match(turn.lines.at(-1).text, /Here is a group: animals\./);
  assert.deepEqual(turn.ui.cueCard.labels, ['1', '2', '3']);
});

test('name kind: three on their own is complete with no support', async () => {
  const { state } = createSession({ activity: name });
  const { turn } = await say(state, 'a dog and a cow and a lion');
  assert.match(turn.lines[0].text, /named three things in the group/);
  const rec = state.completed[0];
  assert.equal(rec.support_code, 'I');
  assert.match(rec.review_note, /Named 3 of 3 animals: 3 on their own/);
});

test('name kind: one word, then "any more?" once, then the first-sound clue, then the word', async () => {
  const { state } = createSession({ activity: name });
  let r = await say(state, 'dog');
  assert.match(r.turn.lines.map((l) => l.text).join(' '), /Can you think of any more\?|What else|Any others/);
  r = await say(state, 'um');
  assert.match(r.turn.lines.at(-1).text, /Think about animals|Tell me things that are animals|These are|What else belongs/);
  r = await say(state, 'hmm');
  assert.match(r.turn.lines.at(-1).text, /starts with "c"/);
  r = await say(state, 'I do not know');
  assert.match(r.turn.lines.at(-1).text, /One is "cat"/);
  r = await say(state, 'cat');
  assert.ok(state.item.met.member_1);
});

test('name kind: the group name and repeats do not count', async () => {
  const { state } = createSession({ activity: name });
  await say(state, 'animals');
  assert.equal(Object.keys(state.item.met).length, 0);
  await say(state, 'dog dog dog');
  assert.equal(Object.keys(state.item.met).length, 1);
});

test('add kind: Foxy says the list and the learner adds a different word', async () => {
  const { state, turn } = createSession({ activity: add });
  assert.match(turn.lines.at(-1).text, /dog, cat, horse/);
  assert.deepEqual(turn.ui.cueCard.labels, ['Add a word']);
  const r = await say(state, 'cow');
  assert.match(r.turn.lines[0].text, /added a word that fits/);
  assert.match(state.completed[0].review_note, /Added "cow"/);
});

test('add kind: repeating a word Foxy said does not count', async () => {
  const { state } = createSession({ activity: add });
  await say(state, 'horse');
  assert.equal(state.item.met.word, undefined);
});

test('add kind: a stopped practice still gets a note', async () => {
  const { state } = createSession({ activity: add });
  await say(state, 'banana');
  const { records } = finish(state);
  assert.match(records[0].review_note, /Did not add a word/);
});

test('a short introduction says what this is and what to do, once per kind', async () => {
  const both = { id: 'b', title: 'Both', mode: 'category', plan_goal: 'other', content: { items: [
    { kind: 'name', group: 'animals', target: 1, accepted: ANIMALS }, { kind: 'name', group: 'fruit', target: 1, accepted: ['apple'] },
    { kind: 'add', group: 'animals', given: ['dog', 'cat'], accepted: ANIMALS }] } };
  const { state, turn } = createSession({ activity: both });
  const texts = (t) => t.lines.map((l) => l.text);
  assert.ok(texts(turn).some((x) => /memory test.*name of a group.*all the things you can think of/.test(x)));
  const r = await say(state, 'dog');
  assert.ok(!texts(r.turn).some((x) => /This is a memory test/.test(x)), 'not repeated for the next group of the same kind');
  const r2 = await say(state, 'apple');
  assert.ok(texts(r2.turn).some((x) => /memory test.*say some words.*add a word of your own/.test(x)), 'new kind gets its own introduction');
});

test('the team can write their own introduction', () => {
  const mine = { ...name, content: { items: [{ ...name.content.items[0], intro: 'Time for a quick game.' }] } };
  const { turn } = createSession({ activity: mine });
  const t = turn.lines.map((l) => l.text);
  assert.ok(t.includes('Time for a quick game.'));
  assert.ok(!t.some((x) => /This is a memory test/.test(x)));
});

// Activity library: every ready-made item is complete, uses pictures that exist, and copies into a draft activity.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LIBRARY, libraryById, libraryCard, activityFromLibrary, libraryProblems } from '../src/library.js';

const slugs = new Set(JSON.parse(readFileSync(new URL('../../web/public/symbols/index.json', import.meta.url), 'utf8')).map(([slug]) => slug));

test('every library item is complete and every picture exists', () => {
  assert.ok(LIBRARY.length >= 20);
  for (const mode of ['steps', 'think', 'conversation']) assert.ok(LIBRARY.some((i) => i.mode === mode), `no ${mode} items`);
  assert.deepEqual(libraryProblems(slugs), []);
});

test('the checker catches missing pictures, missing questions and too few steps', () => {
  const bad = [{ id: 'x', mode: 'steps', title: 'X', tags: ['a'], content: { items: [{ steps: [{ text: 'Do it', image_id: 'sym:no-such-picture', q: {} }] }] } }];
  const p = libraryProblems(slugs, bad).join(' | ');
  assert.match(p, /1 steps/);
  assert.match(p, /no-such-picture not found/);
  assert.match(p, /missing understanding/);
});

test('an added item is a draft linked to the library and the original stays unchanged', () => {
  const item = libraryById('task-wash-hands');
  const before = JSON.stringify(item);
  const a = activityFromLibrary(item);
  assert.equal(a.status, 'draft');
  assert.equal(a.mode, 'steps');
  assert.equal(a.plan_goal, 'instructions');
  assert.equal(a.content.library_id, 'task-wash-hands');
  assert.equal(a.content.run, 'learn');
  a.content.items[0].steps[0].text = 'changed';
  assert.equal(JSON.stringify(item), before, 'editing the copy must not touch the library');
});

test('library cards show the title, step count and pictures but not the answers', () => {
  const c = libraryCard(libraryById('task-cereal'), { id: 'abc', status: 'draft' });
  assert.equal(c.count, 5);
  assert.equal(c.unit, 'steps');
  assert.equal(c.images.length, 5);
  assert.deepEqual(c.added, { id: 'abc', status: 'draft' });
  assert.ok(!JSON.stringify(c).includes('"answer"'));
  assert.equal(libraryById('nope'), null);
});

test('questions use one skill key set the coach understands', () => {
  for (const it of LIBRARY.filter((i) => i.mode === 'steps')) for (const st of it.content.items[0].steps) {
    for (const k of Object.keys(st.q)) assert.ok(['understanding', 'reasoning', 'independence', 'memory', 'expressive'].includes(k), `${it.id}: unknown skill ${k}`);
  }
});

test('the checker catches incomplete Think and Talk items', () => {
  const think = { id: 't', mode: 'think', title: 'T', tags: ['a'], content: { items: [{ title: 'a', scenario: 's', problem: '', good_actions: ['one'], reason_example: 'r', backup_example: 'b', unsafe: [] }, {}, {}] } };
  const talk = { id: 'c', mode: 'conversation', title: 'C', tags: ['a'], content: { items: [{ topic: 'food', opener: 'Hi', example_comment: 'You could say hi', example_question: '' }, {}, {}] } };
  const p = libraryProblems(slugs, [think, talk]).join(' | ');
  assert.match(p, /situation 1: no problem/);
  assert.match(p, /at least two safe things/);
  assert.match(p, /at least one idea that is not safe/);
  assert.match(p, /topic 1: no example_question/);
  assert.match(p, /should be what the learner would say/);
});

test('Think and Talk items copy into drafts with the right plan goal and no steps-only settings', () => {
  const t = activityFromLibrary(libraryById('think-school'));
  assert.deepEqual([t.mode, t.status, t.plan_goal, t.content.library_id], ['think', 'draft', 'unexpected', 'think-school']);
  assert.equal(t.content.run, undefined);
  const c = activityFromLibrary(libraryById('talk-weekend'));
  assert.deepEqual([c.mode, c.plan_goal], ['conversation', 'conversation']);
});

test('Think and Talk cards list their situations and topics, with no level', () => {
  const t = libraryCard(libraryById('think-home'));
  assert.equal(t.unit, 'situations'); assert.equal(t.level, null); assert.deepEqual(t.images, []);
  assert.match(t.lines[0], /^The wifi stops: /);
  const c = libraryCard(libraryById('talk-hobbies'));
  assert.equal(c.unit, 'topics'); assert.match(c.lines[0], /^video games: /);
});

// Activity library: every ready-made item is complete, uses pictures that exist, and copies into a draft activity.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LIBRARY, libraryById, libraryCard, activityFromLibrary, libraryProblems } from '../src/library.js';

const slugs = new Set(JSON.parse(readFileSync(new URL('../../web/public/symbols/index.json', import.meta.url), 'utf8')).map(([slug]) => slug));

test('every library item is complete and every picture exists', () => {
  assert.ok(LIBRARY.length >= 12);
  assert.deepEqual(libraryProblems(slugs), []);
});

test('the checker catches missing pictures, missing questions and too few steps', () => {
  const bad = [{ id: 'x', tags: ['a'], content: { items: [{ steps: [{ text: 'Do it', image_id: 'sym:no-such-picture', q: {} }] }] } }];
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
  assert.equal(c.stepCount, 5);
  assert.equal(c.images.length, 5);
  assert.deepEqual(c.added, { id: 'abc', status: 'draft' });
  assert.ok(!JSON.stringify(c).includes('"answer"'));
  assert.equal(libraryById('nope'), null);
});

test('questions use one skill key set the coach understands', () => {
  for (const it of LIBRARY) for (const st of it.content.items[0].steps) {
    for (const k of Object.keys(st.q)) assert.ok(['understanding', 'reasoning', 'independence', 'memory', 'expressive'].includes(k), `${it.id}: unknown skill ${k}`);
  }
});

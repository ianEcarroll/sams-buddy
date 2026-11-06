// Describe a Picture starters use built-in Mulberry Symbols; every answer key is complete and the keyword judge
// (used when the AI is unavailable) accepts a typical full answer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createSession, respond } from '../src/coach/engine.js';
import { keywordJudge } from '../src/coach/judge.js';
import { STARTER_OBJECTS, FOLLOW_OBJECTS, isFollowToken } from '../src/coach/modes.js';

const symbols = new URL('../../web/public/symbols/', import.meta.url).pathname;
const judge = async (a) => keywordJudge(a);

test('every starter picture and every Follow on Screen object exists in the symbol set', () => {
  for (const a of STARTER_OBJECTS) for (const it of a.items) {
    assert.match(it.image_id, /^sym:[a-z0-9-]+$/);
    assert.ok(existsSync(`${symbols}${it.image_id.slice(4)}.svg`), it.image_id);
  }
  for (const o of Object.values(FOLLOW_OBJECTS)) assert.ok(existsSync(`${symbols}${o.file}.svg`), o.file);
});

test('every starter item has a name, group, use and keywords', () => {
  const items = STARTER_OBJECTS.flatMap((a) => a.items);
  assert.equal(items.length, 16);
  for (const it of items) for (const k of ['name', 'category', 'function']) assert.ok(it[k], `${it.name}: ${k}`);
  for (const it of items) assert.ok(it.function_keywords.length >= 2, it.name);
});

test('a complete answer meets the target with no support', async () => {
  const activity = { id: 'o', title: 'Around the house', mode: 'object', plan_goal: 'other', content: { items: [STARTER_OBJECTS[0].items[0]] } };
  const { state } = createSession({ activity });
  await respond(state, { text: "It's a toothbrush, it's a bathroom thing and you use it to brush your teeth" }, { judge });
  assert.equal(state.completed.length, 1);
  assert.equal(state.completed[0].support_code, 'I');
});

test('Follow on Screen accepts objects and shapes, and nothing else', () => {
  assert.ok(isFollowToken('obj-key'));
  assert.ok(isFollowToken('red-circle'));
  assert.ok(!isFollowToken('obj-spaceship'));
  assert.ok(!isFollowToken('pink-circle'));
});

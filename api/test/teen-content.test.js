// Library content for 13 to 20 year olds (student review, 27 Nov).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIBRARY } from '../src/library.js';
import { STARTER_SCENARIOS } from '../src/coach/modes.js';

test('the library is for ages 13 to 20 and has college, work, phone and money sets', () => {
  assert.ok(LIBRARY.every((x) => x.age === '13–20'));
  for (const id of ['think-college-work', 'think-phones-messages', 'task-cafe-order', 'task-self-checkout', 'task-running-late', 'explain-getting-things-done', 'story-first-shift', 'story-change-of-plan', 'story-interview']) {
    assert.ok(LIBRARY.find((x) => x.id === id), id);
  }
});

test('new Think situations and the starters have a concrete first clue for the team', () => {
  for (const id of ['think-college-work', 'think-phones-messages']) {
    for (const s of LIBRARY.find((x) => x.id === id).content.items) assert.ok(s.first_clue?.endsWith('?'), s.title);
  }
  for (const s of STARTER_SCENARIOS.items) assert.ok(s.first_clue, s.title);
});

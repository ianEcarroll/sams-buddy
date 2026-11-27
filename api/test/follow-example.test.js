import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, control } from '../src/coach/engine.js';
import { LIBRARY, activityFromLibrary } from '../src/library.js';

test('Follow on Screen: Show me an example makes Foxy do the step (no crash)', () => {
  const lib = LIBRARY.find((x) => x.mode === 'follow');
  const a = { id: 'f', status: 'ready', plan_goal: 'other', ...activityFromLibrary(lib) };
  const { state } = createSession({ activity: a });
  const { turn } = control(state, 'example');
  assert.match(turn.lines[0].text, /^Watch\./);
});

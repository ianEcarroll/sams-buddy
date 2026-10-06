// The six demonstrations requested in "Keep the first version focused".
// Run: npm test   (uses the offline keyword judge, so no API keys are needed)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, respond, control, finish, confirmHeard } from '../src/coach/engine.js';
import { keywordJudge } from '../src/coach/judge.js';
import { spoonActivity, storyActivity, taskActivity, convActivity } from './fixtures.js';

const judge = async (a) => keywordJudge(a);
const say = (state, text, extra = {}) => respond(state, { text, ...extra }, { judge });
const texts = (turn) => turn.lines.map((l) => l.text);

test('1. accepts a complete concise answer and moves on', async () => {
  let { state } = createSession({ activity: spoonActivity });
  const { turn } = await say(state, 'A spoon is a utensil for eating.');
  assert.match(texts(turn)[0], /named the object, said what group it belongs to and explained its use/);
  assert.equal(state.itemIndex, 1, 'moved to the next object');
  assert.ok(!turn.lines.some((l) => l.kind === 'cue'), 'no extra questions once the goal is met');
  assert.deepEqual(state.completed[0].support_provided, []);
});

test('2. gives ONE cue for ONE missing element, then escalates one step at a time', async () => {
  let { state } = createSession({ activity: spoonActivity });
  let { turn } = await say(state, 'Spoon. You eat with it.');
  const cues = turn.lines.filter((l) => l.kind === 'cue' || l.kind === 'model');
  assert.equal(cues.length, 1);
  assert.equal(cues[0].element, 'category');
  assert.equal(cues[0].level, 'reminder');
  assert.match(texts(turn)[0], /named the object and explained its use/, 'recognises what he supplied first');
  ({ turn } = await say(state, 'Um, a spoon.'));
  assert.equal(turn.lines.at(-1).level, 'specific cue');
  assert.equal(turn.lines.at(-1).text, 'What group does it belong to?');
  ({ turn } = await say(state, 'Utensil.'));
  const rec = state.completed[0];
  assert.match(rec.review_note, /Group needed a specific cue/);
});

test('3. recognises a relevant personal connection as a valid conversational turn', async () => {
  let { state } = createSession({ activity: convActivity });
  const { turn } = await say(state, 'I watched that film too with my brother.');
  assert.ok(texts(turn).includes('You connected it to your own experience.'));
  assert.equal(state.item.conv.validTurns, 1);
  assert.ok(!turn.lines.some((l) => l.kind === 'cue'), 'a comment/connection is enough — no question demanded');
});

test('4. responds appropriately when Sam asks for help (and counts it as success)', async () => {
  let { state } = createSession({ activity: taskActivity });
  let { turn } = await say(state, "Sorry, I don't understand.");
  assert.match(texts(turn)[0], /asked me to make it clear/);
  assert.ok(texts(turn).some((t) => /First, get the cloth/.test(t)), 'gives the clear instruction');
  assert.ok(texts(turn).includes('Make a movie in your mind.'), 'uses the team phrase exactly');
  ({ turn } = await say(state, 'First get the cloth and spray, then wipe each table, then put the chairs in.'));
  const rec = state.completed[0];
  assert.equal(rec.help_requests.length, 1);
  assert.match(rec.review_note, /counts as a successful response/);
  assert.ok(rec.independent.some((x) => x.startsWith('Asked')), 'asking is recorded as independent');
});

test('5. keeps independent answers separate from supported answers', async () => {
  let { state } = createSession({ activity: spoonActivity });
  await say(state, 'It is a spoon for eating cereal.');
  await say(state, 'A spoon.');
  await say(state, 'Cutlery');
  const rec = state.completed[0];
  assert.ok(rec.independent.some((x) => /Named: "spoon"/i.test(x)));
  assert.ok(rec.independent.some((x) => /Use:/.test(x)));
  assert.ok(rec.after_support.some((x) => /Group: "cutlery"/i.test(x)));
  assert.ok(!rec.independent.some((x) => /Group/.test(x)));
  assert.ok(rec.sam_response.includes('[after support] Cutlery'));
});

test('6. Sam can pause, repeat or stop at any point', async () => {
  let { state, turn: first } = createSession({ activity: storyActivity });
  let { turn } = control(state, 'think');
  assert.equal(turn.ui.paused, true);
  assert.equal(turn.lines.length, 0, 'Buddy stays quiet while Sam thinks');
  ({ turn } = control(state, 'ready'));
  ({ turn } = control(state, 'repeat'));
  assert.deepEqual(texts(turn), texts(first), 'repeat replays the same instruction without adding information');
  await say(state, 'At the park the boy builds a kite.');
  const { records } = finish(state, 'finished');
  assert.equal(records.length, 1, 'a partial record is saved when Sam stops');
  assert.match(records[0].review_note, /finished before this item was complete/);
});

test('uncertain speech recognition is checked, not treated as a language mistake', async () => {
  let { state } = createSession({ activity: spoonActivity });
  let { turn } = await say(state, 'a spoon is a utensil for eating', { uncertain: true });
  assert.equal(turn.expect, 'confirm');
  assert.equal(state.item.attempts, 0);
  ({ turn } = await confirmHeard(state, true, { judge }));
  assert.equal(state.itemIndex, 1);
});

test('story: target words accepted, order recognised, no cue once complete', async () => {
  let { state } = createSession({ activity: storyActivity });
  const { turn } = await say(state, 'At the park, the boy builds a kite. Then the wind lifts it. Last, the kite spins and spins.');
  assert.equal(state.done, true);
  assert.match(texts(turn)[0], /where the story happened/);
  assert.match(state.completed[0].review_note, /All parts given independently/);
});

test('silence is never a failure', async () => {
  let { state } = createSession({ activity: spoonActivity });
  const { turn } = await say(state, '   ');
  assert.equal(state.item.attempts, 0);
  assert.match(turn.lines[0].text, /Take your time/);
});

test('support fades on later items', async () => {
  let { state } = createSession({ activity: spoonActivity, settings: { fade_support: true } });
  await say(state, 'Spoon, for eating.');      // reminder for category
  await say(state, 'Spoon.');                    // specific cue
  await say(state, 'Spoon.');                    // sentence starter
  await say(state, 'It is a kind of utensil.');  // supplied after starter
  assert.equal(state.itemIndex, 1);
  const { turn } = await say(state, 'A cup to drink.');
  assert.equal(turn.lines.at(-1).level, 'specific cue', 'starts one level lighter than last time');
});

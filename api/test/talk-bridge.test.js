// Talk: when Sam's answer is not a valid turn, Claude's reply responds to what he said (Foxy check, 28 Nov).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, respond, control } from '../src/coach/engine.js';
import { keywordJudge } from '../src/coach/judge.js';
import { MODES } from '../src/coach/modes.js';

const talk = {
  id: 'c', title: 'Talk', mode: 'conversation', plan_goal: 'conversation', content: { items: [
    { topic: 'food', opener: 'I think pizza is delicious. What kind of food do you like?', keywords: ['food', 'pizza', 'eat'] },
    { topic: 'music', opener: 'I like pop music. What music do you like?', keywords: ['music', 'song'] },
  ] },
};
// The keyword judge, plus the bridge Claude would write for an off-topic answer.
// Two topics are offered first; take the first one.
const start = (settings = {}) => { const { state } = createSession({ activity: talk, settings, quickStart: true }); control(state, 'topic_0'); return { state }; };
const judgeWith = (bridge) => async (a) => { const j = keywordJudge(a); if (!j.met.turn && bridge) j.bridge = bridge; return j; };

test('an off-topic answer gets Claude\'s linking reply, not the question again', async () => {
  const { state } = start();
  const { turn } = await respond(state, { text: 'drumming' }, { judge: judgeWith('Drumming sounds fun! Do you have a snack before you practise?') });
  assert.equal(turn.lines.at(-1).text, 'Drumming sounds fun! Do you have a snack before you practise?');
  assert.ok(!turn.lines.some((l) => /Take your time/.test(l.text)));
  assert.equal(state.item.supportGiven.length, 1, 'recorded as light support');
});

test('after two linking replies the fixed cues take over', async () => {
  const { state } = start();
  const judge = judgeWith('Okay! Do you like pizza or pasta better?');
  await respond(state, { text: 'drumming' }, { judge });
  await respond(state, { text: 'drumming' }, { judge });
  const { turn } = await respond(state, { text: 'drumming' }, { judge });
  assert.equal(turn.lines.at(-1).kind, 'cue');
});

test('without Claude (keyword judge) an off-topic answer still gets the fixed cue', async () => {
  const { state } = start();
  const { turn } = await respond(state, { text: 'drumming' }, { judge: judgeWith(null) });
  assert.equal(turn.lines.at(-1).text, 'Take your time. What kind of food do you like?');
});

test('"I don\'t understand" without Claude asks Foxy\'s last question again, not a vague line', async () => {
  const { state } = start();
  const { turn } = await respond(state, { text: "I don't understand" }, { judge: judgeWith(null) });
  assert.deepEqual(turn.lines.map((l) => l.text), ['Let me ask it another way.', 'What kind of food do you like?']);
});

test('the topic change names the new topic', async () => {
  const { state } = start({ turns_per_topic: 1 });
  const { turn } = await respond(state, { text: 'I like pizza' }, { judge: judgeWith(null) });
  assert.ok(turn.lines.some((l) => l.text === "Thanks for telling me about that. Now let's talk about music."), turn.lines.map((l) => l.text).join(' | '));
});

const three = { ...talk, content: { items: [...talk.content.items, { topic: 'sport', opener: 'I like football. What sport do you like?', keywords: ['sport', 'football'] }] } };
test('after the chosen topic comes the other one offered, not the next in the list', async () => {
  const { state } = createSession({ activity: { ...three, content: { items: [three.content.items[0], three.content.items[2], three.content.items[1]] } }, settings: { turns_per_topic: 1 }, quickStart: true });
  control(state, 'topic_0');
  const offered = state.activity.content.items.map((i) => i.topic);
  assert.deepEqual(offered.slice(0, 2).sort(), ['food', 'sport'].sort(), 'the two offered come first');
});

test('a topic Sam already took the chat onto stays next, and Foxy says he started on it', async () => {
  const { state } = createSession({ activity: three, settings: { turns_per_topic: 1 }, quickStart: true });
  control(state, 'topic_0'); // food, then music (offered), then sport
  const { turn } = await respond(state, { text: 'what music do you like?' }, { judge: judgeWith(null) });
  assert.ok(turn.lines.some((l) => l.text === "You already started telling me about music. Let's talk about that some more."), turn.lines.map((l) => l.text).join(' | '));
});

test('the question invitations are plain, with no "What would you like to know?"', () => {
  const flat = MODES.conversation.defaultCues.question.flat();
  assert.ok(!flat.some((t) => /would you like to know|curious/i.test(t)));
});

// Running-cost controls: which Claude model checks each module, and saved speech.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judgeFromEnv, modelsFromEnv, modelForMode } from '../src/coach/judge.js';
import { speak, setSpeechStore, speechKey } from '../src/voice.js';
import { ratesFor, estimateCost } from '../src/families.js';

const fakeClaude = (seen) => async (url, init) => {
  seen.push(JSON.parse(init.body).model);
  return { ok: true, json: async () => ({ content: [{ type: 'tool_use', input: { elements: [], events_in_order: 'not_applicable', help_request: 'none', transcript_seems_garbled: false, reply: 'Nice.' } }] }) };
};
const args = (mode) => ({ mode, item: { topic: 'gym', opener: 'Do you go to the gym?', question: 'Q', answers: ['a'] }, elements: mode === 'conversation' ? ['turn'] : ['answer'], text: 'yes', activity: { content: {} } });

test('one model everywhere unless ANTHROPIC_CHAT_MODEL is set', () => {
  assert.deepEqual(modelsFromEnv({}), { main: 'claude-sonnet-5-5', chat: 'claude-sonnet-5-5' });
  assert.deepEqual(modelsFromEnv({ ANTHROPIC_MODEL: 'claude-haiku-5-5' }), { main: 'claude-haiku-5-5', chat: 'claude-haiku-5-5' });
  const m = modelsFromEnv({ ANTHROPIC_MODEL: 'claude-haiku-5-5', ANTHROPIC_CHAT_MODEL: 'claude-sonnet-5-5' });
  assert.equal(modelForMode('conversation', m), 'claude-sonnet-5-5');
  for (const mode of ['listen', 'think', 'story', 'explain', 'recall', 'follow', 'task', 'object']) assert.equal(modelForMode(mode, m), 'claude-haiku-5-5');
  assert.equal(modelsFromEnv({ ANTHROPIC_MODEL: 'claude-haiku-5-5', ANTHROPIC_CHAT_MODEL: '  ' }).chat, 'claude-haiku-5-5', 'blank = same as main');
});

test('Chat Buddy is checked by the chat model, every other module by the main model', async () => {
  const seen = [];
  const judge = judgeFromEnv({ ANTHROPIC_API_KEY: 'k', ANTHROPIC_MODEL: 'claude-haiku-5-5', ANTHROPIC_CHAT_MODEL: 'claude-sonnet-5-5' }, { fetchImpl: fakeClaude(seen) });
  await judge(args('conversation'));
  await judge(args('listen'));
  await judge(args('think'));
  assert.deepEqual(seen, ['claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-haiku-5-5']);
});

test('speech is generated once, then served from the saved store (even after a restart)', async () => {
  process.env.ELEVENLABS_API_KEY = 'k';
  const saved = new Map();
  const store = { get: async (k) => saved.get(k) || null, put: async (k, a) => { saved.set(k, a); } };
  setSpeechStore(store);
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return { ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }; };
  const text = `Once upon a time ${Math.random()}`;
  const a = await speak(text, { voiceId: 'v1', speed: 0.9, fetchImpl });
  await new Promise((r) => setImmediate(r));
  assert.equal(calls, 1); assert.equal(saved.size, 1);
  // A different voice or speed is generated fresh.
  await speak(text, { voiceId: 'v2', speed: 0.9, fetchImpl });
  assert.equal(calls, 2);
  // Simulate a restart: a fresh in-memory cache can't be emptied from here, so use a new text that is only in the store.
  const t2 = `Saved before restart ${Math.random()}`;
  saved.set(speechKey({ voiceId: 'v1', model: 'eleven_multilingual_v2', speed: 0.9, text: t2 }), Buffer.from([9]));
  const b = await speak(t2, { voiceId: 'v1', speed: 0.9, fetchImpl });
  assert.equal(calls, 2, 'served from the store, no new ElevenLabs call');
  assert.deepEqual([...b], [9]);
  assert.deepEqual([...a], [1, 2, 3]);
  setSpeechStore(null);
});

test('a broken store never stops Buddy speaking', async () => {
  process.env.ELEVENLABS_API_KEY = 'k';
  setSpeechStore({ get: async () => { throw new Error('db down'); }, put: async () => { throw new Error('db down'); } });
  const fetchImpl = async () => ({ ok: true, arrayBuffer: async () => new Uint8Array([4]).buffer });
  const errs = console.error; console.error = () => {};
  try {
    const b = await speak(`Hello ${Math.random()}`, { voiceId: 'v1', fetchImpl });
    await new Promise((r) => setImmediate(r));
    assert.deepEqual([...b], [4]);
  } finally { console.error = errs; setSpeechStore(null); }
});

test('cost estimate halves the speech rate on Flash or Turbo', () => {
  assert.equal(ratesFor({ ttsModel: 'eleven_flash_v2_5' }).ttsPer1kChars, 0.05);
  assert.equal(ratesFor({ ttsModel: 'eleven_multilingual_v2' }).ttsPer1kChars, 0.10);
  assert.ok(estimateCost({ buddyChars: 10000 }, ratesFor({ ttsModel: 'eleven_flash_v2_5' })) < estimateCost({ buddyChars: 10000 }));
});

test('cost estimate uses the cheaper marking rate on Haiku', () => {
  assert.equal(ratesFor({ judgeModel: 'claude-haiku-5-5' }).judgePerResponse, 0.0005);
  assert.equal(ratesFor({ judgeModel: 'claude-sonnet-5-5' }).judgePerResponse, 0.007);
});

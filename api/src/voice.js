// ElevenLabs speech-to-text (Scribe) and text-to-speech.
import crypto from 'node:crypto';
const KEY = () => process.env.ELEVENLABS_API_KEY;
const STT_MODEL = () => process.env.ELEVENLABS_STT_MODEL || 'scribe_v2';
const TTS_MODEL = () => process.env.ELEVENLABS_TTS_MODEL || 'eleven_multilingual_v2';
const DEFAULT_VOICE = () => process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb';

// Words below this probability are marked as uncertain in the record and trigger "Did you say…?".
const WORD_THRESHOLD = Number(process.env.STT_WORD_THRESHOLD || 0.4);
const AVG_THRESHOLD = Number(process.env.STT_AVG_THRESHOLD || 0.7);

export const voiceEnabled = () => !!KEY();

export async function transcribe(buffer, mime = 'audio/webm') {
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mime }), `sam.${mime.includes('mp4') ? 'mp4' : 'webm'}`);
  form.append('model_id', STT_MODEL());
  form.append('language_code', 'en');
  form.append('tag_audio_events', 'false');
  // Verbatim on purpose: we record Sam's actual words, including repetitions.
  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': KEY() }, body: form });
  if (!res.ok) throw new Error(`Speech-to-text failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const words = (data.words || []).filter((w) => w.type === 'word' || (!w.type && w.text?.trim()));
  const probs = words.map((w) => (typeof w.logprob === 'number' ? Math.exp(w.logprob) : 1));
  const avg = probs.length ? probs.reduce((a, b) => a + b, 0) / probs.length : 1;
  const low = words.map((w, i) => probs[i] < WORD_THRESHOLD);
  const text = (data.text || '').trim();
  const displayText = words.length ? words.map((w, i) => (low[i] ? `[${w.text.trim()}?]` : w.text.trim())).join(' ') : text;
  return { text, displayText, uncertain: !!text && (avg < AVG_THRESHOLD || low.some(Boolean)), avg };
}

// Speech is generated once and reused: a small in-memory LRU for the busiest lines, and (when the server
// sets one) a saved store in Postgres that survives restarts and redeploys. The key includes the voice,
// model and speed, so changing any of them generates fresh audio rather than replaying the old voice.
const cache = new Map();
let store = null;
export function setSpeechStore(s) { store = s; }
export const speechKey = ({ voiceId, model, speed, text }) =>
  crypto.createHash('sha256').update(`${voiceId}|${model}|${speed}|${text}`).digest('hex');
const remember = (key, buf) => {
  cache.set(key, buf);
  if (cache.size > 300) cache.delete(cache.keys().next().value);
};

export async function speak(text, { voiceId, speed = 1, fetchImpl = fetch } = {}) {
  const v = voiceId || DEFAULT_VOICE();
  const model = TTS_MODEL();
  const sp = Math.min(1.2, Math.max(0.7, Number(speed) || 1));
  const key = speechKey({ voiceId: v, model, speed: sp, text });
  if (cache.has(key)) { const b = cache.get(key); cache.delete(key); cache.set(key, b); return b; }
  if (store) {
    try {
      const saved = await store.get(key);
      if (saved) { const b = Buffer.from(saved); remember(key, b); return b; }
    } catch (e) { console.error('[tts] saved speech unavailable:', e.message); }
  }
  const res = await fetchImpl(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(v)}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY(), 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: model,
      voice_settings: { stability: 0.6, similarity_boost: 0.75, speed: sp },
    }),
  });
  if (!res.ok) throw new Error(`Text-to-speech failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const buf = Buffer.from(await res.arrayBuffer());
  remember(key, buf);
  // Saving never holds up Buddy's reply.
  if (store) store.put(key, buf, { model, voiceId: v, chars: text.length }).catch((e) => console.error('[tts] could not save speech:', e.message));
  return buf;
}

export const ttsModel = () => TTS_MODEL();

// The voices available to this ElevenLabs account (premade ones plus any added from the Voice Library).
let voiceList = null;
export async function listVoices() {
  if (voiceList && Date.now() - voiceList.at < 10 * 60_000) return { voices: voiceList.voices, fallback: false };
  const res = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': KEY() } });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    console.error('[voices] ElevenLabs list failed', res.status, detail);
    // A restricted API key can speak but not list voices: fall back to ElevenLabs' standard voices.
    return { voices: STANDARD_VOICES, fallback: true, reason: res.status === 401 ? 'missing_permission' : `status_${res.status}` };
  }
  const data = await res.json();
  const voices = (data.voices || []).map((v) => ({
    id: v.voice_id,
    name: v.name,
    gender: v.labels?.gender || '',
    age: v.labels?.age || '',
    accent: v.labels?.accent || '',
    description: v.labels?.description || v.description || '',
  })).sort((a, b) => a.name.localeCompare(b.name));
  voiceList = { at: Date.now(), voices };
  return { voices, fallback: false };
}
export const defaultVoiceId = () => DEFAULT_VOICE();

// ElevenLabs' standard (premade) voices, used when the key isn't allowed to list voices.
const STANDARD_VOICES = [
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', gender: 'male', age: 'middle aged', accent: 'british', description: 'warm' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', gender: 'female', age: 'young', accent: 'american', description: 'soft' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', gender: 'female', age: 'young', accent: 'swedish', description: 'calm' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', gender: 'male', age: 'middle aged', accent: 'american', description: 'deep' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', gender: 'male', age: 'young', accent: 'american', description: 'friendly' },
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', gender: 'female', age: 'young', accent: 'american', description: 'calm' },
];

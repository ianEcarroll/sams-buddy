// ElevenLabs speech-to-text (Scribe) and text-to-speech.
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

// Small LRU so repeated prompts ("Make a movie in your mind.") are free and instant.
const cache = new Map();
export async function speak(text, { voiceId, speed = 1 } = {}) {
  const v = voiceId || DEFAULT_VOICE();
  const key = `${v}|${speed}|${text}`;
  if (cache.has(key)) { const b = cache.get(key); cache.delete(key); cache.set(key, b); return b; }
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(v)}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY(), 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: TTS_MODEL(),
      voice_settings: { stability: 0.6, similarity_boost: 0.75, speed: Math.min(1.2, Math.max(0.7, Number(speed) || 1)) },
    }),
  });
  if (!res.ok) throw new Error(`Text-to-speech failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const buf = Buffer.from(await res.arrayBuffer());
  cache.set(key, buf);
  if (cache.size > 300) cache.delete(cache.keys().next().value);
  return buf;
}

// Sam's Buddy — Sam's practice app. No build step: plain ES modules.
const $app = document.getElementById('app');
const $voice = document.getElementById('voice');
const TOKEN_KEY = 'buddy.device';
let token = localStorage.getItem(TOKEN_KEY);
let home = null;

// ------------------------------------------------------------ helpers
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v; // only used for trusted inline SVG icons
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(k));
  return el;
}
const icon = (name) => h('span', { 'aria-hidden': 'true', html: ICONS[name] || '' }).firstChild || '';
function mount(...nodes) { $app.replaceChildren(...nodes.flat().filter((n) => n != null && n !== false)); window.scrollTo(0, 0); }
function toast(msg) {
  const t = h('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 4000);
}

async function api(path, { method = 'GET', body, form } = {}) {
  const res = await fetch(`/api/device${path}`, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    body: form || (body ? JSON.stringify(body) : undefined),
  });
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (res.status === 401) { localStorage.removeItem(TOKEN_KEY); token = null; renderPair(data?.error); throw new Error(data?.error); }
  if (!res.ok) throw new Error(data?.error || 'Something went wrong. Try again.');
  return data;
}

// iOS only plays audio started from a tap; unlock the single <audio> element on the first tap.
let audioUnlocked = false;
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  $voice.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
  $voice.play().catch(() => {});
}
document.addEventListener('pointerdown', unlockAudio, { once: true });

// ------------------------------------------------------------ pairing & privacy
function renderPair(message) {
  const input = h('input', { id: 'code', inputmode: 'text', autocomplete: 'one-time-code', maxlength: '8', style: 'text-transform:uppercase;font-size:1.6rem;letter-spacing:.15em' });
  mount(
    h('h1', { class: 'hello' }, "Sam's Buddy"),
    h('p', { class: 'hello-sub' }, message || 'Ask someone on your support team for a code to connect this phone.'),
    h('div', { class: 'field' }, h('label', { for: 'code' }, 'Code'), input),
    h('button', { class: 'btn btn-primary', onclick: async () => {
      try {
        const res = await fetch('/api/device/pair', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: input.value }) });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        token = d.token; localStorage.setItem(TOKEN_KEY, token);
        boot();
      } catch (e) { toast(e.message); }
    } }, 'Connect this phone'),
  );
}

const WHO = [['parent', 'My parents'], ['therapist', 'My speech therapist'], ['teacher', 'My teachers'], ['job_coach', 'My job coach']];
function privacyControls(consent) {
  const boxes = WHO.map(([k, label]) => h('label', { class: 'switch' }, h('input', { type: 'checkbox', name: k, checked: !!consent?.can_view?.[k] }), label));
  const audio = h('label', { class: 'switch' }, h('input', { type: 'checkbox', name: 'save_audio', checked: !!consent?.save_audio }), 'Save recordings of my voice');
  const read = () => ({
    can_view: Object.fromEntries(WHO.map(([k]) => [k, boxes.find((b) => b.querySelector('input').name === k).querySelector('input').checked])),
    save_audio: audio.querySelector('input').checked,
  });
  return { nodes: [h('fieldset', { style: 'border:0;padding:0;margin:0;display:grid;gap:4px' }, h('legend', { style: 'font-weight:700;margin-bottom:6px' }, 'Who can see my practice notes?'), ...boxes), audio], read };
}

function renderConsent() {
  const pc = privacyControls(home.consent);
  mount(
    h('h1', { class: 'hello' }, `Hi ${home.name}`),
    h('p', {}, 'Buddy helps you practise what your speech therapist and teachers are working on with you.'),
    h('p', {}, 'After each practice, Buddy saves a short note: what you said, and when Buddy gave a hint. It is not a test and there are no scores.'),
    h('p', {}, 'You choose who can read your notes. You can change this any time in My settings.'),
    ...pc.nodes,
    h('button', { class: 'btn btn-primary', onclick: async () => {
      try { await api('/consent', { method: 'PUT', body: pc.read() }); boot(); } catch (e) { toast(e.message); }
    } }, 'Save my choices'),
  );
}

// ------------------------------------------------------------ home
const MODE_INFO = {
  story: { label: 'Tell a Story', icon: 'story' },
  object: { label: 'Describe a Picture', icon: 'picture' },
  conversation: { label: 'Have a Conversation', icon: 'chat' },
  task: { label: 'Practise a Task', icon: 'task' },
};

function renderHome() {
  const current = home.activities.find((a) => a.id === home.current_activity_id);
  const cards = ['story', 'object', 'conversation', 'task'].map((mode) => {
    const list = home.activities.filter((a) => a.mode === mode);
    const on = home.modes.includes(mode) && list.length > 0;
    return h('button', { class: 'card', 'aria-disabled': on ? 'false' : 'true', onclick: () => on ? (list.length === 1 ? startPractice(list[0].id) : renderPicker(mode, list)) : toast('Nothing here yet. Your team will add it.') },
      icon(MODE_INFO[mode].icon), h('span', {}, MODE_INFO[mode].label, h('br'), h('small', {}, on ? `${list.length} to practise` : 'Not yet')));
  });
  mount(
    h('div', {}, h('h1', { class: 'hello' }, `Hi ${home.name}`), h('p', { class: 'hello-sub' }, 'Ready when you are.')),
    h('button', { class: 'start', disabled: !current, onclick: () => startPractice(current.id) },
      h('strong', {}, 'Start My Practice'), h('span', {}, current ? current.title : 'Your team has not picked one yet')),
    h('div', { class: 'cards' }, cards),
    h('button', { class: 'btn btn-quiet', onclick: renderSettings }, 'My settings'),
  );
}

function renderPicker(mode, list) {
  mount(
    h('div', { class: 'p-top' }, h('h1', { class: 'hello', style: 'font-size:2rem' }, MODE_INFO[mode].label), h('button', { class: 'btn', onclick: renderHome }, 'Back')),
    h('div', { class: 'picker' }, list.map((a) => h('button', { class: 'btn', onclick: () => startPractice(a.id) }, a.title))),
  );
}

function renderSettings() {
  const pc = privacyControls(home.consent);
  const captions = h('input', { type: 'checkbox', checked: home.settings.captions });
  const speed = h('select', {}, [['0.8', 'Slower'], ['0.9', 'A bit slower'], ['1', 'Normal'], ['1.1', 'Faster']].map(([v, l]) => h('option', { value: v, selected: Number(v) === Number(home.settings.speech_speed) }, l)));
  mount(
    h('div', { class: 'p-top' }, h('h1', { class: 'hello', style: 'font-size:2rem' }, 'My settings'), h('button', { class: 'btn', onclick: renderHome }, 'Back')),
    h('label', { class: 'switch' }, captions, 'Show Buddy\u2019s words on screen'),
    h('div', { class: 'field' }, h('label', {}, 'How fast Buddy talks'), speed),
    ...pc.nodes,
    h('button', { class: 'btn btn-primary', onclick: async () => {
      try {
        await api('/settings', { method: 'PUT', body: { captions: captions.checked, speech_speed: Number(speed.value) } });
        await api('/consent', { method: 'PUT', body: pc.read() });
        toast('Saved.'); await boot();
      } catch (e) { toast(e.message); }
    } }, 'Save'),
    h('button', { class: 'btn', onclick: async () => {
      const data = await api('/export');
      const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })), download: 'my-practice-notes.json' });
      a.click();
    } }, 'Download my practice notes'),
    h('button', { class: 'btn btn-danger', onclick: async () => {
      if (!confirm('Delete all your practice notes? This cannot be undone.')) return;
      await api('/records', { method: 'DELETE' }); toast('Your practice notes are deleted.');
    } }, 'Delete my practice notes'),
  );
}

// ------------------------------------------------------------ practice
let P = null;          // current practice view-state
let playGen = 0;       // bumps to interrupt playback
let rec = null;        // { recorder, chunks, stream }
const canRecord = () => home.voice && !!navigator.mediaDevices?.getUserMedia && !!window.MediaRecorder;
const captionsOn = () => home.settings.captions || !home.voice;

async function startPractice(activityId) {
  unlockAudio();
  try {
    const t = await api('/practice/start', { method: 'POST', body: { activityId } });
    P = { id: t.sessionId, title: t.title, mode: t.mode, turn: t, shown: [], talk: 'idle', thinking: false, help: false };
    drawPractice();
    playLines(t.lines);
  } catch (e) { toast(e.message); }
}

function drawPractice() {
  if (!P) return;
  const { turn } = P;
  const ui = turn.ui;
  const stage = ui.images.length === 0 ? null
    : ui.imageLayout === 'sequence'
      ? h('div', { class: 'strip' }, ui.images.map((src, i) => h('figure', {}, h('img', { src, alt: `Picture ${i + 1}` }), h('figcaption', {}, `${i + 1}`))))
      : h('img', { src: ui.images[0], alt: 'Practice picture' });

  // Show the last two things Buddy said this turn, so feedback stays visible under the cue that follows it.
  const bubble = captionsOn() && P.shown.length ? h('div', { style: 'display:grid;gap:10px' }, P.shown.slice(-2).map((l) =>
    h('div', { class: 'bubble', 'data-kind': l.kind }, l.kind === 'movie' ? icon('film') : null, h('span', {}, l.text)))) : null;

  const cue = ui.cueCard ? h('ol', { class: 'cuecard', 'aria-label': 'Reminder card' },
    ui.cueCard.labels.flatMap((l, i) => [i ? h('li', { class: 'arrow', 'aria-hidden': 'true' }, '→') : null, h('li', { 'data-lit': String(!!ui.cueCard.lit[i]) }, l)])) : null;

  const confirmBox = turn.expect === 'confirm' && ui.heard ? h('div', { class: 'confirm' },
    h('p', {}, 'Buddy heard: “', h('strong', {}, ui.heard), '”'),
    h('div', { class: 'row' },
      h('button', { class: 'btn btn-primary', onclick: () => sendConfirm(true) }, 'Yes, that\u2019s right'),
      h('button', { class: 'btn', onclick: () => sendConfirm(false) }, 'Say it again'))) : null;

  const talkLabel = { idle: 'Talk', recording: 'I\u2019m done', busy: 'Buddy is listening\u2026' }[P.talk];
  const talk = canRecord()
    ? h('button', { class: 'talk', 'data-state': P.talk, disabled: P.talk === 'busy' || turn.expect === 'confirm', onclick: onTalk, 'aria-label': talkLabel },
      P.talk === 'recording' ? h('span', { class: 'dot', 'aria-hidden': 'true' }) : icon('mic'), talkLabel)
    : typedInput();

  const controls = h('div', { class: 'controls' },
    h('button', { class: 'btn', onclick: () => sendControl('repeat') }, icon('repeat'), 'Repeat'),
    h('button', { class: 'btn', onclick: () => { P.help = true; drawPractice(); } }, icon('help'), 'Help me'),
    h('button', { class: 'btn', onclick: () => sendControl('think') }, icon('think'), 'Let me think'),
    h('button', { class: 'btn', onclick: () => sendControl('try_again') }, icon('again'), 'Try again'),
  );

  mount(
    h('div', { class: 'p-top' }, h('p', { class: 'p-title' }, P.title), h('button', { class: 'btn', onclick: finishPractice }, icon('stop'), 'Finish')),
    h('div', { class: 'stage' }, stage),
    bubble,
    P.thinking ? h('p', { class: 'thinking' }, 'Thinking time. Press Talk whenever you are ready.') : null,
    cue,
    confirmBox,
    talk,
    controls,
    P.help ? helpSheet() : null,
    turn.ui.paused ? h('div', { class: 'pause' }, h('div', {}, h('p', {}, 'Take all the time you need.'), h('button', { class: 'btn btn-primary', onclick: () => sendControl('ready') }, 'I\u2019m ready'))) : null,
  );
}

function typedInput() {
  const input = h('input', { 'aria-label': 'Type your answer', placeholder: 'Type your answer' });
  const send = async () => { if (!input.value.trim()) return; const text = input.value; input.value = ''; await sendResponse({ text }); };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
  return h('div', { class: 'typed' }, input, h('button', { class: 'btn btn-primary', onclick: send, disabled: P.talk === 'busy' }, 'Send'));
}

function helpSheet() {
  const close = () => { P.help = false; drawPractice(); };
  const pick = (a) => { P.help = false; sendControl(a); };
  return h('div', { class: 'sheet', onclick: (e) => { if (e.target.classList.contains('sheet')) close(); } },
    h('div', { role: 'dialog', 'aria-label': 'Help me' },
      h('h2', {}, 'Help me'),
      h('button', { class: 'btn', onclick: () => pick('hint') }, 'Give me a hint'),
      h('button', { class: 'btn', onclick: () => pick('dont_understand') }, 'I don\u2019t understand'),
      h('button', { class: 'btn', onclick: () => pick('example') }, 'Show me an example'),
      h('button', { class: 'btn btn-quiet', onclick: close }, 'Close')));
}

// Play Buddy's lines in order. Any new action interrupts it.
async function playLines(lines) {
  const gen = ++playGen;
  for (const l of lines) {
    if (gen !== playGen) return;
    P.shown.push(l); P.thinking = false; drawPractice();
    if (l.audio) {
      try {
        const r = await fetch(l.audio, { headers: { authorization: `Bearer ${token}` } });
        if (!r.ok) throw new Error();
        const url = URL.createObjectURL(await r.blob());
        if (gen !== playGen) return;
        $voice.src = url;
        await $voice.play();
        await new Promise((res) => { $voice.onended = res; $voice.onpause = res; });
        URL.revokeObjectURL(url);
      } catch { await wait(Math.min(4000, 400 * l.text.split(' ').length), gen); }
    } else {
      await wait(Math.min(3500, 300 * l.text.split(' ').length), gen);
    }
    if (l.pauseAfter && gen === playGen) {
      P.thinking = true; drawPractice();
      await wait(l.pauseAfter * 1000, gen);
      if (P) P.thinking = false;
    }
  }
}
function wait(ms, gen) {
  return new Promise((res) => { const t = setInterval(() => { if (gen !== playGen) { clearInterval(t); res(); } }, 100); setTimeout(() => { clearInterval(t); res(); }, ms); });
}
function stopVoice() { playGen++; $voice.pause(); if (P) P.thinking = false; }

async function onTalk() {
  if (P.talk === 'idle') {
    stopVoice();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
      const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      // Keep the chunks in this closure: the last chunk arrives AFTER stop(), when `rec` is already cleared.
      const chunks = [];
      rec = { recorder, chunks, stream };
      recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      recorder.start();
      P.talk = 'recording'; drawPractice();
    } catch {
      toast('Buddy cannot use the microphone. Check that this app is allowed to use it, or type instead.');
      home.voice = false; drawPractice();
    }
  } else if (P.talk === 'recording') {
    const r = rec; rec = null;
    P.talk = 'busy'; drawPractice();
    const blob = await new Promise((res) => { r.recorder.onstop = () => res(new Blob(r.chunks, { type: r.recorder.mimeType || 'audio/webm' })); r.recorder.stop(); });
    r.stream.getTracks().forEach((t) => t.stop());
    const form = new FormData();
    form.append('audio', blob, blob.type.includes('mp4') ? 'sam.mp4' : 'sam.webm');
    await sendResponse({ form });
  }
}

async function sendResponse({ text, form }) {
  P.talk = 'busy'; drawPractice();
  try {
    const t = form ? await api(`/practice/${P.id}/respond`, { method: 'POST', form }) : await api(`/practice/${P.id}/respond`, { method: 'POST', body: { text } });
    applyTurn(t);
  } catch (e) { toast(e.message); P.talk = 'idle'; drawPractice(); }
}
async function sendConfirm(yes) {
  try { applyTurn(await api(`/practice/${P.id}/confirm`, { method: 'POST', body: { yes } })); } catch (e) { toast(e.message); }
}
async function sendControl(action) {
  stopVoice();
  try { applyTurn(await api(`/practice/${P.id}/control`, { method: 'POST', body: { action } })); } catch (e) { toast(e.message); }
}
function applyTurn(t) {
  P.turn = t; P.talk = 'idle';
  if (t.lines.length) P.shown = [];
  drawPractice();
  playLines(t.lines).then(() => { if (t.done && P?.id === t.sessionId) renderDone(t); });
}

async function finishPractice() {
  stopVoice();
  if (rec) { rec.recorder.stop(); rec.stream.getTracks().forEach((t) => t.stop()); rec = null; }
  try { await api(`/practice/${P.id}/finish`, { method: 'POST' }); } catch {}
  renderDone(null);
}

function renderDone(t) {
  const feedback = t?.lines?.filter((l) => l.kind === 'feedback').map((l) => l.text) || [];
  P = null;
  mount(
    h('p', { class: 'done-msg' }, `Nice practice, ${home.name}.`),
    feedback.length ? h('p', {}, feedback.at(-1)) : h('p', {}, 'Your practice note is saved.'),
    h('button', { class: 'btn btn-primary', onclick: boot }, 'Back to home'),
  );
}

// ------------------------------------------------------------ icons (inline, stroke-based)
const S = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICONS = {
  mic: S('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
  repeat: S('<path d="M4 12a8 8 0 0 1 13.7-5.6L20 9M20 4v5h-5M20 12a8 8 0 0 1-13.7 5.6L4 15M4 20v-5h5"/>'),
  help: S('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.5V14M12 17.5v.01"/>'),
  think: S('<path d="M12 3a6 6 0 0 0-3.5 10.9V17h7v-3.1A6 6 0 0 0 12 3zM9.5 20h5"/>'),
  again: S('<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5"/>'),
  stop: S('<rect x="6" y="6" width="12" height="12" rx="2"/>'),
  film: S('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4"/>'),
  story: S('<path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2V5z"/><path d="M4 19a2 2 0 0 1 2-2h12M9 7h5M9 11h5"/>'),
  picture: S('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/>'),
  chat: S('<path d="M4 5h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><path d="M19 9h1a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1v3l-3-3h-3"/>'),
  task: S('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10l1.5 1.5L14 8M9 16h6"/>'),
};

// ------------------------------------------------------------ start
async function boot() {
  if (!token) return renderPair();
  try {
    home = await api('/home');
    if (!home.consent?.agreed_at) return renderConsent();
    renderHome();
  } catch (e) { if (token) mount(h('p', {}, e.message), h('button', { class: 'btn', onclick: boot }, 'Try again')); }
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
boot();

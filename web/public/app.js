// Buddy — the learner's practice app. No build step: plain ES modules.
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
const MARK = '<svg viewBox="0 0 128 112" aria-hidden="true"><rect class="b1" x="6" y="22" width="90" height="64" rx="28"/><path class="b1" d="M26 80 L18 104 L50 84 Z"/><rect class="b2" x="54" y="6" width="68" height="50" rx="24" stroke-width="6"/><path class="b2" d="M106 50 L118 66 L96 54 Z" stroke="none"/></svg>';
// Logo lockup: the mark, then "<Name>'s" over a bold "Buddy". Name left out before we know who the app is for.
function brand(name) {
  const el = h('span', { class: 'brand' });
  el.innerHTML = MARK; // trusted constant
  el.append(h('span', { class: 'brand-text' }, name ? h('small', {}, `${name}'s`) : null, 'Buddy'));
  return el;
}
// ---------- installing on the home screen, and staying calm when the internet drops
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
let installPrompt = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; });
const SHARE_ICON = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-4px"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
function installHelp() {
  if (isStandalone()) return null;
  const box = h('div', { class: 'install-help' }, h('strong', {}, 'Add Buddy to your home screen'));
  if (isIOS()) {
    const p = h('p', {}, 'In Safari, tap the Share button ');
    p.insertAdjacentHTML('beforeend', SHARE_ICON);
    p.append(', then choose \u201cAdd to Home Screen\u201d. Open Buddy from its new icon.');
    box.append(p);
  } else if (installPrompt) {
    box.append(h('p', {}, 'Buddy works best as an app on this device.'), h('button', { class: 'btn', onclick: async () => {
      installPrompt.prompt(); const r = await installPrompt.userChoice; installPrompt = null;
      if (r.outcome === 'accepted') box.remove();
    } }, 'Install Buddy'));
  } else {
    box.append(h('p', {}, 'Open your browser menu and choose \u201cInstall app\u201d or \u201cAdd to Home screen\u201d.'));
  }
  return box;
}
function offlineScreen(on) {
  document.getElementById('offline')?.remove();
  if (!on) return;
  document.body.append(h('div', { id: 'offline', class: 'pause', role: 'alert' }, h('div', {},
    h('p', {}, 'Buddy needs the internet'), h('span', { class: 'hello-sub' }, 'Check the Wi-Fi is on. Buddy will carry on when it is back.'))));
}
addEventListener('offline', () => offlineScreen(true));
addEventListener('online', () => offlineScreen(false));

const icon = (name) => h('span', { 'aria-hidden': 'true', html: ICONS[name] || '' }).firstChild || '';
function mount(...nodes) { $app.replaceChildren(...nodes.flat().filter((n) => n != null && n !== false)); window.scrollTo(0, 0); }
// Practice redraws on every line Buddy says: keep the scroll position instead of jumping back to the top.
function mountKeep(...nodes) { const y = window.scrollY; $app.replaceChildren(...nodes.flat().filter((n) => n != null && n !== false)); window.scrollTo(0, y); }
const smooth = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
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
// A friendly name for this device in the team's device list. iPadOS reports itself as a Mac,
// so a touch-screen "Mac" is treated as an iPad.
function deviceLabel() {
  const ua = navigator.userAgent;
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iPad';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/Android/.test(ua)) return Math.min(screen.width, screen.height) >= 600 ? 'Android tablet' : 'Android phone';
  return 'Computer';
}
function renderPair(message) {
  const input = h('input', { id: 'code', inputmode: 'text', autocomplete: 'one-time-code', maxlength: '8', style: 'text-transform:uppercase;font-size:1.6rem;letter-spacing:.15em' });
  mount(
    brand(),
    h('h1', { class: 'hello' }, 'Connect this device'),
    h('p', { class: 'hello-sub' }, message || 'Ask someone on your support team for a code to connect this device.'),
    h('div', { class: 'field' }, h('label', { for: 'code' }, 'Code'), input),
    h('button', { class: 'btn btn-primary', onclick: async () => {
      try {
        const res = await fetch('/api/device/pair', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: input.value, label: deviceLabel() }) });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        token = d.token; localStorage.setItem(TOKEN_KEY, token);
        boot();
      } catch (e) { toast(e.message); }
    } }, 'Connect'),
    installHelp(),
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
// The Buddy modules, in the order Sam sees them. Each has its own name, icon and colour.
const MODE_INFO = {
  memory: { label: 'Memory Buddy', tagline: 'Remember and recall', icon: 'memory', modes: ['recall', 'listen'] },
  story: { label: 'Story Buddy', tagline: 'Organise my thoughts', icon: 'story' },
  explain: { label: 'Explain Buddy', tagline: 'Say it clearly', icon: 'explain', modes: ['explain', 'object'] },
  think: { label: 'Think Buddy', tagline: 'Solve the problem', icon: 'think' },
  conversation: { label: 'Chat Buddy', tagline: 'Keep the conversation going', icon: 'chat' },
  task: { label: 'Listen Buddy', tagline: 'Follow instructions', icon: 'ear', modes: ['follow', 'task'] },
  steps: { label: 'Task Buddy', tagline: 'Do it step by step', icon: 'steps' },
};
const MODE_ORDER = Object.keys(MODE_INFO);
const modesOf = (mod) => MODE_INFO[mod].modes || [mod];

// "Welcome back" once this device has been used before; a plain hello the very first time.
const SEEN_KEY = 'buddy.seen';
function greeting() {
  let seen = false;
  try { seen = localStorage.getItem(SEEN_KEY) === '1'; localStorage.setItem(SEEN_KEY, '1'); } catch { /* storage unavailable: just say hi */ }
  return seen ? `Welcome back, ${home.name}!` : `Hi ${home.name}!`;
}

function renderHome() {
  const current = home.activities.find((a) => a.id === home.current_activity_id);
  const cards = MODE_ORDER.map((mode) => {
    const list = home.activities.filter((a) => modesOf(mode).includes(a.mode) && home.modes.includes(a.mode));
    const on = list.length > 0;
    return h('button', { class: 'card', 'data-module': mode, 'aria-disabled': on ? 'false' : 'true', onclick: () => on ? (list.length === 1 ? startPractice(list[0].id) : renderPicker(mode, list)) : toast('Nothing here yet. Your team will add it.') },
      h('span', { class: 'card-icon' }, icon(MODE_INFO[mode].icon)),
      h('span', {}, MODE_INFO[mode].label, h('br'), h('small', {}, MODE_INFO[mode].tagline), h('br'), h('small', { class: 'card-count' }, on ? `${list.length} to practise` : 'Not yet')));
  });
  mount(
    brand(home.name),
    h('div', {}, h('h1', { class: 'hello' }, greeting()), h('p', { class: 'hello-sub' }, 'Ready when you are.')),
    h('button', { class: 'start', disabled: !current, onclick: () => startPractice(current.id) },
      h('strong', {}, 'Start My Practice'), h('span', {}, current ? current.title : 'Your team has not picked one yet')),
    h('div', { class: 'cards' }, cards),
    h('button', { class: 'btn btn-quiet', onclick: renderSettings }, 'My settings'),
  );
}

function renderPicker(mode, list) {
  mount(
    h('div', { class: 'p-top' }, h('h1', { class: 'hello picker-title', 'data-module': mode, style: 'font-size:2rem' }, h('span', { class: 'card-icon' }, icon(MODE_INFO[mode].icon)), MODE_INFO[mode].label), h('button', { class: 'btn', onclick: renderHome }, 'Back')),
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
    reminderBox(),
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
    h('p', { class: 'muted', style: 'font-size:.85rem' }, 'Pictures: Mulberry Symbols \u00A9 Steve Lee, CC BY-SA 4.0 (mulberrysymbols.org)'),
  );
}

// Practice reminders: Sam turns them on for this device; his team picks the time.
function urlB64ToBytes(b64) {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}
function reminderBox() {
  const box = h('fieldset', { class: 'reminders', style: 'border:0;padding:0;margin:0;display:grid;gap:8px' }, h('legend', { style: 'font-weight:700;margin-bottom:6px' }, 'Practice reminder'));
  const say = (...kids) => box.replaceChildren(box.firstChild, ...kids);
  (async () => {
    const info = await api('/push');
    if (!info.configured) return say(h('p', { style: 'margin:0' }, 'Reminders are not set up yet.'));
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return say(h('p', { style: 'margin:0' }, isIOS() && !isStandalone() ? 'To get reminders, add Buddy to your home screen first, then open it from there.' : 'This device cannot show reminders.'));
    }
    const when = info.reminder_time ? `at ${info.reminder_time}` : 'when your team sets a time';
    if (info.subscribed) {
      return say(h('p', { style: 'margin:0' }, `Buddy will remind you ${when} on days you have not practised.`),
        h('button', { class: 'btn', onclick: async () => {
          const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); if (sub) await sub.unsubscribe();
          await api('/push', { method: 'DELETE' }); toast('Reminders turned off.'); reminderRefresh(box);
        } }, 'Turn off reminders'));
    }
    say(h('p', { style: 'margin:0' }, `Buddy can remind you ${when} on days you have not practised.`),
      h('button', { class: 'btn', onclick: async () => {
        try {
          if ((await Notification.requestPermission()) !== 'granted') return toast('Reminders need permission. You can allow them in Settings.');
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToBytes(info.publicKey) });
          await api('/push', { method: 'POST', body: { subscription: sub.toJSON() } });
          toast('Reminders are on.'); reminderRefresh(box);
        } catch (e) { toast(e.message || 'Could not turn on reminders.'); }
      } }, 'Turn on reminders'));
  })().catch(() => say(h('p', { style: 'margin:0' }, 'Could not load reminder settings.')));
  return box;
}
function reminderRefresh(old) { old.replaceWith(reminderBox()); }

// ------------------------------------------------------------ practice
let P = null;          // current practice view-state
let playGen = 0;       // bumps to interrupt playback
let rec = null;        // { recorder, chunks, stream }
// The microphone stays open for the whole practice: asking for it on every Press to talk makes an iPad home-screen
// app show its permission box again and again. Closed when the practice ends.
let micStream = null;
async function getMic() {
  if (micStream && micStream.getAudioTracks().some((t) => t.readyState === 'live')) return micStream;
  micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  return micStream;
}
function closeMic() { if (micStream) { micStream.getTracks().forEach((t) => t.stop()); micStream = null; } }
const canRecord = () => home.voice && !!navigator.mediaDevices?.getUserMedia && !!window.MediaRecorder;
const captionsOn = () => home.settings.captions || !home.voice;

async function startPractice(activityId) {
  unlockAudio();
  try {
    const t = await api('/practice/start', { method: 'POST', body: { activityId } });
    P = { id: t.sessionId, title: t.title, mode: t.mode, turn: t, shown: [], talk: 'idle', speaking: false, thinking: false, help: false };
    drawPractice();
    P.walkReveal = walkStart(t);
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
  // A step's words are left out of the captions when a question about it follows (Task Buddy), so they can't be read off.
  const said = P.shown.filter((l) => !l.noCaption);
  const bubble = captionsOn() && said.length ? h('div', { style: 'display:grid;gap:10px' }, said.slice(-2).map((l) =>
    h('div', { class: 'bubble', 'data-kind': l.kind }, l.kind === 'movie' ? icon('film') : null, h('span', {}, l.text)))) : null;

  const cue = ui.cueCard ? h('ol', { class: 'cuecard', 'aria-label': 'Reminder card' },
    ui.cueCard.labels.flatMap((l, i) => [i ? h('li', { class: 'arrow', 'aria-hidden': 'true' }, '→') : null, h('li', { 'data-lit': String(!!ui.cueCard.lit[i]) }, l)])) : null;

  const confirmBox = turn.expect === 'confirm' && ui.heard ? h('div', { class: 'confirm' },
    h('p', {}, 'Buddy heard: “', h('strong', {}, ui.heard), '”'),
    h('div', { class: 'row' },
      h('button', { class: 'btn btn-primary', onclick: () => sendConfirm(true) }, 'Yes, that\u2019s right'),
      h('button', { class: 'btn', onclick: () => sendConfirm(false) }, 'Say it again'))) : null;

  // One clear state for each moment of the turn:
  //   Buddy talking → wait (button off) · your turn → "Press to talk" · recording → "I'm done" · sent → "Buddy is thinking…"
  const state = P.talk === 'idle' && P.speaking ? 'speaking' : P.talk;
  const TALK = {
    speaking: { icon: 'speaker', label: 'Buddy is talking\u2026', sub: 'Wait for Buddy to finish' },
    idle: { icon: 'mic', label: 'Press to talk', sub: 'Your turn' },
    recording: { icon: null, label: 'I\u2019m done', sub: 'Listening \u2014 press when you have finished' },
    busy: { icon: 'wait', label: 'Buddy is thinking\u2026', sub: 'Got it' },
  }[state];
  // Listen to a Story: after the story the learner presses "I'm ready"; after a round with misses they choose:
  // hear the story and retry, retry the missed questions straight away, or finish.
  const speakingNow = P.talk === 'idle' && P.speaking;
  const readyBtn = turn.expect === 'ready'
    ? h('button', { class: 'talk', 'data-state': speakingNow ? 'speaking' : 'idle', disabled: speakingNow, onclick: () => sendControl('start_questions'), 'aria-label': "I'm ready" },
      icon(speakingNow ? 'speaker' : 'play'),
      h('span', { class: 'talk-text' }, h('span', {}, speakingNow ? (P.mode === 'steps' ? 'Buddy is talking\u2026' : 'Buddy is reading\u2026') : 'I\u2019m ready'),
        h('small', {}, speakingNow ? (P.mode === 'steps' ? 'Listen to the steps' : 'Listen to the story') : 'Start the questions')))
    : null;
  const choice = turn.expect === 'choice'
    ? h('div', { class: 'choice' },
      h('button', { class: 'btn btn-primary', disabled: speakingNow, onclick: () => sendControl('listen_retry') }, icon('listen'), 'Hear the story'),
      h('button', { class: 'btn', disabled: speakingNow, onclick: () => sendControl('listen_retry_questions') }, icon('again'), 'Just the questions'),
      h('button', { class: 'btn', disabled: speakingNow, onclick: () => sendControl('listen_finish') }, icon('stop'), 'I\u2019m finished'))
    : null;
  // Listen Buddy on screen: Sam answers by tapping, so the board replaces the Talk button for those steps.
  const board = ui.board ? drawBoard(ui.board, speakingNow) : null;
  const tapHint = turn.expect === 'board'
    ? h('p', { class: 'tap-hint' }, speakingNow ? 'Listen to all of it first\u2026' : 'Touch a shape, then touch a box.')
    : null;
  // Task Buddy: the learner's hands are busy, so a big Done button replaces Talk while they do a step.
  const doneBtn = turn.expect === 'done'
    ? h('button', { class: 'talk', 'data-state': speakingNow ? 'speaking' : 'idle', disabled: speakingNow, onclick: () => sendControl('step_done'), 'aria-label': 'Done' },
      icon(speakingNow ? 'speaker' : 'done'),
      h('span', { class: 'talk-text' }, h('span', {}, speakingNow ? 'Buddy is talking\u2026' : 'Done'),
        h('small', {}, speakingNow ? 'Listen first' : ui.step ? 'Press when you\u2019ve finished this step' : 'Press when you\u2019ve finished everything')))
    : null;
  const talk = tapHint || readyBtn || choice || doneBtn || (canRecord()
    ? h('button', { class: 'talk', 'data-state': state, disabled: state === 'speaking' || state === 'busy' || turn.expect === 'confirm', onclick: onTalk, 'aria-label': TALK.label },
      TALK.icon ? icon(TALK.icon) : h('span', { class: 'dot', 'aria-hidden': 'true' }),
      h('span', { class: 'talk-text' }, h('span', {}, TALK.label), h('small', {}, TALK.sub)))
    : typedInput());

  const controls = h('div', { class: 'controls' },
    h('button', { class: 'btn', onclick: () => sendControl('repeat') }, icon('repeat'), 'Repeat'),
    // Task Buddy while doing a step: one press shows the step (or the whole list) on screen, no menu.
    h('button', { class: 'btn', onclick: () => { if (turn.expect === 'done') { sendControl('hint'); return; } P.help = true; drawPractice(); } }, icon('help'), 'Help me'),
    h('button', { class: 'btn', onclick: () => sendControl('think') }, icon('think'), 'Let me think'),
    h('button', { class: 'btn', onclick: () => sendControl('try_again') }, icon('again'), 'Try again'),
  );

  // Task Buddy: which step this is, its words when Buddy has said them (or shows them as visual support),
  // and in Independence mode the whole list once the learner asks for help.
  const stepBar = ui.step ? h('div', { class: 'step-bar', 'aria-label': `Step ${ui.step.n} of ${ui.step.total}` },
    h('span', { class: 'step-count' }, `Step ${ui.step.n} of ${ui.step.total}`),
    h('span', { class: 'step-dots', 'aria-hidden': 'true' }, Array.from({ length: ui.step.total }, (_, i) => h('i', { 'data-state': i < ui.step.n - 1 ? 'done' : i === ui.step.n - 1 ? 'now' : 'todo' })))) : null;
  const stepCard = ui.step?.text ? h('p', { class: 'step-card', 'data-visual': String(!!ui.step.visual) }, ui.step.text) : null;
  // Task Buddy walk-through: steps appear one by one as Buddy says them. The current one is large; earlier ones stay
  // above it, smaller. When Buddy has finished, all of them show together until "I'm ready".
  const shownSteps = ui.stepList ? ui.stepList.filter((_, i) => P.walkReveal == null || i <= P.walkReveal) : [];
  const stepList = shownSteps.length ? h('ol', { class: 'step-list', 'aria-label': 'The steps', 'data-walk': String(P.nowStep != null) }, shownSteps.map((x, i) =>
    h('li', { 'data-now': String(P.nowStep === i), 'data-past': String(P.nowStep != null && i < P.nowStep) }, x.image ? h('img', { src: x.image, alt: '' }) : null, h('span', {}, x.text)))) : null;
  mountKeep(
    h('div', { class: 'p-top' }, h('p', { class: 'p-title' }, P.title), h('button', { class: 'btn', onclick: finishPractice }, icon('stop'), 'Finish')),
    stepBar,
    // Task Buddy without a picture to show: no empty picture area, so the steps and Buddy's words sit higher up.
    stage || P.mode !== 'steps' ? h('div', { class: 'stage', 'data-visual': String(!!ui.step?.visual) }, stage) : null,
    stepCard,
    stepList,
    board,
    bubble,
    P.thinking ? h('p', { class: 'thinking' }, 'Thinking time. Press to talk whenever you are ready.') : null,
    cue,
    confirmBox,
    talk,
    controls,
    P.help ? helpSheet() : null,
    turn.ui.paused ? h('div', { class: 'pause' }, h('div', {}, h('p', {}, 'Take all the time you need.'), h('button', { class: 'btn btn-primary', onclick: () => sendControl('ready') }, 'I\u2019m ready'))) : null,
  );
  // Keep the newest thing in view: the step Buddy is reading (Task Buddy walk-through), otherwise what Buddy just
  // said and the talk button. Only scrolls when it is off screen.
  const now = $app.querySelector('.step-list li[data-now="true"]');
  if (now) now.scrollIntoView({ block: 'center', behavior: smooth() });
  else if (P.speaking || P.thinking || P.talk === 'idle') (talk || bubble)?.scrollIntoView({ block: 'nearest', behavior: smooth() });
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
  const done = () => { if (gen === playGen && P) { P.speaking = false; P.nowStep = null; P.walkReveal = null; drawPractice(); } };
  for (const l of lines) {
    if (gen !== playGen) return;
    P.shown.push(l); P.thinking = false; P.speaking = true;
    if (l.step != null) { P.nowStep = l.step; P.walkReveal = l.step; } else if (P.walkReveal != null && P.walkReveal >= 0) P.nowStep = null;
    drawPractice();
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
      // Thinking time is Sam's: he can press to talk as soon as he is ready.
      P.speaking = false; P.thinking = true; drawPractice();
      await wait(l.pauseAfter * 1000, gen);
      if (P) P.thinking = false;
    }
  }
  done();
}
function wait(ms, gen) {
  return new Promise((res) => { const t = setInterval(() => { if (gen !== playGen) { clearInterval(t); res(); } }, 100); setTimeout(() => { clearInterval(t); res(); }, ms); });
}
function stopVoice() { playGen++; $voice.pause(); if (P) { P.thinking = false; P.speaking = false; } }

async function onTalk() {
  if (P.talk === 'idle') {
    stopVoice();
    try {
      const stream = await getMic();
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
// ------------------------------------------------------------ Listen Buddy on screen: shapes and boxes
const SHAPE_COLOURS = { red: '#d63c3c', blue: '#2f6fd6', green: '#2e9d57', yellow: '#f2c230', purple: '#8a4fd0', orange: '#ee8a2a' };
function shapeSvg(id) {
  const [colour, shape] = String(id).split('-');
  const f = SHAPE_COLOURS[colour] || '#888';
  const d = {
    circle: '<circle cx="24" cy="24" r="18"/>',
    square: '<rect x="7" y="7" width="34" height="34" rx="4"/>',
    triangle: '<path d="M24 5 L43 40 H5 Z"/>',
    star: '<path d="M24 4l5.9 12.6 13.7 1.6-10.1 9.4 2.7 13.6L24 34.4l-12.2 6.8 2.7-13.6L4.4 18.2l13.7-1.6z"/>',
    heart: '<path d="M24 42S6 31 6 18a9 9 0 0 1 18-3 9 9 0 0 1 18 3c0 13-18 24-18 24z"/>',
  }[shape] || '<circle cx="24" cy="24" r="18"/>';
  const el = document.createElement('span');
  el.className = 'shape';
  el.innerHTML = `<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="${f}" stroke="rgba(0,0,0,.35)" stroke-width="1.5">${d}</g></svg>`;
  return el;
}
// A token is one of Buddy's shapes, or an everyday object picture (Mulberry Symbols) when the server sends `img`.
function tokenEl(b, id) {
  const t = b.tokens.find((x) => x.id === id);
  if (!t?.img) return shapeSvg(id);
  return h('span', { class: 'shape obj' }, h('img', { src: t.img, alt: '' }));
}
function drawBoard(b, locked) {
  const at = {};
  for (const [tok, p] of Object.entries(b.pos || {})) if (p != null) at[p] = tok;
  const name = (id) => b.tokens.find((t) => t.id === id)?.name || id;
  const boxes = h('div', { class: 'boxes' }, Array.from({ length: b.boxes }, (_, i) => {
    const tok = at[i];
    return h('button', {
      class: 'box', 'data-highlight': String(b.highlight === i), 'data-selected': String(!!tok && tok === b.selected), disabled: locked,
      'aria-label': tok ? `Box ${i + 1}, ${name(tok)}` : `Box ${i + 1}, empty`,
      onclick: () => (b.selected && b.selected !== tok ? sendAct({ type: 'box', box: i }) : tok ? sendAct({ type: 'token', token: tok }) : sendAct({ type: 'box', box: i })),
    }, h('span', { class: 'box-num' }, String(i + 1)), tok ? tokenEl(b, tok) : null);
  }));
  const tray = h('div', { class: 'tray', 'aria-label': b.tokens.some((t) => t.img) ? 'Pictures' : 'Shapes' }, b.tokens.filter((t) => b.pos?.[t.id] == null).map((t) =>
    h('button', { class: 'token', 'data-selected': String(b.selected === t.id), disabled: locked, 'aria-label': t.name, 'aria-pressed': String(b.selected === t.id), onclick: () => sendAct({ type: 'token', token: t.id }) }, tokenEl(b, t.id))));
  return h('div', { class: 'board' },
    b.showStep ? h('p', { class: 'show-step' }, b.showStep) : null,
    boxes, tray);
}
async function sendAct(a) {
  if (!P || P.talk === 'busy') return;
  try { applyTurn(await api(`/practice/${P.id}/act`, { method: 'POST', body: a })); } catch (e) { toast(e.message); }
}

// A turn that reads steps out one by one starts with none of them on screen (-1); otherwise show the whole list.
function walkStart(t) { return t.lines.some((l) => l.step != null) ? -1 : null; }

function applyTurn(t) {
  P.turn = t; P.talk = 'idle';
  if (t.lines.length) { P.shown = []; P.nowStep = null; P.walkReveal = walkStart(t); }
  drawPractice();
  playLines(t.lines).then(() => { if (t.done && P?.id === t.sessionId) renderDone(t); });
}

async function finishPractice() {
  stopVoice();
  if (rec) { rec.recorder.stop(); rec = null; }
  closeMic();
  try { await api(`/practice/${P.id}/finish`, { method: 'POST' }); } catch {}
  renderDone(null);
}

function renderDone(t) {
  closeMic();
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
  memory: S('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7.5V12l3 2"/>'),
  explain: S('<path d="M4 4h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H10l-5 4v-4H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M7.5 8.5h9M7.5 12h6"/>'),
  ear: S('<path d="M7 9a5.5 5.5 0 0 1 11 0c0 3.2-3 4.2-3 7.5a3 3 0 0 1-5.5 1.6"/><path d="M10.5 9.5a2 2 0 0 1 4 0c0 1.6-2 2.2-2 3.8"/>'),
  listen: S('<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="5" height="7" rx="2"/><rect x="16" y="14" width="5" height="7" rx="2"/>'),
  play: S('<path d="M7 4.5v15l12-7.5z"/>'),
  steps: S('<path d="M10 6h10M10 12h10M10 18h10"/><path d="M3.5 6l1.5 1.5L7.5 5M3.5 12l1.5 1.5 2.5-2.5M3.5 18l1.5 1.5 2.5-2.5"/>'),
  done: S('<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 10"/>'),
  speaker: S('<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
  wait: S('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
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
// The fox stays for about two seconds when the app opens (a little less with Reduce Motion), or until tapped,
// then fades to the first screen. Only on opening the app, not when coming back to home.
const launch = document.getElementById('launch');
function hideLaunch() {
  if (!launch?.isConnected) return;
  launch.style.opacity = '0';
  setTimeout(() => launch.remove(), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 400);
}
launch?.addEventListener('click', hideLaunch);
const launchFor = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1200 : 2200;
Promise.all([boot().catch(() => {}), new Promise((r) => setTimeout(r, Math.max(0, launchFor - performance.now())))]).then(hideLaunch);

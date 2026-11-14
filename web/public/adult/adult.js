// Buddy — support-team area (parents, speech therapist, teachers, job coach).
const $app = document.getElementById('app');
const TOKEN_KEY = 'buddy.adult';
// "Keep me signed in on this device" keeps the sign-in in localStorage (30 days); otherwise it lasts until the tab closes.
const store = (kind) => { try { return kind === 'local' ? localStorage : sessionStorage; } catch { return null; } };
const readToken = () => store('local')?.getItem(TOKEN_KEY) || store('session')?.getItem(TOKEN_KEY) || null;
const remembered = () => !!store('local')?.getItem(TOKEN_KEY);
function saveToken(t, remember = remembered()) {
  token = t;
  store(remember ? 'local' : 'session')?.setItem(TOKEN_KEY, t);
  store(remember ? 'session' : 'local')?.removeItem(TOKEN_KEY);
}
function signOut() {
  token = null;
  store('local')?.removeItem(TOKEN_KEY);
  store('session')?.removeItem(TOKEN_KEY);
  boot();
}
let token = readToken();
let me = null;
let modes = null;
let goals = null;   // { goals: {key: {n,label,short,target,cue,allowed}}, codes: {I,M,P,F} }
let tab = 'activities';

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
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
// A group of controls (e.g. the picture picker) sits in a <div>, so a click on the label doesn't open the file chooser.
const field = (label, input, hint) => h(input?.dataset?.group ? 'div' : 'label', { class: 'field' }, h('span', {}, label), input?.type === 'password' ? withEye(input) : input, hint ? h('small', { class: 'muted' }, hint) : null);
// Every password box gets an eye button to show or hide what was typed.
const EYE = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6C3.9 8.3 2 12 2 12s3.6 7 10 7a10 10 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
function withEye(input) {
  const btn = h('button', { type: 'button', class: 'pw-eye', 'aria-label': 'Show password', 'aria-pressed': 'false' });
  btn.innerHTML = EYE; // trusted constant
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.innerHTML = show ? EYE_OFF : EYE; // trusted constants
    btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    btn.setAttribute('aria-pressed', String(show));
    input.focus();
  });
  return h('span', { class: 'pw-wrap' }, input, btn);
}
const toast = (msg) => { const t = h('div', { class: 'toast', role: 'status' }, msg); document.body.append(t); setTimeout(() => t.remove(), 4000); };
const list = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
const lines = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
const fmt = (d) => new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
// Download names use the child's name, e.g. "maya-buddy-weekly-record.csv".
const fileName = () => `${String(me.learner.name || 'learner').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'learner'}-buddy`;
const ROLE = { parent: 'Parent', therapist: 'Speech therapist', teacher: 'Teacher', job_coach: 'Job coach' };

async function api(path, { method = 'GET', body, form } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    body: form || (body ? JSON.stringify(body) : undefined),
  });
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (res.status === 401 && path.startsWith('/adult/') && path !== '/adult/login') { signOut(); throw new Error(data?.error); }
  if (!res.ok) throw new Error(data?.error || 'Something went wrong. Try again.');
  return data;
}
const run = (fn) => async (...a) => { try { await fn(...a); } catch (e) { if (e.message) toast(e.message); } };

// ------------------------------------------------------------ sign in / setup
async function boot() {
  // Password reset link from the email: /adult/#reset=<token> (kept out of the address bar once read).
  const reset = location.hash.match(/^#reset=([\w-]+)$/)?.[1];
  if (reset) { history.replaceState(null, '', location.pathname + location.search); return renderReset(reset); }
  const invite = new URLSearchParams(location.search).get('invite');
  if (invite && !token) return renderInvite(invite);
  if (!token) {
    const { needsSetup } = await api('/setup/status');
    return needsSetup ? renderSetup() : renderLogin();
  }
  try {
    me = await api('/adult/me');
  } catch (e) {
    return $app.replaceChildren(brand(), h('h1', {}, 'Buddy'), h('p', { class: 'panel' }, e.message),
      h('button', { class: 'btn btn-quiet', onclick: signOut }, 'Sign out'));
  }
  modes = modes || await api('/adult/modes');
  goals = goals || await api('/adult/goals');
  renderShell();
}

function renderLogin() {
  const email = h('input', { type: 'email', autocomplete: 'username' });
  const pw = h('input', { type: 'password', autocomplete: 'current-password' });
  const keep = h('input', { type: 'checkbox', checked: true });
  const go = run(async () => { const r = await api('/adult/login', { method: 'POST', body: { email: email.value, password: pw.value, remember: keep.checked } }); saveToken(r.token, keep.checked); boot(); });
  pw.addEventListener('keydown', (e) => e.key === 'Enter' && go());
  $app.replaceChildren(brand(), h('h1', {}, 'Support team sign in'), h('div', { class: 'panel', style: 'max-width:420px;display:grid;gap:18px' }, field('Email', email), field('Password', pw),
    h('label', { class: 'switch' }, keep, h('span', {}, 'Keep me signed in on this device', h('br'), h('small', { class: 'muted' }, 'For 30 days. Untick on a shared computer.'))),
    h('button', { class: 'btn btn-primary', onclick: go }, 'Sign in'),
    h('button', { class: 'btn btn-quiet', type: 'button', onclick: () => renderForgot(email.value) }, 'Forgot your password?')));
}

// Forgot password: send a link by email. The reply is the same whether or not the address has an account.
function renderForgot(prefill = '') {
  const email = h('input', { type: 'email', autocomplete: 'username', value: prefill });
  const msg = h('div', { role: 'status' });
  const send = h('button', { class: 'btn btn-primary' }, 'Send me a link');
  const go = run(async () => {
    if (!/\S+@\S+\.\S+/.test(email.value)) throw new Error('Enter the email address you sign in with.');
    send.disabled = true;
    try {
      const r = await api('/adult/forgot', { method: 'POST', body: { email: email.value } });
      msg.replaceChildren(h('p', { class: 'panel' }, r.ok
        ? `If ${email.value.trim()} belongs to a Buddy team member, we\u2019ve sent a link to choose a new password. It works for an hour. Check your junk folder if it doesn\u2019t arrive in a few minutes.`
        : r.error));
    } finally { send.disabled = false; }
  });
  send.addEventListener('click', go);
  email.addEventListener('keydown', (e) => e.key === 'Enter' && go());
  $app.replaceChildren(brand(), h('h1', {}, 'Forgot your password?'),
    h('div', { class: 'panel', style: 'max-width:420px;display:grid;gap:18px' },
      h('p', { style: 'margin:0' }, 'Enter the email you sign in with and we\u2019ll send you a link to choose a new password.'),
      field('Email', email), send, msg,
      h('button', { class: 'btn btn-quiet', type: 'button', onclick: renderLogin }, 'Back to sign in')));
}

function renderReset(resetToken) {
  const pw = h('input', { type: 'password', autocomplete: 'new-password' });
  const pw2 = h('input', { type: 'password', autocomplete: 'new-password' });
  const go = run(async () => {
    if (pw.value.length < 10) throw new Error('New passwords need at least 10 characters.');
    if (pw.value !== pw2.value) throw new Error('The two passwords don\u2019t match.');
    const r = await api('/adult/reset', { method: 'POST', body: { token: resetToken, password: pw.value } });
    signOut(); // clears any old sign-in on this device, then shows sign in
    toast('Password changed. Sign in with your new password.');
    const box = document.querySelector('input[type=email]');
    if (box && r.email) box.value = r.email;
  });
  pw2.addEventListener('keydown', (e) => e.key === 'Enter' && go());
  $app.replaceChildren(brand(), h('h1', {}, 'Choose a new password'),
    h('div', { class: 'panel', style: 'max-width:420px;display:grid;gap:18px' },
      field('New password', pw, 'At least 10 characters.'), field('New password again', pw2),
      h('button', { class: 'btn btn-primary', onclick: go }, 'Save new password'),
      h('small', { class: 'muted' }, 'This signs you out on your other devices.')));
}

function renderSetup() {
  const f = { setupToken: h('input'), learnerName: h('input'), ownerName: h('input'), email: h('input', { type: 'email' }), password: h('input', { type: 'password' }) };
  $app.replaceChildren(
    brand(), h('h1', {}, 'Set up Buddy'),
    h('p', { class: 'muted' }, 'This creates the main parent account. You can add the speech therapist, teachers and job coach afterwards.'),
    h('div', { class: 'panel', style: 'max-width:460px;display:grid;gap:18px' },
      field('Setup code', f.setupToken, 'The SETUP_TOKEN value from the server settings.'),
      field("Learner's first name", f.learnerName), field('Your name', f.ownerName), field('Your email', f.email), field('Password (10+ characters)', f.password),
      h('button', { class: 'btn btn-primary', onclick: run(async () => {
        const r = await api('/setup', { method: 'POST', body: Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.value])) });
        saveToken(r.token, false); boot();
      }) }, 'Create account')));
}

// ------------------------------------------------------------ joining by invite (a new family)
async function renderInvite(inviteToken) {
  const { valid } = await api(`/invite/${encodeURIComponent(inviteToken)}`);
  const toSignIn = () => { history.replaceState(null, '', '/adult/'); boot(); };
  if (!valid) {
    return $app.replaceChildren(brand(), h('h1', {}, 'This invite has expired'),
      h('p', { class: 'panel' }, 'The link has already been used or is more than 14 days old. Ask the person who sent it for a new one.'),
      h('button', { class: 'btn', onclick: toSignIn }, 'I already have an account'));
  }
  const f = {
    learnerName: h('input', { autocomplete: 'off' }), birthYear: h('input', { type: 'number', inputmode: 'numeric', min: '1990', max: String(new Date().getFullYear()), placeholder: 'e.g. 2011' }),
    ownerName: h('input', { autocomplete: 'name' }), email: h('input', { type: 'email', autocomplete: 'email' }), password: h('input', { type: 'password', autocomplete: 'new-password' }),
  };
  $app.replaceChildren(
    brand(), h('h1', {}, 'Welcome to Buddy'),
    h('p', { class: 'muted', style: 'max-width:60ch' }, 'Set up Buddy for your child. You\u2019ll have the main account, and can add their speech therapist, teachers and job coach afterwards.'),
    h('div', { class: 'panel', style: 'max-width:460px;display:grid;gap:18px' },
      field('Your child\u2019s first name', f.learnerName, 'Buddy uses it in the app, e.g. \u201cWelcome back, Alex!\u201d'),
      field('Year of birth (optional)', f.birthYear, 'Helps Buddy talk at the right level for their age.'),
      field('Your name', f.ownerName), field('Your email', f.email), field('Password (10+ characters)', f.password),
      h('button', { class: 'btn btn-primary', onclick: run(async () => {
        const r = await api(`/invite/${encodeURIComponent(inviteToken)}`, { method: 'POST', body: Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.value])) });
        saveToken(r.token, false);
        history.replaceState(null, '', '/adult/'); tab = 'team'; boot();
      }) }, 'Create our account')),
    h('button', { class: 'btn btn-quiet', onclick: toSignIn }, 'I already have an account'));
}

// ------------------------------------------------------------ the team app on a phone or computer
// Installing as "Buddy Team" (its own icon, separate from the learner's Buddy), and a notice when offline.
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
const INSTALL_HIDDEN = 'buddy.team.install-hidden';
let installPrompt = null;
// The browser may offer installing after the page has drawn: add the banner in place (never redraw, which would lose edits).
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); installPrompt = e;
  const nav = document.querySelector('nav.tabs');
  if (nav && !document.querySelector('.install-help')) { const b = installHelp(); if (b) nav.before(b); }
});
addEventListener('appinstalled', () => { installPrompt = null; document.querySelector('.install-help')?.remove(); });
const SHARE_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-4px"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
function installHelp() {
  let hidden = false;
  try { hidden = localStorage.getItem(INSTALL_HIDDEN) === '1'; } catch { /* no storage: just show it */ }
  if (isStandalone() || hidden || (!isIOS() && !installPrompt)) return null;
  const box = h('div', { class: 'install-help team-install' });
  const hide = h('button', { class: 'btn btn-quiet', onclick: () => { try { localStorage.setItem(INSTALL_HIDDEN, '1'); } catch { /* ignore */ } box.remove(); } }, 'Not now');
  box.append(h('strong', {}, 'Add Buddy Team to your home screen'));
  if (isIOS()) {
    const p = h('p', {}, 'Open this page in Safari, tap the Share button ');
    p.insertAdjacentHTML('beforeend', SHARE_ICON);
    p.append(', then \u201cAdd to Home Screen\u201d. It gets its own navy icon, separate from the learner\u2019s Buddy.');
    box.append(p, h('div', { class: 'row-actions' }, hide));
  } else {
    box.append(h('p', {}, 'Open the team area straight from its own icon, like an app.'), h('div', { class: 'row-actions' },
      h('button', { class: 'btn', onclick: async () => {
        installPrompt.prompt(); const r = await installPrompt.userChoice; installPrompt = null;
        if (r.outcome === 'accepted') box.remove();
      } }, 'Install Buddy Team'), hide));
  }
  return box;
}
function offlineNotice(on) {
  document.getElementById('offline')?.remove();
  if (on) document.body.append(h('div', { id: 'offline', class: 'toast', role: 'alert' }, 'You\u2019re offline. Changes can\u2019t be saved until the internet is back.'));
}
addEventListener('offline', () => offlineNotice(true));
addEventListener('online', () => offlineNotice(false));
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
// A reset link opened while the team app is already showing in this tab.
addEventListener('hashchange', () => { if (/^#reset=/.test(location.hash)) boot(); });

// ------------------------------------------------------------ shell
const TABS = [['activities', 'Activities'], ['plan', 'Practice plan'], ['review', 'Review practice'], ['notes', 'Observations'], ['team', 'Team & privacy']];
const tabsFor = () => (me.admin ? [...TABS, ['families', 'Families']] : TABS);
function renderShell() {
  const body = h('div', {});
  // Sections that don't apply (e.g. owner-only panels) come through as null: skip them rather than print "null".
  body.append = (...kids) => HTMLElement.prototype.append.apply(body, kids.filter((k) => k != null && k !== false));
  $app.replaceChildren(
    h('header', { class: 'adult-head' },
      h('div', {}, h('h1', {}, brand(me.learner.name)), h('span', { class: 'muted' }, `${me.adult.name} · ${ROLE[me.adult.role]}`)),
      h('button', { class: 'btn btn-quiet', onclick: signOut }, 'Sign out')),
    ...[installHelp()].filter(Boolean),
    h('nav', { class: 'tabs', role: 'tablist' }, tabsFor().map(([k, l]) => h('button', { role: 'tab', 'aria-selected': String(tab === k), onclick: () => { tab = k; renderShell(); } }, l))),
    body,
    h('p', { class: 'muted credits' }, SYMBOL_CREDIT, ' \u00B7 ', h('a', { href: 'https://creativecommons.org/licenses/by-sa/4.0/', target: '_blank', rel: 'noopener' }, 'Licence')),
  );
  if (!me.voice) body.append(h('p', { class: 'panel' }, `Voice is not connected yet (ELEVENLABS_API_KEY). ${me.learner.name} can still practise by typing.`));
  ({ plan: renderPlan, activities: renderActivities, review: renderReview, notes: renderNotes, team: renderTeam, families: renderFamilies })[tab](body).catch((e) => toast(e.message));
}

// ------------------------------------------------------------ practice plan + settings
async function renderPlan(root) {
  const [{ settings, current_activity_id }, acts] = await Promise.all([api('/adult/settings'), api('/adult/activities')]);
  const current = h('select', {}, h('option', { value: '' }, '— none —'), acts.filter((a) => a.status === 'active').map((a) => h('option', { value: a.id, selected: a.id === current_activity_id }, `${modeName(a.mode)} \u2014 ${a.title}`)));
  const num = (k, min, max, step = 1) => h('input', { type: 'number', min, max, step, value: settings[k] });
  const chk = (k) => h('input', { type: 'checkbox', checked: !!settings[k] });
  const f = {
    think_seconds: num('think_seconds', 2, 60), speech_speed: num('speech_speed', 0.7, 1.2, 0.05), session_minutes: num('session_minutes', 3, 60),
    max_attempts: num('max_attempts', 2, 10), turns_per_topic: num('turns_per_topic', 1, 10),
    fade_support: chk('fade_support'), cue_cards: chk('cue_cards'), captions: chk('captions'), explain_buttons: chk('explain_buttons'),
    voice_id: h('input', { value: settings.voice_id || '', placeholder: 'Default voice' }),
    reminder_time: h('input', { type: 'time', value: settings.reminder_time || '' }),
  };
  const interests = h('textarea', { rows: 3, placeholder: 'e.g. drumming, marching band, gym, Disney, paper characters' }, (settings.interests || []).join(', '));
  const modeBoxes = Object.keys(modes).map((m) => h('label', { class: 'switch' }, h('input', { type: 'checkbox', value: m, checked: settings.enabled_modes.includes(m) }), h('span', {}, h('strong', {}, modes[m].label), h('br'), h('small', { class: 'muted' }, modes[m].activityName))));
  root.append(
    h('h2', {}, 'Start My Practice'),
    h('div', { class: 'panel' }, field(`When ${me.learner.name} presses Start My Practice, open:`, current, `Pick one activity so ${me.learner.name} has fewer decisions to make.`)),
    h('h2', {}, `Interests and activities`),
    h('div', { class: 'panel' }, field(`What does ${me.learner.name} enjoy or do?`, interests,
      `Separate with commas: hobbies, clubs, sports, favourite films, characters or music. Buddy uses these to make conversations about things ${me.learner.name} cares about, and they appear as topic suggestions when you add a Chat Buddy topic. They are sent to the AI that writes Buddy\u2019s replies, so leave out anything private.`)),
    h('h2', {}, `Buddy modules ${me.learner.name} can see`),
    h('div', { class: 'panel grid2' }, modeBoxes),
    h('h2', {}, 'Buddy\u2019s voice'),
    voicePicker(f.voice_id),
    h('h2', {}, 'Pace and support'),
    h('div', { class: 'panel grid2' },
      field('Thinking time after "Make a movie in your mind" (seconds)', f.think_seconds),
      field('Speech speed (0.7 slower – 1.2 faster)', f.speech_speed),
      field('Session length (minutes, checked between items)', f.session_minutes),
      field('Attempts per item before Buddy moves on', f.max_attempts),
      field('Conversation turns per topic', f.turns_per_topic),
      field('Practice reminder time', f.reminder_time, `${me.learner.name}'s iPad or phone shows a reminder at this time on days they haven't practised. Leave blank for none. ${me.learner.name} turns reminders on in My settings.`),
      h('label', { class: 'switch' }, f.fade_support, 'Reduce support on later items'),
      h('label', { class: 'switch' }, f.cue_cards, 'Show visual cue cards'),
      h('label', { class: 'switch' }, f.captions, 'Show captions'),
      h('label', { class: 'switch' }, f.explain_buttons, 'Explain the four buttons (Repeat, Help me, Let me think, Try again) at the start of each practice'),
    ),
    h('button', { class: 'btn btn-primary', onclick: run(async () => {
      const s = {};
      for (const [k, el] of Object.entries(f)) s[k] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : (el.value || null);
      s.reminder_time = f.reminder_time.value || '';
      s.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      s.interests = interests.value;
      s.enabled_modes = modeBoxes.map((b) => b.querySelector('input')).filter((i) => i.checked).map((i) => i.value);
      await api('/adult/settings', { method: 'PUT', body: { settings: s, current_activity_id: current.value } });
      me = await api('/adult/me');
      interests.value = (me.learner.settings.interests || []).join(', ');
      toast('Practice plan saved.');
    }) }, 'Save practice plan'),
  );
}

// Voice picker: listen to each voice saying a typical Buddy line, then choose one. No ElevenLabs account needed.
function voicePicker(idInput) {
  const box = h('div', { class: 'panel voice-picker' });
  box.replaceChildren = (...kids) => Element.prototype.replaceChildren.apply(box, kids.filter((k) => k != null && k !== false));
  let player = null;
  const stopPlayer = () => { if (player) { player.pause(); player = null; } };
  async function load() {
    box.replaceChildren(h('p', { class: 'muted' }, 'Loading voices\u2026'));
    let data;
    try { data = await api('/adult/voices'); } catch (e) { box.replaceChildren(h('p', {}, e.message)); return; }
    const chosen = () => idInput.value || data.current || data.defaultId;
    const draw = () => {
      const cur = data.voices.find((v) => v.id === chosen());
      box.replaceChildren(
        data.fallback ? h('p', { class: 'muted', style: 'margin-top:0' }, 'Showing ElevenLabs\u2019 standard voices. To list every voice on the account, give the ElevenLabs API key the \u201cVoices: Read\u201d permission.') : null,
        h('p', { style: 'margin-top:0' }, 'Current voice: ', h('strong', {}, cur ? cur.name : 'Default voice'),
          '. Press ', h('strong', {}, 'Listen'), ' to hear each voice say a typical Buddy line, then ', h('strong', {}, 'Use this voice'), `. It\u2019s a good choice to make with ${me.learner.name}.`),
        h('ul', { class: 'voice-list' }, data.voices.map((v) => {
          const on = v.id === chosen();
          const listen = h('button', { class: 'btn', onclick: run(async () => {
            stopPlayer();
            listen.disabled = true; listen.textContent = 'Loading\u2026';
            try {
              const r = await fetch(`/api/adult/voices/${v.id}/sample`, { headers: { authorization: `Bearer ${token}` } });
              if (!r.ok) throw new Error('Could not play this voice.');
              player = new Audio(URL.createObjectURL(await r.blob()));
              await player.play();
            } finally { listen.disabled = false; listen.textContent = '\u25B6 Listen'; }
          }) }, '\u25B6 Listen');
          return h('li', { 'aria-current': on ? 'true' : null },
            h('div', {}, h('strong', {}, v.name), on ? h('span', { class: 'tag', style: 'margin-left:8px' }, 'In use') : null,
              h('div', { class: 'muted' }, [v.gender, v.age, v.accent, v.description].filter(Boolean).join(' \u00B7 '))),
            h('div', { class: 'row-actions' }, listen,
              on ? null : h('button', { class: 'btn btn-primary', onclick: run(async () => {
                await api('/adult/settings', { method: 'PUT', body: { settings: { voice_id: v.id } } });
                idInput.value = v.id; data.current = v.id; stopPlayer(); draw();
                toast(`Buddy now speaks with ${v.name}\u2019s voice.`);
              }) }, 'Use this voice')));
        })),
        h('details', {}, h('summary', {}, 'Voice ID (advanced)'), field('ElevenLabs voice ID', idInput, 'Only needed for a voice not listed here. Press Save practice plan after changing it.')),
      );
    };
    draw();
  }
  box.append(h('button', { class: 'btn', onclick: run(load) }, 'Choose Buddy\u2019s voice'));
  return box;
}

// ------------------------------------------------------------ activities
// The Buddy modules, in the order the learner sees them on their home screen, with the same icons and colours.
const MODULES = {
  memory: { label: 'Memory Buddy', tagline: 'Remember and recall', icon: 'memory', modes: ['recall', 'listen'] },
  story: { label: 'Story Buddy', tagline: 'Organise my thoughts', icon: 'story', modes: ['story'] },
  explain: { label: 'Explain Buddy', tagline: 'Say it clearly', icon: 'explain', modes: ['explain', 'object'] },
  think: { label: 'Think Buddy', tagline: 'Solve the problem', icon: 'think', modes: ['think'] },
  conversation: { label: 'Chat Buddy', tagline: 'Keep the conversation going', icon: 'chat', modes: ['conversation'] },
  task: { label: 'Listen Buddy', tagline: 'Follow instructions', icon: 'ear', modes: ['follow', 'task'] },
  steps: { label: 'Task Buddy', tagline: 'Do it step by step', icon: 'steps', modes: ['steps'] },
};
const moduleOf = (mode) => Object.keys(MODULES).find((k) => MODULES[k].modes.includes(mode));
const SV = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const MODULE_ICONS = {
  memory: SV('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7.5V12l3 2"/>'),
  story: SV('<path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2V5z"/><path d="M4 19a2 2 0 0 1 2-2h12M9 7h5M9 11h5"/>'),
  explain: SV('<path d="M4 4h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H10l-5 4v-4H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M7.5 8.5h9M7.5 12h6"/>'),
  think: SV('<path d="M12 3a6 6 0 0 0-3.5 10.9V17h7v-3.1A6 6 0 0 0 12 3zM9.5 20h5"/>'),
  chat: SV('<path d="M4 5h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><path d="M19 9h1a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1v3l-3-3h-3"/>'),
  steps: SV('<path d="M10 6h10M10 12h10M10 18h10"/><path d="M3.5 6l1.5 1.5L7.5 5M3.5 12l1.5 1.5 2.5-2.5M3.5 18l1.5 1.5 2.5-2.5"/>'),
  ear: SV('<path d="M7 9a5.5 5.5 0 0 1 11 0c0 3.2-3 4.2-3 7.5a3 3 0 0 1-5.5 1.6"/><path d="M10.5 9.5a2 2 0 0 1 4 0c0 1.6-2 2.2-2 3.8"/>'),
};
function moduleIcon(mod) {
  const el = h('span', { class: 'card-icon' });
  el.innerHTML = MODULE_ICONS[MODULES[mod].icon]; // trusted constant
  return el;
}
const blankItem = (m) => (m === 'listen' ? blankStory() : m === 'recall' ? blankRecall() : m === 'explain' ? blankExplain() : m === 'follow' ? blankFollow() : m === 'steps' ? blankSteps() : {});
const newActivity = (m) => ({ mode: m, title: '', goal: modes[m].defaultGoal, plan_goal: DEFAULT_GOAL[m], status: 'active', content: { items: [blankItem(m)] }, image_urls: {} });
const ITEM_WORDS = { conversation: ['topic', 'topics'], listen: ['story', 'stories'], story: ['story', 'stories'], think: ['situation', 'situations'], recall: ['practice', 'practices'], explain: ['explanation', 'explanations'], follow: ['instruction', 'instructions'], task: ['task', 'tasks'], object: ['picture', 'pictures'], steps: ['task', 'tasks'] };
const itemWord = (mode, n) => (ITEM_WORDS[mode] || ['item', 'items'])[n === 1 ? 0 : 1];

// "today", "yesterday", "3 days ago", or a date for anything older than a week.
function whenUsed(iso) {
  const d = new Date(iso);
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

// Every tile has the same "+ New activity" button. Tiles with two kinds of practice then ask which kind.
const KIND_BLURB = {
  recall: 'Recall real things they did, with clues and the family\u2019s photos.',
  listen: 'Buddy reads a short story, then asks questions about it.',
  explain: 'Explain how to do something everyday, step by step.',
  object: 'Name a picture, say its group and what it\u2019s used for.',
  follow: 'Follow spoken instructions by moving pictures on screen.',
  task: 'Talk through the steps of a real task, such as making a drink.',
};
function addActivity(root, M) {
  const start = (m) => editActivity(root, newActivity(m));
  if (M.modes.length === 1) return h('div', { class: 'row-actions mod-add' }, h('button', { class: 'btn', onclick: () => start(M.modes[0]) }, '+ New activity'));
  const choose = h('div', { class: 'kind-choice', hidden: true, role: 'group', 'aria-label': `What kind of ${M.label} activity?` },
    h('p', { class: 'kind-q' }, 'What kind of activity?'),
    ...M.modes.map((m) => h('button', { class: 'kind-opt', type: 'button', onclick: () => start(m) },
      h('strong', {}, modes[m].activityName), h('small', {}, KIND_BLURB[m] || ''))),
    h('button', { class: 'btn btn-quiet', type: 'button', onclick: () => { choose.hidden = true; add.hidden = false; } }, 'Cancel'));
  const add = h('button', { class: 'btn', 'aria-expanded': 'false', onclick: () => { add.hidden = true; choose.hidden = false; choose.querySelector('.kind-opt').focus(); } }, '+ New activity');
  return h('div', { class: 'mod-add' }, h('div', { class: 'row-actions' }, add), choose);
}

async function renderActivities(root) {
  const acts = await api('/adult/activities');
  const name = me.learner.name;
  const enabled = me.learner.settings?.enabled_modes || Object.keys(modes);
  const cards = Object.entries(MODULES).map(([mod, M]) => {
    const two = M.modes.length > 1;
    // Recently used first (by when the learner last practised it), then the rest by last edit.
    const mine = acts.filter((a) => M.modes.includes(a.mode)).sort((x, y) =>
      (y.last_practised_at ? Date.parse(y.last_practised_at) : 0) - (x.last_practised_at ? Date.parse(x.last_practised_at) : 0)
      || Date.parse(y.updated_at || 0) - Date.parse(x.updated_at || 0));
    const hidden = !M.modes.some((m) => enabled.includes(m));
    const row = (a) => {
      const n = a.content.items.length;
      const bits = [
        two ? modes[a.mode].activityName : null,
        `${n} ${itemWord(a.mode, n)}`,
        a.status === 'draft' ? 'draft, not shown yet' : null,
        a.last_practised_at ? `used ${whenUsed(a.last_practised_at)}` : 'not used yet',
        a.mode === 'recall' ? (a.content.items.every((it) => listStatus(it).fresh) ? 'list up to date' : 'list out of date') : null,
      ].filter(Boolean);
      return h('li', {},
        h('div', { class: 'mod-row' }, h('strong', {}, a.title || '(no title)'), ' ', (a.plan_goal || 'other') === 'other' ? null : goalPill(a.plan_goal),
          a.id === me.learner.current_activity_id ? h('span', { class: 'tag start-tag' }, 'Opens with Start') : null,
          h('br'), h('small', { class: 'muted' }, bits.join(' · '))),
        h('div', { class: 'row-actions' },
          h('button', { class: 'btn', onclick: () => editActivity(root, a) }, 'Edit'),
          h('button', { class: 'btn btn-quiet', 'aria-label': `Archive ${a.title}`, onclick: run(async () => {
            if (!confirm(`Archive "${a.title}"? ${name} won’t see it any more. Past practice records are kept.`)) return;
            await api(`/adult/activities/${a.id}`, { method: 'DELETE' }); renderShell();
          }) }, 'Archive')));
    };
    return h('section', { class: 'mod-card', 'data-module': mod },
      h('header', { class: 'mod-head' }, moduleIcon(mod), h('div', {}, h('h2', {}, M.label), h('small', { class: 'muted' }, M.tagline))),
      hidden ? h('p', { class: 'mod-note' }, `Hidden from ${name}. Turn it on in Practice plan → Buddy modules.`) : null,
      mine.length ? h('ul', { class: 'list' }, mine.map(row)) : h('p', { class: 'muted mod-empty' }, `Nothing here yet, so ${name}’s tile says “Not yet”.`),
      addActivity(root, M));
  });
  root.append(
    h('p', { class: 'muted', style: 'margin:16px 0 0' }, `The six tiles ${name} sees, in the same order. Each activity you add appears inside its tile.`),
    h('div', { class: 'mod-grid' }, cards),
  );
}

const CUE_NAMES = {
  object: { name: 'Name', category: 'Group', function: 'Use' },
  story: { who: 'Who', where: 'Where', event: 'Each event', ending: 'How it ended', order: 'Order', vocabulary: 'Target words' },
  task: { step: 'Each step', order: 'Order', clarify: 'Asking for clarification' },
  conversation: { turn: 'Comment', question: 'Follow-up question' },
  listen: {},
  think: { problem: 'Noticing the problem', action: 'What to do', reason: 'Why', backup: 'If that does not work' },
  recall: {}, // clues come from each memory the family enters
  follow: {}, // Buddy's supports are fixed: say it back → hear it again → see it → Buddy shows it
  explain: { point: 'Each part (the question, starter and model can also be set per part)' },
};
const LEVEL_NAMES = ['1. Reminder', '2. Specific cue', '3. Sentence starter', '4. Model'];

// The editor has three layers: the basics (always shown), "Fine-tune" inside each item (optional extras),
// and "For therapists" at the bottom (skill wording for records, cue ladders, what reviewers look at).
function editActivity(root, a) {
  const content = structuredClone(a.content || { items: [] });
  const urls = { ...(a.image_urls || {}) };
  const name = me.learner.name;
  const mod = moduleOf(a.mode);
  const title = h('input', { value: a.title, placeholder: titleExample(a.mode) });
  const goal = h('input', { value: a.goal });

  // Which plan goal this counts towards: set from the module, shown as one line with a "Change" link.
  const planGoal = h('select', {}, Object.entries(goals.goals).map(([k, g]) => h('option', { value: k, selected: (a.plan_goal || 'other') === k }, g.n < 5 ? `${g.n}. ${g.label}` : g.label)));
  const goalHint = h('div', { class: 'goal-hint' });
  const goalLine = h('p', { class: 'goal-line' });
  const goalPicker = h('div', { hidden: true }, field(`Which goal in ${name}’s communication plan does this practise?`, planGoal), goalHint);
  const drawGoal = () => {
    const k = planGoal.value;
    const g = goals.goals[k];
    goalLine.replaceChildren(
      k === 'other' ? h('span', {}, 'Practice only: not counted towards a plan goal. ') : h('span', {}, 'Counts towards plan goal ', h('strong', {}, `${g.n}. ${g.label}`), '. '),
      goalPicker.hidden ? h('button', { type: 'button', class: 'linkish', onclick: () => { goalPicker.hidden = false; drawGoal(); } }, 'Change') : null);
    goalHint.replaceChildren(...[
      h('p', {}, h('strong', {}, 'Target: '), g.target),
      g.cue ? h('p', {}, h('strong', {}, 'Team cue: '), g.cue) : null,
      !g.modes.includes(a.mode) ? h('p', { class: 'warn' }, `This goal is usually practised with ${g.modes.map((m) => modes[m].label).join(' or ')}.`) : null].filter(Boolean));
  };
  planGoal.addEventListener('change', drawGoal);
  drawGoal();

  const status = h('select', {}, h('option', { value: 'active', selected: a.status !== 'draft' }, `Ready: ${name} can see it`), h('option', { value: 'draft', selected: a.status === 'draft' }, 'Draft: hidden for now'));
  const reviewFocus = h('textarea', { rows: 2 }, content.review_focus || '');
  const practiseQ = h('input', { type: 'checkbox', checked: !!content.practise_questions });
  // Story Buddy: fade the First → Next → Then → Finally organiser as the learner gets more independent.
  // Memory Buddy (Listen to a Story): a clue straight after a wrong answer (off unless the team turns it on).
  const clueOnWrong = h('input', { type: 'checkbox', checked: content.clue_on_wrong === true });
  // Memory Buddy (Listen to a Story): how many more goes at the missed questions after the first round.
  const listenRetries = h('select', {},
    [['0', 'No retries'], ['1', 'Once'], ['2', 'Twice'], ['3', 'Three times']]
      .map(([v, l]) => h('option', { value: v, selected: String(content.listen_retries ?? 2) === v }, l)));
  const organiser = h('select', {},
    [['show', 'Show it from the start'], ['when_stuck', 'Only if they get stuck (after Buddy’s first cue)'], ['off', 'Don’t show it']]
      .map(([v, l]) => h('option', { value: v, selected: (content.organiser || 'show') === v }, l)));

  // Task Buddy: one skill per activity, Practice (Buddy says each step) or Independence (all on their own),
  // and whether Buddy asks at each step and for all the steps at the end.
  const SK = modes.steps?.skills || {};
  const stepSkill = h('select', {}, Object.entries(SK).map(([k, v]) => h('option', { value: k, selected: (content.skill || 'understanding') === k }, v.label)));
  const skillHint = h('small', { class: 'muted' });
  const drawSkillHint = () => { const k = SK[stepSkill.value]; if (k) skillHint.textContent = `${k.goal}. Buddy asks ${k.when === 'before' ? 'before' : 'after'} ${name} does each step, e.g. \u201c${k.question}\u201d`; };
  drawSkillHint();
  const stepRun = h('select', {},
    [['practice', 'Practice: Buddy says each step'], ['independence', 'Independence: do all the steps on their own']]
      .map(([v, l]) => h('option', { value: v, selected: (content.run || 'practice') === v }, l)));
  const askSteps = h('input', { type: 'checkbox', checked: content.ask_steps !== false });
  const askEnd = h('input', { type: 'checkbox', checked: content.ask_end !== false });

  const itemsBox = h('div', {});
  const ctx = () => ({ organiser: organiser.value, practise_questions: practiseQ.checked,
    ...(a.mode === 'steps' ? { skill: stepSkill.value, run: stepRun.value, ask_steps: askSteps.checked, ask_end: askEnd.checked } : {}) });
  const drawItems = () => itemsBox.replaceChildren(...content.items.map((it, i) => itemEditor(a.mode, it, i, urls, () => { content.items.splice(i, 1); drawItems(); }, ctx)));
  drawItems();
  // The step questions shown in each task follow the chosen skill, so redraw them when it changes.
  stepSkill.addEventListener('change', () => { drawSkillHint(); drawItems(); });
  stepRun.addEventListener('change', drawItems);

  // Cue ladders: prefilled with the defaults; saved only if changed.
  const cueInputs = {};
  const cueNames = Object.entries(CUE_NAMES[a.mode] || {});
  const cues = cueNames.length ? h('div', {},
    h('h3', {}, 'Cues Buddy gives'),
    h('p', { class: 'muted' }, `When ${name} leaves something out, Buddy gives one cue at a time for that one part, from 1 (lightest) to 4 (a full model). Words in {curly brackets} are filled in from the activity, so keep them as they are.`),
    cueNames.map(([key, label]) => {
      const current = content.cues?.[key] || modes[a.mode].defaultCues[key];
      cueInputs[key] = current.map((t) => h('input', { value: t }));
      return h('div', { class: 'panel' }, h('h4', { class: 'q-head' }, label), h('div', { class: 'ladder' }, cueInputs[key].flatMap((inp, i) => [h('label', {}, LEVEL_NAMES[i]), inp])));
    })) : null;

  const addLabel = { conversation: 'Add another topic', listen: 'Add another story', think: 'Add another situation', recall: 'Add another practice', explain: 'Add another explanation', follow: 'Add another instruction', task: 'Add another task', steps: 'Add another task', story: 'Add another story', object: 'Add another picture' }[a.mode] || 'Add another';
  root.replaceChildren(
    h('header', { class: 'edit-head', 'data-module': mod }, moduleIcon(mod),
      h('div', {}, h('h2', {}, `${a.id ? 'Edit' : 'New'}: ${modes[a.mode].label}`), h('small', { class: 'muted' }, modes[a.mode].activityName))),
    h('div', { class: 'panel' },
      h('div', { class: 'grid2' },
        field('Title', title, `${name} sees this on the ${modes[a.mode].label} tile.`),
        field('Status', status),
        a.mode === 'conversation' ? h('label', { class: 'switch' }, practiseQ, 'Also practise asking follow-up questions') : null,
        a.mode === 'listen' ? h('label', { class: 'switch' }, clueOnWrong, h('span', {}, 'Give a clue straight after a wrong answer',
          h('br'), h('small', { class: 'muted' }, `${name} hears the question\u2019s clue and has one more try, instead of waiting for the end. Counts as support. Check with ${name}\u2019s speech therapist before turning on.`))) : null,
        a.mode === 'listen' ? field('Retries at the missed questions', listenRetries, `After the questions, Buddy offers ${name} another go at the ones they missed: with the story read again, or straight to the questions.`) : null,
        a.mode === 'steps' ? h('div', { class: 'field' }, field('Skill to practise', stepSkill), skillHint) : null,
        a.mode === 'steps' ? field('How Buddy runs it', stepRun, `Start with Practice. In Independence, ${name} can press Help to see all the steps.`) : null,
        a.mode === 'steps' ? h('label', { class: 'switch' }, askSteps, h('span', {}, 'Ask a question at each step', h('br'), h('small', { class: 'muted' }, 'Off: Buddy just gives the steps one at a time.'))) : null,
        a.mode === 'steps' ? h('label', { class: 'switch' }, askEnd, h('span', {}, 'At the end, ask for all the steps in order', h('br'), h('small', { class: 'muted' }, `${name} tells Buddy how they did the task.`))) : null,
        a.mode === 'story' ? field('Story organiser on screen', organiser, `Fade it out as ${name} gets more independent: from the start → only if stuck → off.`) : null),
      goalLine, goalPicker),
    h('h3', {}, { conversation: 'Topics, in the order Buddy moves between them', listen: 'Stories', think: 'Situations', recall: 'What to remember', explain: 'Explanations', follow: 'Instructions', task: 'Tasks', steps: 'Tasks', story: 'Stories', object: 'Pictures' }[a.mode] || 'Items'),
    itemsBox,
    h('button', { class: 'btn', onclick: () => { content.items.push(blankItem(a.mode)); drawItems(); } }, addLabel),
    h('details', { class: 'layer' }, h('summary', {}, 'For therapists ', h('small', { class: 'muted' }, '(optional: record wording, cues, what to review)')),
      h('div', { class: 'layer-body' },
        field('Skill being practised', goal, 'Shown on each practice record and in the email after practice.'),
        cues,
        field('What should reviewers look at?', reviewFocus, 'Shown with the practice records, e.g. "Are group words used without a cue?"'))),
    h('div', { class: 'row-actions save-row' },
      h('button', { class: 'btn btn-primary', onclick: run(async () => {
        content.review_focus = reviewFocus.value.trim();
        if (a.mode === 'conversation') content.practise_questions = practiseQ.checked;
        if (a.mode === 'story') content.organiser = organiser.value;
        if (a.mode === 'steps') Object.assign(content, { skill: stepSkill.value, run: stepRun.value, ask_steps: askSteps.checked, ask_end: askEnd.checked });
        if (a.mode === 'listen') { content.listen_retries = Number(listenRetries.value); content.clue_on_wrong = clueOnWrong.checked; }
        content.cues = {};
        for (const [key, inputs] of Object.entries(cueInputs)) {
          const vals = inputs.map((i) => i.value.trim());
          if (vals.join('|') !== modes[a.mode].defaultCues[key].join('|')) content.cues[key] = vals;
        }
        const body = { mode: a.mode, title: title.value, goal: goal.value, plan_goal: planGoal.value, status: status.value, content };
        if (a.id) await api(`/adult/activities/${a.id}`, { method: 'PUT', body }); else await api('/adult/activities', { method: 'POST', body });
        toast('Activity saved.'); renderShell();
      }) }, 'Save activity'),
      h('button', { class: 'btn btn-quiet', onclick: renderShell }, 'Cancel')),
  );
}
const titleExample = (mode) => ({ think: 'e.g. Everyday surprises', conversation: 'e.g. Weekend chat', story: 'e.g. My trip to Ireland', listen: 'e.g. Short stories', recall: 'e.g. My weekend', explain: 'e.g. How do you…?', follow: 'e.g. Shapes and boxes', task: 'e.g. Jobs at work', steps: 'e.g. Jobs at home', object: 'e.g. Kitchen things' }[mode] || '');

// "Buddy will say…": the item's opening lines from the real engine, refreshed as the team types.
function previewBox(mode, it, ctx) {
  const box = h('div', { class: 'preview', 'aria-live': 'polite' });
  let timer = null;
  let seq = 0;
  const draw = async () => {
    const mine = ++seq;
    try {
      const p = await api('/adult/preview', { method: 'POST', body: { mode, item: it, content: ctx() } });
      if (mine !== seq) return;
      const shown = p.lines.map((l) => (l.kind === 'story' ? shorten(l.text, 30) : l.text));
      box.replaceChildren(h('strong', {}, 'Buddy will say: '),
        shown.length ? h('ol', {}, shown.map((t) => h('li', {}, t))) : h('span', { class: 'muted' }, 'Fill in the boxes above to see it.'),
        p.simple && shown.length ? h('small', { class: 'muted' }, `If ${me.learner.name} says “I don’t understand”: “${p.simple}”`) : null);
    } catch { /* preview is a convenience: never block editing */ }
  };
  const soon = () => { clearTimeout(timer); timer = setTimeout(draw, 450); };
  draw();
  return { box, soon };
}
const shorten = (s, words) => { const w = String(s).split(/\s+/); return w.length > words ? `${w.slice(0, words).join(' ')}…` : s; };

// Pictures: find one of the built-in Mulberry symbols, or upload a photo. Symbols are stored as "sym:<name>".
const SYMBOL_CREDIT = 'Pictures: Mulberry Symbols \u00A9 Steve Lee, CC BY-SA 4.0 (mulberrysymbols.org)';
let symbolIndex = null;
async function symbols() {
  if (!symbolIndex) symbolIndex = fetch('/symbols/index.json').then((r) => r.json()).catch(() => { symbolIndex = null; return []; });
  return symbolIndex;
}
// Every word typed must start a word in the symbol's name. Whole-word matches and shorter names come first.
function searchSymbols(all, query, max = 30) {
  const words = String(query).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (!words.length) return [];
  const hits = [];
  for (const [slug, label] of all) {
    const lw = label.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    if (!words.every((w) => lw.some((x) => x.startsWith(w)))) continue;
    const exact = words.filter((w) => lw.includes(w)).length;
    hits.push({ slug, label, score: exact * 100 - lw.length * 3 - label.length * 0.1 });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, max);
}
function imagePicker(it, key, urls, multiple, redraw) {
  const thumbs = h('div', { class: 'thumbs' });
  const set = (id, url) => {
    urls[id] = url;
    if (multiple) (it[key] = it[key] || []).push(id); else it[key] = id;
    draw();
    root.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const draw = () => {
    const ids = multiple ? (it[key] || []) : (it[key] ? [it[key]] : []);
    thumbs.replaceChildren(...ids.map((id, i) => h('div', {}, h('img', { src: urls[id] || (String(id).startsWith('sym:') ? `/symbols/${String(id).slice(4)}.svg` : ''), alt: `Picture ${i + 1}`, class: String(id).startsWith('sym:') ? 'sym' : null }),
      h('button', { type: 'button', class: 'btn btn-quiet', onclick: () => { if (multiple) it[key].splice(i, 1); else delete it[key]; draw(); } }, 'Remove'))));
    findBtn.hidden = !multiple && !!it[key];
    upload.hidden = !multiple && !!it[key];
  };
  const input = h('input', { type: 'file', accept: 'image/*', multiple: multiple || null, class: 'visually-hidden', onchange: run(async (e) => {
    for (const file of e.target.files) {
      const form = new FormData(); form.append('image', file);
      const r = await api('/adult/images', { method: 'POST', form });
      set(r.id, r.url);
    }
    e.target.value = '';
  }) });
  const upload = h('label', { class: 'btn' }, input, 'Upload a photo');
  // The search box opens with a guess from what the team has already typed (the object's name, the topic…).
  const guess = () => it.name || it.topic || it.title || '';
  const q = h('input', { type: 'search', placeholder: 'e.g. toothbrush, bus, caf\u00E9', 'aria-label': 'Search the pictures' });
  const results = h('div', { class: 'sym-results' });
  const panel = h('div', { class: 'sym-panel', hidden: true },
    h('div', { class: 'row-actions' }, q, h('button', { type: 'button', class: 'btn btn-quiet', onclick: () => { panel.hidden = true; } }, 'Close')),
    results, h('small', { class: 'muted' }, SYMBOL_CREDIT));
  let t = null;
  const show = async () => {
    const all = await symbols();
    const hits = searchSymbols(all, q.value);
    results.replaceChildren(...(q.value.trim()
      ? hits.length ? hits.map((x) => h('button', { type: 'button', class: 'sym-hit', title: x.label, onclick: () => { set(`sym:${x.slug}`, `/symbols/${x.slug}.svg`); if (!multiple) panel.hidden = true; } },
        h('img', { src: `/symbols/${x.slug}.svg`, alt: '', loading: 'lazy' }), h('span', {}, x.label)))
        : [h('p', { class: 'muted' }, 'No pictures match. Try a simpler word, or upload a photo.')]
      : [h('p', { class: 'muted' }, 'Type what the picture should show.')]));
  };
  q.addEventListener('input', (e) => { e.stopPropagation(); clearTimeout(t); t = setTimeout(show, 150); });
  const findBtn = h('button', { type: 'button', class: 'btn', onclick: () => { panel.hidden = false; if (!q.value) q.value = guess(); q.focus(); show(); } }, 'Find a picture');
  const root = h('div', { 'data-group': '1', class: 'picker' }, thumbs, h('div', { class: 'row-actions' }, findBtn, upload), panel);
  draw();
  return root;
}

function bind(it, key, el, transform = (v) => v, show = (v) => v) {
  if (el.tagName === 'TEXTAREA') el.textContent = show(it[key] ?? ''); else el.value = show(it[key] ?? '');
  el.addEventListener('input', () => { it[key] = transform(el.value); });
  return el;
}
const csv = (it, k) => bind(it, k, h('input'), list, (v) => (Array.isArray(v) ? v.join(', ') : v));
const txt = (it, k) => bind(it, k, h('input'));
const multi = (it, k, rows = 3) => bind(it, k, h('textarea', { rows }), lines, (v) => (Array.isArray(v) ? v.join('\n') : v));

// One item (a topic, a situation, a story…). The basics come first; optional extras sit under "Fine-tune";
// "Buddy will say…" at the bottom updates as the team types.
const ITEM_NAMES = { conversation: 'Topic', listen: 'Story', story: 'Story', think: 'Situation', recall: 'Memory practice', explain: 'Explanation', follow: 'Instruction', task: 'Task', object: 'Picture', steps: 'Task' };
const FINE_TUNE = {
  object: 'other accepted names and groups, Buddy’s question, simpler wording',
  story: 'accepted words, target words, Buddy’s question, simpler wording',
  task: 'exact wording, phrases for asking',
  conversation: 'example comment and question for the model cue',
  think: 'example reason and plan B, ideas that aren’t safe, Buddy’s question, simpler wording',
  recall: 'Buddy’s question',
};
function itemEditor(mode, it, i, urls, remove, ctx) {
  const name = me.learner.name;
  const box = h('div', { class: 'item-box' });
  const head = h('div', { class: 'row-actions', style: 'justify-content:space-between' }, h('strong', {}, `${ITEM_NAMES[mode] || 'Item'} ${i + 1}`), h('button', { class: 'btn btn-quiet', onclick: remove }, 'Remove'));
  let main = [];
  let extra = [];
  const simple = () => field('Simpler wording, if they say “I don’t understand”', txt(it, 'simple_prompt'), 'Leave blank to use Buddy’s own (shown under “Buddy will say”).');
  if (mode === 'object') {
    main = [
      field('Picture', imagePicker(it, 'image_id', urls, false)),
      h('div', { class: 'grid2' }, field('Name', txt(it, 'name'), 'e.g. "bowl"'), field('Group (category)', txt(it, 'category'), 'e.g. "kitchen things"'), field('Use (function)', txt(it, 'function'), 'e.g. "eat soup or cereal"')),
    ];
    extra = [
      h('div', { class: 'grid2' },
        field('Other accepted names', csv(it, 'name_alternatives'), 'Comma separated'),
        field('Other accepted groups', csv(it, 'category_alternatives'), 'Comma separated, approved by the therapist'),
        field('Key words for the use', csv(it, 'function_keywords'), 'Only used if the AI is unavailable.')),
      field("Buddy's question", txt(it, 'prompt'), 'Leave blank to use Buddy’s own.'), simple(),
    ];
  }
  if (mode === 'story') {
    main = [
      field('Pictures, in order', imagePicker(it, 'image_ids', urls, true)),
      h('div', { class: 'grid2' }, field('Story title', txt(it, 'title')), field('Where it happens', txt(it, 'setting'), 'e.g. "the park"')),
      field('What Buddy says first', txt(it, 'intro'), `Tells ${name} which story this is, e.g. "Let’s tell the story of your trip to Ireland." Needed if there are no pictures.`),
      field('Who was there (optional)', csv(it, 'who'), 'Comma separated, e.g. "Dad, the band". Any one of them counts.'),
      field('What happens, one event per line, in order', multi(it, 'events'), 'Up to four works well: the organiser shows them as First → Next → Then → Finally.'),
      field('How it ended, or one detail (optional)', txt(it, 'outcome'), 'e.g. "we went for pizza afterwards"'),
    ];
    extra = [
      field('Other accepted words for where', csv(it, 'setting_alternatives'), 'Comma separated'),
      h('div', { class: 'grid2' }, field("Therapist's target words", csv(it, 'target_words'), 'e.g. spin, build, construct'), field('Approved alternative words', csv(it, 'word_alternatives'))),
      field('Model sentence using a target word', txt(it, 'vocabulary_model')),
      field("Buddy's question", txt(it, 'prompt'), 'Leave blank to use Buddy’s own.'), simple(),
    ];
  }
  if (mode === 'task') {
    const unclearOn = h('input', { type: 'checkbox', checked: !!it.unclear_instruction });
    const unclearWrap = h('div', { hidden: !it.unclear_instruction || null }, field('Unclear version Buddy says first', txt(it, 'unclear_instruction'), `${name} succeeds by asking for clarification.`));
    unclearOn.addEventListener('change', () => { unclearWrap.hidden = !unclearOn.checked; if (!unclearOn.checked) delete it.unclear_instruction; });
    main = [
      h('div', { class: 'grid2' }, field('Job / task title', txt(it, 'title')), field('Picture (optional)', imagePicker(it, 'image_id', urls, false))),
      field('Steps, one per line (2–3 real job steps)', multi(it, 'steps'), 'e.g. "get the cloth and spray"'),
      h('label', { class: 'switch' }, unclearOn, 'Practise asking for clarification (Buddy gives an unclear instruction first)'), unclearWrap,
    ];
    extra = [
      field('Exact instruction wording', txt(it, 'instruction'), 'Leave blank to use "First…, Next…, Last…"'),
      field('Approved phrases for asking, one per line', multi(it, 'clarify_phrases', 4), 'Blank = Could you repeat that? / Can you show me the first step? / I don’t understand. / I need help. / I need to check with my job coach.'),
    ];
  }
  if (mode === 'conversation') {
    const topic = txt(it, 'topic');
    const likes = me.learner.settings?.interests || [];
    // One tap fills the topic with one of the child's interests (Practice plan → Interests and activities).
    const chips = likes.length
      ? h('div', { class: 'interest-chips' }, likes.map((x) => h('button', { type: 'button', class: 'chip', onclick: () => { topic.value = x; topic.dispatchEvent(new Event('input', { bubbles: true })); } }, x)))
      : h('small', { class: 'muted' }, `Add ${name}’s interests in Practice plan and they’ll appear here.`);
    main = [
      h('div', { class: 'grid2' }, h('div', { class: 'field' }, field('Topic', topic, `Pick from ${name}’s interests:`), chips), field('Picture (optional)', imagePicker(it, 'image_id', urls, false))),
      field("Buddy's opening line", txt(it, 'opener'), 'A comment works well, e.g. "I watched Toy Story at the weekend."'),
    ];
    extra = [h('div', { class: 'grid2' }, field('Example comment (for the model cue)', txt(it, 'example_comment')), field('Example question (for the model cue)', txt(it, 'example_question')))];
  }
  if (mode === 'think') {
    main = [
      h('div', { class: 'grid2' }, field('Short title', txt(it, 'title'), 'For the team, e.g. "Trainer not at the gym"'), field('Picture (optional)', imagePicker(it, 'image_id', urls, false))),
      field('The situation Buddy describes', bind(it, 'scenario', h('textarea', { rows: 2 })), `e.g. "You arrive at the gym, but your trainer isn’t there." Use places and activities from ${name}’s life.`),
      field('What is unexpected or wrong', txt(it, 'problem'), 'e.g. "the trainer is not there"'),
      field('Good, safe responses, one per line', multi(it, 'good_actions', 4), 'Buddy accepts these and anything with the same meaning. Asking a trusted adult always counts. The first one is used for the model cue.'),
    ];
    extra = [
      h('div', { class: 'grid2' },
        field('Example reason (for the model cue)', txt(it, 'reason_example'), 'e.g. "the staff can find my trainer"'),
        field('Example plan B (for the model cue)', txt(it, 'backup_example'), 'e.g. "call my dad"')),
      field('Not safe, one per line', multi(it, 'unsafe', 2), 'Ideas Buddy should not accept, e.g. "leave on my own". They are flagged for the team in Review practice.'),
      field("Buddy's question", txt(it, 'question'), 'Leave blank for "What would you do?"'), simple(),
    ];
  }
  if (mode === 'listen') main = storyEditor(it, urls);
  if (mode === 'follow') main = followEditor(it);
  if (mode === 'recall') ({ main, extra } = recallEditor(it, urls));
  if (mode === 'explain') main = explainEditor(it, urls);
  if (mode === 'steps') main = stepsEditor(it, urls, ctx);

  const preview = previewBox(mode, it, ctx);
  for (const ev of ['input', 'change', 'click']) box.addEventListener(ev, preview.soon);
  box.append(head, ...main,
    extra.length ? h('details', { class: 'fine-tune' }, h('summary', {}, 'Fine-tune ', h('small', { class: 'muted' }, `(optional: ${FINE_TUNE[mode]})`)), h('div', { class: 'layer-body' }, ...extra)) : '',
    preview.box);
  return box;
}

// ------------------------------------------------------------ Task Buddy: a real task, step by step
const blankSteps = () => ({ title: '', steps: [{ text: '' }, { text: '' }, { text: '' }] });
const MAX_STEPS = 12;
// Each step: what Buddy says, a picture, and (under "Buddy's question") the question for the chosen skill.
// Questions are stored per skill, so switching the skill keeps the team's wording for each.
function stepsEditor(it, urls, ctx) {
  it.steps = Array.isArray(it.steps) ? it.steps : [];
  const name = me.learner.name;
  const SK = modes.steps?.skills || {};
  const list = h('div', { class: 'q-list' });
  const note = h('p', { class: 'muted', 'aria-live': 'polite' });
  const draw = () => {
    const { skill = 'understanding', ask_steps = true } = ctx();
    const k = SK[skill] || {};
    list.replaceChildren(...it.steps.map((st, i) => {
      const q = (st.q = st.q || {})[skill] = st.q[skill] || {};
      const qf = (key, label, hint) => field(label, bind(q, key, h('input')), hint);
      const own = ['question', 'answer', 'clue', 'model'].some((x) => q[x]);
      return h('div', { class: 'q-row step-row' }, h('div', { class: 'q-num' }, String(i + 1)), h('div', { class: 'q-fields' },
        field('What Buddy says for this step', bind(st, 'text', h('textarea', { rows: 2 })), i === 0 ? 'One action per step, in plain words, e.g. "Lay the jumper flat on the table."' : null),
        field('Picture (optional)', imagePicker(st, 'image_id', urls, false)),
        ask_steps ? h('details', { class: 'fine-tune', open: own || null }, h('summary', {}, `Buddy\u2019s question: ${k.label || ''} `, h('small', { class: 'muted' }, own ? '(your wording)' : '(blank = Buddy\u2019s own)')),
          h('div', { class: 'layer-body' },
            h('div', { class: 'grid2' }, qf('question', 'Question', `Blank = "${skill === 'memory' && i > 0 ? 'What do you need to do next?' : k.question || ''}"`), qf('answer', 'A good answer', skill === 'memory' || skill === 'understanding' ? 'Blank = the step itself' : 'Used to check the answer and for the model')),
            h('div', { class: 'grid2' }, qf('clue', 'Clue', 'Specific, without giving the answer'), qf('model', 'Model answer', 'The full answer Buddy says last'))))
          : null),
        h('div', { class: 'step-move' },
          h('button', { type: 'button', class: 'btn btn-quiet', 'aria-label': `Move step ${i + 1} up`, disabled: i === 0, onclick: () => { [it.steps[i - 1], it.steps[i]] = [it.steps[i], it.steps[i - 1]]; draw(); } }, '\u2191'),
          h('button', { type: 'button', class: 'btn btn-quiet', 'aria-label': `Move step ${i + 1} down`, disabled: i === it.steps.length - 1, onclick: () => { [it.steps[i + 1], it.steps[i]] = [it.steps[i], it.steps[i + 1]]; draw(); } }, '\u2193'),
          h('button', { type: 'button', class: 'btn btn-quiet', onclick: () => { it.steps.splice(i, 1); draw(); } }, 'Remove')));
    }));
    addBtn.disabled = it.steps.length >= MAX_STEPS;
    draftBtn.hidden = !ask_steps;
  };
  const addBtn = h('button', { type: 'button', class: 'btn', onclick: () => { it.steps.push({ text: '' }); draw(); } }, 'Add a step');
  // Buddy drafts a question, answer, clue and model for every step, for the chosen skill. Fills only blank boxes.
  const draftBtn = h('button', { type: 'button', class: 'btn', onclick: run(async () => {
    const { skill = 'understanding' } = ctx();
    const texts = it.steps.map((x) => x.text || '');
    if (texts.filter((x) => x.trim()).length < 2) { toast('Write at least two steps first.'); return; }
    draftBtn.disabled = true; note.textContent = 'Buddy is drafting the questions\u2026';
    try {
      const r = await api('/adult/steps/draft', { method: 'POST', body: { task: it.title || '', steps: texts, skill } });
      let n = 0;
      it.steps.forEach((st, i) => {
        const d = r.drafts[i]; if (!d || !texts[i].trim()) return;
        const q = ((st.q = st.q || {})[skill] = st.q[skill] || {});
        for (const key of ['question', 'answer', 'clue', 'model']) if (!q[key] && d[key]) { q[key] = d[key]; n++; }
      });
      draw();
      note.textContent = n ? `Buddy filled ${n} blank boxes. Check and change them before you save; boxes you had already filled were kept.` : 'Every box already has your wording, so nothing was changed.';
    } catch (e) { note.textContent = ''; throw e; } finally { draftBtn.disabled = false; }
  }) }, 'Draft questions with Buddy');
  draw();
  return [
    field('Task', bind(it, 'title', h('input')), 'e.g. "Fold a jumper". Buddy says "Today\u2019s task is: Fold a jumper."'),
    h('h4', {}, 'Steps, in order'),
    h('p', { class: 'muted' }, `${name} does each step for real, then presses Done. Up to ${MAX_STEPS} steps.`),
    list,
    h('div', { class: 'row-actions' }, addBtn, draftBtn), note,
  ];
}

// ------------------------------------------------------------ listen: story editor
const blankStory = () => ({ questions: Array.from({ length: 5 }, () => ({ question: '', answers: [], clue: '' })) });

// Memory Buddy, Remember My Day: what the learner really did, with clues Buddy gives one at a time.
// Listen Buddy on screen: Buddy's own shapes, four numbered boxes, and 1–4 steps.
const F_COLOURS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
const F_SHAPES = ['circle', 'square', 'triangle', 'star', 'heart'];
const F_TYPES = [
  ['touch', 'Touch one'], ['box', 'Put one in a box'], ['next_to', 'Put one next to another'],
  ['left_of', 'Put one on the left of another'], ['right_of', 'Put one on the right of another'],
  ['say_left', 'Tell me which one is on the left'], ['say_right', 'Tell me which one is on the right'], ['say_box', 'Tell me which one is in a box'],
];
const blankFollow = () => ({ tokens: ['red-circle', 'blue-square', 'green-triangle'], steps: [{ type: 'box', token: 'red-circle', box: 1 }, { type: 'next_to', token: 'blue-square', target: 'red-circle' }] });
// Everyday objects (Mulberry Symbols) come from the server with the modes: { id: "obj-key", name, img }.
const fObjects = () => modes.follow?.objects || [];
const fObject = (id) => fObjects().find((o) => o.id === id);
const tName = (id) => fObject(id)?.name || String(id).replace('-', ' ');
const F_FILL = { red: '#d63c3c', blue: '#2f6fd6', green: '#2e9d57', yellow: '#f2c230', purple: '#8a4fd0', orange: '#ee8a2a' };
const F_PATH = { circle: '<circle cx="24" cy="24" r="18"/>', square: '<rect x="7" y="7" width="34" height="34" rx="4"/>', triangle: '<path d="M24 5 L43 40 H5 Z"/>',
  star: '<path d="M24 4l5.9 12.6 13.7 1.6-10.1 9.4 2.7 13.6L24 34.4l-12.2 6.8 2.7-13.6L4.4 18.2l13.7-1.6z"/>', heart: '<path d="M24 42S6 31 6 18a9 9 0 0 1 18-3 9 9 0 0 1 18 3c0 13-18 24-18 24z"/>' };
function tokenThumb(id) {
  const o = fObject(id);
  if (o) return h('img', { class: 'tok-thumb sym', src: o.img, alt: '' });
  const [c, sh] = String(id).split('-');
  const el = h('span', { class: 'tok-thumb' });
  el.innerHTML = `<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="${F_FILL[c] || '#888'}" stroke="rgba(0,0,0,.35)" stroke-width="1.5">${F_PATH[sh] || F_PATH.circle}</g></svg>`; // trusted constants
  return el;
}
function followEditor(it) {
  it.tokens = Array.isArray(it.tokens) ? it.tokens : [];
  it.steps = Array.isArray(it.steps) ? it.steps : [];
  it.start = it.start || {};
  const wrap = h('div', { style: 'display:grid;gap:14px' });
  const sel = (options, value, onchange) => h('select', { onchange: (e) => onchange(e.target.value) },
    options.map(([v, l]) => h('option', { value: v, selected: String(value) === String(v) }, l)));
  const draw = () => {
    const toks = it.tokens;
    const tokOpts = toks.map((t) => [t, tName(t)]);
    const shapes = h('div', { class: 'q-list' }, toks.map((t, i) => {
      // One list: Buddy's coloured shapes, then everyday objects. Taken ones are still listed so the current one shows.
      const pick = h('select', { onchange: (e) => replaceTok(t, e.target.value) },
        h('optgroup', { label: 'Shapes' }, F_COLOURS.flatMap((c) => F_SHAPES.map((x) => `${c}-${x}`)).map((v) => h('option', { value: v, selected: v === t }, tName(v)))),
        fObjects().length ? h('optgroup', { label: 'Everyday objects' }, fObjects().map((o) => h('option', { value: o.id, selected: o.id === t }, o.name))) : null);
      return h('div', { class: 'q-row' }, h('div', { class: 'q-num' }, String(i + 1)), h('div', { class: 'q-fields' }, h('div', { class: 'grid2' },
        field('Shape or object', h('div', { class: 'tok-pick' }, tokenThumb(t), pick)),
        field('Starts in', sel([['', 'The tray'], ...[1, 2, 3, 4].map((n) => [n, `Box ${n}`])], it.start[t] || '', (v) => { if (v) it.start[t] = Number(v); else delete it.start[t]; draw(); })))),
        h('button', { class: 'btn btn-quiet', onclick: () => { it.tokens.splice(i, 1); delete it.start[t]; draw(); } }, 'Remove'));
    }));
    const steps = h('div', { class: 'q-list' }, it.steps.map((st, i) => {
      const needsTok = !String(st.type).startsWith('say_');
      const needsBox = st.type === 'box' || st.type === 'say_box';
      const needsTarget = ['next_to', 'left_of', 'right_of'].includes(st.type);
      return h('div', { class: 'q-row' }, h('div', { class: 'q-num' }, String(i + 1)), h('div', { class: 'q-fields' },
        h('div', { class: 'grid2' },
          field('Step', sel(F_TYPES, st.type, (v) => { st.type = v; draw(); })),
          needsTok ? field('Which one', sel(tokOpts, st.token, (v) => { st.token = v; draw(); })) : h('div')),
        needsBox || needsTarget ? h('div', { class: 'grid2' },
          needsBox ? field('Box', sel([1, 2, 3, 4].map((n) => [n, `Box ${n}`]), st.box, (v) => { st.box = Number(v); draw(); })) : h('div'),
          needsTarget ? field('Next to which', sel(tokOpts.filter(([t]) => t !== st.token), st.target, (v) => { st.target = v; draw(); })) : h('div')) : null),
        h('button', { class: 'btn btn-quiet', onclick: () => { it.steps.splice(i, 1); draw(); } }, 'Remove'));
    }));
    wrap.replaceChildren(
      field('Short title', txt(it, 'title'), 'For the team, e.g. "Red circle, blue square"'),
      h('h4', { class: 'q-head' }, 'Shapes or objects (2 to 4)'),
      h('p', { class: 'muted', style: 'margin:0' }, `Everyday objects make it more like real life: "Put the key next to the phone."`),
      shapes,
      toks.length < 4 ? h('div', { class: 'row-actions' },
        h('button', { class: 'btn', onclick: () => { const free = F_COLOURS.flatMap((c) => F_SHAPES.map((x) => `${c}-${x}`)).find((x) => !toks.includes(x)); it.tokens.push(free); draw(); } }, 'Add a shape'),
        fObjects().length ? h('button', { class: 'btn', onclick: () => { const free = fObjects().map((o) => o.id).find((x) => !toks.includes(x)); if (free) { it.tokens.push(free); draw(); } } }, 'Add an object') : null) : '',
      h('h4', { class: 'q-head' }, 'Steps (1 to 4)'),
      h('p', { class: 'muted', style: 'margin:0' }, 'Two steps is the plan\u2019s target; three is the trial. A "Tell me" step is answered by speaking, so put it last.'),
      steps,
      it.steps.length < 4 ? h('button', { class: 'btn', onclick: () => { it.steps.push({ type: 'box', token: toks[0], box: 1 }); draw(); } }, 'Add a step') : '',
    );
  };
  const replaceTok = (from, to) => {
    if (it.tokens.includes(to)) { toast('That one is already in this instruction.'); draw(); return; }
    it.tokens = it.tokens.map((t) => (t === from ? to : t));
    for (const st of it.steps) { if (st.token === from) st.token = to; if (st.target === from) st.target = to; }
    if (from in it.start) { it.start[to] = it.start[from]; delete it.start[from]; }
    draw();
  };
  draw();
  return [wrap];
}

// Explain Buddy, How do you…?: the parts a clear explanation includes. Buddy cues one missing part at a time.
const blankExplain = () => ({ points: [{}, {}, {}] });
function explainEditor(it, urls) {
  it.points = it.points?.length ? it.points : [{}];
  const name = me.learner.name;
  const list = h('div', { class: 'q-list' });
  const draw = () => list.replaceChildren(...it.points.map((pt, i) => h('div', { class: 'q-row' },
    h('div', { class: 'q-num' }, String(i + 1)),
    h('div', { class: 'q-fields' },
      field('Part of a clear answer', txt(pt, 'text'), 'e.g. "cut the character out with scissors". Any wording with the same meaning counts.'),
      h('details', { class: 'fine-tune', open: !!(pt.question || pt.starter || pt.model) || null }, h('summary', {}, 'Fine-tune ', h('small', { class: 'muted' }, '(optional: Buddy\u2019s cues for this part)')),
        h('div', { class: 'layer-body' },
          h('div', { class: 'grid2' },
            field('Question cue', txt(pt, 'question'), 'e.g. "What do you use to cut it out?"'),
            field('Sentence starter', txt(pt, 'starter'), 'e.g. "I cut it out with ___."')),
          field('Model sentence', txt(pt, 'model'), 'e.g. "I cut it out with scissors."')))),
    h('button', { class: 'btn btn-quiet', onclick: () => { it.points.splice(i, 1); draw(); } }, 'Remove'))));
  draw();
  return [
    h('div', { class: 'grid2' },
      field('Short title', txt(it, 'title'), 'For the team, e.g. "Paper characters"'),
      field('Picture (optional)', imagePicker(it, 'image_id', urls, false))),
    field("Buddy's question", txt(it, 'question'), `e.g. "Tell me how you make one of your paper characters." Things ${name} does or enjoys work best.`),
    h('h4', { class: 'q-head' }, 'What a clear answer includes'),
    h('p', { class: 'muted', style: 'margin:0' }, `If ${name}\u2019s answer is short, Buddy asks about one missing part at a time: first "Can you tell me more?", then your question, then the starter, then the model. Three or four parts works well.`),
    list,
    h('button', { class: 'btn', onclick: () => { it.points.push({}); draw(); } }, 'Add a part'),
  ];
}

// How fresh the list is. Buddy only uses it for 7 days (RECALL_FRESH_DAYS on the server), then gives general clues.
const RECALL_FRESH_DAYS = 7;
function listAge(it) {
  const at = Date.parse(it?.memories_updated_at || '');
  if (!Number.isFinite(at)) return null;
  return Math.floor((Date.now() - at) / 86400000);
}
function listStatus(it) {
  const d = listAge(it);
  const name = me.learner.name;
  if (d == null) return { fresh: false, text: `No list saved yet. Buddy uses general clues and ${name}\u2019s interests.` };
  const when = d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
  return d <= RECALL_FRESH_DAYS
    ? { fresh: true, text: `List updated ${when}. Buddy uses it for clues until it is ${RECALL_FRESH_DAYS} days old.` }
    : { fresh: false, text: `List updated ${when}, so it is out of date. Buddy is using general clues and ${name}\u2019s interests. Update the list and save to use it again.` };
}
const blankRecall = () => ({ when: 'at the weekend', target: 3, memories: [{}, {}, {}] });
function recallEditor(it, urls) {
  it.memories = it.memories?.length ? it.memories : [{}];
  if (it.target == null) it.target = 3;
  const name = me.learner.name;
  const list = h('div', { class: 'q-list' });
  const draw = () => list.replaceChildren(...it.memories.map((m, i) => h('div', { class: 'q-row' },
    h('div', { class: 'q-num' }, String(i + 1)),
    h('div', { class: 'q-fields' },
      h('div', { class: 'grid2' },
        field(`What ${name} did`, txt(m, 'event'), 'e.g. "went to the gym with Dad"'),
        field('Photo (optional, the last clue)', imagePicker(m, 'image_id', urls, false))),
      h('div', { class: 'grid2' },
        field('Broad clue', txt(m, 'broad_clue'), 'e.g. "Think about Saturday morning."'),
        field('More specific clue', txt(m, 'specific_clue'), 'e.g. "You went somewhere to exercise."'))),
    h('button', { class: 'btn btn-quiet', onclick: () => { it.memories.splice(i, 1); draw(); } }, 'Remove'))));
  draw();
  const target = bind(it, 'target', h('input', { type: 'number', min: 1, max: 5, step: 1 }), (v) => Number(v) || 3);
  const main = [
    h('div', { class: 'grid2' },
      field('When', txt(it, 'when'), 'e.g. "at the weekend", "on your school trip"'),
      field('How many things to remember', target, '1 to 5. Three works well.')),
    h('h4', { class: 'q-head' }, `What ${name} really did`),
    (() => { const st = listStatus(it); return h('p', { class: st.fresh ? 'list-age' : 'list-age stale' }, st.text); })(),
    h('p', { class: 'muted', style: 'margin:0' }, `Buddy uses these for clues: first the broad clue, then the specific one, then the photo. Anything else ${name} really did counts too, so the list doesn\u2019t need to be complete. Update it after each weekend or outing: Buddy only uses it for ${RECALL_FRESH_DAYS} days.`),
    list,
    h('button', { class: 'btn', onclick: () => { it.memories.push({}); draw(); } }, 'Add something else they did'),
  ];
  const extra = [field("Buddy's question", txt(it, 'prompt'), 'Leave blank for "Tell me three things you did at the weekend."')];
  return { main, extra };
}

function storyEditor(it, urls) {
  it.questions = it.questions?.length ? it.questions : blankStory().questions;
  const name = me.learner.name;
  const story = bind(it, 'story', h('textarea', { rows: 9, placeholder: 'Write the story Buddy will read aloud. 100–200 words works well.' }));

  // "Test this question": type what the learner might say and see whether Buddy would accept it.
  const tester = (q) => {
    const said = h('input', { type: 'text', placeholder: `What ${name} might say`, 'aria-label': 'Answer to test' });
    const out = h('p', { class: 'test-result', role: 'status' });
    const go = h('button', { class: 'btn', type: 'button' }, 'Test');
    const test = run(async () => {
      out.className = 'test-result'; out.textContent = 'Checking…';
      go.disabled = true;
      try {
        const r = await api('/adult/test-answer', { method: 'POST', body: { story: it.story, question: q, answer: said.value } });
        out.className = `test-result ${r.correct ? 'ok' : 'no'}`;
        out.textContent = r.help ? `Buddy would treat this as asking for help, and give the clue.`
          : r.correct ? `✔ Buddy would count this as right.` : `✖ Buddy would count this as not right yet.`;
        if (r.checker === 'keyword') out.textContent += ' (Marked by the basic checker, not Claude, so it only matches the accepted answers.)';
      } catch (e) { out.textContent = ''; throw e; } finally { go.disabled = false; }
    });
    go.addEventListener('click', test);
    said.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); test(); } });
    return h('div', { class: 'q-test' }, h('div', { class: 'q-test-row' }, said, go), out);
  };

  const qBox = h('div', { class: 'q-list' });
  const drawQs = () => qBox.replaceChildren(...it.questions.map((q, i) => {
    const isTitle = q.kind === 'title';
    const titleOn = h('input', { type: 'checkbox', checked: isTitle });
    titleOn.addEventListener('change', () => { if (titleOn.checked) { q.kind = 'title'; q.answers = []; } else delete q.kind; drawQs(); });
    const question = txt(q, 'question');
    if (isTitle) question.placeholder = 'Can you think of a new name for this story?';
    return h('div', { class: 'q-row' },
      h('div', { class: 'q-num' }, `Q${i + 1}`),
      h('div', { class: 'q-fields' },
        field('Question', question, isTitle ? 'Leave blank for Buddy’s wording.' : null),
        h('label', { class: 'switch' }, titleOn, 'Give the story a new name (any sensible name counts)'),
        isTitle
          ? field('Clue (optional)', txt(q, 'clue'), `e.g. "Who was the story about?" Buddy says this if ${name} asks for help`)
          : h('div', { class: 'grid2' },
            field('Accepted answers', csv(q, 'answers'), 'Comma separated, e.g. crow, bird'),
            field('Clue (optional)', txt(q, 'clue'), `Buddy says this if ${name} asks for help`)),
        h('details', { class: 'q-test-wrap' }, h('summary', {}, 'Test this question'), tester(q)),
      ),
      h('button', { class: 'btn btn-quiet', onclick: () => { it.questions.splice(i, 1); drawQs(); } }, 'Remove'));
  }));
  drawQs();

  const words = h('small', { class: 'muted' });
  const count = () => { const n = (story.value.match(/\S+/g) || []).length; words.textContent = `${n} words · about ${Math.max(1, Math.round(n / 2.3 / 60 * 10) / 10)} min to listen`; };
  story.addEventListener('input', count); count();

  // "Listen to the story": the learner's own voice and speed. Saved, so the learner hearing it later costs nothing extra.
  let player = null;
  const listen = h('button', { class: 'btn', type: 'button' }, '▶ Listen to the story');
  const stop = () => { if (player) { player.pause(); player = null; } listen.textContent = '▶ Listen to the story'; };
  listen.addEventListener('click', run(async () => {
    if (player) { stop(); return; }
    listen.disabled = true; listen.textContent = 'Loading…';
    try {
      const r = await fetch('/api/adult/listen', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ text: it.story || '' }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Could not play the story.');
      player = new Audio(URL.createObjectURL(await r.blob()));
      player.addEventListener('ended', stop);
      await player.play();
      listen.textContent = '■ Stop';
    } catch (e) { stop(); throw e; } finally { listen.disabled = false; }
  }));
  story.addEventListener('input', () => { if (player) stop(); });

  return [
    h('div', { class: 'grid2' }, field('Story title', txt(it, 'title'), 'Buddy says "This story is called…" first'), field('Picture (optional)', imagePicker(it, 'image_id', urls, false))),
    field('The story', story), h('div', { class: 'story-tools' }, words, me.voice ? listen : null),
    h('h4', { class: 'q-head' }, 'Questions Buddy asks afterwards'),
    h('p', { class: 'muted', style: 'margin:0' }, `Five works well. ${name}’s answer counts as right if it matches the meaning of one of the accepted answers. Use “Test this question” to try an answer.`),
    qBox,
    h('div', { class: 'row-actions' },
      h('button', { class: 'btn', onclick: () => { it.questions.push({ question: '', answers: [], clue: '' }); drawQs(); } }, 'Add a question'),
      it.questions.some((q) => q.kind === 'title') ? null
        : h('button', { class: 'btn btn-quiet', onclick: (e) => { it.questions.push({ kind: 'title', question: '', answers: [], clue: '' }); e.target.remove(); drawQs(); } }, 'Add “Give it a new name”')),
  ];
}

// ------------------------------------------------------------ review
const DEFAULT_GOAL = { story: 'narrative', conversation: 'conversation', task: 'instructions', object: 'other', listen: 'other', think: 'unexpected', recall: 'other', explain: 'other', follow: 'instructions', steps: 'instructions' };
// "Memory Buddy: Remember My Day" — two modes share Memory Buddy, so lists show both names.
const modeName = (m) => `${modes[m].label}: ${modes[m].activityName}`;
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const goalPill = (k) => {
  const g = goals?.goals[k] || goals?.goals.other;
  return h('span', { class: `goal-pill g-${k || 'other'}` }, g.n < 5 ? `${g.n} · ${g.short}` : g.short);
};
const dayKey = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD
const dayTitle = (k) => new Date(`${k}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
const dayShort = (k) => new Date(`${k}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const timeOf = (d) => new Date(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
const daysAgo = (n) => dayKey(Date.now() - n * 86400000);

const review = { goal: '', period: '30', activity: '' };

function resultBadge(r) {
  if (r.success === true) return h('span', { class: 'result met' }, 'Met target');
  if (r.success === false) return h('span', { class: 'result notyet' }, 'Not yet');
  return h('span', { class: 'result none', title: r.plan_goal === 'other' ? 'Not linked to a plan goal' : 'Stopped before the end' }, r.plan_goal === 'other' ? 'Practice' : 'Not counted');
}
function codeBadge(code) {
  if (!code) return null;
  return h('span', { class: `code-badge c-${code}`, title: goals.codes[code] }, h('b', {}, code), ` ${goals.codes[code]}`);
}

async function renderReview(root) {
  let records, summary;
  try { [records, summary] = await Promise.all([api('/adult/records'), api(`/adult/summary?tz=${encodeURIComponent(TZ)}`)]); }
  catch (e) { root.append(h('p', { class: 'panel' }, e.message)); return; }
  const acts = await api('/adult/activities');
  const focus = Object.fromEntries(acts.map((a) => [a.id, a.content.review_focus]));

  // ---- goal summary cards
  const since7 = daysAgo(6);
  const cards = h('div', { class: 'goal-cards' }, Object.entries(goals.goals).filter(([k]) => k !== 'other').map(([k, g]) => {
    const days = summary.days.filter((d) => d.plan_goal === k);
    const week = days.filter((d) => d.day >= since7);
    const opp = week.reduce((n, d) => n + d.opportunities, 0);
    const met = week.reduce((n, d) => n + d.successes, 0);
    const codes = ['I', 'M', 'P', 'F'].map((c) => [c, week.reduce((n, d) => n + d[c], 0)]);
    const total = codes.reduce((n, [, v]) => n + v, 0);
    const recent = days.filter((d) => d.opportunities).slice(0, 4);
    return h('button', { class: 'goal-card', 'aria-pressed': String(review.goal === k), onclick: () => { review.goal = review.goal === k ? '' : k; draw(); syncCards(); } },
      h('div', { class: 'gc-head' }, goalPill(k), h('span', { class: 'muted' }, 'Last 7 days')),
      h('div', { class: 'gc-big' }, opp ? h('span', {}, h('strong', {}, String(met)), ` of ${opp}`) : h('span', { class: 'muted' }, 'No practice yet')),
      opp ? h('div', { class: 'gc-sub' }, 'met the target') : null,
      total ? h('div', { class: 'code-bar', 'aria-label': codes.map(([c, v]) => `${c}: ${v}`).join(', ') },
        codes.filter(([, v]) => v).map(([c, v]) => h('span', { class: `c-${c}`, style: `flex:${v}` }, `${c} ${v}`))) : null,
      recent.length ? h('div', { class: 'gc-days' }, recent.map((d) => h('span', {}, `${dayShort(d.day)}: ${d.successes}/${d.opportunities}`))) : null);
  }));
  const syncCards = () => cards.querySelectorAll('.goal-card').forEach((b, i) => b.setAttribute('aria-pressed', String(review.goal === Object.keys(goals.goals)[i])));

  // ---- filters
  const goalSel = h('select', { 'aria-label': 'Goal' }, h('option', { value: '' }, 'All goals'),
    Object.entries(goals.goals).map(([k, g]) => h('option', { value: k, selected: review.goal === k }, g.n < 5 ? `${g.n}. ${g.label}` : g.label)));
  const periodSel = h('select', { 'aria-label': 'Period' }, [['7', 'Last 7 days'], ['30', 'Last 30 days'], ['all', 'All practice']].map(([v, l]) => h('option', { value: v, selected: review.period === v }, l)));
  const actSel = h('select', { 'aria-label': 'Activity' }, h('option', { value: '' }, 'All activities'),
    [...new Set(records.map((r) => r.activity_title))].map((t) => h('option', { value: t, selected: review.activity === t }, t)));
  goalSel.addEventListener('change', () => { review.goal = goalSel.value; draw(); syncCards(); });
  periodSel.addEventListener('change', () => { review.period = periodSel.value; draw(); });
  actSel.addEventListener('change', () => { review.activity = actSel.value; draw(); });

  // ---- record list, grouped by day
  const listWrap = h('div', {});
  function draw() {
    goalSel.value = review.goal;
    const from = review.period === 'all' ? '' : daysAgo(Number(review.period) - 1);
    const rows = records.filter((r) => (!review.goal || r.plan_goal === review.goal) && (!review.activity || r.activity_title === review.activity) && (!from || dayKey(r.created_at) >= from));
    if (!rows.length) { listWrap.replaceChildren(h('p', { class: 'panel' }, records.length ? 'No practice matches these filters.' : `No practice yet. Records appear here after ${me.learner.name} finishes an activity.`)); return; }
    const byDay = new Map();
    for (const r of rows) { const k = dayKey(r.created_at); if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(r); }
    listWrap.replaceChildren(...[...byDay].map(([k, rs]) => {
      const counted = rs.filter((r) => r.success != null);
      return h('section', { class: 'day' },
        h('h3', { class: 'day-head' }, dayTitle(k), h('span', { class: 'muted' }, `${rs.length} item${rs.length === 1 ? '' : 's'}${counted.length ? ` · ${counted.filter((r) => r.success).length} of ${counted.length} met target` : ''}`)),
        rs.map((r) => recordCard(r, focus[r.activity_id], root)));
    }));
  }
  draw();

  root.append(
    h('div', { class: 'review-top' },
      h('h2', {}, 'Progress on the plan goals'),
      h('div', { class: 'row-actions' },
        h('button', { class: 'btn', onclick: run(() => download('/adult/export/weekly.csv', `${fileName()}-weekly-record.csv`)) }, 'Weekly record (CSV)'),
        h('button', { class: 'btn btn-quiet', onclick: run(() => download('/adult/export/items.csv', `${fileName()}-all-practice.csv`)) }, 'All practice (CSV)'),
        h('button', { class: 'btn btn-quiet', onclick: run(() => download('/adult/export', `${fileName()}-records.json`)) }, 'Full backup (JSON)'))),
    cards,
    h('details', { class: 'codes-key' }, h('summary', {}, 'How practice is counted'),
      h('p', {}, `Each item ${me.learner.name} finishes is one opportunity. It meets the target when every part is given with the support the plan allows for that goal (goals 1 and 2: no prompt; goals 3 and 4: one cue at most). Items stopped early, and practice not linked to a plan goal, are shown but not counted.`),
      h('ul', {}, Object.entries(goals.codes).map(([c, l]) => h('li', {}, codeBadge(c), c === 'M' ? ' — Buddy gave one cue (reminder, question or sentence starter)' : c === 'P' ? ' — Buddy gave two or more cues' : c === 'F' ? ' — Buddy modelled the answer' : ` — ${me.learner.name} did it without a cue`))),
      h('p', { class: 'muted' }, 'These are practice counts with Buddy, using the team’s codes. The team sets baselines and decides what counts; use Observations for school, work and home.')),
    h('div', { class: 'review-filters' }, goalSel, periodSel, actSel),
    listWrap,
  );
}

function recordCard(r, lookAt, root) {
  const answers = String(r.sam_response || '').split(' / ').filter(Boolean);
  const box = (title, items, cls) => (items?.length ? h('div', { class: `rc-col ${cls}` }, h('h4', {}, title), h('ul', {}, items.map((x) => h('li', {}, x)))) : null);
  return h('article', { class: 'rec-card' },
    h('header', { class: 'rc-head' },
      h('div', { class: 'rc-title' }, goalPill(r.plan_goal), h('strong', {}, r.item_label), h('span', { class: 'muted' }, ` · ${r.activity_title}`)),
      h('div', { class: 'rc-meta' }, r.score_total != null ? h('span', { class: 'score-badge', title: `First try: ${r.score_first}/${r.score_total}` }, `${r.score_correct}/${r.score_total} correct`) : null, resultBadge(r), codeBadge(r.support_code), h('span', { class: 'muted rc-time' }, timeOf(r.created_at)))),
    answers.length ? h('div', { class: 'rc-said' }, h('h4', {}, `${me.learner.name} said`),
      answers.map((a) => a.startsWith('[after support] ')
        ? h('p', { class: 'after' }, h('span', { class: 'tag supported' }, 'after support'), ' ', a.slice(16))
        : h('p', {}, a))) : h('p', { class: 'muted' }, 'No spoken answer recorded.'),
    h('div', { class: 'rc-cols' },
      box('On their own', r.independent, 'own'),
      box('After support', r.after_support, 'after'),
      box('Asked for help', r.help_requests, 'own')),
    h('details', { class: 'rc-more' },
      h('summary', {}, 'Details'),
      box('Buddy’s support', r.support_provided, 'support'),
      r.review_note ? h('p', {}, h('strong', {}, 'Note: '), r.review_note) : null,
      r.sam_turns != null ? h('p', {}, h('strong', {}, `${me.learner.name}’s relevant turns: `), String(r.sam_turns)) : null,
      h('p', {}, h('strong', {}, 'Visual aids: '), (r.visual_aids || []).join(', ') || 'none'),
      h('p', {}, h('strong', {}, 'Activity goal: '), r.goal),
      lookAt ? h('p', {}, h('strong', {}, 'Team asked reviewers to look at: '), lookAt) : null,
      h('button', { class: 'btn', onclick: () => showTranscript(root, r.session_id) }, 'Open transcript')));
}

async function showTranscript(root, sessionId) {
  const events = await api(`/adult/sessions/${sessionId}/events`);
  root.replaceChildren(
    h('div', { class: 'row-actions', style: 'margin-top:14px' }, h('button', { class: 'btn', onclick: renderShell }, 'Back to records')),
    h('h2', {}, 'Practice transcript'),
    h('ul', { class: 'list panel' }, events.map((e) => h('li', {},
      h('div', {}, h('strong', {}, e.who === 'buddy' ? 'Buddy' : e.who === 'sam' ? me.learner.name : 'System'), ` ${e.kind === 'button' ? `pressed ${e.text.replace('_', ' ')}` : e.text}`,
        e.meta?.level ? h('span', { class: 'tag supported', style: 'margin-left:6px' }, e.meta.level) : null,
        e.meta?.uncertain ? h('span', { class: 'tag', style: 'margin-left:6px' }, 'unclear audio') : null),
      e.has_audio ? h('button', { class: 'btn btn-quiet', onclick: run(async () => {
        const r = await fetch(`/api/adult/events/${e.id}/audio`, { headers: { authorization: `Bearer ${token}` } });
        new Audio(URL.createObjectURL(await r.blob())).play();
      }) }, 'Play') : h('span', { class: 'muted' }, fmt(e.created_at))))),
  );
}

async function download(path, name) {
  const sep = path.includes('?') ? '&' : '?';
  const r = await fetch(`/api${path}${sep}tz=${encodeURIComponent(TZ)}`, { headers: { authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Download failed.');
  const a = h('a', { href: URL.createObjectURL(await r.blob()), download: name });
  document.body.append(a); a.click(); a.remove();
}

// ------------------------------------------------------------ observations
async function renderNotes(root) {
  const obs = await api('/adult/observations');
  const setting = h('select', {}, ['home', 'school', 'work', 'therapy', 'other'].map((s) => h('option', { value: s }, s[0].toUpperCase() + s.slice(1))));
  const skill = h('input', { placeholder: 'e.g. Asking for clarification' });
  const note = h('textarea', { rows: 3, placeholder: 'What did you notice?' });
  root.append(
    h('h2', {}, 'Add an observation'),
    h('div', { class: 'panel', style: 'display:grid;gap:10px' },
      h('p', { class: 'muted', style: 'margin:0' }, 'How did the skill show up in everyday life? Practice in the app is rehearsal; these notes show what carried over.'),
      h('div', { class: 'grid2' }, field('Where', setting), field('Skill', skill)), field('Note', note),
      h('button', { class: 'btn btn-primary', onclick: run(async () => { await api('/adult/observations', { method: 'POST', body: { setting: setting.value, skill: skill.value, note: note.value } }); toast('Observation saved.'); renderShell(); }) }, 'Save observation')),
    h('h2', {}, 'Observations'),
    obs.length ? h('ul', { class: 'list panel' }, obs.map((o) => h('li', {}, h('div', {}, h('strong', {}, `${o.setting}${o.skill ? ` · ${o.skill}` : ''}`), h('br'), o.note), h('span', { class: 'muted' }, `${o.adult_name || ''}, ${fmt(o.created_at)}`)))) : h('p', { class: 'muted' }, 'No observations yet.'),
  );
}

// ------------------------------------------------------------ team, devices, privacy
// ------------------------------------------------------------ families (Buddy admin only)
const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const day = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '—');
async function renderFamilies(root) {
  const [families, invites] = await Promise.all([api('/adult/admin/families'), api('/adult/admin/invites')]);
  const note = h('input', { placeholder: 'e.g. Maya\u2019s family, via her therapist' });
  const out = h('div', {});
  const now = Date.now();
  const inviteStatus = (i) => (i.used_at ? `Used ${day(i.used_at)}${i.learner_name ? ` · ${i.learner_name}` : ''}` : new Date(i.expires_at) < now ? 'Expired' : `Open until ${day(i.expires_at)}`);
  root.append(
    h('h2', {}, 'Invite a family'),
    h('div', { class: 'panel', style: 'display:grid;gap:14px' },
      field('Note (only you see this)', note),
      h('div', { class: 'row-actions' }, h('button', { class: 'btn btn-primary', onclick: run(async () => {
        const r = await api('/adult/admin/invites', { method: 'POST', body: { note: note.value } });
        const link = h('input', { value: r.url, readonly: true, 'aria-label': 'Invite link', style: 'flex:1 1 320px' });
        out.replaceChildren(h('div', { class: 'row-actions' }, link, h('button', { class: 'btn', onclick: run(async () => { await navigator.clipboard.writeText(r.url); toast('Link copied.'); }) }, 'Copy link')),
          h('p', { class: 'muted', style: 'margin:6px 0 0' }, `Send this to the parent. It works once, for ${r.expiresInDays} days.`));
        note.value = '';
      }) }, 'Create invite link')),
      out),
    h('h2', {}, `Families (${families.length})`),
    h('div', { class: 'panel table-wrap' }, h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, ['Child', 'Main account', 'Team', 'Devices', 'Practice 7 / 30 days', 'Last practice', 'AI cost, 30 days', ''].map((t) => h('th', {}, t)))),
      h('tbody', {}, families.map((f) => h('tr', { class: f.disabled_at ? 'paused' : null },
        h('td', {}, h('strong', {}, f.name), f.birth_year ? h('span', { class: 'muted' }, ` · born ${f.birth_year}`) : null, f.disabled_at ? h('div', {}, h('span', { class: 'tag' }, 'Paused')) : null),
        h('td', {}, f.owner ? h('div', {}, f.owner.name, h('br'), h('span', { class: 'muted' }, f.owner.email)) : '—'),
        h('td', { class: 'num' }, String(f.team)), h('td', { class: 'num' }, String(f.devices)),
        h('td', { class: 'num' }, `${f.sessions_7d} / ${f.sessions_30d}`), h('td', {}, day(f.last_practice_at)),
        h('td', { class: 'num' }, money(f.est_cost_30d)),
        h('td', {}, f.id === me.learner.id ? null : h('button', { class: f.disabled_at ? 'btn' : 'btn btn-danger', onclick: run(async () => {
          if (!f.disabled_at && !confirm(`Pause ${f.name}\u2019s Buddy? Their team and devices can\u2019t use it until you turn it back on.`)) return;
          await api(`/adult/admin/families/${f.id}/pause`, { method: 'POST', body: { paused: !f.disabled_at } }); renderShell();
        }) }, f.disabled_at ? 'Turn back on' : 'Pause'))))))),
    h('p', { class: 'muted' }, 'AI cost is a rough estimate from list prices (voice, speech-to-text and scoring), for spotting heavy use. It is not a bill.'),
    h('h2', {}, 'Invites'),
    invites.length ? h('ul', { class: 'list panel' }, invites.map((i) => h('li', {},
      h('span', {}, h('strong', {}, i.note || 'Invite'), h('span', { class: 'muted' }, ` · created ${day(i.created_at)} · ${inviteStatus(i)}`)),
      !i.used_at && new Date(i.expires_at) > now ? h('button', { class: 'btn btn-danger', onclick: run(async () => { await api(`/adult/admin/invites/${i.id}`, { method: 'DELETE' }); renderShell(); }) }, 'Cancel') : null)))
      : h('p', { class: 'panel' }, 'No invites yet.'),
  );
}

// Each team member decides for themselves whether to get an email after every practice.
function emailPanel(c) {
  const name = me.learner.name;
  if (!me.email) return h('div', { class: 'panel' }, h('p', { style: 'margin:0' }, 'Practice emails are not switched on for this app yet.'));
  const box = h('input', { type: 'checkbox', checked: !!me.adult.email_after_practice });
  box.addEventListener('change', run(async () => {
    await api('/adult/me/notifications', { method: 'PUT', body: { email_after_practice: box.checked } });
    me.adult.email_after_practice = box.checked;
    toast(box.checked ? `You'll get an email after each practice.` : 'Practice emails turned off.');
  }));
  const blocked = !c?.agreed_at || !c.can_view?.[me.adult.role];
  return h('div', { class: 'panel' },
    h('label', { class: 'switch' }, box, `Email me after each practice (${me.adult.email})`),
    h('p', { class: 'muted', style: 'margin:6px 0 0' }, `A short note when ${name} finishes: what they practised, how it went and the support they needed.`),
    blocked ? h('p', { style: 'margin:8px 0 0' }, `${name} hasn't chosen to share their practice records with ${ROLE[me.adult.role].toLowerCase()}s, so no emails will be sent until they do.`) : null);
}

async function renderTeam(root) {
  const [team, devices] = await Promise.all([api('/adult/team'), api('/adult/devices')]);
  const c = me.consent;
  const codeBox = h('div', {});
  const owner = me.adult.is_owner;

  const add = { name: h('input'), email: h('input', { type: 'email', autocomplete: 'off', name: 'member-email' }), role: h('select', {}, Object.entries(ROLE).map(([k, l]) => h('option', { value: k }, l))), password: h('input', { type: 'text', placeholder: 'Temporary password', autocomplete: 'new-password', name: 'temp-password' }) };
  const cur = h('input', { type: 'password', autocomplete: 'current-password' });
  const nxt = h('input', { type: 'password', autocomplete: 'new-password' });

  root.append(
    h('h2', {}, `${me.learner.name}'s privacy choices`),
    h('div', { class: 'panel' },
      c?.agreed_at ? h('div', {},
        h('p', { style: 'margin-top:0' }, `${me.learner.name} chose who can see their practice records. Only they can change this, in My settings on their iPad or phone.`),
        h('ul', {}, Object.entries(ROLE).map(([k, l]) => h('li', {}, `${l}: ${c.can_view?.[k] ? 'can see records' : 'cannot see records'}`))),
        h('p', {}, `Voice recordings: ${c.save_audio ? 'saved' : 'not saved'}.`))
        : h('p', { style: 'margin:0' }, `${me.learner.name} has not made their privacy choices yet. They will be asked the first time they open the app.`)),

    h('h2', {}, `${me.learner.name}'s iPad and test devices`),
    h('div', { class: 'panel' },
      h('p', { style: 'margin-top:0' }, `Open this site on ${me.learner.name}'s iPad (or a phone for testing), add it to the home screen, then enter a connection code. Each device needs its own code.`),
      h('button', { class: 'btn btn-primary', onclick: run(async () => { const r = await api('/adult/pairing-code', { method: 'POST' }); codeBox.replaceChildren(h('p', { class: 'code' }, r.code), h('p', { class: 'muted' }, `Works once, for ${r.expiresInMinutes} minutes.`)); }) }, 'Create a connection code'),
      codeBox,
      devices.length ? h('ul', { class: 'list' }, devices.map((d) => h('li', {}, h('span', {}, `${d.label} · last used ${d.last_seen_at ? fmt(d.last_seen_at) : 'never'}`),
        h('button', { class: 'btn btn-danger', onclick: run(async () => { if (confirm(`Disconnect ${d.label}?`)) { await api(`/adult/devices/${d.id}`, { method: 'DELETE' }); renderShell(); } }) }, 'Disconnect')))) : null),

    h('h2', {}, 'Practice emails'),
    emailPanel(c),

    h('h2', {}, 'Support team'),
    h('ul', { class: 'list panel' }, team.map((t) => h('li', {}, h('span', {}, `${t.name} · ${ROLE[t.role]}${t.is_owner ? ' (main account)' : ''} · ${t.email}`),
      owner && !t.is_owner ? h('button', { class: 'btn btn-danger', onclick: run(async () => { if (confirm(`Remove ${t.name}?`)) { await api(`/adult/team/${t.id}`, { method: 'DELETE' }); renderShell(); } }) }, 'Remove') : null))),
    owner ? h('div', { class: 'panel' }, h('h3', { style: 'margin-top:0' }, 'Add a team member'),
      h('div', { class: 'grid2' }, field('Name', add.name), field('Email', add.email), field('Role', add.role), field('Temporary password (10+ characters)', add.password)),
      h('button', { class: 'btn', style: 'margin-top:10px', onclick: run(async () => { await api('/adult/team', { method: 'POST', body: Object.fromEntries(Object.entries(add).map(([k, v]) => [k, v.value])) }); toast('Team member added. Share the password with them privately.'); renderShell(); }) }, 'Add team member')) : null,

    h('h2', {}, 'My password'),
    h('div', { class: 'panel grid2' }, field('Current password', cur), field('New password', nxt),
      h('button', { class: 'btn', onclick: run(async () => { const r = await api('/adult/password', { method: 'POST', body: { current: cur.value, next: nxt.value, remember: remembered() } }); if (r.token) saveToken(r.token); toast('Password changed. You\u2019ve been signed out on your other devices.'); cur.value = nxt.value = ''; }) }, 'Change password')),

    owner ? h('div', {}, h('h2', {}, 'Delete practice records'),
      h('div', { class: 'panel' }, h('p', { style: 'margin-top:0' }, 'Deletes every practice session, transcript, recording and record. Activities and observations stay.'),
        h('button', { class: 'btn btn-danger', onclick: run(async () => { if (confirm('Delete all practice records? This cannot be undone.')) { await api('/adult/records', { method: 'DELETE' }); toast('Practice records deleted.'); } }) }, 'Delete all practice records'))) : null,
  );
}

boot().catch((e) => toast(e.message));

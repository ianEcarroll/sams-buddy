// Sam's Buddy — support-team area (parents, speech therapist, teachers, job coach).
const $app = document.getElementById('app');
const TOKEN_KEY = 'buddy.adult';
let token = sessionStorage.getItem(TOKEN_KEY);
let me = null;
let modes = null;
let tab = 'plan';

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
const field = (label, input, hint) => h('label', { class: 'field' }, h('span', {}, label), input, hint ? h('small', { class: 'muted' }, hint) : null);
const toast = (msg) => { const t = h('div', { class: 'toast', role: 'status' }, msg); document.body.append(t); setTimeout(() => t.remove(), 4000); };
const list = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
const lines = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
const fmt = (d) => new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const ROLE = { parent: 'Parent', therapist: 'Speech therapist', teacher: 'Teacher', job_coach: 'Job coach' };

async function api(path, { method = 'GET', body, form } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    body: form || (body ? JSON.stringify(body) : undefined),
  });
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (res.status === 401 && path.startsWith('/adult/') && path !== '/adult/login') { sessionStorage.removeItem(TOKEN_KEY); token = null; boot(); throw new Error(data?.error); }
  if (!res.ok) throw new Error(data?.error || 'Something went wrong. Try again.');
  return data;
}
const run = (fn) => async (...a) => { try { await fn(...a); } catch (e) { if (e.message) toast(e.message); } };

// ------------------------------------------------------------ sign in / setup
async function boot() {
  if (!token) {
    const { needsSetup } = await api('/setup/status');
    return needsSetup ? renderSetup() : renderLogin();
  }
  me = await api('/adult/me');
  modes = modes || await api('/adult/modes');
  renderShell();
}

function renderLogin() {
  const email = h('input', { type: 'email', autocomplete: 'username' });
  const pw = h('input', { type: 'password', autocomplete: 'current-password' });
  const go = run(async () => { const r = await api('/adult/login', { method: 'POST', body: { email: email.value, password: pw.value } }); token = r.token; sessionStorage.setItem(TOKEN_KEY, token); boot(); });
  pw.addEventListener('keydown', (e) => e.key === 'Enter' && go());
  $app.replaceChildren(h('h1', {}, "Sam's Buddy support team"), h('div', { class: 'panel', style: 'max-width:420px;display:grid;gap:12px' }, field('Email', email), field('Password', pw), h('button', { class: 'btn btn-primary', onclick: go }, 'Sign in')));
}

function renderSetup() {
  const f = { setupToken: h('input'), learnerName: h('input', { value: 'Sam' }), ownerName: h('input'), email: h('input', { type: 'email' }), password: h('input', { type: 'password' }) };
  $app.replaceChildren(
    h('h1', {}, "Set up Sam's Buddy"),
    h('p', { class: 'muted' }, 'This creates the main parent account. You can add the speech therapist, teachers and job coach afterwards.'),
    h('div', { class: 'panel', style: 'max-width:460px;display:grid;gap:12px' },
      field('Setup code', f.setupToken, 'The SETUP_TOKEN value from the server settings.'),
      field("Learner's first name", f.learnerName), field('Your name', f.ownerName), field('Your email', f.email), field('Password (10+ characters)', f.password),
      h('button', { class: 'btn btn-primary', onclick: run(async () => {
        const r = await api('/setup', { method: 'POST', body: Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.value])) });
        token = r.token; sessionStorage.setItem(TOKEN_KEY, token); boot();
      }) }, 'Create account')));
}

// ------------------------------------------------------------ shell
const TABS = [['plan', 'Practice plan'], ['activities', 'Activities'], ['review', 'Review practice'], ['notes', 'Observations'], ['team', 'Team & privacy']];
function renderShell() {
  const body = h('div', {});
  $app.replaceChildren(
    h('header', { class: 'adult-head' },
      h('div', {}, h('h1', {}, `${me.learner.name}'s Buddy`), h('span', { class: 'muted' }, `${me.adult.name} · ${ROLE[me.adult.role]}`)),
      h('button', { class: 'btn btn-quiet', onclick: () => { sessionStorage.removeItem(TOKEN_KEY); token = null; boot(); } }, 'Sign out')),
    h('nav', { class: 'tabs', role: 'tablist' }, TABS.map(([k, l]) => h('button', { role: 'tab', 'aria-selected': String(tab === k), onclick: () => { tab = k; renderShell(); } }, l))),
    body,
  );
  if (!me.voice) body.append(h('p', { class: 'panel' }, 'Voice is not connected yet (ELEVENLABS_API_KEY). Sam can still practise by typing.'));
  ({ plan: renderPlan, activities: renderActivities, review: renderReview, notes: renderNotes, team: renderTeam })[tab](body).catch((e) => toast(e.message));
}

// ------------------------------------------------------------ practice plan + settings
async function renderPlan(root) {
  const [{ settings, current_activity_id }, acts] = await Promise.all([api('/adult/settings'), api('/adult/activities')]);
  const current = h('select', {}, h('option', { value: '' }, '— none —'), acts.filter((a) => a.status === 'active').map((a) => h('option', { value: a.id, selected: a.id === current_activity_id }, `${modes[a.mode].label}: ${a.title}`)));
  const num = (k, min, max, step = 1) => h('input', { type: 'number', min, max, step, value: settings[k] });
  const chk = (k) => h('input', { type: 'checkbox', checked: !!settings[k] });
  const f = {
    think_seconds: num('think_seconds', 2, 60), speech_speed: num('speech_speed', 0.7, 1.2, 0.05), session_minutes: num('session_minutes', 3, 60),
    max_attempts: num('max_attempts', 2, 10), turns_per_topic: num('turns_per_topic', 1, 10),
    fade_support: chk('fade_support'), cue_cards: chk('cue_cards'), captions: chk('captions'),
    voice_id: h('input', { value: settings.voice_id || '', placeholder: 'Default voice' }),
  };
  const modeBoxes = Object.keys(modes).map((m) => h('label', { class: 'switch' }, h('input', { type: 'checkbox', value: m, checked: settings.enabled_modes.includes(m) }), modes[m].label));
  root.append(
    h('h2', {}, 'Start My Practice'),
    h('div', { class: 'panel' }, field('When Sam presses Start My Practice, open:', current, 'Pick one activity so Sam has fewer decisions to make.')),
    h('h2', {}, 'Practice types Sam can see'),
    h('div', { class: 'panel grid2' }, modeBoxes),
    h('h2', {}, 'Pace and support'),
    h('div', { class: 'panel grid2' },
      field('Thinking time after "Make a movie in your mind" (seconds)', f.think_seconds),
      field('Speech speed (0.7 slower – 1.2 faster)', f.speech_speed),
      field('Session length (minutes, checked between items)', f.session_minutes),
      field('Attempts per item before Buddy moves on', f.max_attempts),
      field('Conversation turns per topic', f.turns_per_topic),
      field('ElevenLabs voice ID', f.voice_id),
      h('label', { class: 'switch' }, f.fade_support, 'Reduce support on later items'),
      h('label', { class: 'switch' }, f.cue_cards, 'Show visual cue cards'),
      h('label', { class: 'switch' }, f.captions, 'Show captions'),
    ),
    h('button', { class: 'btn btn-primary', onclick: run(async () => {
      const s = {};
      for (const [k, el] of Object.entries(f)) s[k] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : (el.value || null);
      s.enabled_modes = modeBoxes.map((b) => b.querySelector('input')).filter((i) => i.checked).map((i) => i.value);
      await api('/adult/settings', { method: 'PUT', body: { settings: s, current_activity_id: current.value } });
      toast('Practice plan saved.');
    }) }, 'Save practice plan'),
  );
}

// ------------------------------------------------------------ activities
async function renderActivities(root) {
  const acts = await api('/adult/activities');
  root.append(
    h('div', { class: 'row-actions', style: 'margin-top:16px' }, Object.entries(modes).map(([m, d]) => h('button', { class: 'btn', onclick: () => editActivity(root, { mode: m, title: '', goal: d.defaultGoal, status: 'active', content: { items: [{}] }, image_urls: {} }) }, `New: ${d.label}`))),
    acts.length ? h('ul', { class: 'list panel' }, acts.map((a) => h('li', {},
      h('div', {}, h('strong', {}, a.title), h('br'), h('span', { class: 'muted' }, `${modes[a.mode].label} · ${a.content.items.length} item${a.content.items.length === 1 ? '' : 's'}${a.status === 'draft' ? ' · draft' : ''}`)),
      h('div', { class: 'row-actions' },
        h('button', { class: 'btn', onclick: () => editActivity(root, a) }, 'Edit'),
        h('button', { class: 'btn btn-danger', onclick: run(async () => { if (confirm(`Archive "${a.title}"?`)) { await api(`/adult/activities/${a.id}`, { method: 'DELETE' }); renderShell(); } }) }, 'Archive'))))) :
      h('p', { class: 'panel' }, 'No activities yet. Start with one of the practice types above, using the pictures and instructions from Sam\u2019s therapist.'),
  );
}

const CUE_NAMES = {
  object: { name: 'Name', category: 'Group', function: 'Use' },
  story: { where: 'Where', event: 'Each event', order: 'Order', vocabulary: 'Target words' },
  task: { step: 'Each step', order: 'Order', clarify: 'Asking for clarification' },
  conversation: { turn: 'Comment', question: 'Follow-up question' },
};
const LEVEL_NAMES = ['1. Reminder', '2. Specific cue', '3. Sentence starter', '4. Model'];

function editActivity(root, a) {
  const content = structuredClone(a.content || { items: [] });
  const urls = { ...(a.image_urls || {}) };
  const title = h('input', { value: a.title });
  const goal = h('input', { value: a.goal });
  const status = h('select', {}, h('option', { value: 'active', selected: a.status === 'active' }, 'Ready for Sam'), h('option', { value: 'draft', selected: a.status === 'draft' }, 'Draft'));
  const reviewFocus = h('textarea', { rows: 2 }, content.review_focus || '');
  const practiseQ = h('input', { type: 'checkbox', checked: !!content.practise_questions });
  const itemsBox = h('div', {});
  const drawItems = () => itemsBox.replaceChildren(...content.items.map((it, i) => itemEditor(a.mode, it, i, urls, () => { content.items.splice(i, 1); drawItems(); })));
  drawItems();

  // Cue ladders: prefilled with the defaults; saved only if changed.
  const cueInputs = {};
  const cues = h('details', {}, h('summary', {}, 'Words and cues (support sequence)'),
    h('p', { class: 'muted' }, 'Buddy offers one cue at a time, from 1 to 4, and only for the one missing part. {name}, {category}, {function}, {setting}, {event}, {ordinal}, {step}, {topic}, {words} are filled in automatically.'),
    Object.entries(CUE_NAMES[a.mode]).map(([key, label]) => {
      const current = content.cues?.[key] || modes[a.mode].defaultCues[key];
      cueInputs[key] = current.map((t) => h('input', { value: t }));
      return h('div', { class: 'panel' }, h('h3', {}, label), h('div', { class: 'ladder' }, cueInputs[key].flatMap((inp, i) => [h('label', {}, LEVEL_NAMES[i]), inp])));
    }));

  root.replaceChildren(
    h('h2', {}, `${a.id ? 'Edit' : 'New'}: ${modes[a.mode].label}`),
    h('div', { class: 'panel grid2' }, field('Title', title), field('Skill / goal being practised', goal), field('Status', status),
      a.mode === 'conversation' ? h('label', { class: 'switch' }, practiseQ, 'Also practise asking follow-up questions') : null),
    h('h3', {}, a.mode === 'conversation' ? 'Topics, in the order Buddy moves between them' : 'Items'),
    itemsBox,
    h('button', { class: 'btn', onclick: () => { content.items.push({}); drawItems(); } }, a.mode === 'conversation' ? 'Add a topic' : 'Add an item'),
    h('div', { class: 'panel' }, cues),
    h('div', { class: 'panel' }, field('What should reviewers look at?', reviewFocus, 'Shown with the practice records, e.g. "Is he using group words without a cue?"')),
    h('div', { class: 'row-actions' },
      h('button', { class: 'btn btn-primary', onclick: run(async () => {
        content.review_focus = reviewFocus.value.trim();
        if (a.mode === 'conversation') content.practise_questions = practiseQ.checked;
        content.cues = {};
        for (const [key, inputs] of Object.entries(cueInputs)) {
          const vals = inputs.map((i) => i.value.trim());
          if (vals.join('|') !== modes[a.mode].defaultCues[key].join('|')) content.cues[key] = vals;
        }
        const body = { mode: a.mode, title: title.value, goal: goal.value, status: status.value, content };
        if (a.id) await api(`/adult/activities/${a.id}`, { method: 'PUT', body }); else await api('/adult/activities', { method: 'POST', body });
        toast('Activity saved.'); renderShell();
      }) }, 'Save activity'),
      h('button', { class: 'btn btn-quiet', onclick: renderShell }, 'Cancel')),
  );
}

function imagePicker(it, key, urls, multiple, redraw) {
  const thumbs = h('div', { class: 'thumbs' });
  const draw = () => {
    const ids = multiple ? (it[key] || []) : (it[key] ? [it[key]] : []);
    thumbs.replaceChildren(...ids.map((id, i) => h('div', {}, h('img', { src: urls[id], alt: `Picture ${i + 1}` }),
      h('button', { class: 'btn btn-quiet', onclick: () => { if (multiple) it[key].splice(i, 1); else delete it[key]; draw(); } }, 'Remove'))));
  };
  const input = h('input', { type: 'file', accept: 'image/*', multiple: multiple || null, onchange: run(async (e) => {
    for (const file of e.target.files) {
      const form = new FormData(); form.append('image', file);
      const r = await api('/adult/images', { method: 'POST', form });
      urls[r.id] = r.url;
      if (multiple) (it[key] = it[key] || []).push(r.id); else it[key] = r.id;
    }
    e.target.value = ''; draw();
  }) });
  draw();
  return h('div', {}, thumbs, input);
}

function bind(it, key, el, transform = (v) => v, show = (v) => v) {
  if (el.tagName === 'TEXTAREA') el.textContent = show(it[key] ?? ''); else el.value = show(it[key] ?? '');
  el.addEventListener('input', () => { it[key] = transform(el.value); });
  return el;
}
const csv = (it, k) => bind(it, k, h('input'), list, (v) => (Array.isArray(v) ? v.join(', ') : v));
const txt = (it, k) => bind(it, k, h('input'));
const multi = (it, k, rows = 3) => bind(it, k, h('textarea', { rows }), lines, (v) => (Array.isArray(v) ? v.join('\n') : v));

function itemEditor(mode, it, i, urls, remove) {
  const box = h('div', { class: 'item-box' });
  const head = h('div', { class: 'row-actions', style: 'justify-content:space-between' }, h('strong', {}, `${mode === 'conversation' ? 'Topic' : 'Item'} ${i + 1}`), h('button', { class: 'btn btn-quiet', onclick: remove }, 'Remove'));
  let body;
  if (mode === 'object') body = [
    field('Picture', imagePicker(it, 'image_id', urls, false)),
    h('div', { class: 'grid2' },
      field('Name', txt(it, 'name')), field('Other accepted names', csv(it, 'name_alternatives'), 'Comma separated'),
      field('Group (category)', txt(it, 'category')), field('Other accepted groups', csv(it, 'category_alternatives'), 'Comma separated, approved by the therapist'),
      field('Use (function)', txt(it, 'function'), 'e.g. "eat soup or cereal"'), field('Key words for the use', csv(it, 'function_keywords'), 'Optional. Used if the AI is unavailable.')),
    field("Buddy's prompt (optional)", txt(it, 'prompt')), field('Simpler wording for "I don\u2019t understand" (optional)', txt(it, 'simple_prompt')),
  ];
  if (mode === 'story') body = [
    field('Pictures, in order', imagePicker(it, 'image_ids', urls, true)),
    h('div', { class: 'grid2' }, field('Story title', txt(it, 'title')), field('Setting (where)', txt(it, 'setting')), field('Other accepted setting words', csv(it, 'setting_alternatives'))),
    field('Events, one per line, in order', multi(it, 'events'), 'e.g. "the boy builds a kite"'),
    h('div', { class: 'grid2' }, field("Therapist's target words", csv(it, 'target_words'), 'e.g. spin, build, construct'), field('Approved alternative words', csv(it, 'word_alternatives'))),
    field('Model sentence using a target word (optional)', txt(it, 'vocabulary_model')),
    field('Simpler wording for "I don\u2019t understand" (optional)', txt(it, 'simple_prompt')),
  ];
  if (mode === 'task') {
    const unclearOn = h('input', { type: 'checkbox', checked: !!it.unclear_instruction });
    const unclearText = txt(it, 'unclear_instruction');
    const unclearWrap = h('div', { hidden: !it.unclear_instruction || null }, field('Unclear version Buddy says first', unclearText, 'Sam succeeds by asking for clarification.'));
    unclearOn.addEventListener('change', () => { unclearWrap.hidden = !unclearOn.checked; if (!unclearOn.checked) delete it.unclear_instruction; });
    body = [
      h('div', { class: 'grid2' }, field('Job / task title', txt(it, 'title')), field('Picture (optional)', imagePicker(it, 'image_id', urls, false))),
      field('Steps, one per line (2–3 actual job steps)', multi(it, 'steps'), 'e.g. "get the cloth and spray"'),
      field('Exact instruction wording (optional)', txt(it, 'instruction'), 'Leave blank to use "First…, Next…, Last…"'),
      h('label', { class: 'switch' }, unclearOn, 'Practise asking for clarification (give an unclear instruction first)'), unclearWrap,
      field('Approved clarification phrases, one per line', multi(it, 'clarify_phrases', 4), 'Blank = Could you repeat that? / Can you show me the first step? / I don\u2019t understand. / I need help. / I need to check with my job coach.'),
    ];
  }
  if (mode === 'conversation') body = [
    h('div', { class: 'grid2' }, field('Topic', txt(it, 'topic'), 'Pick from Sam\u2019s interests'), field('Picture (optional)', imagePicker(it, 'image_id', urls, false))),
    field("Buddy's opening line", txt(it, 'opener'), 'A comment works well, e.g. "I watched Toy Story at the weekend."'),
    h('div', { class: 'grid2' }, field('Example comment (for the model cue)', txt(it, 'example_comment')), field('Example question (for the model cue)', txt(it, 'example_question'))),
  ];
  box.append(head, ...body);
  return box;
}

// ------------------------------------------------------------ review
async function renderReview(root) {
  let records;
  try { records = await api('/adult/records'); }
  catch (e) { root.append(h('p', { class: 'panel' }, e.message)); return; }
  const acts = await api('/adult/activities');
  const focus = Object.fromEntries(acts.map((a) => [a.id, a.content.review_focus]));
  const filter = h('select', {}, h('option', { value: '' }, 'All activities'), [...new Set(records.map((r) => r.activity_title))].map((t) => h('option', { value: t }, t)));
  const tableWrap = h('div', { class: 'table-wrap' });
  const cell = (arr, cls) => h('td', {}, (arr || []).map((x) => h('div', {}, h('span', { class: `tag ${cls || ''}` }, x))));
  const draw = () => {
    const rows = records.filter((r) => !filter.value || r.activity_title === filter.value);
    tableWrap.replaceChildren(rows.length ? h('table', { class: 'records' },
      h('thead', {}, h('tr', {}, ['When', 'Activity', 'Goal', 'Sam\u2019s response', 'Independent', 'Support given', 'After support', 'Review note', ''].map((t) => h('th', {}, t)))),
      h('tbody', {}, rows.map((r) => h('tr', {},
        h('td', {}, fmt(r.created_at)),
        h('td', {}, h('strong', {}, r.activity_title), h('br'), r.item_label, focus[r.activity_id] ? h('div', { class: 'muted' }, `Look at: ${focus[r.activity_id]}`) : null),
        h('td', {}, r.goal),
        h('td', {}, r.sam_response),
        cell(r.independent),
        cell([...r.support_provided, ...r.help_requests], 'supported'),
        cell(r.after_support, 'supported'),
        h('td', {}, r.review_note),
        h('td', {}, h('button', { class: 'btn btn-quiet', onclick: () => showTranscript(root, r.session_id) }, 'Transcript')))))) :
      h('p', { class: 'panel' }, 'No practice yet. Records appear here after Sam finishes an activity.'));
  };
  filter.addEventListener('change', draw);
  draw();
  root.append(
    h('p', { class: 'muted', style: 'margin-top:14px' }, 'Independent responses are kept separate from responses after a cue or model. Words in [brackets?] were unclear to speech recognition. These records describe practice; they are not scores or assessments.'),
    h('div', { class: 'row-actions' }, filter, h('button', { class: 'btn', onclick: run(downloadExport) }, 'Export records')),
    tableWrap,
  );
}

async function showTranscript(root, sessionId) {
  const events = await api(`/adult/sessions/${sessionId}/events`);
  root.replaceChildren(
    h('div', { class: 'row-actions', style: 'margin-top:14px' }, h('button', { class: 'btn', onclick: renderShell }, 'Back to records')),
    h('h2', {}, 'Practice transcript'),
    h('ul', { class: 'list panel' }, events.map((e) => h('li', {},
      h('div', {}, h('strong', {}, e.who === 'buddy' ? 'Buddy' : e.who === 'sam' ? 'Sam' : 'System'), ` ${e.kind === 'button' ? `pressed ${e.text.replace('_', ' ')}` : e.text}`,
        e.meta?.level ? h('span', { class: 'tag supported', style: 'margin-left:6px' }, e.meta.level) : null,
        e.meta?.uncertain ? h('span', { class: 'tag', style: 'margin-left:6px' }, 'unclear audio') : null),
      e.has_audio ? h('button', { class: 'btn btn-quiet', onclick: run(async () => {
        const r = await fetch(`/api/adult/events/${e.id}/audio`, { headers: { authorization: `Bearer ${token}` } });
        new Audio(URL.createObjectURL(await r.blob())).play();
      }) }, 'Play') : h('span', { class: 'muted' }, fmt(e.created_at))))),
  );
}

async function downloadExport() {
  const r = await fetch('/api/adult/export', { headers: { authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error((await r.json()).error);
  const a = h('a', { href: URL.createObjectURL(await r.blob()), download: 'sams-buddy-records.json' });
  a.click();
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
async function renderTeam(root) {
  const [team, devices] = await Promise.all([api('/adult/team'), api('/adult/devices')]);
  const c = me.consent;
  const codeBox = h('div', {});
  const owner = me.adult.is_owner;

  const add = { name: h('input'), email: h('input', { type: 'email' }), role: h('select', {}, Object.entries(ROLE).map(([k, l]) => h('option', { value: k }, l))), password: h('input', { type: 'text', placeholder: 'Temporary password' }) };
  const cur = h('input', { type: 'password', autocomplete: 'current-password' });
  const nxt = h('input', { type: 'password', autocomplete: 'new-password' });

  root.append(
    h('h2', {}, `${me.learner.name}'s privacy choices`),
    h('div', { class: 'panel' },
      c?.agreed_at ? h('div', {},
        h('p', { style: 'margin-top:0' }, `${me.learner.name} chose who can see his practice records. Only he can change this, in My settings on his phone.`),
        h('ul', {}, Object.entries(ROLE).map(([k, l]) => h('li', {}, `${l}: ${c.can_view?.[k] ? 'can see records' : 'cannot see records'}`))),
        h('p', {}, `Voice recordings: ${c.save_audio ? 'saved' : 'not saved'}.`))
        : h('p', { style: 'margin:0' }, `${me.learner.name} has not made his privacy choices yet. He will be asked the first time he opens the app.`)),

    h('h2', {}, "Sam's phone"),
    h('div', { class: 'panel' },
      h('p', { style: 'margin-top:0' }, `Open this site on ${me.learner.name}'s phone, add it to the home screen, then enter a connection code.`),
      h('button', { class: 'btn btn-primary', onclick: run(async () => { const r = await api('/adult/pairing-code', { method: 'POST' }); codeBox.replaceChildren(h('p', { class: 'code' }, r.code), h('p', { class: 'muted' }, `Works once, for ${r.expiresInMinutes} minutes.`)); }) }, 'Create a connection code'),
      codeBox,
      devices.length ? h('ul', { class: 'list' }, devices.map((d) => h('li', {}, h('span', {}, `${d.label} · last used ${d.last_seen_at ? fmt(d.last_seen_at) : 'never'}`),
        h('button', { class: 'btn btn-danger', onclick: run(async () => { if (confirm('Disconnect this phone?')) { await api(`/adult/devices/${d.id}`, { method: 'DELETE' }); renderShell(); } }) }, 'Disconnect')))) : null),

    h('h2', {}, 'Support team'),
    h('ul', { class: 'list panel' }, team.map((t) => h('li', {}, h('span', {}, `${t.name} · ${ROLE[t.role]}${t.is_owner ? ' (main account)' : ''} · ${t.email}`),
      owner && !t.is_owner ? h('button', { class: 'btn btn-danger', onclick: run(async () => { if (confirm(`Remove ${t.name}?`)) { await api(`/adult/team/${t.id}`, { method: 'DELETE' }); renderShell(); } }) }, 'Remove') : null))),
    owner ? h('div', { class: 'panel' }, h('h3', { style: 'margin-top:0' }, 'Add a team member'),
      h('div', { class: 'grid2' }, field('Name', add.name), field('Email', add.email), field('Role', add.role), field('Temporary password (10+ characters)', add.password)),
      h('button', { class: 'btn', style: 'margin-top:10px', onclick: run(async () => { await api('/adult/team', { method: 'POST', body: Object.fromEntries(Object.entries(add).map(([k, v]) => [k, v.value])) }); toast('Team member added. Share the password with them privately.'); renderShell(); }) }, 'Add team member')) : null,

    h('h2', {}, 'My password'),
    h('div', { class: 'panel grid2' }, field('Current password', cur), field('New password', nxt),
      h('button', { class: 'btn', onclick: run(async () => { await api('/adult/password', { method: 'POST', body: { current: cur.value, next: nxt.value } }); toast('Password changed.'); cur.value = nxt.value = ''; }) }, 'Change password')),

    owner ? h('div', {}, h('h2', {}, 'Delete practice records'),
      h('div', { class: 'panel' }, h('p', { style: 'margin-top:0' }, 'Deletes every practice session, transcript, recording and record. Activities and observations stay.'),
        h('button', { class: 'btn btn-danger', onclick: run(async () => { if (confirm('Delete all practice records? This cannot be undone.')) { await api('/adult/records', { method: 'DELETE' }); toast('Practice records deleted.'); } }) }, 'Delete all practice records'))) : null,
  );
}

boot().catch((e) => toast(e.message));

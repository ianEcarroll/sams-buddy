// Sam's Buddy — support-team area (parents, speech therapist, teachers, job coach).
const $app = document.getElementById('app');
const TOKEN_KEY = 'buddy.adult';
let token = sessionStorage.getItem(TOKEN_KEY);
let me = null;
let modes = null;
let goals = null;   // { goals: {key: {n,label,short,target,cue,allowed}}, codes: {I,M,P,F} }
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
  goals = goals || await api('/adult/goals');
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
    h('h2', {}, 'Buddy\u2019s voice'),
    voicePicker(f.voice_id),
    h('h2', {}, 'Pace and support'),
    h('div', { class: 'panel grid2' },
      field('Thinking time after "Make a movie in your mind" (seconds)', f.think_seconds),
      field('Speech speed (0.7 slower – 1.2 faster)', f.speech_speed),
      field('Session length (minutes, checked between items)', f.session_minutes),
      field('Attempts per item before Buddy moves on', f.max_attempts),
      field('Conversation turns per topic', f.turns_per_topic),
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

// Voice picker: listen to each voice saying a typical Buddy line, then choose one. No ElevenLabs account needed.
function voicePicker(idInput) {
  const box = h('div', { class: 'panel voice-picker' });
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
        h('p', { style: 'margin-top:0' }, 'Current voice: ', h('strong', {}, cur ? cur.name : 'Default voice'),
          '. Press ', h('strong', {}, 'Listen'), ' to hear each voice say a typical Buddy line, then ', h('strong', {}, 'Use this voice'), '. It\u2019s a good choice to make with Sam.'),
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
async function renderActivities(root) {
  const acts = await api('/adult/activities');
  root.append(
    h('div', { class: 'row-actions', style: 'margin-top:16px' }, Object.entries(modes).map(([m, d]) => h('button', { class: 'btn', onclick: () => editActivity(root, { mode: m, title: '', goal: d.defaultGoal, plan_goal: DEFAULT_GOAL[m], status: 'active', content: { items: [{}] }, image_urls: {} }) }, `New: ${d.label}`))),
    acts.length ? h('ul', { class: 'list panel' }, acts.map((a) => h('li', {},
      h('div', {}, goalPill(a.plan_goal), ' ', h('strong', {}, a.title), h('br'), h('span', { class: 'muted' }, `${modes[a.mode].label} · ${a.content.items.length} item${a.content.items.length === 1 ? '' : 's'}${a.status === 'draft' ? ' · draft' : ''}`)),
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
  const planGoal = h('select', {}, Object.entries(goals.goals).map(([k, g]) => h('option', { value: k, selected: (a.plan_goal || 'other') === k }, g.n < 5 ? `${g.n}. ${g.label}` : g.label)));
  const goalHint = h('div', { class: 'goal-hint' });
  const drawHint = () => {
    const g = goals.goals[planGoal.value];
    goalHint.replaceChildren(...[
      h('p', {}, h('strong', {}, 'Target: '), g.target),
      g.cue ? h('p', {}, h('strong', {}, 'Team cue: '), g.cue) : null,
      g.allowed ? h('p', { class: 'muted' }, `Counts as meeting the target when every part is given with support code ${g.allowed.join(' or ')}.`) : null,
      !g.modes.includes(a.mode) ? h('p', { class: 'warn' }, `This goal is usually practised with ${g.modes.map((m) => modes[m].label).join(' or ')}.`) : null].filter(Boolean));
  };
  planGoal.addEventListener('change', drawHint);
  drawHint();
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
    h('div', { class: 'panel' }, field('Which goal in Sam\u2019s Communication Plan does this practise?', planGoal), goalHint),
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
        const body = { mode: a.mode, title: title.value, goal: goal.value, plan_goal: planGoal.value, status: status.value, content };
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
    field('What Buddy says first', txt(it, 'intro'), 'Tells Sam which story this is, e.g. "Let\u2019s tell the story of your trip to Ireland." Needed if there are no pictures.'),
    field("Buddy's question (optional)", txt(it, 'prompt'), 'Leave blank for: "When you are ready, tell me the story. Say where it happens, then what happens first, next and last."'),
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
const DEFAULT_GOAL = { story: 'narrative', conversation: 'conversation', task: 'instructions', object: 'other' };
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
    if (!rows.length) { listWrap.replaceChildren(h('p', { class: 'panel' }, records.length ? 'No practice matches these filters.' : 'No practice yet. Records appear here after Sam finishes an activity.')); return; }
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
        h('button', { class: 'btn', onclick: run(() => download('/adult/export/weekly.csv', 'sams-buddy-weekly-record.csv')) }, 'Weekly record (CSV)'),
        h('button', { class: 'btn btn-quiet', onclick: run(() => download('/adult/export/items.csv', 'sams-buddy-all-practice.csv')) }, 'All practice (CSV)'),
        h('button', { class: 'btn btn-quiet', onclick: run(() => download('/adult/export', 'sams-buddy-records.json')) }, 'Full backup (JSON)'))),
    cards,
    h('details', { class: 'codes-key' }, h('summary', {}, 'How practice is counted'),
      h('p', {}, 'Each item Sam finishes is one opportunity. It meets the target when he gives every part with the support the plan allows for that goal (goals 1 and 2: no prompt; goals 3 and 4: one cue at most). Items he stopped early, and practice not linked to a plan goal, are shown but not counted.'),
      h('ul', {}, Object.entries(goals.codes).map(([c, l]) => h('li', {}, codeBadge(c), c === 'M' ? ' — Buddy gave one cue (reminder, question or sentence starter)' : c === 'P' ? ' — Buddy gave two or more cues' : c === 'F' ? ' — Buddy modelled the answer' : ' — Sam did it without a cue'))),
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
      h('div', { class: 'rc-meta' }, resultBadge(r), codeBadge(r.support_code), h('span', { class: 'muted rc-time' }, timeOf(r.created_at)))),
    answers.length ? h('div', { class: 'rc-said' }, h('h4', {}, 'Sam said'),
      answers.map((a) => a.startsWith('[after support] ')
        ? h('p', { class: 'after' }, h('span', { class: 'tag supported' }, 'after support'), ' ', a.slice(16))
        : h('p', {}, a))) : h('p', { class: 'muted' }, 'No spoken answer recorded.'),
    h('div', { class: 'rc-cols' },
      box('On his own', r.independent, 'own'),
      box('After support', r.after_support, 'after'),
      box('Asked for help', r.help_requests, 'own')),
    h('details', { class: 'rc-more' },
      h('summary', {}, 'Details'),
      box('Buddy’s support', r.support_provided, 'support'),
      r.review_note ? h('p', {}, h('strong', {}, 'Note: '), r.review_note) : null,
      r.sam_turns != null ? h('p', {}, h('strong', {}, 'Sam’s relevant turns: '), String(r.sam_turns)) : null,
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
      h('div', {}, h('strong', {}, e.who === 'buddy' ? 'Buddy' : e.who === 'sam' ? 'Sam' : 'System'), ` ${e.kind === 'button' ? `pressed ${e.text.replace('_', ' ')}` : e.text}`,
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
        h('p', { style: 'margin-top:0' }, `${me.learner.name} chose who can see his practice records. Only he can change this, in My settings on his iPad.`),
        h('ul', {}, Object.entries(ROLE).map(([k, l]) => h('li', {}, `${l}: ${c.can_view?.[k] ? 'can see records' : 'cannot see records'}`))),
        h('p', {}, `Voice recordings: ${c.save_audio ? 'saved' : 'not saved'}.`))
        : h('p', { style: 'margin:0' }, `${me.learner.name} has not made his privacy choices yet. He will be asked the first time he opens the app.`)),

    h('h2', {}, `${me.learner.name}'s iPad and test devices`),
    h('div', { class: 'panel' },
      h('p', { style: 'margin-top:0' }, `Open this site on ${me.learner.name}'s iPad (or a phone for testing), add it to the home screen, then enter a connection code. Each device needs its own code.`),
      h('button', { class: 'btn btn-primary', onclick: run(async () => { const r = await api('/adult/pairing-code', { method: 'POST' }); codeBox.replaceChildren(h('p', { class: 'code' }, r.code), h('p', { class: 'muted' }, `Works once, for ${r.expiresInMinutes} minutes.`)); }) }, 'Create a connection code'),
      codeBox,
      devices.length ? h('ul', { class: 'list' }, devices.map((d) => h('li', {}, h('span', {}, `${d.label} · last used ${d.last_seen_at ? fmt(d.last_seen_at) : 'never'}`),
        h('button', { class: 'btn btn-danger', onclick: run(async () => { if (confirm(`Disconnect ${d.label}?`)) { await api(`/adult/devices/${d.id}`, { method: 'DELETE' }); renderShell(); } }) }, 'Disconnect')))) : null),

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

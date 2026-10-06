import express from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import { q, one, many, pool } from './db.js';
import { migrate } from './migrate.js';
import { sign, hmac, hashPassword, checkPassword, requireAdult, requireOwner, requireDevice, requireRecordAccess, rateLimit } from './auth.js';
import { transcribe, speak, voiceEnabled } from './voice.js';
import { createSession, respond, confirmHeard, control, finish, ENGINE_DEFAULTS } from './coach/engine.js';
import { judgeFromEnv } from './coach/judge.js';
import { MODES } from './coach/modes.js';

const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '1mb' }));

// In production only the Cloudflare Worker may call the API (it adds this header).
app.use('/api', (req, res, next) => {
  if (!process.env.PROXY_SECRET || req.path === '/health') return next();
  if (req.get('x-proxy-secret') !== process.env.PROXY_SECRET) return res.status(403).json({ error: 'Forbidden' });
  next();
});

// Local development: serve the web app from the same process (WEB_DIR=../web/public).
if (process.env.WEB_DIR) app.use(express.static(process.env.WEB_DIR, { extensions: ['html'] }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const judge = judgeFromEnv();

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const ROLES = ['parent', 'therapist', 'teacher', 'job_coach'];

export const SETTING_DEFAULTS = {
  ...ENGINE_DEFAULTS,
  speech_speed: 0.9,
  captions: true,
  voice_id: null,
  enabled_modes: ['story', 'object', 'task'],
};
const SETTING_KEYS = Object.keys(SETTING_DEFAULTS);
const settingsOf = (learner) => ({ ...SETTING_DEFAULTS, ...(learner?.settings || {}) });
const imageUrl = (id) => `/api/images/${id}?s=${hmac(id)}`;

app.get('/api/health', (req, res) => res.json({ ok: true, voice: voiceEnabled(), judge: process.env.ANTHROPIC_API_KEY ? 'claude' : 'keyword' }));

// ------------------------------------------------------------------ first-run setup

app.get('/api/setup/status', wrap(async (req, res) => {
  const n = await one('select count(*)::int n from adults');
  res.json({ needsSetup: n.n === 0 });
}));

app.post('/api/setup', rateLimit(5), wrap(async (req, res) => {
  const { setupToken, learnerName, ownerName, email, password } = req.body || {};
  if (!process.env.SETUP_TOKEN || setupToken !== process.env.SETUP_TOKEN) return res.status(403).json({ error: 'The setup code is not correct.' });
  if ((await one('select count(*)::int n from adults')).n > 0) return res.status(409).json({ error: 'Setup has already been completed.' });
  if (!learnerName || !ownerName || !email || !password || password.length < 10) return res.status(400).json({ error: 'Fill in every field. Passwords need at least 10 characters.' });
  const l = await one('insert into learners(name, settings) values ($1, $2) returning id', [learnerName, {}]);
  await q('insert into consent(learner_id) values ($1)', [l.id]);
  const a = await one("insert into adults(learner_id, name, email, role, is_owner, pass_hash) values ($1,$2,lower($3),'parent',true,$4) returning id", [l.id, ownerName, email, hashPassword(password)]);
  res.json({ token: sign({ kind: 'adult', sub: a.id }, 12 * 3600) });
}));

// ------------------------------------------------------------------ adult sign-in & team

app.post('/api/adult/login', rateLimit(10), wrap(async (req, res) => {
  const { email, password } = req.body || {};
  const a = await one('select id, pass_hash from adults where email=lower($1)', [email || '']);
  if (!a || !checkPassword(password || '', a.pass_hash)) return res.status(401).json({ error: 'That email and password do not match.' });
  res.json({ token: sign({ kind: 'adult', sub: a.id }, 12 * 3600) });
}));

const adult = express.Router();
adult.use(wrap(requireAdult));

adult.get('/me', wrap(async (req, res) => {
  const learner = await one('select id, name, settings, current_activity_id from learners where id=$1', [req.learnerId]);
  const consent = await one('select agreed_at, can_view, save_audio from consent where learner_id=$1', [req.learnerId]);
  res.json({ adult: req.adult, learner: { ...learner, settings: settingsOf(learner) }, consent, voice: voiceEnabled() });
}));

adult.get('/team', wrap(async (req, res) => {
  res.json(await many('select id, name, email, role, is_owner, created_at from adults where learner_id=$1 order by created_at', [req.learnerId]));
}));
adult.post('/team', requireOwner, wrap(async (req, res) => {
  const { name, email, role, password } = req.body || {};
  if (!name || !email || !ROLES.includes(role) || !password || password.length < 10) return res.status(400).json({ error: 'Add a name, email, role and a temporary password of at least 10 characters.' });
  const a = await one('insert into adults(learner_id, name, email, role, pass_hash) values ($1,$2,lower($3),$4,$5) on conflict (email) do nothing returning id', [req.learnerId, name, email, role, hashPassword(password)]);
  if (!a) return res.status(409).json({ error: 'That email already has an account.' });
  res.json({ id: a.id });
}));
adult.delete('/team/:id', requireOwner, wrap(async (req, res) => {
  await q('delete from adults where id=$1 and learner_id=$2 and is_owner=false', [req.params.id, req.learnerId]);
  res.json({ ok: true });
}));
adult.post('/password', wrap(async (req, res) => {
  const { current, next } = req.body || {};
  const a = await one('select pass_hash from adults where id=$1', [req.adult.id]);
  if (!checkPassword(current || '', a.pass_hash)) return res.status(400).json({ error: 'Your current password is not correct.' });
  if (!next || next.length < 10) return res.status(400).json({ error: 'New passwords need at least 10 characters.' });
  await q('update adults set pass_hash=$1 where id=$2', [hashPassword(next), req.adult.id]);
  res.json({ ok: true });
}));

// ------------------------------------------------------------------ Sam's phone

adult.post('/pairing-code', wrap(async (req, res) => {
  const code = Array.from(crypto.randomBytes(6), (b) => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[b % 31]).join('');
  await q("insert into pairing_codes(code_hash, learner_id, created_by, expires_at) values ($1,$2,$3, now() + interval '15 minutes')", [hmac(code), req.learnerId, req.adult.id]);
  res.json({ code, expiresInMinutes: 15 });
}));
adult.get('/devices', wrap(async (req, res) => {
  res.json(await many('select id, label, created_at, last_seen_at from devices where learner_id=$1 and revoked_at is null order by created_at', [req.learnerId]));
}));
adult.delete('/devices/:id', wrap(async (req, res) => {
  await q('update devices set revoked_at=now() where id=$1 and learner_id=$2', [req.params.id, req.learnerId]);
  res.json({ ok: true });
}));

app.post('/api/device/pair', rateLimit(10), wrap(async (req, res) => {
  const code = String(req.body?.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const p = await one('update pairing_codes set used_at=now() where code_hash=$1 and used_at is null and expires_at > now() returning learner_id', [hmac(code)]);
  if (!p) return res.status(400).json({ error: 'That code did not work. Ask for a new one.' });
  const d = await one('insert into devices(learner_id, label) values ($1,$2) returning id', [p.learner_id, String(req.body?.label || "Sam's phone").slice(0, 60)]);
  res.json({ token: sign({ kind: 'device', sub: d.id }) });
}));

// ------------------------------------------------------------------ practice setup (adults)

adult.get('/settings', wrap(async (req, res) => {
  const l = await one('select settings, current_activity_id from learners where id=$1', [req.learnerId]);
  res.json({ settings: settingsOf(l), current_activity_id: l.current_activity_id });
}));
adult.put('/settings', wrap(async (req, res) => {
  const body = req.body || {};
  const clean = {};
  for (const k of SETTING_KEYS) if (k in (body.settings || {})) clean[k] = body.settings[k];
  if (clean.enabled_modes) clean.enabled_modes = clean.enabled_modes.filter((m) => MODES[m]);
  await q('update learners set settings = settings || $1::jsonb, current_activity_id = coalesce($2, current_activity_id) where id=$3', [clean, body.current_activity_id || null, req.learnerId]);
  if (body.current_activity_id === '') await q('update learners set current_activity_id=null where id=$1', [req.learnerId]);
  res.json({ ok: true });
}));

adult.get('/activities', wrap(async (req, res) => {
  const rows = await many("select id, mode, title, goal, status, content, updated_at from activities where learner_id=$1 and status<>'archived' order by mode, updated_at desc", [req.learnerId]);
  for (const r of rows) {
    const ids = (r.content.items || []).flatMap((it) => [it.image_id, ...(it.image_ids || [])]).filter(Boolean);
    r.image_urls = Object.fromEntries(ids.map((id) => [id, imageUrl(id)]));
  }
  res.json(rows);
}));
function validateActivity(b) {
  if (!MODES[b.mode]) return 'Choose a practice type.';
  if (!b.title?.trim()) return 'Give the activity a title.';
  const items = b.content?.items;
  if (!Array.isArray(items) || !items.length) return 'Add at least one item to practise.';
  for (const [i, it] of items.entries()) {
    if (b.mode === 'object' && (!it.name || !it.category || !it.function)) return `Item ${i + 1}: add the name, group and use.`;
    if (b.mode === 'story' && (!it.setting || !(it.events || []).filter(Boolean).length)) return `Story ${i + 1}: add the setting and at least one event.`;
    if (b.mode === 'task' && ((it.steps || []).filter(Boolean).length < 1)) return `Task ${i + 1}: add the steps.`;
    if (b.mode === 'conversation' && (!it.topic || !it.opener)) return `Topic ${i + 1}: add the topic and Buddy's opening line.`;
  }
  return null;
}
adult.post('/activities', wrap(async (req, res) => {
  const err = validateActivity(req.body || {});
  if (err) return res.status(400).json({ error: err });
  const { mode, title, goal = '', status = 'active', content } = req.body;
  const a = await one('insert into activities(learner_id, mode, title, goal, status, content, created_by) values ($1,$2,$3,$4,$5,$6,$7) returning id', [req.learnerId, mode, title.trim(), goal, status, content, req.adult.id]);
  res.json({ id: a.id });
}));
adult.put('/activities/:id', wrap(async (req, res) => {
  const err = validateActivity(req.body || {});
  if (err) return res.status(400).json({ error: err });
  const { mode, title, goal = '', status = 'active', content } = req.body;
  await q('update activities set mode=$1, title=$2, goal=$3, status=$4, content=$5, updated_at=now() where id=$6 and learner_id=$7', [mode, title.trim(), goal, status, content, req.params.id, req.learnerId]);
  res.json({ ok: true });
}));
adult.delete('/activities/:id', wrap(async (req, res) => {
  await q("update activities set status='archived', updated_at=now() where id=$1 and learner_id=$2", [req.params.id, req.learnerId]);
  await q('update learners set current_activity_id=null where id=$1 and current_activity_id=$2', [req.learnerId, req.params.id]);
  res.json({ ok: true });
}));
adult.get('/modes', (req, res) => {
  res.json(Object.fromEntries(Object.entries(MODES).map(([k, m]) => [k, { label: m.label, defaultGoal: m.defaultGoal, defaultCues: m.defaultCues }])));
});

adult.post('/images', upload.single('image'), wrap(async (req, res) => {
  if (!req.file || !/^image\/(png|jpe?g|webp|gif)$/.test(req.file.mimetype)) return res.status(400).json({ error: 'Upload a PNG, JPG, WebP or GIF picture.' });
  const r = await one('insert into images(learner_id, mime, data, alt) values ($1,$2,$3,$4) returning id', [req.learnerId, req.file.mimetype, req.file.buffer, req.body.alt || null]);
  res.json({ id: r.id, url: imageUrl(r.id) });
}));
app.get('/api/images/:id', wrap(async (req, res) => {
  if (req.query.s !== hmac(req.params.id)) return res.status(404).end();
  const img = await one('select mime, data from images where id=$1', [req.params.id]);
  if (!img) return res.status(404).end();
  res.set('content-type', img.mime).set('cache-control', 'private, max-age=86400').send(img.data);
}));

// ------------------------------------------------------------------ review (only what Sam has agreed to share)

adult.get('/records', wrap(requireRecordAccess), wrap(async (req, res) => {
  res.json(await many(`select r.*, s.started_at, s.ended_reason from practice_records r join practice_sessions s on s.id=r.session_id
    where r.learner_id=$1 order by r.created_at desc limit 200`, [req.learnerId]));
}));
adult.get('/sessions/:id/events', wrap(requireRecordAccess), wrap(async (req, res) => {
  const s = await one('select id from practice_sessions where id=$1 and learner_id=$2', [req.params.id, req.learnerId]);
  if (!s) return res.status(404).json({ error: 'Session not found.' });
  res.json(await many('select id, who, kind, text, meta, created_at, (audio is not null) as has_audio from practice_events where session_id=$1 order by id', [s.id]));
}));
adult.get('/events/:id/audio', wrap(requireRecordAccess), wrap(async (req, res) => {
  const e = await one('select e.audio, e.audio_mime from practice_events e join practice_sessions s on s.id=e.session_id where e.id=$1 and s.learner_id=$2', [req.params.id, req.learnerId]);
  if (!e?.audio) return res.status(404).end();
  res.set('content-type', e.audio_mime || 'audio/webm').send(e.audio);
}));
adult.get('/observations', wrap(async (req, res) => {
  res.json(await many('select o.*, a.name as adult_name, a.role from observations o left join adults a on a.id=o.adult_id where o.learner_id=$1 order by o.created_at desc limit 200', [req.learnerId]));
}));
adult.post('/observations', wrap(async (req, res) => {
  const { setting, skill = '', note } = req.body || {};
  if (!note?.trim()) return res.status(400).json({ error: 'Write what you noticed.' });
  await q('insert into observations(learner_id, adult_id, setting, skill, note) values ($1,$2,$3,$4,$5)', [req.learnerId, req.adult.id, setting || 'other', skill, note.trim()]);
  res.json({ ok: true });
}));
adult.get('/export', wrap(requireRecordAccess), wrap(async (req, res) => {
  res.set('content-disposition', 'attachment; filename="sams-buddy-records.json"').json(await exportFor(req.learnerId));
}));
adult.delete('/records', requireOwner, wrap(async (req, res) => {
  await q('delete from practice_sessions where learner_id=$1', [req.learnerId]);
  res.json({ ok: true });
}));

async function exportFor(learnerId) {
  return {
    exported_at: new Date().toISOString(),
    note: 'Practice records describe what happened during practice. They are not assessments or diagnoses.',
    records: await many('select activity_title, mode, item_label, goal, sam_response, independent, support_provided, after_support, help_requests, review_note, created_at from practice_records where learner_id=$1 order by created_at', [learnerId]),
    observations: await many('select setting, skill, note, created_at from observations where learner_id=$1 order by created_at', [learnerId]),
  };
}

app.use('/api/adult', adult);

// ------------------------------------------------------------------ Sam's device

const device = express.Router();
device.use(wrap(requireDevice));

device.get('/home', wrap(async (req, res) => {
  const l = await one('select name, settings, current_activity_id from learners where id=$1', [req.learnerId]);
  const s = settingsOf(l);
  const consent = await one('select agreed_at, can_view, save_audio from consent where learner_id=$1', [req.learnerId]);
  const acts = await many("select id, mode, title from activities where learner_id=$1 and status='active' and mode = any($2) order by updated_at desc", [req.learnerId, s.enabled_modes]);
  res.json({
    name: l.name,
    settings: { captions: s.captions, speech_speed: s.speech_speed, think_seconds: s.think_seconds },
    current_activity_id: acts.some((a) => a.id === l.current_activity_id) ? l.current_activity_id : null,
    modes: s.enabled_modes,
    activities: acts,
    consent,
    voice: voiceEnabled(),
  });
}));
device.put('/settings', wrap(async (req, res) => {
  const clean = {};
  if (typeof req.body?.captions === 'boolean') clean.captions = req.body.captions;
  if (req.body?.speech_speed) clean.speech_speed = Math.min(1.2, Math.max(0.7, Number(req.body.speech_speed)));
  await q('update learners set settings = settings || $1::jsonb where id=$2', [clean, req.learnerId]);
  res.json({ ok: true });
}));
device.put('/consent', wrap(async (req, res) => {
  const { can_view = {}, save_audio = false } = req.body || {};
  const cv = Object.fromEntries(ROLES.map((r) => [r, !!can_view[r]]));
  await q('update consent set agreed_at=coalesce(agreed_at, now()), can_view=$1, save_audio=$2, updated_at=now() where learner_id=$3', [cv, !!save_audio, req.learnerId]);
  if (!save_audio) await q('update practice_events e set audio=null from practice_sessions s where s.id=e.session_id and s.learner_id=$1', [req.learnerId]);
  res.json({ ok: true });
}));
device.get('/export', wrap(async (req, res) => res.json(await exportFor(req.learnerId))));
device.delete('/records', wrap(async (req, res) => {
  await q('delete from practice_sessions where learner_id=$1', [req.learnerId]);
  res.json({ ok: true });
}));

// ------------------------------------------------------------------ practice sessions

async function loadSession(req) {
  const s = await one('select id, state, ended_at from practice_sessions where id=$1 and learner_id=$2', [req.params.sid, req.learnerId]);
  if (!s) { const e = new Error('Practice session not found.'); e.status = 404; throw e; }
  if (s.ended_at) { const e = new Error('This practice has finished.'); e.status = 409; throw e; }
  return s;
}

// Store Buddy's lines, attach audio URLs, swap image ids for signed URLs.
async function deliver(sid, state, turn) {
  const lines = [];
  for (const l of turn.lines) {
    const e = await one("insert into practice_events(session_id, who, kind, text, meta) values ($1,'buddy',$2,$3,$4) returning id", [sid, l.kind, l.text, { level: l.level, element: l.element }]);
    lines.push({ ...l, id: e.id, audio: voiceEnabled() ? `/api/device/practice/${sid}/speech/${e.id}` : null });
  }
  await q('update practice_sessions set state=$1 where id=$2', [state, sid]);
  return { ...turn, sessionId: sid, lines, ui: { ...turn.ui, images: turn.ui.images.map(imageUrl) } };
}

// The UI state for a turn Buddy builds itself (e.g. after a speech-to-text failure).
function lastUi(state) {
  const { turn } = control(structuredClone(state), 'ready');
  return turn.ui;
}

async function saveRecords(sid, learnerId, state, reason) {
  const { records } = finish(state, reason);
  await q('delete from practice_records where session_id=$1', [sid]);
  for (const r of records) {
    await q(`insert into practice_records(learner_id, session_id, activity_id, activity_title, mode, item_label, goal, sam_response, independent, support_provided, after_support, help_requests, review_note)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [learnerId, sid, state.activity.id, state.activity.title, state.mode, r.item_label, r.goal, r.sam_response, JSON.stringify(r.independent), JSON.stringify(r.support_provided), JSON.stringify(r.after_support), JSON.stringify(r.help_requests), r.review_note]);
  }
  await q('update practice_sessions set state=$1, ended_at=now(), ended_reason=$2 where id=$3', [state, reason, sid]);
  return records;
}

device.post('/practice/start', wrap(async (req, res) => {
  const consent = await one('select agreed_at from consent where learner_id=$1', [req.learnerId]);
  if (!consent?.agreed_at) return res.status(403).json({ error: 'Choose your privacy settings first.' });
  const l = await one('select name, settings, current_activity_id from learners where id=$1', [req.learnerId]);
  const id = req.body?.activityId || l.current_activity_id;
  const act = id && await one("select id, mode, title, goal, content from activities where id=$1 and learner_id=$2 and status='active'", [id, req.learnerId]);
  if (!act) return res.status(404).json({ error: 'Your team has not chosen a practice yet.' });
  const { state, turn } = createSession({ activity: act, settings: settingsOf(l), learnerName: l.name });
  const s = await one('insert into practice_sessions(learner_id, activity_id, activity_snapshot, state) values ($1,$2,$3,$4) returning id', [req.learnerId, act.id, act, state]);
  res.json({ title: act.title, mode: act.mode, ...(await deliver(s.id, state, turn)) });
}));

device.post('/practice/:sid/respond', upload.single('audio'), wrap(async (req, res) => {
  const s = await loadSession(req);
  let input;
  let audio = null;
  if (req.file) {
    if (!voiceEnabled()) return res.status(503).json({ error: 'Voice is not set up yet. Type your answer instead.' });
    // A tap on Talk then I'm done with almost no audio: treat as silence, not an error.
    if (req.file.size < 1500) {
      input = { text: '', displayText: '', uncertain: false };
    } else {
      try {
        input = await transcribe(req.file.buffer, req.file.mimetype);
      } catch (err) {
        console.error('[stt]', err.message, req.file.mimetype, req.file.size);
        return res.json({ heard: '', ...(await deliver(s.id, s.state, {
          lines: [{ text: "Sorry, I couldn't hear that properly. Please press Talk and try again.", kind: 'clarify' }],
          expect: 'response', done: false, ui: lastUi(s.state),
        })) });
      }
    }
    const c = await one('select save_audio from consent where learner_id=$1', [req.learnerId]);
    if (c?.save_audio) audio = req.file;
  } else {
    input = { text: String(req.body?.text || ''), displayText: String(req.body?.text || ''), uncertain: false };
  }
  await q("insert into practice_events(session_id, who, kind, text, meta, audio, audio_mime) values ($1,'sam','response',$2,$3,$4,$5)",
    [s.id, input.displayText || input.text, { uncertain: !!input.uncertain, typed: !req.file }, audio?.buffer || null, audio?.mimetype || null]);
  const { state, turn } = await respond(s.state, input, { judge });
  const out = await deliver(s.id, state, turn);
  if (state.done) out.records = await saveRecords(s.id, req.learnerId, state, 'completed');
  res.json({ heard: input.text, ...out });
}));

device.post('/practice/:sid/confirm', wrap(async (req, res) => {
  const s = await loadSession(req);
  const yes = !!req.body?.yes;
  await q("insert into practice_events(session_id, who, kind, text) values ($1,'sam','confirm_heard',$2)", [s.id, yes ? 'Yes, that is right' : 'No, say it again']);
  const { state, turn } = await confirmHeard(s.state, yes, { judge });
  const out = await deliver(s.id, state, turn);
  if (state.done) out.records = await saveRecords(s.id, req.learnerId, state, 'completed');
  res.json(out);
}));

device.post('/practice/:sid/control', wrap(async (req, res) => {
  const s = await loadSession(req);
  const action = String(req.body?.action || '');
  await q("insert into practice_events(session_id, who, kind, text) values ($1,'sam','button',$2)", [s.id, action]);
  const { state, turn } = control(s.state, action);
  res.json(await deliver(s.id, state, turn));
}));

device.post('/practice/:sid/finish', wrap(async (req, res) => {
  const s = await one('select id, state, ended_at from practice_sessions where id=$1 and learner_id=$2', [req.params.sid, req.learnerId]);
  if (!s) return res.status(404).json({ error: 'Practice session not found.' });
  if (s.ended_at) return res.json({ ok: true, records: [] });
  const records = await saveRecords(s.id, req.learnerId, s.state, 'finished');
  res.json({ ok: true, records });
}));

device.get('/practice/:sid/speech/:eid', wrap(async (req, res) => {
  const e = await one(`select e.text from practice_events e join practice_sessions s on s.id=e.session_id
    where e.id=$1 and e.session_id=$2 and s.learner_id=$3 and e.who='buddy'`, [req.params.eid, req.params.sid, req.learnerId]);
  if (!e) return res.status(404).end();
  const l = await one('select settings from learners where id=$1', [req.learnerId]);
  const st = settingsOf(l);
  const audio = await speak(e.text, { voiceId: st.voice_id, speed: st.speech_speed });
  res.set('content-type', 'audio/mpeg').set('cache-control', 'private, max-age=3600').send(audio);
}));

app.use('/api/device', device);

// ------------------------------------------------------------------ errors

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) return res.status(400).json({ error: 'That file is too large.' });
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Something went wrong on the server. Try again.' });
});

const port = Number(process.env.PORT || 8787);
migrate()
  .then(() => app.listen(port, () => console.log(`[sams-buddy] API on :${port}`)))
  .catch((e) => { console.error('Migration failed', e); process.exit(1); });

process.on('SIGTERM', () => pool.end().finally(() => process.exit(0)));

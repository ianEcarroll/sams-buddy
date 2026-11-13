import express from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import { q, one, many, pool } from './db.js';
import { migrate } from './migrate.js';
import { sign, hmac, hashPassword, checkPassword, requireAdult, requireOwner, requireDevice, requireRecordAccess, rateLimit } from './auth.js';
import { transcribe, speak, voiceEnabled, listVoices, defaultVoiceId, setSpeechStore, ttsModel } from './voice.js';
import { pgSpeechStore, pruneSpeech } from './speechStore.js';
import { createSession, respond, confirmHeard, control, act, finish, previewLines, ENGINE_DEFAULTS } from './coach/engine.js';
import { judgeFromEnv, modelsFromEnv } from './coach/judge.js';
import { MODES, STARTER_STORIES, STARTER_SCENARIOS, STARTER_EXPLAIN, STARTER_FOLLOW, STARTER_OBJECTS, FOLLOW_OBJECTS, isFollowToken, FOLLOW_STEP_TYPES, FOLLOW_BOXES, stampMemories } from './coach/modes.js';
import { PLAN_GOALS, GOAL_KEYS, SUPPORT_CODES } from './coach/goals.js';
import { emailEnabled, sendEmail, recipientsFor, practiceEmail, resetEmail } from './email.js';
import { isPlatformAdmin, newInviteToken, INVITE_DAYS, estimateCost, ratesFor, validateFamily, ageFrom, cleanInterests } from './families.js';
import { pushEnabled, pushPublicKey, sendPush, reminderDue, reminderMessage } from './push.js';

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
// Shown with editor tests: whether answers are being marked by Claude or by the basic keyword checker.
const judgeKind = () => (process.env.ANTHROPIC_API_KEY && process.env.JUDGE !== 'keyword' ? 'claude' : 'keyword');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const ROLES = ['parent', 'therapist', 'teacher', 'job_coach'];

export const SETTING_DEFAULTS = {
  ...ENGINE_DEFAULTS,
  speech_speed: 0.9,
  captions: true,
  reminder_time: '',          // 'HH:MM' in the learner's time zone; '' = no reminder
  timezone: 'Europe/Paris',
  voice_id: null,
  enabled_modes: ['story', 'object', 'task', 'listen', 'think', 'recall', 'explain', 'follow'],
  interests: [],              // the child's interests and activities, used by Buddy in conversation
};
const SETTING_KEYS = Object.keys(SETTING_DEFAULTS);
const settingsOf = (learner) => ({ ...SETTING_DEFAULTS, ...(learner?.settings || {}) });
// Listen Buddy on screen: 2–4 shapes or objects, 1–4 steps, each step naming ones that are in the item.
function followItemError(it) {
  const toks = Array.isArray(it.tokens) ? it.tokens : [];
  if (toks.length < 2 || toks.length > 4 || !toks.every(isFollowToken) || new Set(toks).size !== toks.length) return 'choose 2 to 4 different shapes or objects.';
  const steps = Array.isArray(it.steps) ? it.steps : [];
  if (!steps.length || steps.length > 4) return 'add 1 to 4 steps.';
  for (const [k, st] of steps.entries()) {
    if (!FOLLOW_STEP_TYPES.includes(st?.type)) return `step ${k + 1} needs a type.`;
    if (!st.type.startsWith('say_') && !toks.includes(st.token)) return `step ${k + 1}: choose one of this instruction's shapes or objects.`;
    if (['box', 'say_box'].includes(st.type) && !(Number(st.box) >= 1 && Number(st.box) <= FOLLOW_BOXES)) return `step ${k + 1}: choose a box from 1 to ${FOLLOW_BOXES}.`;
    if (['next_to', 'left_of', 'right_of'].includes(st.type) && (!toks.includes(st.target) || st.target === st.token)) return `step ${k + 1}: choose a different one to put it next to.`;
  }
  return null;
}
// Pictures are either a family's own upload (a uuid) or a built-in Mulberry symbol ("sym:<name>", served by the web app).
const SYMBOL_ID = /^sym:[a-z0-9-]{1,80}$/;
const isSymbol = (id) => SYMBOL_ID.test(String(id));
const imageUrl = (id) => (isSymbol(id) ? `/symbols/${String(id).slice(4)}.svg` : `/api/images/${id}?s=${hmac(id)}`);
// Every picture an activity item uses: its own, a story's sequence, and Memory Buddy's photo clues.
const imageIdsOf = (it) => [it?.image_id, ...(it?.image_ids || []), ...(it?.memories || []).map((m) => m?.image_id)].filter(Boolean);

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

const ADULT_SESSION_SECONDS = 12 * 3600;
const ADULT_REMEMBER_SECONDS = 30 * 24 * 3600;

app.post('/api/adult/login', rateLimit(10), wrap(async (req, res) => {
  const { email, password, remember } = req.body || {};
  const a = await one('select id, pass_hash from adults where email=lower($1)', [String(email || '').trim()]);
  if (!a || !checkPassword(password || '', a.pass_hash)) return res.status(401).json({ error: 'That email and password do not match.' });
  // "Keep me signed in on this device": 30 days, for the team app on a phone. Otherwise 12 hours.
  const ttl = remember === true ? ADULT_REMEMBER_SECONDS : ADULT_SESSION_SECONDS;
  res.json({ token: sign({ kind: 'adult', sub: a.id }, ttl), remember: remember === true });
}));

// ------------------------------------------------------------------ joining by invite (new families)

const inviteByToken = (token) => one(`select id, note from invites where token_hash=$1 and used_at is null and expires_at > now()`, [hmac(String(token || ''))]);
// ------------------------------------------------------------------ forgot password
// The same reply whether or not the email belongs to someone, so the form can't be used to find accounts.
const RESET_MINUTES = 60;
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
app.post('/api/adult/forgot', rateLimit(5), wrap(async (req, res) => {
  if (!emailEnabled()) return res.json({ ok: false, error: 'Password reset by email isn\u2019t set up yet. Ask the family\u2019s account owner to remove you from the team and add you again with a new temporary password.' });
  const email = String(req.body?.email || '').trim().toLowerCase();
  const a = email ? await one('select a.id, a.name from adults a where a.email=$1', [email]) : null;
  if (a) {
    const recent = await one("select count(*)::int as n from password_resets where adult_id=$1 and created_at > now() - interval '15 minutes'", [a.id]);
    if (recent.n < 3) {
      const token = crypto.randomBytes(32).toString('base64url');
      await q("insert into password_resets(token_hash, adult_id, expires_at) values ($1,$2, now() + make_interval(mins => $3))", [sha(token), a.id, RESET_MINUTES]);
      const base = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
      const link = `${base}/adult/#reset=${token}`;
      sendEmail({ to: email, ...resetEmail({ name: a.name, link, minutes: RESET_MINUTES }) })
        .catch((e) => console.error('[reset] email failed:', e.message));
    }
  }
  res.json({ ok: true });
}));
app.post('/api/adult/reset', rateLimit(10), wrap(async (req, res) => {
  const { token, password } = req.body || {};
  if (!password || String(password).length < 10) return res.status(400).json({ error: 'New passwords need at least 10 characters.' });
  const r = await one('select token_hash, adult_id from password_resets where token_hash=$1 and used_at is null and expires_at > now()', [sha(String(token || ''))]);
  if (!r) return res.status(400).json({ error: 'This link has expired or has already been used. Ask for a new one.' });
  await q('update password_resets set used_at=now() where adult_id=$1 and used_at is null', [r.adult_id]);
  // Signs this person out on every device; they sign in again with the new password.
  await q("update adults set pass_hash=$1, password_changed_at=date_trunc('second', now()) where id=$2", [hashPassword(String(password)), r.adult_id]);
  const a = await one('select email from adults where id=$1', [r.adult_id]);
  res.json({ ok: true, email: a.email });
}));

app.get('/api/invite/:token', rateLimit(30), wrap(async (req, res) => {
  const inv = await inviteByToken(req.params.token);
  res.json({ valid: !!inv });
}));
app.post('/api/invite/:token', rateLimit(10), wrap(async (req, res) => {
  const { error, value: f } = validateFamily(req.body || {});
  if (error) return res.status(400).json({ error });
  const client = await pool.connect();
  try {
    await client.query('begin');
    // Claim the invite first, so the same link can't create two families.
    const inv = (await client.query('update invites set used_at=now() where token_hash=$1 and used_at is null and expires_at > now() returning id', [hmac(String(req.params.token || ''))])).rows[0];
    if (!inv) { await client.query('rollback'); return res.status(410).json({ error: 'This invite link has expired or was already used. Ask for a new one.' }); }
    if ((await client.query('select 1 from adults where email=$1', [f.email])).rowCount) { await client.query('rollback'); return res.status(409).json({ error: 'That email already has a Buddy account. Sign in instead, or use another email.' }); }
    const l = (await client.query('insert into learners(name, birth_year, settings) values ($1,$2,$3) returning id', [f.learnerName, f.birthYear, {}])).rows[0];
    await client.query('insert into consent(learner_id) values ($1)', [l.id]);
    const a = (await client.query("insert into adults(learner_id, name, email, role, is_owner, pass_hash) values ($1,$2,$3,'parent',true,$4) returning id", [l.id, f.ownerName, f.email, hashPassword(f.password)])).rows[0];
    await client.query('update invites set learner_id=$1 where id=$2', [l.id, inv.id]);
    await client.query('commit');
    res.json({ token: sign({ kind: 'adult', sub: a.id }, 12 * 3600) });
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}));

const adult = express.Router();
adult.use(wrap(requireAdult));

adult.get('/me', wrap(async (req, res) => {
  const learner = await one('select id, name, birth_year, settings, current_activity_id from learners where id=$1', [req.learnerId]);
  const consent = await one('select agreed_at, can_view, save_audio from consent where learner_id=$1', [req.learnerId]);
  res.json({ adult: req.adult, learner: { ...learner, settings: settingsOf(learner) }, consent, voice: voiceEnabled(), email: emailEnabled(), admin: isPlatformAdmin(req.adult.email) });
}));

// Each team member chooses for themselves whether to get an email after every practice.
adult.put('/me/notifications', wrap(async (req, res) => {
  await q('update adults set email_after_practice=$1 where id=$2', [!!req.body?.email_after_practice, req.adult.id]);
  res.json({ ok: true });
}));

adult.get('/team', wrap(async (req, res) => {
  res.json(await many('select id, name, email, role, is_owner, created_at from adults where learner_id=$1 order by created_at', [req.learnerId]));
}));
adult.post('/team', requireOwner, wrap(async (req, res) => {
  const { name, role, password } = req.body || {};
  // Accept a pasted contact like "Ian Carroll <ian@example.com>" by keeping just the address.
  const email = (String(req.body?.email || '').match(/[^\s<>"]+@[^\s<>"]+\.[^\s<>"]+/) || [''])[0];
  if (!name || !email || !ROLES.includes(role) || !password || password.length < 10) return res.status(400).json({ error: 'Add a name, a valid email address, a role and a temporary password of at least 10 characters.' });
  const a = await one('insert into adults(learner_id, name, email, role, pass_hash) values ($1,$2,lower($3),$4,$5) on conflict (email) do nothing returning id', [req.learnerId, name, email, role, hashPassword(password)]);
  if (!a) return res.status(409).json({ error: 'That email already has an account.' });
  res.json({ id: a.id });
}));
adult.delete('/team/:id', requireOwner, wrap(async (req, res) => {
  await q('delete from adults where id=$1 and learner_id=$2 and is_owner=false', [req.params.id, req.learnerId]);
  res.json({ ok: true });
}));
// ------------------------------------------------------------------ platform admin (Ian): families and invites

function requirePlatformAdmin(req, res, next) {
  if (!isPlatformAdmin(req.adult?.email)) return res.status(403).json({ error: 'Only the Buddy admin can do this.' });
  next();
}
adult.get('/admin/families', requirePlatformAdmin, wrap(async (req, res) => {
  const rows = await many(`select l.id, l.name, l.birth_year, l.created_at, l.disabled_at,
      (select json_build_object('name', a.name, 'email', a.email) from adults a where a.learner_id=l.id and a.is_owner limit 1) as owner,
      (select count(*)::int from adults a where a.learner_id=l.id) as team,
      (select count(*)::int from devices d where d.learner_id=l.id and d.revoked_at is null) as devices,
      (select count(*)::int from practice_sessions s where s.learner_id=l.id and s.started_at > now() - interval '7 days') as sessions_7d,
      (select count(*)::int from practice_sessions s where s.learner_id=l.id and s.started_at > now() - interval '30 days') as sessions_30d,
      (select max(started_at) from practice_sessions s where s.learner_id=l.id) as last_practice_at,
      (select coalesce(sum(length(e.text)),0)::int from practice_events e join practice_sessions s on s.id=e.session_id where s.learner_id=l.id and e.who='buddy' and e.created_at > now() - interval '30 days') as buddy_chars_30d,
      (select count(*)::int from practice_events e join practice_sessions s on s.id=e.session_id where s.learner_id=l.id and e.who='sam' and e.kind='response' and e.created_at > now() - interval '30 days') as responses_30d
    from learners l order by l.created_at`);
  const rates = ratesFor({ ttsModel: ttsModel(), judgeModel: modelsFromEnv().main });
  res.json(rows.map((r) => ({ ...r, est_cost_30d: estimateCost({ buddyChars: r.buddy_chars_30d, responses: r.responses_30d }, rates) })));
}));
adult.post('/admin/families/:id/pause', requirePlatformAdmin, wrap(async (req, res) => {
  if (req.params.id === req.learnerId && req.body?.paused) return res.status(400).json({ error: "You can't pause your own family's account from here." });
  await q('update learners set disabled_at = case when $1 then coalesce(disabled_at, now()) else null end where id=$2', [!!req.body?.paused, req.params.id]);
  res.json({ ok: true });
}));
adult.get('/admin/invites', requirePlatformAdmin, wrap(async (req, res) => {
  res.json(await many(`select i.id, i.note, i.created_at, i.expires_at, i.used_at, l.name as learner_name
    from invites i left join learners l on l.id=i.learner_id order by i.created_at desc limit 100`));
}));
adult.post('/admin/invites', requirePlatformAdmin, wrap(async (req, res) => {
  const token = newInviteToken();
  await q(`insert into invites(token_hash, note, created_by, expires_at) values ($1,$2,$3, now() + make_interval(days => $4))`, [hmac(token), String(req.body?.note || '').slice(0, 80), req.adult.id, INVITE_DAYS]);
  const base = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  res.json({ url: `${base}/adult/?invite=${token}`, expiresInDays: INVITE_DAYS });
}));
adult.delete('/admin/invites/:id', requirePlatformAdmin, wrap(async (req, res) => {
  await q('update invites set expires_at=now() where id=$1 and used_at is null', [req.params.id]);
  res.json({ ok: true });
}));

adult.post('/password', wrap(async (req, res) => {
  const { current, next } = req.body || {};
  const a = await one('select pass_hash from adults where id=$1', [req.adult.id]);
  if (!checkPassword(current || '', a.pass_hash)) return res.status(400).json({ error: 'Your current password is not correct.' });
  if (!next || next.length < 10) return res.status(400).json({ error: 'New passwords need at least 10 characters.' });
  // Signs this person out everywhere else; this device gets a fresh sign-in of the same kind.
  await q("update adults set pass_hash=$1, password_changed_at=date_trunc('second', now()) where id=$2", [hashPassword(next), req.adult.id]);
  const remember = req.body?.remember === true;
  res.json({ ok: true, token: sign({ kind: 'adult', sub: req.adult.id }, remember ? ADULT_REMEMBER_SECONDS : ADULT_SESSION_SECONDS) });
}));

// ------------------------------------------------------------------ Sam's device (iPad)

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
  const d = await one('insert into devices(learner_id, label) values ($1,$2) returning id', [p.learner_id, String(req.body?.label || 'Device').slice(0, 60)]);
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
  if ('interests' in clean) clean.interests = cleanInterests(clean.interests);
  if ('reminder_time' in clean && !/^([01]\d|2[0-3]):[0-5]\d$/.test(clean.reminder_time || '')) clean.reminder_time = '';
  if ('timezone' in clean) { try { new Intl.DateTimeFormat('en', { timeZone: clean.timezone }); } catch { delete clean.timezone; } }
  await q('update learners set settings = settings || $1::jsonb, current_activity_id = coalesce($2, current_activity_id) where id=$3', [clean, body.current_activity_id || null, req.learnerId]);
  if (body.current_activity_id === '') await q('update learners set current_activity_id=null where id=$1', [req.learnerId]);
  res.json({ ok: true });
}));

adult.get('/activities', wrap(async (req, res) => {
  await ensureStarters(req.learnerId);
  // last_practised_at: when the learner last started this activity, for "Recently used" in each module.
  const rows = await many(`select a.id, a.mode, a.title, a.goal, a.plan_goal, a.status, a.content, a.updated_at,
      (select max(s.started_at) from practice_sessions s where s.activity_id = a.id) as last_practised_at
    from activities a where a.learner_id=$1 and a.status<>'archived' order by a.mode, a.updated_at desc`, [req.learnerId]);
  for (const r of rows) {
    const ids = (r.content.items || []).flatMap(imageIdsOf);
    r.image_urls = Object.fromEntries(ids.map((id) => [id, imageUrl(id)]));
  }
  res.json(rows);
}));
const planGoalOf = (b) => (GOAL_KEYS.includes(b.plan_goal) ? b.plan_goal : 'other');
// Every learner starts with two stories for "Listen to a Story". Added once; the team can edit or archive them.
async function ensureStarterStories(learnerId) {
  const l = await one('select settings from learners where id=$1', [learnerId]);
  if (!l || l.settings?.listen_seeded) return;
  for (const st of STARTER_STORIES) {
    await q("insert into activities(learner_id, mode, title, goal, plan_goal, status, content) values ($1,'listen',$2,$3,'other','active',$4)", [learnerId, st.title, st.goal, { items: st.items }]);
  }
  const modes = settingsOf(l).enabled_modes;
  await q('update learners set settings = settings || $1::jsonb where id=$2', [{ listen_seeded: true, enabled_modes: modes.includes('listen') ? modes : [...modes, 'listen'] }, learnerId]);
}
// Think Buddy starts with three everyday situations (plan goal 1). Added once; the team can edit or archive them.
async function ensureStarterScenarios(learnerId) {
  const l = await one('select settings from learners where id=$1', [learnerId]);
  if (!l || l.settings?.think_seeded) return;
  await q("insert into activities(learner_id, mode, title, goal, plan_goal, status, content) values ($1,'think',$2,$3,'unexpected','active',$4)", [learnerId, STARTER_SCENARIOS.title, STARTER_SCENARIOS.goal, { items: STARTER_SCENARIOS.items }]);
  const modes = settingsOf(l).enabled_modes;
  await q('update learners set settings = settings || $1::jsonb where id=$2', [{ think_seeded: true, enabled_modes: modes.includes('think') ? modes : [...modes, 'think'] }, learnerId]);
}
// Memory Buddy's "Remember My Day" has no starter content (it is about the child's own life), but is switched on once.
async function ensureRecallEnabled(learnerId) {
  const l = await one('select settings from learners where id=$1', [learnerId]);
  if (!l || l.settings?.recall_enabled) return;
  const modes = settingsOf(l).enabled_modes;
  await q('update learners set settings = settings || $1::jsonb where id=$2', [{ recall_enabled: true, enabled_modes: modes.includes('recall') ? modes : [...modes, 'recall'] }, learnerId]);
}
// Explain Buddy's "How do you…?" starts with three everyday explanations. Added once; the team can edit or archive them.
async function ensureStarterExplain(learnerId) {
  const l = await one('select settings from learners where id=$1', [learnerId]);
  if (!l || l.settings?.explain_seeded) return;
  await q("insert into activities(learner_id, mode, title, goal, plan_goal, status, content) values ($1,'explain',$2,$3,'other','active',$4)", [learnerId, STARTER_EXPLAIN.title, STARTER_EXPLAIN.goal, { items: STARTER_EXPLAIN.items }]);
  const modes = settingsOf(l).enabled_modes;
  await q('update learners set settings = settings || $1::jsonb where id=$2', [{ explain_seeded: true, enabled_modes: modes.includes('explain') ? modes : [...modes, 'explain'] }, learnerId]);
}
// Listen Buddy on screen starts with three shape-and-box instructions (plan goal 2). Added once.
async function ensureStarterFollow(learnerId) {
  const l = await one('select settings from learners where id=$1', [learnerId]);
  if (!l || l.settings?.follow_seeded) return;
  await q("insert into activities(learner_id, mode, title, goal, plan_goal, status, content) values ($1,'follow',$2,$3,'instructions','active',$4)", [learnerId, STARTER_FOLLOW.title, STARTER_FOLLOW.goal, { items: STARTER_FOLLOW.items }]);
  const modes = settingsOf(l).enabled_modes;
  await q('update learners set settings = settings || $1::jsonb where id=$2', [{ follow_seeded: true, enabled_modes: modes.includes('follow') ? modes : [...modes, 'follow'] }, learnerId]);
}
// Explain Buddy's "Describe a Picture" starts with two sets of everyday objects (Mulberry Symbols). Added once, as drafts,
// so the therapist can check the names, groups and uses before the learner sees them.
async function ensureStarterObjects(learnerId) {
  const l = await one('select settings from learners where id=$1', [learnerId]);
  if (!l || l.settings?.object_seeded) return;
  for (const a of STARTER_OBJECTS) {
    await q("insert into activities(learner_id, mode, title, goal, plan_goal, status, content) values ($1,'object',$2,$3,'other','draft',$4)", [learnerId, a.title, a.goal, { items: a.items }]);
  }
  // Describe a Picture is already on by default; a family that turned it off keeps it off.
  await q('update learners set settings = settings || $1::jsonb where id=$2', [{ object_seeded: true }, learnerId]);
}
const ensureStarters = async (learnerId) => { await ensureStarterStories(learnerId); await ensureStarterScenarios(learnerId); await ensureRecallEnabled(learnerId); await ensureStarterExplain(learnerId); await ensureStarterFollow(learnerId); await ensureStarterObjects(learnerId); };

function validateActivity(b) {
  if (!MODES[b.mode]) return 'Choose a practice type.';
  if (b.plan_goal && !GOAL_KEYS.includes(b.plan_goal)) return 'Choose which plan goal this activity practises.';
  if (!b.title?.trim()) return 'Give the activity a title.';
  const items = b.content?.items;
  if (!Array.isArray(items) || !items.length) return 'Add at least one item to practise.';
  for (const [i, it] of items.entries()) {
    if (b.mode === 'object' && (!it.name || !it.category || !it.function)) return `Item ${i + 1}: add the name, group and use.`;
    if (b.mode === 'story' && (!it.setting || !(it.events || []).filter(Boolean).length)) return `Story ${i + 1}: add the setting and at least one event.`;
    if (b.mode === 'story' && !(it.image_ids || []).length && !it.intro?.trim()) return `Story ${i + 1}: add pictures, or a line for Buddy to say first, so the learner knows which story to tell.`;
    if (b.mode === 'task' && ((it.steps || []).filter(Boolean).length < 1)) return `Task ${i + 1}: add the steps.`;
    if (b.mode === 'follow') {
      const err = followItemError(it);
      if (err) return `Instruction ${i + 1}: ${err}`;
    }
    if (b.mode === 'explain' && (!it.question?.trim() || !(it.points || []).filter((pt) => pt?.text?.trim()).length)) return `Explanation ${i + 1}: add Buddy's question and at least one part of a clear answer.`;
    if (b.mode === 'recall') {
      const n = Number(it.target ?? 3);
      if (!Number.isInteger(n) || n < 1 || n > 5) return `Memory ${i + 1}: choose how many things to remember (1 to 5).`;
      if (!it.when?.trim() && !it.prompt?.trim()) return `Memory ${i + 1}: say when it happened (e.g. "at the weekend") or write Buddy's question.`;
    }
    if (b.mode === 'think' && (!it.scenario?.trim() || !it.problem?.trim())) return `Situation ${i + 1}: describe the situation and what is unexpected about it.`;
    if (b.mode === 'conversation' && (!it.topic || !it.opener)) return `Topic ${i + 1}: add the topic and Buddy's opening line.`;
    if (b.mode === 'listen') {
      if (!it.story?.trim()) return `Story ${i + 1}: write the story Buddy will read.`;
      const qs = (it.questions || []).filter((x) => x?.question?.trim());
      if (!qs.length) return `Story ${i + 1}: add at least one question.`;
      const noAns = qs.findIndex((x) => !(x.answers || []).filter(Boolean).length);
      if (noAns >= 0) return `Story ${i + 1}, question ${noAns + 1}: add at least one accepted answer.`;
    }
  }
  return null;
}
// Pictures in an activity must be this family's own uploads or built-in symbols.
async function imagesOwned(content, learnerId) {
  const all = [...new Set((content?.items || []).flatMap(imageIdsOf).map(String))];
  if (all.some((id) => id.startsWith('sym:') && !isSymbol(id))) return false;
  const ids = all.filter((id) => !isSymbol(id));
  if (!ids.length) return true;
  if (!ids.every((id) => /^[0-9a-f-]{36}$/i.test(id))) return false;
  const n = await one('select count(*)::int n from images where id = any($1::uuid[]) and learner_id=$2', [ids, learnerId]);
  return n.n === ids.length;
}
adult.post('/activities', wrap(async (req, res) => {
  const err = validateActivity(req.body || {});
  if (err) return res.status(400).json({ error: err });
  if (!(await imagesOwned(req.body.content, req.learnerId))) return res.status(400).json({ error: 'One of the pictures could not be found. Upload it again.' });
  const { mode, title, goal = '', status = 'active' } = req.body;
  const content = stampMemories(mode, req.body.content, null);
  const a = await one('insert into activities(learner_id, mode, title, goal, plan_goal, status, content, created_by) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id', [req.learnerId, mode, title.trim(), goal, planGoalOf(req.body), status, content, req.adult.id]);
  res.json({ id: a.id });
}));
adult.put('/activities/:id', wrap(async (req, res) => {
  const err = validateActivity(req.body || {});
  if (err) return res.status(400).json({ error: err });
  if (!(await imagesOwned(req.body.content, req.learnerId))) return res.status(400).json({ error: 'One of the pictures could not be found. Upload it again.' });
  const { mode, title, goal = '', status = 'active' } = req.body;
  const prev = await one('select content from activities where id=$1 and learner_id=$2', [req.params.id, req.learnerId]);
  const content = stampMemories(mode, req.body.content, prev?.content);
  await q('update activities set mode=$1, title=$2, goal=$3, plan_goal=$4, status=$5, content=$6, updated_at=now() where id=$7 and learner_id=$8', [mode, title.trim(), goal, planGoalOf(req.body), status, content, req.params.id, req.learnerId]);
  res.json({ ok: true });
}));
adult.delete('/activities/:id', wrap(async (req, res) => {
  await q("update activities set status='archived', updated_at=now() where id=$1 and learner_id=$2", [req.params.id, req.learnerId]);
  await q('update learners set current_activity_id=null where id=$1 and current_activity_id=$2', [req.learnerId, req.params.id]);
  res.json({ ok: true });
}));
adult.get('/modes', (req, res) => {
  const extra = { follow: { objects: Object.entries(FOLLOW_OBJECTS).map(([k, o]) => ({ id: `obj-${k}`, name: o.name, img: `/symbols/${o.file}.svg` })) } };
  res.json(Object.fromEntries(Object.entries(MODES).map(([k, m]) => [k, { label: m.label, tagline: m.tagline, activityName: m.activityName, defaultGoal: m.defaultGoal, defaultCues: m.defaultCues, ...(extra[k] || {}) }])));
});
// "Buddy will say…" in the activity editor: the opening lines for one item, from the real engine,
// so the preview always matches what the learner hears. Nothing is saved.
adult.post('/preview', wrap(async (req, res) => {
  const { mode, content = {}, item } = req.body || {};
  if (!MODES[mode] || !item || typeof item !== 'object') return res.status(400).json({ error: 'Nothing to preview.' });
  const l = await one('select name, birth_year, settings from learners where id=$1', [req.learnerId]);
  const s = settingsOf(l);
  res.json(previewLines({ mode, content, item, learnerName: l.name, learnerAge: ageFrom(l.birth_year), learnerInterests: s.interests, settings: s }));
}));
// Voice picker: the account's ElevenLabs voices, and a short sample in Buddy's own words.
const voiceSample = (name) => `Hi ${name}, I'm Buddy. Make a movie in your mind. When you're ready, press to talk.`;
adult.get('/voices', wrap(async (req, res) => {
  if (!voiceEnabled()) return res.status(503).json({ error: 'Voice is not set up yet (ELEVENLABS_API_KEY).' });
  const l = await one('select settings from learners where id=$1', [req.learnerId]);
  const list = await listVoices();
  res.json({ voices: list.voices, fallback: list.fallback, reason: list.reason || null, current: settingsOf(l).voice_id || null, defaultId: defaultVoiceId() });
}));
adult.get('/voices/:id/sample', wrap(async (req, res) => {
  if (!voiceEnabled()) return res.status(503).json({ error: 'Voice is not set up yet.' });
  const id = String(req.params.id).replace(/[^A-Za-z0-9]/g, '').slice(0, 64);
  const l = await one('select name, settings from learners where id=$1', [req.learnerId]);
  const audio = await speak(voiceSample(l.name), { voiceId: id, speed: settingsOf(l).speech_speed });
  res.set('content-type', 'audio/mpeg').set('cache-control', 'private, max-age=86400').send(audio);
}));
// Story editor: hear the story in the learner's own voice and speed. The audio is saved, so when the
// learner later hears the same story it costs nothing extra.
const MAX_LISTEN_CHARS = 4000;
adult.post('/listen', wrap(async (req, res) => {
  if (!voiceEnabled()) return res.status(503).json({ error: 'Voice is not set up yet.' });
  const text = String(req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Write the story first.' });
  if (text.length > MAX_LISTEN_CHARS) return res.status(400).json({ error: `Stories can be up to ${MAX_LISTEN_CHARS} characters to listen to here.` });
  const st = settingsOf(await one('select settings from learners where id=$1', [req.learnerId]));
  const audio = await speak(text, { voiceId: st.voice_id, speed: st.speech_speed });
  res.set('content-type', 'audio/mpeg').set('cache-control', 'private, no-store').send(audio);
}));

// Story editor: "Test this question". Marks a typed answer with the same checking the learner gets.
adult.post('/test-answer', wrap(async (req, res) => {
  const { story, question, answer } = req.body || {};
  const q = question && typeof question === 'object' ? { ...question } : null;
  if (q?.kind === 'title' && !String(q.question || '').trim()) q.question = 'Can you think of a new name for this story?';
  const text = String(answer || '').trim().slice(0, 500);
  if (!q || !String(q.question || '').trim() || !text) return res.status(400).json({ error: 'Add a question and type an answer to test.' });
  if (!String(story || '').trim()) return res.status(400).json({ error: 'Write the story first.' });
  const l = await one('select name, birth_year, settings from learners where id=$1', [req.learnerId]);
  const item = { question: String(q.question).slice(0, 300), answers: Array.isArray(q.answers) ? q.answers.map(String).slice(0, 20) : [], kind: q.kind === 'title' ? 'title' : undefined, story: String(story).slice(0, MAX_LISTEN_CHARS), clarify_phrases: [] };
  const j = await judge({ mode: 'listen', item, elements: ['answer'], text, activity: { content: {} }, history: [], learner: { name: l.name, age: ageFrom(l.birth_year), interests: settingsOf(l).interests } });
  res.json({ correct: !!j.met.answer, evidence: typeof j.met.answer === 'string' && j.met.answer !== '(supplied)' ? j.met.answer : null, help: j.help && j.help !== 'none' ? j.help : null, checker: judgeKind() });
}));
adult.get('/goals', (req, res) => res.json({ goals: PLAN_GOALS, codes: SUPPORT_CODES }));

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
  res.set('content-disposition', 'attachment; filename="buddy-records.json"').json(await exportFor(req.learnerId));
}));
// ---- plan tracking: per-goal summary and CSV exports in the team's weekly-record format

// The viewer's time zone decides what counts as "a date" (the plan asks for success on two separate dates).
function tzOf(req) {
  const tz = String(req.query.tz || 'UTC');
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return tz; } catch { return 'UTC'; }
}

adult.get('/summary', wrap(requireRecordAccess), wrap(async (req, res) => {
  const tz = tzOf(req);
  const rows = await many(`select plan_goal, (created_at at time zone $2)::date::text as day,
      count(*)::int as items,
      count(success)::int as opportunities,
      count(*) filter (where success)::int as successes,
      count(*) filter (where support_code='I')::int as "I",
      count(*) filter (where support_code='M')::int as "M",
      count(*) filter (where support_code='P')::int as "P",
      count(*) filter (where support_code='F')::int as "F"
    from practice_records where learner_id=$1
    group by 1, 2 order by 2 desc`, [req.learnerId, tz]);
  res.json({ tz, days: rows });
}));

const csvCell = (v) => {
  const s = v == null ? '' : Array.isArray(v) ? v.join('; ') : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (header, rows) => '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
const goalLabel = (k) => (PLAN_GOALS[k] ? `${PLAN_GOALS[k].n < 5 ? `${PLAN_GOALS[k].n}. ` : ''}${PLAN_GOALS[k].label}` : k);
const clip = (s, n = 160) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s || '');

async function recordsForExport(learnerId, tz) {
  return many(`select r.*, to_char(r.created_at at time zone $2, 'YYYY-MM-DD') as day, to_char(r.created_at at time zone $2, 'HH24:MI') as time
    from practice_records r where r.learner_id=$1 order by r.created_at`, [learnerId, tz]);
}

// One row per goal per date — the plan's "Weekly record" columns.
adult.get('/export/weekly.csv', wrap(requireRecordAccess), wrap(async (req, res) => {
  const recs = await recordsForExport(req.learnerId, tzOf(req));
  const groups = new Map();
  for (const r of recs) {
    const k = `${r.day}|${r.plan_goal}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  const order = (k) => PLAN_GOALS[k]?.n ?? 9;
  const rows = [...groups.values()].sort((x, y) => x[0].day.localeCompare(y[0].day) || order(x[0].plan_goal) - order(y[0].plan_goal)).map((g) => {
    const counted = g.filter((r) => r.success != null);
    const codes = ['I', 'M', 'P', 'F'].map((c) => [c, g.filter((r) => r.support_code === c).length]).filter(([, n]) => n).map(([c, n]) => `${c}×${n}`).join(' ');
    const aids = [...new Set(g.flatMap((r) => r.visual_aids || []))];
    const ex = g.find((r) => r.success) || g.find((r) => r.sam_response) || g[0];
    return [
      goalLabel(g[0].plan_goal), g[0].day, "Buddy app (practice with Buddy)",
      counted.length ? `${counted.filter((r) => r.success).length}/${counted.length}` : `practice only (${g.length})`,
      codes, aids.length ? aids : 'None', clip(`${ex.item_label}: ${ex.sam_response}`),
    ];
  });
  res.set('content-type', 'text/csv; charset=utf-8').set('content-disposition', 'attachment; filename="buddy-weekly-record.csv"')
    .send(toCsv(['Goal', 'Date', 'Setting/person', 'Success out of opportunities', 'Support code', 'Visual aid', 'Brief example'], rows));
}));

// Every practice item, for anyone who wants the detail behind the weekly record.
adult.get('/export/items.csv', wrap(requireRecordAccess), wrap(async (req, res) => {
  const recs = await recordsForExport(req.learnerId, tzOf(req));
  const rows = recs.map((r) => [
    r.day, r.time, goalLabel(r.plan_goal), r.activity_title, r.item_label,
    r.success == null ? 'not counted' : r.success ? 'yes' : 'no', r.support_code || '', r.visual_aids || [], r.sam_turns ?? '', r.score_total != null ? `${r.score_first}/${r.score_total}` : '', r.score_total != null ? `${r.score_correct}/${r.score_total}` : '',
    r.sam_response, r.independent, r.after_support, r.support_provided, r.help_requests, r.review_note,
  ]);
  res.set('content-type', 'text/csv; charset=utf-8').set('content-disposition', 'attachment; filename="buddy-all-practice.csv"')
    .send(toCsv(['Date', 'Time', 'Goal', 'Activity', 'Item', 'Met target', 'Support code', 'Visual aids', "Learner's relevant turns", 'Score (first try)', 'Score (final)', "Learner's response",
      'Independently', 'After support', 'Support given', 'Asked for help', 'Note'], rows));
}));

adult.delete('/records', requireOwner, wrap(async (req, res) => {
  await q('delete from practice_sessions where learner_id=$1', [req.learnerId]);
  res.json({ ok: true });
}));

async function exportFor(learnerId) {
  return {
    exported_at: new Date().toISOString(),
    note: 'Practice records describe what happened during practice with Buddy, using the support codes from the learner\'s communication plan. They are not assessments or diagnoses; the team sets baselines and decides what counts.',
    records: await many('select activity_title, mode, plan_goal, item_label, goal, success, support_code, visual_aids, sam_turns, score_first, score_correct, score_total, sam_response, independent, support_provided, after_support, help_requests, review_note, created_at from practice_records where learner_id=$1 order by created_at', [learnerId]),
    support_codes: SUPPORT_CODES,
    observations: await many('select setting, skill, note, created_at from observations where learner_id=$1 order by created_at', [learnerId]),
  };
}

app.use('/api/adult', adult);

// ------------------------------------------------------------------ Sam's device

const device = express.Router();
device.use(wrap(requireDevice));

device.get('/home', wrap(async (req, res) => {
  await ensureStarters(req.learnerId);
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
    await q(`insert into practice_records(learner_id, session_id, activity_id, activity_title, mode, item_label, goal, sam_response, independent, support_provided, after_support, help_requests, review_note,
        plan_goal, support_code, success, visual_aids, sam_turns, score_correct, score_first, score_total)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
    [learnerId, sid, state.activity.id, state.activity.title, state.mode, r.item_label, r.goal, r.sam_response, JSON.stringify(r.independent), JSON.stringify(r.support_provided), JSON.stringify(r.after_support), JSON.stringify(r.help_requests), r.review_note,
      r.plan_goal || 'other', r.support_code || null, r.success ?? null, JSON.stringify(r.visual_aids || []), r.sam_turns ?? null, r.score_correct ?? null, r.score_first ?? null, r.score_total ?? null]);
  }
  await q('update practice_sessions set state=$1, ended_at=now(), ended_reason=$2 where id=$3', [state, reason, sid]);
  // Emails go out in the background: a slow or failed send never holds up Sam's practice.
  if (records.length) notifyPractice(learnerId, state, records, reason).catch((e) => console.error('[email]', e.message));
  return records;
}

async function notifyPractice(learnerId, state, records, reason) {
  if (!emailEnabled()) return;
  const consent = await one('select agreed_at, can_view from consent where learner_id=$1', [learnerId]);
  const adults = await many('select name, email, role, email_after_practice from adults where learner_id=$1', [learnerId]);
  const learner = await one('select name from learners where id=$1', [learnerId]);
  for (const a of recipientsFor(adults, consent)) {
    const mail = practiceEmail({ learnerName: learner.name, adultName: a.name, activityTitle: state.activity.title, records, reason, appUrl: process.env.APP_URL });
    await sendEmail({ to: a.email, ...mail });
  }
}

device.post('/practice/start', wrap(async (req, res) => {
  const consent = await one('select agreed_at from consent where learner_id=$1', [req.learnerId]);
  if (!consent?.agreed_at) return res.status(403).json({ error: 'Choose your privacy settings first.' });
  const l = await one('select name, birth_year, settings, current_activity_id from learners where id=$1', [req.learnerId]);
  const id = req.body?.activityId || l.current_activity_id;
  const act = id && await one("select id, mode, title, goal, plan_goal, content from activities where id=$1 and learner_id=$2 and status='active'", [id, req.learnerId]);
  if (!act) return res.status(404).json({ error: 'Your team has not chosen a practice yet.' });
  const { state, turn } = createSession({ activity: act, settings: settingsOf(l), learnerName: l.name, learnerAge: ageFrom(l.birth_year), learnerInterests: settingsOf(l).interests });
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

// Listen Buddy on screen: Sam tapped a shape or a box.
device.post('/practice/:sid/act', wrap(async (req, res) => {
  const s = await loadSession(req);
  const a = { type: String(req.body?.type || ''), token: String(req.body?.token || ''), box: Number(req.body?.box) };
  await q("insert into practice_events(session_id, who, kind, text) values ($1,'sam','tap',$2)", [s.id, a.type === 'box' ? `Touched box ${a.box + 1}` : `Touched the ${a.token.replace('-', ' ')}`]);
  const { state, turn } = act(s.state, a);
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

// ---------- practice reminders (web push)
device.get('/push', wrap(async (req, res) => {
  const n = await one('select count(*)::int n from push_subscriptions where device_id=$1', [req.device.id]);
  const l = await one('select settings from learners where id=$1', [req.learnerId]);
  res.json({ configured: pushEnabled(), publicKey: pushPublicKey(), subscribed: n.n > 0, reminder_time: settingsOf(l).reminder_time });
}));
device.post('/push', wrap(async (req, res) => {
  const sub = req.body?.subscription;
  if (!pushEnabled()) return res.status(503).json({ error: 'Reminders are not set up yet.' });
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth || !/^https:\/\//.test(sub.endpoint)) return res.status(400).json({ error: 'That reminder subscription is not valid.' });
  await q(`insert into push_subscriptions(learner_id, device_id, endpoint, p256dh, auth) values ($1,$2,$3,$4,$5)
    on conflict (endpoint) do update set learner_id=excluded.learner_id, device_id=excluded.device_id, p256dh=excluded.p256dh, auth=excluded.auth`,
  [req.learnerId, req.device.id, sub.endpoint, sub.keys.p256dh, sub.keys.auth]);
  res.json({ ok: true });
}));
device.delete('/push', wrap(async (req, res) => {
  await q('delete from push_subscriptions where device_id=$1', [req.device.id]);
  res.json({ ok: true });
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

// ------------------------------------------------------------------ reminder schedule

// Once a minute: send today's reminder to any learner whose chosen time has passed and who hasn't practised yet.
export async function sendDueReminders(now = new Date()) {
  if (!pushEnabled()) return 0;
  let sent = 0;
  const learners = await many(`select l.id, l.name, l.settings, l.last_reminder_on::text as last_reminder_on,
      (select max(started_at) from practice_sessions s where s.learner_id=l.id) as last_practice_at
    from learners l where l.disabled_at is null and coalesce(l.settings->>'reminder_time','') <> ''
      and exists (select 1 from push_subscriptions p where p.learner_id=l.id)`);
  for (const l of learners) {
    const st = settingsOf(l);
    if (!reminderDue({ now, timeZone: st.timezone, reminderTime: st.reminder_time, lastReminderOn: l.last_reminder_on, lastPracticeAt: l.last_practice_at })) continue;
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: st.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    await q('update learners set last_reminder_on=$1 where id=$2', [date, l.id]);
    for (const sub of await many('select id, endpoint, p256dh, auth from push_subscriptions where learner_id=$1', [l.id])) {
      try {
        if ((await sendPush(sub, reminderMessage(l.name))) === 'gone') await q('delete from push_subscriptions where id=$1', [sub.id]);
        else sent++;
      } catch (e) { console.error('[push]', e.message); }
    }
  }
  return sent;
}

const port = Number(process.env.PORT || 8787);
migrate()
  .then(() => app.listen(port, () => {
    console.log(`[sams-buddy] API on :${port}`);
    setInterval(() => sendDueReminders().catch((e) => console.error('[push]', e.message)), 60_000);
    // Saved speech: tidy once at start, then daily.
    setSpeechStore(pgSpeechStore);
    const prune = () => pruneSpeech().then((n) => n && console.log(`[tts] removed ${n} unused saved lines`)).catch((e) => console.error('[tts]', e.message));
    prune();
    setInterval(prune, 24 * 60 * 60_000);
  }))
  .catch((e) => { console.error('Migration failed', e); process.exit(1); });

process.on('SIGTERM', () => pool.end().finally(() => process.exit(0)));

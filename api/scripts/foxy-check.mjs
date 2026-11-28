// Foxy check: play realistic practice through the real coach engine and the real Claude judge, and flag the problems
// people have found by hand on the iPad: a question asked twice, a hint after a right answer, a picture that doesn't
// belong, broken text, too many questions at once, wording that talks down. With a key, a second Claude call reads
// each transcript as a reviewer would (asked something already answered, ignored what was said, confusing wording).
//
//   ANTHROPIC_API_KEY=sk-ant-... node scripts/foxy-check.mjs          # the real judge + reviewer (a few cents)
//   node scripts/foxy-check.mjs --keyword                              # offline rehearsal: keyword stand-in, rule checks only
//   node scripts/foxy-check.mjs --only think                           # scenarios whose name contains "think"
//   node scripts/foxy-check.mjs --no-review                            # skip the reviewer call
//
// Uses the same key (and ANTHROPIC_WORKSPACE_ID, if set) as on Render. Writes foxy-check.md next to this folder and
// exits with 1 when anything is flagged as a problem, so it can run before a deploy.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSession, respond, control, act } from '../src/coach/engine.js';
import { keywordJudge, makeClaudeJudge, modelsFromEnv, modelForMode } from '../src/coach/judge.js';
import { STARTER_SCENARIOS, STARTER_STORIES } from '../src/coach/modes.js';
import { LIBRARY, activityFromLibrary } from '../src/library.js';

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const KEY = (process.env.ANTHROPIC_API_KEY || '').trim();
const offline = flag('--keyword');
if (!offline && !KEY.startsWith('sk-ant-')) {
  console.error('ANTHROPIC_API_KEY is missing or isn\'t an Anthropic key (they start with "sk-ant-").');
  console.error('Copy it from Render (sams-buddy-api → Environment):  ANTHROPIC_API_KEY=sk-ant-... node scripts/foxy-check.mjs');
  console.error('Or rehearse offline with the keyword stand-in:      node scripts/foxy-check.mjs --keyword');
  process.exit(1);
}
const review = !offline && !flag('--no-review');
const WORKSPACE = (process.env.ANTHROPIC_WORKSPACE_ID || '').trim();
const HEADERS = { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01', ...(WORKSPACE ? { 'anthropic-workspace-id': WORKSPACE } : {}) };

// One tiny call first, so a wrong key, workspace or model stops here with a clear message instead of failing every practice.
if (!offline) {
  console.log(`Key: ${KEY.slice(0, 10)}… · workspace: ${WORKSPACE || '(not set)'}`);
  const model = modelsFromEnv().main;
  const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: HEADERS, body: JSON.stringify({ model, max_tokens: 1, messages: [{ role: 'user', content: 'Hi' }] }) });
  if (!res.ok) {
    const body = await res.text();
    let msg = body; try { msg = JSON.parse(body).error?.message || body; } catch { /* plain text */ }
    console.error(`\nCan't use the Claude API (${res.status}): ${msg.slice(0, 300)}`);
    if (/workspace/i.test(msg)) console.error('→ Set the workspace from Render on the same line:  ANTHROPIC_WORKSPACE_ID=wrkspc_... npm run check:foxy');
    else if (res.status === 401) console.error('→ The key was rejected. Check it is the full key from Render and starts with sk-ant-.');
    else if (/credit/i.test(msg)) console.error('→ The account is out of API credit.');
    else if (res.status === 404 || /model/i.test(msg)) console.error(`→ Check the model name (${model}), or set ANTHROPIC_MODEL.`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------- the judge (fails loudly instead of falling back)
let calls = 0;
let judgeErrors = 0;
const models = modelsFromEnv();
const claude = new Map();
const judge = offline ? async (a) => keywordJudge(a) : async (a) => {
  const model = modelForMode(a.mode, models);
  if (!claude.has(model)) claude.set(model, makeClaudeJudge({ apiKey: KEY, model, workspaceId: WORKSPACE || undefined }));
  calls += 1;
  try { return await claude.get(model)(a); } catch (e) { judgeErrors += 1; console.error(`  judge error (${model}): ${e.message}`); return keywordJudge(a); }
};

// ---------------------------------------------------------------- content
const learner = { name: 'Sam', age: 16, interests: ['drumming', 'the gym', 'Tinker Bell', 'video games'] };
const lib = (id) => { const x = LIBRARY.find((l) => l.id === id); if (!x) throw new Error(`No library activity ${id}`); return { id, status: 'active', plan_goal: 'other', ...activityFromLibrary(x) }; };
const first = (a, n = 1) => ({ ...a, content: { ...a.content, items: a.content.items.slice(0, n) } });
const think = (items) => ({ id: 'think', title: 'Everyday surprises', mode: 'think', plan_goal: 'unexpected', status: 'active', content: { items } });
const gym = STARTER_SCENARIOS.items[0];
// A Talk activity with a picture on the second topic, like the pumpkin photo Ian saw.
const autumn = { id: 'autumn', title: 'Autumn', mode: 'conversation', plan_goal: 'conversation', status: 'active', content: { practise_questions: true, items: [
  { topic: 'the weekend', opener: 'I went for a long walk on Saturday. What did you do at the weekend?', example_comment: 'I went to the gym.', example_question: 'What about you?' },
  { topic: 'Halloween', opener: 'Some people love dressing up for Halloween. What would you dress up as?', image_id: 'sym:pumpkin', example_comment: 'I would be a vampire.', example_question: 'What would you be?' },
] } };

// Listen to Instructions: real job instructions, retold in order.
const tables = { id: 'jobs', title: 'Café jobs', mode: 'task', plan_goal: 'instructions', status: 'active', content: { items: [
  { title: 'Wipe the tables', steps: ['get the cloth and spray', 'wipe each table'] }] } };

// Steps: say (expect: 'credit' = a right answer, so no hint may follow), tap (topic or board), control (a button).
const say = (text, expect = 'any') => ({ say: text, expect });
const ctl = (action) => ({ control: action });
const tap = (o) => ({ act: o });

const SCENARIOS = [
  // Think: goal 1 is to notice and say a safe thing to do.
  { name: 'think: right first time', activity: think([gym]), expectRecord: { success: true, code: 'I' },
    steps: [say('I would go and see the receptionist', 'credit'), say('She could tell me where the trainer is'), say('I would call my dad')] },
  { name: 'think: stuck, then notices', activity: think([gym]),
    steps: [say("I don't know"), ctl('hint'), say('the lights are off'), say('ask the lady at the desk', 'credit')] },
  { name: 'think: does not understand', activity: think([gym]), steps: [say("I don't know what you mean"), say('I would ask someone', 'credit')] },
  { name: 'think: unsafe idea, then safe', activity: think([gym]), steps: [say("I'd just walk home on my own"), say('ok I would ask the receptionist', 'credit')] },
  { name: 'think: card declined (library)', activity: { ...lib('think-college-work'), content: { items: [lib('think-college-work').content.items[3]] } },
    steps: [say('I would try again and then tell the person at the till', 'credit')] },
  { name: 'think: scam text (library)', activity: first(lib('think-phones-messages')), steps: [say('I would not reply and I would show my dad', 'credit')] },
  { name: 'think: short answers', activity: think([gym]), steps: [say('reception'), say('because'), say('dunno')] },

  // Talk: choose a topic, then a real back-and-forth with short, Sam-like answers.
  { name: 'talk: hobbies, taps a topic', activity: lib('talk-hobbies'),
    steps: [ctl('topic_0'), say('I play Fortnite'), say('with my cousin, we play on Saturdays'), say('do you play games?'), say('I like the building bit')] },
  { name: 'talk: says the topic, short answers', activity: lib('talk-my-day'),
    steps: [say('something funny'), say('my cousin fell over'), say('yeah'), say("I don't know"), say('nothing really')] },
  { name: 'talk: interests come up', activity: lib('talk-favourites'),
    steps: [ctl('topic_0'), say('I like drumming'), say('every day after school'), say('what music do you like?'), say('I like rock')] },
  { name: 'talk: picture belongs to its own topic', activity: autumn,
    steps: [say('the weekend'), say('I went to the pumpkin patch with my cousin'), say('we picked apples'), say('I like doing things with my cousin'), say('a vampire')] },
  { name: 'talk: does not understand', activity: lib('talk-school'), steps: [ctl('topic_0'), say("I don't understand"), say('maths'), say('because I like numbers')] },

  // Story, Describe, Explain.
  { name: 'story: whole story', activity: first(lib('tell-easy')),
    steps: [say('First the boy got up, then he had breakfast, then he went to school and finally he played football. It ended well.')] },
  { name: 'story: bit by bit', activity: first(lib('tell-easy')), steps: [say('a boy'), ctl('hint'), say('he went to school'), say("I don't know")] },
  { name: 'describe: full answer', activity: first(lib('describe-kitchen')), steps: [say('It is a spoon. It is cutlery. You eat soup with it.', 'credit')] },
  { name: 'describe: one word at a time', activity: first(lib('describe-kitchen')), steps: [say('spoon'), say('cutlery'), say('for eating')] },

  // Memory.
  { name: 'remember a story: Tinker Bell', activity: { id: 'tb', title: 'Tinker Bell', mode: 'listen', plan_goal: 'narrative', status: 'active', content: { items: STARTER_STORIES[0].items } },
    steps: [ctl('start_questions'), say('Neverland'), say('a hat'), say('Peter'), say("I don't know"), say('she glows')] },
  { name: 'word groups: fruit', activity: first(lib('memory-food-name')), steps: [say('apple banana'), say('grapes'), say("I can't think of any more")] },
  { name: 'remember my day', activity: first(lib('remember-weekend')), steps: [say('I went to the gym'), say('I watched TV'), say("I don't remember")] },

  // Listen and Task.
  { name: 'follow on screen: real places', activity: first(lib('follow-places-2')),
    steps: [tap({ type: 'token', token: 'obj-milk' }), tap({ type: 'box', box: 0 }), tap({ type: 'token', token: 'obj-cereal' }), tap({ type: 'box', box: 1 })] },
  { name: 'follow on screen: wrong place', activity: first(lib('follow-places-2')),
    steps: [tap({ type: 'token', token: 'obj-milk' }), tap({ type: 'box', box: 2 }), say('put the milk in the fridge'), tap({ type: 'token', token: 'obj-milk' }), tap({ type: 'box', box: 0 })] },
  { name: 'listen to instructions: retell', activity: tables, steps: [say('I get the cloth and the spray and then I wipe the tables')] },
  { name: 'listen to instructions: asks to clarify', activity: { ...tables, content: { items: [{ ...tables.content.items[0], unclear_instruction: 'Sort out the tables before the rush.' }] } },
    steps: [say('sorry, what do you mean?', 'credit'), say('get the cloth and spray then wipe the tables')] },

  // Help buttons in the middle of a practice.
  { name: 'help: repeat and example in Think', activity: think([gym]), steps: [ctl('repeat'), say('um'), ctl('example'), say('ask the receptionist', 'credit')] },
  { name: 'help: example in Describe', activity: first(lib('describe-kitchen')), steps: [say('spoon'), ctl('hint'), ctl('hint'), ctl('example')] },
];

// ---------------------------------------------------------------- the rule checks
const norm = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
const QUESTION_KINDS = new Set(['prompt', 'cue', 'model', 'reply', 'clarify', 'instruction']);
const TALKS_DOWN = [/good boy|good girl/i, /good listening/i, /\bgrown-?up\b/i, /well done!{2,}/i, /\bbuddy\b/i, /\bkiddo\b/i, /out of \d+ right/i];

function checkTurn(run, turn, step, before) {
  const lines = turn?.lines || [];
  for (const l of lines) {
    if (/undefined|\bnull\b|\[object|\{[a-z_]+\}|\s\.|\s{2,}/.test(l.text)) run.flags.push({ level: 'problem', rule: 'broken text', quote: l.text });
    for (const re of TALKS_DOWN) if (re.test(l.text)) run.flags.push({ level: 'warn', rule: 'talks down or old name', quote: l.text });
  }
  // A question Foxy already asked in this run (Repeat is meant to repeat).
  if (!(step.control === 'repeat')) {
    for (const l of lines.filter((x) => QUESTION_KINDS.has(x.kind) && /\?/.test(x.text))) {
      const k = norm(l.text);
      if (k.length > 12 && run.asked.has(k)) run.flags.push({ level: 'problem', rule: 'question asked twice', quote: l.text });
      run.asked.add(k);
    }
  }
  // More than two questions in one go is hard for a literal thinker.
  const qs = lines.filter((x) => x.kind !== 'story' && x.kind !== 'intro').map((x) => (x.text.match(/\?/g) || []).length).reduce((a, b) => a + b, 0);
  if (qs > 4) run.flags.push({ level: 'warn', rule: 'many questions at once', quote: lines.map((x) => x.text).join(' ') });
  // A right answer must not be followed by a hint.
  if (step.expect === 'credit' && lines.some((x) => x.kind === 'cue' || x.kind === 'model')) {
    run.flags.push({ level: 'problem', rule: 'hint after a right answer', quote: `${step.say} → ${lines.map((x) => x.text).join(' | ')}` });
  }
  // A picture must belong to the item on screen.
  const items = run.state.activity.content.items;
  const item = items[run.state.itemIndex] || {};
  const own = new Set([item.image_id, ...(item.image_ids || []), ...((item.steps || []).map((s) => s.image_id))].filter(Boolean));
  for (const img of turn?.ui?.images || []) {
    const id = String(img).startsWith('/symbols/') ? `sym:${String(img).slice(9).replace(/\.svg$/, '')}` : img;
    if (!own.has(id) && !own.has(img)) run.flags.push({ level: 'problem', rule: 'picture from another item', quote: `${img} shown with "${item.topic || item.title || ''}"` });
  }
  if (turn && !lines.length && !before.done && step.say) run.flags.push({ level: 'warn', rule: 'no reply to an answer', quote: step.say });
}

async function play(sc) {
  const run = { name: sc.name, flags: [], asked: new Set(), log: [] };
  const started = createSession({ activity: sc.activity, learnerName: learner.name, learnerAge: learner.age, learnerInterests: learner.interests, quickStart: true });
  run.state = started.state;
  const show = (turn) => (turn?.lines || []).forEach((l) => run.log.push(`Foxy${l.kind ? ` (${l.kind})` : ''}: ${l.text}`));
  show(started.turn);
  checkTurn(run, started.turn, {}, { done: false });
  for (const step of sc.steps) {
    if (run.state.done) break;
    const before = { done: run.state.done };
    let turn;
    if (step.say != null) { run.log.push(`Sam: ${step.say}`); ({ turn } = await respond(run.state, { text: step.say }, { judge })); }
    else if (step.control) { run.log.push(`Sam presses: ${step.control}`); ({ turn } = control(run.state, step.control)); }
    else { run.log.push(`Sam taps: ${JSON.stringify(step.act)}`); ({ turn } = act(run.state, step.act)); }
    show(turn);
    checkTurn(run, turn, step, before);
  }
  if (sc.expectRecord) {
    const rec = run.state.completed[0];
    if (!rec) run.flags.push({ level: 'problem', rule: 'no record', quote: 'the item did not finish' });
    else {
      if (sc.expectRecord.success != null && rec.success !== sc.expectRecord.success) run.flags.push({ level: 'problem', rule: 'record result', quote: `success ${rec.success}, expected ${sc.expectRecord.success}` });
      if (sc.expectRecord.code && rec.support_code !== sc.expectRecord.code) run.flags.push({ level: 'problem', rule: 'record code', quote: `${rec.support_code}, expected ${sc.expectRecord.code}` });
    }
  }
  return run;
}

// ---------------------------------------------------------------- the reviewer (a second Claude call per transcript)
const REVIEW_MODEL = (process.env.REVIEW_MODEL || '').trim() || models.main;
async function reviewRun(run) {
  const tool = {
    name: 'report', description: 'Report problems in this practice transcript.',
    input_schema: { type: 'object', required: ['issues'], properties: { issues: { type: 'array', items: { type: 'object', required: ['type', 'quote', 'why'], properties: {
      type: { type: 'string', enum: ['asked_already_answered', 'ignored_answer', 'confusing_or_abstract', 'several_questions_at_once', 'talks_down', 'gives_answer_away', 'off_topic_jump', 'wrong_feedback', 'other'] },
      quote: { type: 'string', description: "Foxy's exact words" }, why: { type: 'string', description: 'One short sentence' } } } } } },
  };
  const prompt = `You review one practice transcript from TALVO, a speech and language practice app. Foxy is the coach. Sam is ${learner.age}, autistic, and takes language literally. Foxy should sound like a good coach or older peer: one clear question at a time, concrete, building on what Sam just said, never repeating a question Sam has answered, never talking down. Hints are expected when Sam is stuck; they are not a problem in themselves.

Report only real problems a speech therapist would want fixed. An empty list is a good result. Ignore the "Sam presses" and "Sam taps" lines except as context.

Activity: ${run.state.activity.title} (${run.state.mode})

${run.log.join('\n')}`;
  const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: HEADERS, body: JSON.stringify({ model: REVIEW_MODEL, max_tokens: 1200, tools: [tool], tool_choice: { type: 'tool', name: 'report' }, messages: [{ role: 'user', content: prompt }] }) });
  calls += 1;
  if (!res.ok) throw new Error(`review ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const out = (await res.json()).content.find((c) => c.type === 'tool_use')?.input?.issues || [];
  for (const i of out) run.flags.push({ level: 'review', rule: i.type.replace(/_/g, ' '), quote: i.quote, why: i.why });
}

// ---------------------------------------------------------------- run and report
const list = SCENARIOS.filter((s) => !only || s.name.includes(only));
console.log(`Foxy check: ${list.length} practices, ${offline ? 'keyword stand-in (offline rehearsal)' : `Claude judge (${models.main}${models.chat !== models.main ? `, Talk: ${models.chat}` : ''})`}${review ? `, reviewer ${REVIEW_MODEL}` : ''}\n`);
const runs = [];
for (const sc of list) {
  let run;
  try { run = await play(sc); } catch (e) { run = { name: sc.name, flags: [{ level: 'problem', rule: 'crashed', quote: e.message }], log: [], state: { activity: { title: '' } } }; }
  if (review && run.log.length) { try { await reviewRun(run); } catch (e) { run.flags.push({ level: 'warn', rule: 'reviewer failed', quote: e.message }); } }
  runs.push(run);
  const p = run.flags.filter((f) => f.level === 'problem').length;
  const r = run.flags.filter((f) => f.level === 'review').length;
  const w = run.flags.filter((f) => f.level === 'warn').length;
  console.log(`${p ? '✗' : r ? '?' : '✓'} ${run.name}${p ? `  ${p} problem${p > 1 ? 's' : ''}` : ''}${r ? `  ${r} for review` : ''}${w ? `  ${w} warning${w > 1 ? 's' : ''}` : ''}`);
}

const problems = runs.reduce((n, r) => n + r.flags.filter((f) => f.level === 'problem').length, 0);
const reviewed = runs.reduce((n, r) => n + r.flags.filter((f) => f.level === 'review').length, 0);
const md = [`# Foxy check`, '', `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · ${list.length} practices · ${offline ? 'keyword stand-in' : `judge ${models.main}`}${review ? ` · reviewer ${REVIEW_MODEL}` : ''} · ${calls} API calls${judgeErrors ? ` · ${judgeErrors} judge errors (fell back to keywords)` : ''}`, '',
  `**${problems} problem${problems === 1 ? '' : 's'}**${review ? `, **${reviewed} for review**` : ''}. Problems are rule checks that should never fail; "for review" items are the reviewer's opinion, to read and judge.`, '',
  ...(offline ? ['Offline rehearsal: the keyword stand-in misses answers the real judge accepts (such as "go and see the receptionist"), so "hint after a right answer" and record checks can fail here and pass with the real judge.', ''] : [])];
for (const r of runs) {
  md.push(`## ${r.flags.some((f) => f.level === 'problem') ? '✗' : r.flags.some((f) => f.level === 'review') ? '?' : '✓'} ${r.name}`, '');
  for (const f of r.flags) md.push(`- **${f.level}: ${f.rule}**: "${f.quote}"${f.why ? `. ${f.why}` : ''}`);
  if (r.flags.length) md.push('');
  md.push('```', ...r.log, '```', '');
}
const outFile = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'foxy-check.md');
fs.writeFileSync(outFile, md.join('\n'));
if (offline) console.log('\n(Offline: the keyword stand-in misses some right answers, so a few "hint after a right answer" flags are expected here.)');
console.log(`\n${problems} problem${problems === 1 ? '' : 's'}${review ? `, ${reviewed} for review` : ''}. ${calls} API calls. Full transcripts: ${path.relative(process.cwd(), outFile)}`);
process.exit(problems ? 1 : 0);

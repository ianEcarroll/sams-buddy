// Compare two Claude models on the same learner answers before switching ANTHROPIC_MODEL.
//
//   ANTHROPIC_API_KEY=sk-ant-your-key node scripts/compare-models.mjs              # Haiku vs Sonnet
//   ANTHROPIC_API_KEY=sk-ant-your-key node scripts/compare-models.mjs claude-haiku-5-5 claude-sonnet-5-5
//
// Use the same key (and ANTHROPIC_WORKSPACE_ID, if set) as on Render. Uses the real marking code (makeClaudeJudge) and the starter content,
// so it calls the API about 60 times (~30 answers x 2 models; a few cents). Writes model-comparison.md.
import fs from 'node:fs';
import { makeClaudeJudge } from '../src/coach/judge.js';
import { STARTER_STORIES, STARTER_SCENARIOS, STARTER_EXPLAIN } from '../src/coach/modes.js';

const [A = 'claude-haiku-5-5', B = 'claude-sonnet-5-5'] = process.argv.slice(2);
const KEY = (process.env.ANTHROPIC_API_KEY || '').trim();
if (!KEY || !KEY.startsWith('sk-ant-')) {
  console.error('ANTHROPIC_API_KEY is missing or isn\'t an Anthropic key (they start with "sk-ant-").');
  console.error('Copy the real key from Render (sams-buddy-api → Environment), e.g.:');
  console.error('  ANTHROPIC_API_KEY=sk-ant-... node scripts/compare-models.mjs');
  process.exit(1);
}
const HEADERS = { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01', ...(process.env.ANTHROPIC_WORKSPACE_ID ? { 'anthropic-workspace-id': process.env.ANTHROPIC_WORKSPACE_ID } : {}) };

// Check the key and both model names with one tiny call each, so a mistake stops here with a clear message.
for (const model of [A, B]) {
  const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: HEADERS, body: JSON.stringify({ model, max_tokens: 1, messages: [{ role: 'user', content: 'Hi' }] }) });
  if (!res.ok) {
    const body = await res.text();
    let msg = body; try { msg = JSON.parse(body).error?.message || body; } catch { /* plain text */ }
    console.error(`Can't use ${model} (${res.status}): ${msg.slice(0, 300)}`);
    if (res.status === 401) console.error('→ The API key was rejected. Check it is the full key, copied from Render.');
    else if (res.status === 404 || /model/i.test(msg)) console.error('→ Check the model name, or pass two names: node scripts/compare-models.mjs <model-a> <model-b>');
    else if (res.status === 400 && /credit/i.test(msg)) console.error('→ The account is out of API credit.');
    process.exit(1);
  }
}

const learner = { name: 'Sam', age: 15, interests: ['drumming', 'gym', 'Disney'] };

// ---------------------------------------------------------------- the answers to check
const story = STARTER_STORIES[0].items[0];
const listen = (qi, text, right, why) => ({
  group: 'Story questions (accepted answers)', label: `Q${qi + 1}: "${text}"`, expect: right ? 'right' : 'wrong', why,
  args: { mode: 'listen', item: { ...story.questions[qi], story: story.story, clarify_phrases: [] }, elements: ['answer'], text },
  read: (j) => (j.met.answer ? 'right' : 'wrong'),
});
const gym = STARTER_SCENARIOS.items[0];
const think = (text, expect, why) => ({
  group: 'Think Buddy (safety)', label: `"${text}"`, expect, why,
  args: { mode: 'think', item: gym, elements: ['problem', 'action', 'reason', 'backup'], text },
  // "unsafe" beats everything; otherwise whether a safe action was found.
  read: (j) => (j.unsafe ? 'unsafe' : j.met.action ? 'safe action' : 'no action'),
});
const sandwich = STARTER_EXPLAIN.items[0];
const explain = (text, expectParts, why) => ({
  group: 'Explain Buddy (parts of an answer)', label: `"${text}"`, expect: expectParts.join(',') || 'none', why,
  args: { mode: 'explain', item: sandwich, elements: sandwich.points.map((_, i) => `point_${i}`), text },
  read: (j) => Object.entries(j.met).filter(([, v]) => v).map(([k]) => Number(k.slice(6)) + 1).join(',') || 'none',
});
const chatItem = { topic: 'the gym', opener: 'Do you go to the gym?' };
const chat = (text, relevant, why) => ({
  group: 'Chat Buddy (reply quality: read these)', label: `"${text}"`, expect: relevant ? 'on topic' : 'off topic', why,
  args: { mode: 'conversation', item: chatItem, elements: ['turn'], text, history: [{ who: 'Buddy', text: chatItem.opener }], inviteQuestion: true },
  read: (j) => (j.relevant ? 'on topic' : 'off topic'),
  reply: true,
});

const CASES = [
  listen(0, 'it was on that island, Neverland', true, 'answer inside a sentence'),
  listen(0, 'never never land', true, 'near miss of an accepted answer'),
  listen(1, 'the little silver thing you put on your finger for sewing', true, 'describes a thimble without the word'),
  listen(1, 'a ring', false, 'plausible but wrong'),
  listen(2, 'the boy who never grows up', true, 'describes Peter Pan without the name'),
  listen(2, 'Wendy', false, 'a character, but the wrong one'),
  listen(3, 'a big black bird', true, 'accepted via "bird"'),
  listen(3, 'a raven', true, 'synonym not in the list'),
  listen(3, 'a cat', false, 'wrong animal'),
  listen(4, 'she goes all sparkly and bright', true, 'same meaning, different words'),
  listen(4, 'she cries', false, 'wrong'),
  listen(2, "I don't know", false, 'no answer'),
  think("I'd ask the lady at the front desk where he is", 'safe action', 'starter good action, own words'),
  think("I'd ask for help", 'safe action', 'asking for help always counts'),
  think('wait a bit, and if he still doesn\'t come I\'d ring my mum because she can sort it out', 'safe action', 'action + reason + plan B'),
  think("I'd just walk home by myself", 'unsafe', 'leaving alone'),
  think("I'd go with the man in the car park, he said he knows my trainer", 'unsafe', 'going with a stranger'),
  think("I'd do my workout on my own on the big machines", 'unsafe', 'not in the unsafe list: needs judgement'),
  think('I dunno', 'no action', 'no answer'),
  explain('you get two bits of bread, put cheese on, then the other bread on top and eat it', ['1', '2', '3', '4'], 'all four parts'),
  explain('bread and ham', ['1', '2'], 'very short'),
  explain('you put the stuff in the middle', ['2'], 'vague but has the filling'),
  explain('I like sandwiches', [], 'no parts'),
  chat('yeah I go on tuesdays with my coach', true, 'on topic, personal'),
  chat('I did drumming yesterday', false, 'changes topic to an interest'),
  chat('yes', true, 'very short'),
];

// ---------------------------------------------------------------- run
console.log(`Key and models OK. Checking ${CASES.length} answers with each model (about a minute)…`);
// Wrap fetch so we can count tokens and time each call.
function meter() {
  const m = { calls: 0, input: 0, output: 0, ms: 0, errors: 0, lastError: '' };
  const fetchImpl = async (url, init) => {
    const t = Date.now();
    const res = await fetch(url, init);
    m.ms += Date.now() - t; m.calls += 1;
    if (!res.ok) { m.errors += 1; m.lastError = `${res.status}: ${(await res.clone().text()).slice(0, 200)}`; return res; }
    const data = await res.json();
    m.input += data.usage?.input_tokens || 0; m.output += data.usage?.output_tokens || 0;
    return { ok: true, json: async () => data, text: async () => JSON.stringify(data) };
  };
  return { m, fetchImpl };
}
const runs = {};
for (const model of [A, B]) {
  const { m, fetchImpl } = meter();
  const judge = makeClaudeJudge({ apiKey: KEY, model, workspaceId: process.env.ANTHROPIC_WORKSPACE_ID, fetchImpl });
  const results = [];
  for (const c of CASES) {
    if (process.stdout.isTTY) { const w = Math.max(20, (process.stdout.columns || 80) - 1); process.stdout.write(`${model}: ${c.group.split(' (')[0]} ${c.label}`.slice(0, w).padEnd(w) + '\r'); }
    try {
      const j = await judge({ activity: { content: {} }, learner, history: [], ...c.args });
      results.push({ got: c.read(j), reply: j.reply });
    } catch (e) { results.push({ got: `error: ${e.message.slice(0, 80)}` }); }
  }
  runs[model] = { m, results };
}
if (process.stdout.isTTY) process.stdout.write(' '.repeat(Math.max(20, (process.stdout.columns || 80) - 1)) + '\r');

// ---------------------------------------------------------------- report
const ok = (c, r) => r.got === c.expect;
const out = [`# Model comparison: ${A} vs ${B}`, '', `${new Date().toISOString().slice(0, 16).replace('T', ' ')} · ${CASES.length} answers · learner "${learner.name}", ${learner.age}`, ''];
out.push('| | ' + [A, B].join(' | ') + ' |', '|---|---|---|');
out.push('| Matched the expected result | ' + [A, B].map((x) => `${CASES.filter((c, i) => ok(c, runs[x].results[i])).length} / ${CASES.length}`).join(' | ') + ' |');
out.push('| Average time per check | ' + [A, B].map((x) => `${(runs[x].m.ms / Math.max(1, runs[x].m.calls) / 1000).toFixed(1)} s`).join(' | ') + ' |');
out.push('| Tokens in / out (all checks) | ' + [A, B].map((x) => `${runs[x].m.input.toLocaleString()} / ${runs[x].m.output.toLocaleString()}`).join(' | ') + ' |');
out.push('| API errors | ' + [A, B].map((x) => runs[x].m.errors).join(' | ') + ' |', '');
for (const x of [A, B]) if (runs[x].m.lastError) out.push(`Last API error from ${x}: \`${runs[x].m.lastError.replace(/`/g, "'")}\``, '');
let group = '';
CASES.forEach((c, i) => {
  if (c.group !== group) {
    group = c.group;
    out.push('', `## ${group}`, '', `| Answer | Why it's here | Expected | ${A} | ${B} |`, '|---|---|---|---|---|');
  }
  const cell = (x) => { const r = runs[x].results[i]; return `${ok(c, r) ? '✅' : '❌'} ${r.got}`; };
  out.push(`| ${c.label} | ${c.why} | ${c.expect} | ${cell(A)} | ${cell(B)} |`);
});
const chats = CASES.map((c, i) => [c, i]).filter(([c]) => c.reply);
if (chats.length) {
  out.push('', '## What Buddy would say back in Chat Buddy', '');
  for (const [c, i] of chats) {
    out.push(`**Sam: ${c.label}**`, '', `- ${A}: ${runs[A].results[i].reply || '(no reply)'}`, `- ${B}: ${runs[B].results[i].reply || '(no reply)'}`, '');
  }
}
out.push('', 'Expected results are judgement calls: a ❌ on a borderline case (e.g. the big machines) is worth a look, not automatically a failure.');
fs.writeFileSync('model-comparison.md', out.join('\n'));
console.log(out.slice(0, 12).join('\n'));
console.log('\nFull report: model-comparison.md');

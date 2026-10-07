// The judge only answers "what did Sam supply?" against the team's answer key.
// It never decides what Buddy does next — the engine does that deterministically.
//
// Judgement shape (both judges return this):
// {
//   met: { [element]: evidence | null },   // evidence = Sam's own words
//   inOrder: true | false | null,          // story/task: were the events/steps he gave in order?
//   help: 'none'|'repeat'|'dont_understand'|'need_help'|'show_me'|'check_with_coach'|'other_clarification',
//   relevant, connection, question,        // conversation
//   garbled: boolean,                      // transcript looks like a recognition error
//   reply: string | null                   // conversation only: Buddy's next line
// }

import { MODES, DEFAULT_CLARIFY_PHRASES } from './modes.js';

// ---------- deterministic help-request detection (runs before any model) ----------
const HELP_PATTERNS = [
  ['repeat', /\b(could|can|would) you (please )?(say|repeat) (that|it)( again)?\b|\brepeat (that|it|please)\b|\bsay (that|it) again\b|\bpardon\b|\bwhat did you say\b/i],
  ['show_me', /\b(can|could) you show me\b|\bshow me (the )?(first step|how|an example)\b/i],
  ['dont_understand', /\bi (don'?t|do not) understand\b|\bi('m| am) (confused|not sure what)\b|\bwhat do you mean\b|\bi don'?t get it\b/i],
  ['check_with_coach', /\b(check|ask) (with )?my (job )?coach\b/i],
  ['need_help', /\bi need (some )?help\b|\bhelp me\b|\bcan you help\b/i],
];

export function detectHelp(text, extraPhrases = []) {
  const t = String(text || '').trim();
  if (!t) return 'none';
  for (const [kind, re] of HELP_PATTERNS) if (re.test(t)) return kind;
  const norm = (s) => s.toLowerCase().replace(/[^a-z' ]/g, '').trim();
  for (const p of extraPhrases) if (p && norm(t).includes(norm(p))) return 'other_clarification';
  return 'none';
}

// ---------- keyword judge: offline fallback + tests ----------
const STOP = new Set('the a an and then he she they it is are was were to of in on at for with his her their into from up down out over this that'.split(' '));
const words = (s) => String(s || '').toLowerCase().match(/[a-z']+/g) || [];
const keyWords = (s) => words(s).filter((w) => w.length > 3 && !STOP.has(w));
const stem = (w) => w.replace(/(ing|ed|es|s)$/, '');
function findAny(text, candidates) {
  const tw = words(text);
  const ts = tw.map(stem);
  for (const c of candidates.filter(Boolean)) {
    const cw = words(c);
    if (cw.length > 1) { if (String(text).toLowerCase().includes(String(c).toLowerCase())) return c; continue; }
    const cs = stem(cw[0] || '');
    const i = ts.indexOf(cs);
    if (cs && i >= 0) return tw[i];
  }
  return null;
}
function firstIndex(text, candidates) {
  const tw = words(text).map(stem);
  let best = -1;
  for (const c of candidates) {
    const i = tw.indexOf(stem(c));
    if (i >= 0 && (best < 0 || i < best)) best = i;
  }
  return best;
}

export function keywordJudge({ mode, item, elements, text, activity }) {
  const out = { met: {}, inOrder: null, help: detectHelp(text, item.clarify_phrases), relevant: false, connection: false, question: false, garbled: false, reply: null };
  for (const el of elements) out.met[el] = null;

  if (mode === 'object') {
    out.met.name = findAny(text, [item.name, ...(item.name_alternatives || [])]);
    out.met.category = findAny(text, [item.category, ...(item.category_alternatives || [])]);
    out.met.function = findAny(text, item.function_keywords?.length ? item.function_keywords : keyWords(item.function));
  }

  if (mode === 'story' || mode === 'task') {
    const list = mode === 'story' ? (item.events || []) : (item.steps || []);
    const prefix = mode === 'story' ? 'event_' : 'step_';
    const kwLists = list.map((e, i) => (item.keywords?.[i]?.length ? item.keywords[i] : keyWords(e)));
    const positions = [];
    kwLists.forEach((kws, i) => {
      const hit = findAny(text, kws);
      out.met[`${prefix}${i}`] = hit;
      if (hit) positions.push(firstIndex(text, kws));
    });
    if (mode === 'story') {
      out.met.where = findAny(text, [item.setting, ...(item.setting_alternatives || []), ...keyWords(item.setting)]);
      if (elements.includes('vocabulary')) out.met.vocabulary = findAny(text, [...(item.target_words || []), ...(item.word_alternatives || [])]);
    }
    if (positions.length >= 2) out.inOrder = positions.every((p, i) => i === 0 || p > positions[i - 1]);
  }

  if (mode === 'conversation') {
    const topicWords = [...keyWords(item.topic), ...(item.keywords || [])];
    out.relevant = !!findAny(text, topicWords) || /\b(me too|i did|i do|i have|i went|i like|i love|i saw|i watched|my )/i.test(text);
    out.connection = /\b(i|me|my)\b/i.test(text) && /\b(too|also|did|have|went|was|saw|watched|like|love|play|played)\b/i.test(text);
    out.question = /\?\s*$/.test(text) || /^(what|where|when|who|why|how|do|did|does|are|is|can|have)\b/i.test(String(text).trim());
    const lines = item.buddy_lines || [];
    out.reply = lines.length ? lines[Math.floor(Math.random() * lines.length)] : 'That sounds interesting.';
    out.met.turn = (out.relevant || out.connection || out.question) ? text : null;
  }
  return out;
}

// ---------- Claude judge ----------
const HELP_ENUM = ['none', 'repeat', 'dont_understand', 'need_help', 'show_me', 'check_with_coach', 'other_clarification'];

function answerKey(mode, item, activity) {
  const c = activity?.content || {};
  if (mode === 'object') return {
    picture_shows: item.name, approved_names: [item.name, ...(item.name_alternatives || [])],
    group: item.category, approved_groups: [item.category, ...(item.category_alternatives || [])],
    use: item.function, approved_use_wordings: item.function_keywords || [],
  };
  if (mode === 'story') return {
    setting: item.setting, approved_setting_wordings: item.setting_alternatives || [],
    events_in_order: item.events, target_words: item.target_words || [], approved_alternative_words: item.word_alternatives || [],
  };
  if (mode === 'task') return { steps_in_order: item.steps, instruction_given: MODES.task.instruction(item) };
  if (mode === 'conversation') return { topic: item.topic, buddy_last_said: null, practise_questions: !!c.practise_questions };
  return {};
}

const ELEMENT_GUIDE = {
  object: 'name = he named the object (approved name or obvious variant e.g. plural, "a"/"the"). category = he named its group (approved group only, or an obvious synonym of it). use = he said what it is used for, in any wording with the same meaning.',
  story: 'where = he said where it happens. event_N = he described event N (meaning, not exact words). order = only judge in events_in_order. vocabulary = he used one of the target words or approved alternatives AND it fits the picture/action.',
  task: 'step_N = his retelling includes step N (meaning, not exact words). order = only judge in events_in_order.',
  conversation: 'turn = he made a relevant comment, a personal connection, or a question on the topic. Any of these is a valid turn.',
};

const SYSTEM = `You assess one spoken practice response from Sam, an 18-year-old practising speech and language skills set by his speech therapist.
You only report what Sam supplied, measured against the team's answer key. You do not coach, correct grammar, or judge pronunciation.
Rules:
- Judge meaning, not polish. Short, concise answers are complete if they contain the element.
- Repetition of a word is fine when it is accurate.
- Never credit an element Sam did not say. Evidence must be Sam's own words copied from the transcript.
- Accept approved alternatives from the answer key. Do not invent stricter targets.
- The transcript comes from speech recognition. If it looks like a recognition error (garbled, wrong-language fragments, words that make no sense in context) set transcript_seems_garbled = true rather than treating it as a language mistake.
- help_request: classify if Sam is asking for repetition, saying he doesn't understand, asking for help, asking to be shown, or saying he needs to check with his job coach. Otherwise "none".
Always respond by calling the report tool.`;

function convReplyRules(inviteQuestion) {
  return `Also write "reply": Buddy's next conversational line. Rules: 1–2 short sentences, plain friendly English for an 18-year-old, stay on the topic, acknowledge what Sam said (if he shared a personal connection, show you noticed it), add one brief comment of your own. ${inviteQuestion ? 'You may end with one simple question.' : 'Do NOT ask a question.'} If Sam asked you a question, answer it briefly first. Never give advice about safety, strangers, travel or work. Never pretend to be a person; you are Buddy, a practice app.`;
}

export function makeClaudeJudge({ apiKey, model, workspaceId, fetchImpl = fetch }) {
  return async function claudeJudge({ mode, item, elements, text, activity, history = [], inviteQuestion = true }) {
    const quickHelp = detectHelp(text, item.clarify_phrases || DEFAULT_CLARIFY_PHRASES);
    const tool = {
      name: 'report',
      description: 'Report what Sam supplied in this response.',
      input_schema: {
        type: 'object',
        properties: {
          elements: {
            type: 'array',
            items: {
              type: 'object',
              properties: { element: { type: 'string', enum: elements }, supplied: { type: 'boolean' }, evidence: { type: 'string', description: "Sam's exact words, or empty" } },
              required: ['element', 'supplied', 'evidence'],
            },
          },
          events_in_order: { type: 'string', enum: ['yes', 'no', 'not_applicable'], description: 'If he mentioned 2+ events/steps in this response, were they in the right order?' },
          help_request: { type: 'string', enum: HELP_ENUM },
          relevant_to_topic: { type: 'boolean' },
          personal_connection: { type: 'boolean' },
          asked_question: { type: 'boolean' },
          transcript_seems_garbled: { type: 'boolean' },
          reply: { type: 'string' },
        },
        required: ['elements', 'events_in_order', 'help_request', 'transcript_seems_garbled'],
      },
    };
    const user = [
      `Mode: ${mode}`,
      `Elements to assess: ${elements.join(', ')}`,
      `Element guide: ${ELEMENT_GUIDE[mode]}`,
      `Answer key: ${JSON.stringify(answerKey(mode, item, activity))}`,
      history.length ? `Conversation so far (most recent last):\n${history.map((h) => `${h.who}: ${h.text}`).join('\n')}` : '',
      `Sam's response (speech-to-text): """${text}"""`,
      mode === 'conversation' ? convReplyRules(inviteQuestion) : 'Set reply to an empty string.',
    ].filter(Boolean).join('\n\n');

    const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', ...(workspaceId ? { 'anthropic-workspace-id': workspaceId } : {}) },
      // tool_choice "auto" works on every model (some reject a forced tool); the system prompt requires the call.
      body: JSON.stringify({ model, max_tokens: 2000, system: `${SYSTEM}\nAlways answer by calling the report tool exactly once. Do not reply with plain text.`, tools: [tool], tool_choice: { type: 'auto' }, messages: [{ role: 'user', content: user }] }),
    });
    if (!res.ok) throw new Error(`Claude ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const input = data.content?.find((b) => b.type === 'tool_use')?.input;
    if (!input) throw new Error('Claude returned no assessment');

    const out = { met: {}, inOrder: null, help: 'none', relevant: false, connection: false, question: false, garbled: false, reply: null };
    for (const el of elements) out.met[el] = null;
    for (const e of input.elements || []) {
      if (elements.includes(e.element) && e.supplied) out.met[e.element] = (e.evidence || '').trim() || '(supplied)';
    }
    out.inOrder = input.events_in_order === 'yes' ? true : input.events_in_order === 'no' ? false : null;
    out.help = quickHelp !== 'none' ? quickHelp : (HELP_ENUM.includes(input.help_request) ? input.help_request : 'none');
    out.relevant = !!input.relevant_to_topic;
    out.connection = !!input.personal_connection;
    out.question = !!input.asked_question;
    out.garbled = !!input.transcript_seems_garbled;
    out.reply = mode === 'conversation' ? (input.reply || '').trim() || null : null;
    if (mode === 'conversation') out.met.turn = (out.relevant || out.connection || out.question) ? text : null;
    return out;
  };
}

// Pick the judge from the environment. Keyword judge keeps the app usable without a model key.
export function judgeFromEnv(env = process.env) {
  if (env.ANTHROPIC_API_KEY && env.JUDGE !== 'keyword') {
    const claude = makeClaudeJudge({ apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL || 'claude-sonnet-5-5', workspaceId: env.ANTHROPIC_WORKSPACE_ID });
    return async (args) => {
      try { return await claude(args); }
      catch (err) { console.error('[judge] falling back to keyword judge:', err.message); return keywordJudge(args); }
    };
  }
  return async (args) => keywordJudge(args);
}

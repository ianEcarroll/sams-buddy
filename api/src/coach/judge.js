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

import { MODES, DEFAULT_CLARIFY_PHRASES, whoList } from './modes.js';

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

// In Think Buddy, "I'd ask for help" or "I'd check with my coach" is an answer to the situation, not a request
// to Buddy. Only clear requests to Buddy (repeat, don't understand, show me) count as help there.
const THINK_HELP = new Set(['repeat', 'dont_understand', 'show_me']);
export function helpFor(mode, kind) {
  return mode === 'think' && !THINK_HELP.has(kind) ? 'none' : kind;
}

// ---------- keyword judge: offline fallback + tests ----------
// Everyday verbs say nothing about WHICH thing was done ("went" to the gym vs "went" to the cinema).
const COMMON_VERBS = new Set('went going played play watched visited made bought walked stayed took have had with some'.split(' '));
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

const eventWords = (e) => words(e).filter((w) => w.length >= 3 && !STOP.has(w) && !COMMON_VERBS.has(w));

export function keywordJudge({ mode, item, elements, text, activity }) {
  const out = { met: {}, inOrder: null, help: helpFor(mode, detectHelp(text, item.clarify_phrases)), unsafe: false, relevant: false, connection: false, question: false, garbled: false, reply: null };
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
      if (elements.includes('who')) out.met.who = findAny(text, whoList(item).flatMap((w) => [w, ...keyWords(w)]));
      if (elements.includes('ending')) out.met.ending = findAny(text, keyWords(item.outcome));
      out.met.where = findAny(text, [item.setting, ...(item.setting_alternatives || []), ...keyWords(item.setting)]);
      if (elements.includes('vocabulary')) out.met.vocabulary = findAny(text, [...(item.target_words || []), ...(item.word_alternatives || [])]);
    }
    if (positions.length >= 2) out.inOrder = positions.every((p, i) => i === 0 || p > positions[i - 1]);
  }

  if (mode === 'listen') {
    // "Give the story a new name": no single right answer, so any real attempt counts.
    out.met.answer = item.kind === 'title'
      ? (/\w/.test(text) && !/\b(don'?t know|dunno|no idea|not sure|pass)\b/i.test(text) ? text.trim() : null)
      : findAny(text, item.answers || []);
  }

  if (mode === 'steps') {
    // Basic checker: the answer shares the step's key words, or (for why / how-do-you-know questions)
    // gives a reason or a check in a few words. Claude judges meaning; this only keeps the app usable without it.
    const dunno = /\b(don'?t know|dunno|no idea|not sure|pass)\b/i.test(text);
    const keys = [...keyWords(item.step), ...keyWords(item.example_answer || '')];
    const hit = findAny(text, keys);
    const reason = /\b(because|so (that|it|i|you|they)|to make|it helps|otherwise|cause|'cause)\b/i.test(text);
    const check = /\b(look|looks|check|see|neat|tidy|flat|straight|finished|done|same|match|like the picture)\b/i.test(text);
    const enough = words(text).length >= 3;
    out.met.answer = dunno ? null
      : item.skill === 'reasoning' ? (reason || hit) && enough ? text : null
      : item.skill === 'independence' ? (check || hit) && enough ? text : null
      : hit;
  }

  if (mode === 'explain') {
    (item.points || []).filter((pt) => pt?.text).forEach((pt, i) => {
      if (elements.includes(`point_${i}`)) out.met[`point_${i}`] = findAny(text, pt.keywords?.length ? pt.keywords : eventWords(pt.text));
    });
  }

  if (mode === 'recall') {
    // Each clause that says the learner did something counts as one thing remembered.
    const mems = (item.memories || []).filter((m) => m?.event);
    const clauses = String(text).split(/\b(?:and then|and|then|also)\b|[.,;!?]/i).map((c) => c.trim()).filter(Boolean);
    out.events = [];
    for (const c of clauses) {
      const known = mems.findIndex((m) => findAny(c, eventWords(m.event)));
      const did = /\b(i|we|me and|my)\b/i.test(c) && /\b(went|go|going|played|play|watched|saw|ate|had|did|visited|made|met|bought|swam|ran|walked|drummed|practi[sc]ed|cooked|baked|stayed|rode|drove|took|got|was|were)\b/i.test(c);
      if (known >= 0 || did) out.events.push({ text: c, known });
    }
    out.met.memory = out.events.length ? text : null;
  }

  if (mode === 'think') {
    const actions = [...(item.good_actions || []).flatMap(keyWords), 'ask', 'tell', 'call', 'message', 'staff', 'teacher', 'adult', 'parent', 'mum', 'dad', 'mom'];
    out.met.action = findAny(text, actions);
    out.met.problem = findAny(text, keyWords(item.problem)) || (out.met.action ? text : null);
    out.met.reason = /\b(because|so that|so (i|they|he|she|we)|that way|cause|'cause)\b/i.test(text) ? text : null;
    out.met.backup = /\b(if (that|it|they) (doesn'?t|does not|didn'?t|did not|don'?t|isn'?t|wasn'?t)|otherwise|instead|someone else|then i'?d|if not)\b/i.test(text) ? text : null;
    out.unsafe = !!findAny(text, (item.unsafe || []).filter((u) => words(u).length > 1));
    if (out.unsafe) out.met.action = null;
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
    who_was_there: whoList(item), how_it_ended: item.outcome || null,
    events_in_order: item.events, target_words: item.target_words || [], approved_alternative_words: item.word_alternatives || [],
  };
  if (mode === 'task') return { steps_in_order: item.steps, instruction_given: MODES.task.instruction(item) };
  if (mode === 'conversation') return { topic: item.topic, buddy_last_said: null, practise_questions: !!c.practise_questions };
  if (mode === 'listen') return item.kind === 'title'
    ? { story: item.story, question: item.question, question_type: 'new_title' }
    : { story: item.story, question: item.question, accepted_answers: item.answers || [] };
  if (mode === 'steps') return {
    task: item.task, skill_practised: item.skill, step_number: item.step_number, this_step: item.step,
    previous_step: item.previous_step, next_step: item.next_step, buddy_has_said_this_step_aloud: !!item.said_step_already,
    question: item.question, example_answer: item.example_answer,
  };
  if (mode === 'explain') return {
    question: item.question, parts_of_a_clear_explanation: (item.points || []).filter((pt) => pt?.text).map((pt, i) => ({ element: `point_${i}`, part: pt.text })),
  };
  if (mode === 'recall') return {
    question: MODES.recall.prompt(item), time_period: item.when || null,
    things_the_family_says_they_did: (item.memories || []).filter((m) => m?.event).map((m, i) => ({ index: i, event: m.event })),
    already_remembered_earlier: item.already_recalled || [],
  };
  if (mode === 'think') return {
    situation: item.scenario, what_is_unexpected: item.problem, approved_safe_responses: item.good_actions || [],
    example_reason: item.reason_example || null, example_backup_plan: item.backup_example || null, not_safe: item.unsafe || [],
  };
  return {};
}

const ELEMENT_GUIDE = {
  object: 'name = the learner named the object (approved name or obvious variant e.g. plural, "a"/"the"). category = they named its group (approved group only, or an obvious synonym of it). use = they said what it is used for, in any wording with the same meaning.',
  story: 'who = they said who was there (any one of the people listed, or an obvious way of naming them such as "my dad" for Dad). ending = they said how it ended or the outcome (meaning, not exact words). where = the learner said where it happens. event_N = they described event N (meaning, not exact words). order = only judge in events_in_order. vocabulary = they used one of the target words or approved alternatives AND it fits the picture/action.',
  task: 'step_N = the learner\'s retelling includes step N (meaning, not exact words). order = only judge in events_in_order.',
  listen: 'answer = the learner\'s response correctly answers the question, judged against the story and the accepted answers. Accept any wording, synonym or partial answer with the same meaning (e.g. "a bird" for "crow" only if bird is accepted; "Peter" for "Peter Pan"). A wrong or unrelated answer, or "I don\'t know", is not supplied. Evidence = their answer words. If question_type is "new_title" there is no single right answer: answer = any short, sensible name for the story that fits what happened (the original title, a character or event from the story, or a playful but related name all count). "I don\'t know", unrelated words or a whole retelling instead of a name do not count.',
  explain: 'The learner is explaining how they do something. point_N = their explanation includes part N (meaning, not exact words; their own way of saying it counts, and an example counts for a general part such as "a filling like ham or cheese"). A very short answer that only hints at a part (e.g. "Cut paper." for "cut the character out with scissors") counts only if the meaning of that part is actually there. Do not credit a part just because it is implied by another.',
  recall: 'Memory practice: the learner is asked to remember real things they did. memory = they described at least one real thing they did or experienced (evidence = their words). Also fill "events": one entry per DIFFERENT thing they say they did in this response, as a short phrase in their own words (e.g. "went to the gym"). Set known to the index of the matching thing the family listed, or -1 if it is something else (it still counts: the family list is not complete). Leave out anything already_remembered_earlier, repeats, "I don\'t know", and simple yes/no answers. Several details about one activity are one event, not several.',
  think: 'This is a problem-solving role-play: Buddy described a situation and asked what the learner would do. The whole response may cover several parts at once. problem = they show they noticed what is wrong or unexpected (naming it, or giving a response that clearly deals with that specific problem). action = they say a safe, sensible thing they would do; asking a trusted adult, staff member, teacher or parent always counts; compare with the approved responses by meaning, not wording, and accept other safe, sensible ideas too. An unsafe idea (in not_safe, or plainly unsafe such as leaving alone, going with a stranger, or anything risky) is NOT an action: set unsafe_idea = true. reason = they explain why their idea would help ("because…", "so that…", or a clear reason in other words). backup = they say what they would do if their first idea did not work. Saying what they WOULD do in the situation (e.g. "I\'d ask my coach for help", "I need help so I\'d ask the staff") is an answer, not a help_request; help_request is only for asking Buddy itself (e.g. "Can you say that again?", "I don\'t understand the question").',
  steps: 'The learner is doing a real task step by step and Buddy asked one question about this step. answer = the response is a sensible, correct answer to the question for THIS step (meaning, not exact words; the example answer is one good answer, not the only one). By skill: understanding = they show they understood the instruction (saying the key action or thing is enough, e.g. "the sleeves"); memory = they say what this step is (when Buddy has not said it yet) or the step asked about; expressive = they describe what they did in this step in their own words, ideally a sentence (a single word like "folded" counts only if it clearly names the action); reasoning = any sensible reason why the step matters, or a sensible plan if something goes wrong; independence = any sensible way of checking the step is finished, or what to do next time. "I don\'t know", unrelated words, or describing a different step do not count.',
  conversation: 'turn = the learner made a relevant comment, a personal connection, or a question on the topic. Any of these is a valid turn.',
};

// Who Buddy is talking to: first name, age when the family gave a year of birth, and the interests the family entered.
const describe = (learner = {}) => {
  const name = learner.name || 'the learner';
  const age = Number(learner.age) > 0 ? `a ${learner.age}-year-old` : 'a young person';
  const interests = (Array.isArray(learner.interests) ? learner.interests : []).map((i) => String(i).replace(/["\n\r]/g, '').slice(0, 40)).filter(Boolean).slice(0, 15);
  return { name, age, interests };
};

// The family's list of interests: context only. It helps spot personal connections and gives Buddy things to talk about.
function interestsLine(learner) {
  const { name, interests } = describe(learner);
  return interests.length ? ` ${name}'s family says ${name} enjoys: ${interests.join(', ')}. Mentioning one of these counts as a personal connection when it relates to the topic.` : '';
}
function interestsReply(learner) {
  const { name, interests } = describe(learner);
  if (!interests.length) return '';
  return `- Things ${name} enjoys: ${interests.join(', ')}. When it fits the topic naturally, link your comment to one of them (e.g. "That reminds me of ${interests[0]}."). Don't force it, don't change the topic to it, and don't list them.\n`;
}

export function systemFor(learner) {
  const { name, age } = describe(learner);
  return `You assess one spoken practice response from ${name}, ${age} practising speech and language skills set by their speech therapist.
You only report what ${name} supplied, measured against the team's answer key. You do not coach, correct grammar, or judge pronunciation.
Rules:
- Judge meaning, not polish. Short, concise answers are complete if they contain the element.
- Repetition of a word is fine when it is accurate.
- Never credit an element ${name} did not say. Evidence must be ${name}'s own words copied from the transcript.
- Accept approved alternatives from the answer key. Do not invent stricter targets.
- The transcript comes from speech recognition. If it looks like a recognition error (garbled, wrong-language fragments, words that make no sense in context) set transcript_seems_garbled = true rather than treating it as a language mistake.
- A response that links the topic to ${name}'s own life counts as a personal connection.${interestsLine(learner)}
- help_request: classify if ${name} is asking for repetition, saying they don't understand, asking for help, asking to be shown, or saying they need to check with their job coach. Otherwise "none".
Always respond by calling the report tool.`;
}

function convReplyRules(inviteQuestion, learner) {
  const { name, age } = describe(learner);
  return `Also write "reply": Buddy's next conversational line. Rules: 1–2 short sentences, plain friendly English for ${age}, stay on the topic, acknowledge what ${name} said (if they shared a personal connection, show you noticed it), add one brief comment of your own. ${inviteQuestion ? 'You may end with one simple question.' : 'Do NOT ask a question.'} If ${name} asked you a question, answer it briefly first. Never give advice about safety, strangers, travel or work.
Staying in the conversation:
- You are Buddy, a friendly conversation partner. ${name} already knows this is practice, so never mention being an app, an AI, a computer or a program, and never talk about what you can or cannot do (seeing, hearing, colours, eating, going places, remembering).
- Talk like a friendly person on the phone: share simple likes, opinions and everyday comments in character. If ${name} asks something you can't really know (e.g. "what colour is my shirt?"), turn it back to them warmly ("Ooh, tell me! Is that your favourite colour?").
- Only if ${name} sincerely asks whether you are a real person, say briefly that you're their practice buddy, then carry on with the topic.
- Never comment on ${name}'s progress: no "well done for asking a question", "you made a connection", "task complete", goals, levels or scores. Progress is recorded separately for the adults.
${interestsReply(learner)}- Don't tell ${name} to ask you a question; the app handles that. Vary your wording and don't reuse phrases from earlier in the conversation.`;
}

export function makeClaudeJudge({ apiKey, model, workspaceId, fetchImpl = fetch }) {
  return async function claudeJudge({ mode, item, elements, text, activity, history = [], inviteQuestion = true, learner = {} }) {
    const who = describe(learner).name;
    const quickHelp = detectHelp(text, item.clarify_phrases || DEFAULT_CLARIFY_PHRASES);
    const tool = {
      name: 'report',
      description: `Report what ${who} supplied in this response.`,
      input_schema: {
        type: 'object',
        properties: {
          elements: {
            type: 'array',
            items: {
              type: 'object',
              properties: { element: { type: 'string', enum: elements }, supplied: { type: 'boolean' }, evidence: { type: 'string', description: `${who}'s exact words, or empty` } },
              required: ['element', 'supplied', 'evidence'],
            },
          },
          events_in_order: { type: 'string', enum: ['yes', 'no', 'not_applicable'], description: 'If they mentioned 2+ events/steps in this response, were they in the right order?' },
          help_request: { type: 'string', enum: HELP_ENUM },
          relevant_to_topic: { type: 'boolean' },
          personal_connection: { type: 'boolean' },
          asked_question: { type: 'boolean' },
          transcript_seems_garbled: { type: 'boolean' },
          events: {
            type: 'array',
            description: 'Recall mode only: each different thing the learner says they did.',
            items: { type: 'object', properties: { text: { type: 'string' }, known: { type: 'integer' } }, required: ['text', 'known'] },
          },
          unsafe_idea: { type: 'boolean', description: 'Think mode only: the learner suggested something unsafe.' },
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
      `${who}'s response (speech-to-text): """${text}"""`,
      mode === 'conversation' ? convReplyRules(inviteQuestion, learner) : 'Set reply to an empty string.',
    ].filter(Boolean).join('\n\n');

    const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', ...(workspaceId ? { 'anthropic-workspace-id': workspaceId } : {}) },
      // tool_choice "auto" works on every model (some reject a forced tool); the system prompt requires the call.
      body: JSON.stringify({ model, max_tokens: 2000, system: `${systemFor(learner)}\nAlways answer by calling the report tool exactly once. Do not reply with plain text.`, tools: [tool], tool_choice: { type: 'auto' }, messages: [{ role: 'user', content: user }] }),
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
    out.help = helpFor(mode, quickHelp !== 'none' ? quickHelp : (HELP_ENUM.includes(input.help_request) ? input.help_request : 'none'));
    out.unsafe = mode === 'think' && !!input.unsafe_idea;
    if (mode === 'recall') {
      out.events = (Array.isArray(input.events) ? input.events : [])
        .map((e) => ({ text: String(e?.text || '').trim().slice(0, 200), known: Number.isInteger(e?.known) ? e.known : -1 }))
        .filter((e) => e.text);
    }
    if (out.unsafe && out.met.action) out.met.action = null;
    out.relevant = !!input.relevant_to_topic;
    out.connection = !!input.personal_connection;
    out.question = !!input.asked_question;
    out.garbled = !!input.transcript_seems_garbled;
    out.reply = mode === 'conversation' ? (input.reply || '').trim() || null : null;
    if (mode === 'conversation') out.met.turn = (out.relevant || out.connection || out.question) ? text : null;
    return out;
  };
}

// Which Claude model checks each module. ANTHROPIC_MODEL is used everywhere; ANTHROPIC_CHAT_MODEL (optional)
// overrides it for Chat Buddy, the one module where Claude follows an open conversation rather than an answer key.
export const DEFAULT_MODEL = 'claude-sonnet-5-5';
export function modelsFromEnv(env = process.env) {
  const main = (env.ANTHROPIC_MODEL || '').trim() || DEFAULT_MODEL;
  const chat = (env.ANTHROPIC_CHAT_MODEL || '').trim() || main;
  return { main, chat };
}
export const modelForMode = (mode, models) => (mode === 'conversation' ? models.chat : models.main);

// Pick the judge from the environment. Keyword judge keeps the app usable without a model key.
export function judgeFromEnv(env = process.env, { fetchImpl = fetch } = {}) {
  if (env.ANTHROPIC_API_KEY && env.JUDGE !== 'keyword') {
    const models = modelsFromEnv(env);
    const judges = new Map();
    const judgeFor = (model) => {
      if (!judges.has(model)) judges.set(model, makeClaudeJudge({ apiKey: env.ANTHROPIC_API_KEY, model, workspaceId: env.ANTHROPIC_WORKSPACE_ID, fetchImpl }));
      return judges.get(model);
    };
    return async (args) => {
      try { return await judgeFor(modelForMode(args.mode, models))(args); }
      catch (err) { console.error('[judge] falling back to keyword judge:', err.message); return keywordJudge(args); }
    };
  }
  return async (args) => keywordJudge(args);
}

// Coaching engine.
//   Prompt → wait → listen → recognise what Sam supplied → offer ONE relevant cue if needed → allow another attempt.
// Pure state machine: no I/O except the injected `judge`. State is JSON so it can live in Postgres.

import { RECALL_FRESH_DAYS as RECALL_DAYS } from './modes.js';
import { detectHelp } from './judge.js';
import { FOLLOW_BOXES, followSteps, followStepText, followInstruction, tokenName, tokenImage, tokenWords, followThing } from './modes.js';
import { MODES, LEVELS, TEAM_PHRASE, DEFAULT_CLARIFY_PHRASES, cueLadder, describe, labelFor, freshMemories, whenNoun } from './modes.js';
import { PLAN_GOALS, supportCode, successFor } from './goals.js';
import { STEP_SKILLS, STEP_LEVELS, stepCoach, stepSkillOf, stepRunOf } from './modes.js';

const DEFAULTS = {
  think_seconds: 8,        // quiet time after "Make a movie in your mind" before the prompt
  fade_support: true,      // start later items at a lighter cue level
  max_attempts: 6,         // per item, then Buddy closes the item kindly
  session_minutes: 15,     // checked only between items — never shown as a timer
  turns_per_topic: 3,      // conversation
  cue_cards: true,
  explain_buttons: true,   // at the start of each practice, Buddy explains Repeat / Help me / Let me think / Try again
};

// Story questions: how many extra rounds at the missed questions the team allows (0 = none). Set per activity.
const DEFAULT_LISTEN_RETRIES = 2;
const MAX_LISTEN_RETRIES = 4;

const line = (text, kind = 'say', extra = {}) => ({ text, kind, ...extra });
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// ---------------------------------------------------------------- session lifecycle

const learnerOf = (state) => ({ name: state.learnerName, age: state.learnerAge, interests: state.learnerInterests || [] });

export function createSession({ activity, settings = {}, learnerName = '', learnerAge = null, learnerInterests = [], now = Date.now() }) {
  const items = activity.content?.items || [];
  if (!items.length) throw new Error('This activity has no items yet.');
  const state = {
    v: 1,
    mode: activity.mode,
    activity: { id: activity.id, title: activity.title, goal: activity.goal, plan_goal: activity.plan_goal || 'other', content: activity.content },
    settings: { ...DEFAULTS, ...settings },
    itemIndex: 0,
    item: null,
    fade: {},
    completed: [],
    lastLines: [],
    pending: null,
    paused: false,
    done: false,
    startedAt: now,
    learnerName,
    learnerAge,
    learnerInterests,
  };
  // Welcome lines come first but stay out of lastLines, so Repeat replays the task, not the greeting.
  const lines = [...welcomeLines(state), ...openItem(state)];
  return { state, turn: state.mode === 'listen' ? listenTurn(state, lines) : state.mode === 'follow' ? followTurn(state, lines) : state.mode === 'steps' ? stepsTurn(state, lines) : makeTurn(state, lines) };
}

// A warm start to every practice, and (if the team leaves it on) what the four buttons do.
function welcomeLines(state) {
  const name = state.learnerName ? ` ${state.learnerName}` : '';
  const lines = [line(`Hi${name}! It's great to see you. Take your time, and remember, you can always ask me for help.`, 'welcome')];
  if (state.settings.explain_buttons) {
    lines.push(line('You can use the buttons at the bottom whenever you like. Repeat, to hear it again. Help me, for a clue. Let me think, for extra time. And Try again, to have another go.', 'welcome'));
  }
  return lines;
}

// What Buddy says when an item starts, plus the simpler wording used for "I don't understand".
// Used by the activity editor's preview; it runs the same code as a real practice.
export function previewLines({ mode, content = {}, item, learnerName = '', learnerAge = null, learnerInterests = [], settings = {} }) {
  try {
    const activity = { id: null, title: '', goal: '', plan_goal: 'other', mode, content: { ...content, items: [item] } };
    const { turn } = createSession({ activity, settings, learnerName, learnerAge, learnerInterests });
    const lines = turn.lines.filter((l) => l.kind !== 'welcome' && String(l.text || '').trim()).map((l) => ({ text: l.text, kind: l.kind }));
    const simple = MODES[mode].simplePrompt ? MODES[mode].simplePrompt(item) : null;
    return { lines, simple: simple && String(simple).trim() ? simple : null };
  } catch {
    return { lines: [], simple: null };
  }
}

function newItemState(state) {
  const m = MODES[state.mode];
  const item = curItem(state);
  const elements = m.elements(item, state.activity);
  const st = {
    elements,
    met: {},
    skipped: {},
    supportGiven: [],
    anySupport: false,
    focus: null,
    focusLevel: -1,
    attempts: 0,
    responses: [],
    help: [],
    modelGiven: {},
    orderBroken: false,
    phase: 'answer',
    asked: {},       // think: follow-up questions already asked (why? / what if that doesn't work?)
    unsafe: [],      // think: ideas the judge flagged as unsafe, in the learner's words
    recalled: [],    // recall: things remembered so far { text, known } (known = index in item.memories or -1)
    clueFor: null,   // recall: which listed memory the current clues are about
    showImage: null, // recall: photo shown as the strongest clue
  };
  if (state.mode === 'task' && item.unclear_instruction) { st.phase = 'clarify'; st.elements.unshift('clarify'); }
  if (state.mode === 'conversation') st.conv = { validTurns: 0, questionAsked: false, turns: [], noted: {} };
  if (state.mode === 'listen') st.listen = { phase: 'story', round: 1, queue: [], pos: 0, results: {}, helped: false };
  if (state.mode === 'steps') st.steps = { phase: 'step', pos: 0, said: false, level: -1, tries: 0, results: {}, visual: false, sawStep: {}, list: false, retellTries: 0, retell: null };
  return st;
}

const curItem = (s) => s.activity.content.items[s.itemIndex];

// Each item in an activity is led in the same conversational way in every module:
// "Here's the first situation." → "On to the next situation." → "And here's the last situation."
// One item on its own gets no lead. Stories (Listen to a Story) lead in from storyLines.
const ITEM_NOUN = { steps: 'task', object: 'picture', story: 'story', task: 'job', follow: 'instruction', explain: 'question', recall: 'question', think: 'situation', conversation: 'topic', listen: 'story' };
const NEXT_ITEM = ['On to the next {noun}.', "Here's the next {noun}.", 'Now for the next {noun}.'];
export function itemLead(state) {
  const total = state.activity.content.items?.length || 1;
  const i = state.itemIndex;
  const noun = ITEM_NOUN[state.mode] || 'one';
  if (total <= 1) return null;
  if (i === 0) return `Here's the first ${noun}.`;
  if (i === total - 1) return `And here's the last ${noun}.`;
  return NEXT_ITEM[(i - 1) % NEXT_ITEM.length].replace('{noun}', noun);
}

function openItem(state) {
  state.item = newItemState(state);
  const item = curItem(state);
  const m = MODES[state.mode];
  const think = state.settings.think_seconds;
  const lines = [];
  const lead = state.mode === 'listen' ? null : itemLead(state);
  if (lead) lines.push(line(lead, 'intro'));
  if (state.mode === 'object') {
    lines.push(line(m.prompt(item), 'prompt'));
  } else if (state.mode === 'story') {
    // Optional opening line from the team, e.g. "Let's tell the story of your trip to Ireland."
    if (item.intro) lines.push(line(item.intro, 'intro'));
    lines.push(line(TEAM_PHRASE, 'movie', { pauseAfter: think }));
    lines.push(line(m.prompt(item), 'prompt'));
  } else if (state.mode === 'task') {
    if (!lead) lines.push(line("Here's your job.", 'intro'));
    if (state.item.phase === 'clarify') {
      lines.push(line(item.unclear_instruction, 'instruction'));
      lines.push(line(TEAM_PHRASE, 'movie', { pauseAfter: think }));
      lines.push(line('Then tell me the instructions back.', 'prompt'));
    } else {
      lines.push(line(m.instruction(item), 'instruction'));
      lines.push(line(TEAM_PHRASE, 'movie', { pauseAfter: think }));
      lines.push(line(m.prompt(item), 'prompt'));
    }
  } else if (state.mode === 'follow') {
    const st = state.item;
    st.board = { pos: {}, selected: null, highlight: null };
    for (const [tok, box] of Object.entries(item.start || {})) if ((item.tokens || []).includes(tok)) st.board.pos[tok] = Number(box) - 1;
    st.phase = 'act';
    st.diag = {};
    st.showStep = null;
    st.repeats = 0;
    if (item.intro) lines.push(line(item.intro, 'intro'));
    lines.push(line('Listen to all of it first.', 'intro'));
    const instr = line(followInstruction(item), 'instruction');
    lines.push(instr);
    lines.push(line(TEAM_PHRASE, 'movie', { pauseAfter: think }));
    lines.push(line(m.prompt(item), 'prompt'));
    st.instructionLine = instr;
  } else if (state.mode === 'explain') {
    if (item.intro) lines.push(line(item.intro, 'intro'));
    lines.push(line(TEAM_PHRASE, 'movie', { pauseAfter: think }));
    lines.push(line(m.prompt(item), 'prompt'));
  } else if (state.mode === 'recall') {
    state.item.mems = freshMemories(item, state.startedAt);
    if (item.intro) lines.push(line(item.intro, 'intro'));
    lines.push(line(TEAM_PHRASE, 'movie', { pauseAfter: think }));
    lines.push(line(m.prompt(item), 'prompt'));
  } else if (state.mode === 'think') {
    if (item.intro) lines.push(line(item.intro, 'intro'));
    if (!lead) lines.push(line("Here's a situation.", 'intro'));
    lines.push(line(item.scenario || '', 'instruction'));
    lines.push(line(TEAM_PHRASE, 'movie', { pauseAfter: think }));
    lines.push(line(m.prompt(item), 'prompt'));
  } else if (state.mode === 'conversation') {
    lines.push(line(item.opener || `Let's talk about ${item.topic}.`, 'prompt'));
  } else if (state.mode === 'listen') {
    return storyLines(state);
  } else if (state.mode === 'steps') {
    return stepsOpen(state, lines);
  }
  state.lastLines = lines;
  return lines;
}

// ---------------------------------------------------------------- Sam responds

/**
 * @param input { text, displayText?, uncertain? }  uncertain = speech recognition was unsure
 */
export async function respond(state, input, { judge }) {
  if (state.done) return { state, turn: makeTurn(state, []) };
  state.paused = false;
  const text = String(input.text || '').trim();
  if (state.mode === 'listen' && state.item.listen.phase === 'story') return { state, turn: listenTurn(state, startQuestions(state)) };
  if (state.mode === 'listen' && state.item.listen.phase === 'offer') return listenOfferSpoken(state, text);
  if (state.mode === 'steps' && ['doing', 'indep'].includes(state.item.steps.phase)) return { state, turn: stepsTurn(state, stepsSpokenWhileDoing(state, text)) };
  if (!text) {
    return { state, turn: makeTurn(state, [line("I didn't hear anything. Take your time, and press Talk when you're ready.", 'clarify')]) };
  }
  if (input.uncertain && !input.confirmed) return askToConfirm(state, input);
  if (state.mode === 'follow') return { state, turn: followSpeech(state, input.displayText || text) };
  if (state.mode === 'steps') return stepsAnswer(state, { text, displayText: input.displayText || text, confirmed: !!input.confirmed }, judge);
  return process_(state, { text, displayText: input.displayText || text, confirmed: !!input.confirmed }, judge);
}

function askToConfirm(state, input) {
  state.pending = { text: input.text, displayText: input.displayText || input.text };
  const t = makeTurn(state, [line(`I want to check I heard you. Did you say: "${input.text}"?`, 'check_heard')], 'confirm');
  t.ui.heard = input.text;
  return { state, turn: t };
}

/** Sam answers the "did I hear you right?" check. Not counted as an attempt either way. */
export async function confirmHeard(state, yes, { judge }) {
  const p = state.pending;
  state.pending = null;
  if (!p) return { state, turn: makeTurn(state, []) };
  if (!yes) return { state, turn: makeTurn(state, [line('Thanks. Please say it again whenever you are ready.', 'clarify')]) };
  if (state.mode === 'steps') return stepsAnswer(state, { ...p, confirmed: true }, judge);
  return process_(state, { ...p, confirmed: true }, judge);
}

async function process_(state, { text, displayText, confirmed }, judge) {
  const m = MODES[state.mode];
  const it = state.item;
  const item = curItem(state);

  if (state.mode === 'listen') return listenAnswer(state, { text, displayText, confirmed }, judge);

  const conv = it.conv;
  const practiseQ = !!state.activity.content.practise_questions;
  const inviteQuestion = state.mode === 'conversation'
    ? !(practiseQ && !conv.questionAsked && conv.validTurns >= 1) && conv.validTurns + 1 < state.settings.turns_per_topic
    : false;

  const history = state.mode === 'conversation'
    ? [{ who: 'Buddy', text: item.opener }, ...conv.turns.flatMap((t) => [{ who: state.learnerName || 'Learner', text: t.text }, ...(t.reply ? [{ who: 'Buddy', text: t.reply }] : [])])]
    : [];

  const judgeElements = state.mode === 'conversation' ? ['turn'] : state.mode === 'recall' ? ['memory'] : it.elements.filter((e) => e !== 'order' && e !== 'clarify');
  const judgeItem = state.mode === 'recall' ? { ...item, memories: it.mems || [], already_recalled: it.recalled.map((r) => r.text) } : item;
  const j = await judge({ mode: state.mode, item: judgeItem, elements: judgeElements, text, activity: state.activity, history, inviteQuestion, learner: learnerOf(state) });

  if (j.garbled && !confirmed) return askToConfirm(state, { text, displayText });

  it.responses.push({ text: displayText, afterSupport: it.anySupport });

  if (j.help && j.help !== 'none') return { state, turn: makeTurn(state, handleHelp(state, j.help, text, 'spoken')) };

  if (state.mode === 'conversation') return { state, turn: makeTurn(state, conversationTurn(state, j, text)) };

  // Task, clarification phase: success = Sam asks for clarification.
  if (state.mode === 'task' && it.phase === 'clarify') {
    it.attempts += 1;
    if (it.focus !== 'clarify') { it.focus = 'clarify'; it.focusLevel = -1; }
    if (it.modelGiven.clarify) {
      // He has had the model once; give the clear instruction anyway and move on to retelling.
      it.skipped.clarify = true;
      return { state, turn: makeTurn(state, [line('Here is the instruction again, more clearly.', 'intro'), ...clearInstructionLines(state)]) };
    }
    return { state, turn: makeTurn(state, [giveCue(state, 'clarify', 'buddy')]) };
  }

  it.attempts += 1;
  if (j.unsafe) it.unsafe.push(displayText);
  const newly = state.mode === 'recall' ? absorbRecall(state, j) : absorb(state, j);
  const lines = [];
  if (allMet(state)) return { state, turn: makeTurn(state, completeItem(state, newly)) };

  if (newly.length) lines.push(line(`You ${describe(state.mode, newly, item)}.`, 'feedback'));

  // After a model, one more attempt; if the element is still missing, note it and move to the next one.
  if (it.focus && it.modelGiven[it.focus] && !it.met[it.focus]) it.skipped[it.focus] = true;
  if (allMet(state) || it.attempts >= state.settings.max_attempts) return { state, turn: makeTurn(state, completeItem(state, newly)) };

  const focus = nextMissing(state);
  // Think Buddy: "Why…?" and "What if that doesn't work?" are part of the activity, asked once as plain
  // follow-up questions before any cue. They are not counted as support.
  const follow = m.followUp?.(focus, it);
  if (follow && !it.asked[focus]) {
    it.asked[focus] = true;
    it.focus = focus;
    it.focusLevel = 0; // a later cue for this part starts at the specific cue
    const q = line(follow, 'prompt');
    state.lastLines = [q];
    lines.push(q);
    return { state, turn: makeTurn(state, lines) };
  }
  lines.push(giveCue(state, focus, 'buddy'));
  return { state, turn: makeTurn(state, lines) };
}

// Merge a judgement into the item state; return elements newly supplied on this attempt.
function absorb(state, j) {
  const it = state.item;
  const newly = [];
  for (const el of it.elements) {
    if (el === 'order' || it.met[el]) continue;
    if (j.met[el]) {
      it.met[el] = { evidence: j.met[el], independent: !it.anySupport, level: maxLevelFor(it, el), attempt: it.attempts };
      newly.push(el);
    }
  }
  if (it.elements.includes('order') && !it.met.order) {
    if (j.inOrder === false) it.orderBroken = true;
    const seq = it.elements.filter((e) => e.startsWith('event_') || e.startsWith('step_'));
    // Order is credited once every event/step is there and EITHER this one response told them all in order,
    // OR he supplied them across attempts in sequence and never out of order.
    const allNow = seq.every((e) => j.met[e]);
    const attempts = seq.map((e) => it.met[e]?.attempt ?? Infinity);
    const sequential = attempts.every((a, i) => i === 0 || a >= attempts[i - 1]);
    if (seq.every((e) => it.met[e]) && ((allNow && j.inOrder === true) || (sequential && !it.orderBroken))) {
      it.met.order = { evidence: j.inOrder === true ? 'told in order' : 'given in order across attempts', independent: !it.anySupport, level: maxLevelFor(it, 'order') };
      newly.push('order');
    }
  }
  return newly;
}

// Memory Buddy (recall): each new, different thing remembered fills the next memory slot.
function absorbRecall(state, j) {
  const it = state.item;
  const newly = [];
  const norm = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  for (const ev of j.events || []) {
    const known = Number.isInteger(ev.known) ? ev.known : -1;
    const dup = it.recalled.some((r) => (known >= 0 && r.known === known) || norm(r.text) === norm(ev.text));
    if (dup || !norm(ev.text)) continue;
    const slot = it.elements.find((e) => !it.met[e] && !it.skipped[e]);
    if (!slot) break;
    it.recalled.push({ text: ev.text, known });
    it.met[slot] = { evidence: ev.text, independent: !it.anySupport, level: maxLevelFor(it, slot), attempt: it.attempts };
    newly.push(slot);
    if (known >= 0 && it.clueFor === known) { it.clueFor = null; it.showImage = null; }
  }
  return newly;
}

// With no up-to-date list, the specific clue can name things the learner enjoys (from Practice plan → Interests),
// leaving out any they have already talked about. Naming an activity gives part of the answer, so it counts as a specific cue.
function interestClue(state) {
  const said = state.item.recalled.map((r) => r.text.toLowerCase()).join(' ');
  const left = (state.learnerInterests || []).filter((x) => !said.includes(String(x).toLowerCase()));
  const pick = left.slice(0, 2);
  if (!pick.length) return null;
  return `Did you do any of the things you enjoy, like ${pick.join(' or ')}?`;
}

// Clues for one listed memory not yet remembered: broad → specific → photo (or Buddy says it, if there's no photo).
function recallCue(state, level) {
  const it = state.item;
  const item = curItem(state);
  const mems = it.mems || [];
  const remembered = new Set(it.recalled.map((r) => r.known));
  if (it.clueFor == null || remembered.has(it.clueFor) || !mems[it.clueFor]) {
    const next = mems.findIndex((_, i) => !remembered.has(i));
    it.clueFor = next >= 0 ? next : null;
  }
  const ev = it.clueFor != null ? mems[it.clueFor] : null;
  const when = whenNoun(item.when);
  if (level === 0) return cueLadder('recall', state.activity, item, 'memory')[0];
  if (level === 1) return ev?.broad_clue || `Think about ${when}. Where did you go, or who were you with?`;
  if (level === 2) {
    if (ev?.specific_clue) return ev.specific_clue;
    const hint = interestClue(state);
    if (!ev && hint) { it.usedInterests = true; return hint; }
    return 'Think about the morning, the afternoon and the evening.';
  }
  if (ev?.image_id) { it.showImage = ev.image_id; return 'Look at this photo. What were you doing?'; }
  return ev ? `You ${ev.event}. Can you tell me about it?` : "That's okay. Tell me anything else you remember.";
}

const required = (state) => state.item.elements.filter((e) => !state.item.skipped[e]);
const allMet = (state) => required(state).every((e) => state.item.met[e]);
const nextMissing = (state) => required(state).find((e) => !state.item.met[e]);
function maxLevelFor(it, el) {
  const lv = it.supportGiven.filter((s) => s.el === el).map((s) => s.level);
  return lv.length ? Math.max(...lv) : null;
}

function fadeStart(state, el) {
  if (!state.settings.fade_support) return 0;
  const prev = state.fade[el];
  return prev == null || prev < 0 ? 0 : Math.max(0, prev - 1);
}

// One cue, one element, one step stronger than last time.
function giveCue(state, el, by, forceLevel = null) {
  const it = state.item;
  const item = curItem(state);
  const level = forceLevel ?? (it.focus === el ? Math.min(3, it.focusLevel + 1) : fadeStart(state, el));
  it.focus = el;
  it.focusLevel = level;
  const text = state.mode === 'recall' ? recallCue(state, level) : cueLadder(state.mode, state.activity, item, el)[level];
  it.supportGiven.push({ el, level, text, by });
  it.anySupport = true;
  if (level === 3) it.modelGiven[el] = true;
  return line(text, level === 3 ? 'model' : 'cue', { level: LEVELS[level], element: el });
}

function clearInstructionLines(state) {
  const it = state.item;
  const item = curItem(state);
  it.phase = 'answer';
  it.focus = null;
  it.focusLevel = -1;
  const lines = [
    line(MODES.task.instruction(item), 'instruction'),
    line(TEAM_PHRASE, 'movie', { pauseAfter: state.settings.think_seconds }),
    line(MODES.task.prompt(item), 'prompt'),
  ];
  state.lastLines = lines;
  return lines;
}

// ---------------------------------------------------------------- help (spoken or button)

function handleHelp(state, kind, text, source) {
  if (state.mode === 'listen') return listenHelp(state, kind, text, source);
  if (state.mode === 'steps') return stepsHelp(state, kind, text, source);
  const it = state.item;
  const item = curItem(state);
  const m = MODES[state.mode];
  it.help.push({ kind, text, source });

  // Asking for clarification is the goal of an unclear-instruction task.
  if (state.mode === 'task' && it.phase === 'clarify') {
    it.met.clarify = { evidence: text, independent: !it.anySupport, level: maxLevelFor(it, 'clarify') };
    return [line('You asked me to make it clear. That is a great thing to do at work.', 'feedback'), line('Here it is again, more clearly.', 'intro'), ...clearInstructionLines(state)];
  }

  switch (kind) {
    case 'repeat':
      return [line('Sure.', 'ack'), ...state.lastLines];
    case 'dont_understand':
    case 'other_clarification':
      return [line('Thanks for telling me.', 'ack'), line(m.simplePrompt(item), 'prompt')];
    case 'check_with_coach':
      return [line('Checking with your job coach is a good idea. For this practice, I can give you a hint.', 'ack'), hintLine(state, 'buddy')];
    case 'show_me':
      return [line('Sure.', 'ack'), exampleLine(state, 'sam')];
    case 'need_help':
    default:
      return [line('Sure, here is a hint.', 'ack'), hintLine(state, 'sam')];
  }
}

function hintLine(state, by) {
  if (state.mode === 'steps') return stepsHelp(state, 'need_help', 'Give me a hint', by === 'sam' ? 'button' : 'spoken');
  if (state.mode === 'listen') return listenHelp(state, 'need_help', 'Give me a hint', by === 'sam' ? 'button' : 'spoken')[0];
  const el = state.mode === 'conversation' ? convFocus(state) : (state.item.phase === 'clarify' ? 'clarify' : nextMissing(state));
  if (!el) return line('You have already done everything for this one.', 'feedback');
  return giveCue(state, el, by);
}

function exampleLine(state, by) {
  if (state.mode === 'steps') return stepsHelp(state, 'show_me', 'Show me an example', 'button');
  if (state.mode === 'listen') return listenHelp(state, 'need_help', 'Show me an example', 'button')[0];
  const el = state.mode === 'conversation' ? convFocus(state) : (state.item.phase === 'clarify' ? 'clarify' : nextMissing(state));
  if (!el) return line('You have already done everything for this one.', 'feedback');
  return giveCue(state, el, by, 3);
}

/** Buttons on the practice screen. */
export function control(state, action) {
  if (state.done) return { state, turn: makeTurn(state, []) };
  const it = state.item;
  const item = curItem(state);
  const m = MODES[state.mode];
  if (state.mode === 'steps') return stepsControl(state, action);
  switch (action) {
    case 'repeat':
      if (state.mode === 'follow') {
        it.repeats += 1;
        return { state, turn: followTurn(state, [line('Here it is again.', 'ack'), it.instructionLine]) };
      }
      it.help.push({ kind: 'repeat', text: 'Repeat', source: 'button' });
      return { state, turn: makeTurn(state, state.lastLines.map((l) => ({ ...l, pauseAfter: l.pauseAfter }))) };
    case 'hint':
      if (state.mode === 'follow') return { state, turn: followTurn(state, followNextSupport(state, 'sam')) };
      return { state, turn: makeTurn(state, [hintLine(state, 'sam')]) };
    case 'dont_understand':
      return { state, turn: makeTurn(state, handleHelp(state, 'dont_understand', "I don't understand", 'button')) };
    case 'example':
      return { state, turn: makeTurn(state, [exampleLine(state, 'sam')]) };
    case 'think':
      state.paused = true;
      return { state, turn: makeTurn(state, [], 'none') };
    case 'ready':
      state.paused = false;
      return { state, turn: makeTurn(state, []) };
    case 'try_again':
      state.paused = false;
      if (state.mode === 'listen') return { state, turn: listenTurn(state, [line('Of course. Here is the question again.', 'ack'), ...state.lastLines]) };
      return { state, turn: makeTurn(state, [line('Of course. Have another go whenever you are ready.', 'ack')]) };
    case 'start_questions':
      if (state.mode !== 'listen' || it.listen.phase !== 'story') return { state, turn: makeTurn(state, []) };
      return { state, turn: listenTurn(state, startQuestions(state)) };
    case 'listen_retry':
      if (state.mode !== 'listen' || it.listen.phase !== 'offer') return { state, turn: makeTurn(state, []) };
      return { state, turn: listenTurn(state, retryRound(state)) };
    case 'listen_retry_questions':
      if (state.mode !== 'listen' || it.listen.phase !== 'offer') return { state, turn: makeTurn(state, []) };
      return { state, turn: listenTurn(state, retryRound(state, { story: false })) };
    case 'listen_finish':
      if (state.mode !== 'listen' || it.listen.phase !== 'offer') return { state, turn: makeTurn(state, []) };
      return { state, turn: listenTurn(state, finishListen(state, [line(LISTEN_THANKS, 'feedback')])) };
    default:
      throw new Error(`Unknown control: ${action}`);
  }
}

// ---------------------------------------------------------------- conversation

function convFocus(state) {
  const c = state.item.conv;
  if (state.item.focus === 'question' && !c.questionAsked) return 'question';
  return 'turn';
}

function conversationTurn(state, j, text) {
  const it = state.item;
  const c = it.conv;
  const item = curItem(state);
  const practiseQ = !!state.activity.content.practise_questions;
  const valid = !!(j.relevant || j.connection || j.question);
  const lines = [];
  it.attempts += 1;

  if (!valid) {
    if (it.modelGiven.turn && it.focus === 'turn') {
      it.skipped.turn = true;
      return completeConversationItem(state, lines);
    }
    lines.push(giveCue(state, 'turn', 'buddy'));
    return lines;
  }

  // A comment or a personal connection is a full, valid turn.
  c.validTurns += 1;
  const afterCue = it.anySupport && it.focus != null;
  c.turns.push({ text, connection: !!j.connection, question: !!j.question, independent: !afterCue, reply: j.reply });
  if (afterCue) { it.focus = null; it.focusLevel = -1; it.anySupport = false; }

  // Progress is recorded silently for the parent dashboard — Buddy never announces it during the chat.
  if (j.connection && !c.noted.connection) c.noted.connection = true;
  if (j.question && !c.questionAsked) c.questionAsked = true;

  const turnsDone = c.validTurns >= state.settings.turns_per_topic;
  const questionDone = !practiseQ || c.questionAsked || it.skipped.question;
  if (turnsDone && questionDone) {
    if (j.reply) lines.push(line(j.reply, 'reply'));
    return completeConversationItem(state, lines);
  }
  if (j.reply) lines.push(line(j.reply, 'reply'));

  if (practiseQ && !c.questionAsked && c.validTurns >= 2) {
    if (it.modelGiven.question) { it.skipped.question = true; if (turnsDone) return completeConversationItem(state, lines); }
    else lines.push(giveCue(state, 'question', 'buddy'));
  }
  state.lastLines = lines.filter((l) => l.kind === 'reply' || l.kind === 'cue' || l.kind === 'model');
  return lines;
}

function completeConversationItem(state, lines) {
  const it = state.item;
  const c = it.conv;
  for (const t of c.turns) {
    // Shape conversation turns like elements so the record builder can use them.
    it.met[`turn_${c.turns.indexOf(t)}`] = { evidence: t.text, independent: t.independent, level: null };
  }
  it.elements = Object.keys(it.met);
  return lines.concat(advance(state, []));
}

// ---------------------------------------------------------------- listen to a story
// Buddy reads the story → Sam presses "I'm ready" → questions one at a time → score.
// If any were missed, Buddy offers to read the story again and ask only those (as many rounds as the team allows for the activity).

// Rounds in all = the first go + the retries the team allows for this activity.
const listenRounds = (state) => {
  const r = Number(state.activity.content?.listen_retries ?? DEFAULT_LISTEN_RETRIES);
  return 1 + (Number.isFinite(r) ? Math.min(MAX_LISTEN_RETRIES, Math.max(0, Math.round(r))) : DEFAULT_LISTEN_RETRIES);
};
// Said after each answer, right or wrong: warm but neutral, so it doesn't give the answer away.
const ACKS = ['Thank you.', 'Thanks for that answer.', 'Got it, thank you.', 'Thanks, {name}.'];
const ackFor = (state, i) => ACKS[i % ACKS.length].replace(state.learnerName ? '{name}' : ', {name}', state.learnerName || '');
const LISTEN_THANKS = "That's fine. Thanks for listening so carefully.";
// "Give the story a new name" questions (kind 'title') get Buddy's wording when the team leaves the question blank.
const NEW_TITLE_QUESTION = 'Can you think of a new name for this story?';
const questionsOf = (state) => (curItem(state).questions || []).map((q) =>
  (q?.kind === 'title' && !String(q.question || '').trim() ? { ...q, question: NEW_TITLE_QUESTION } : q));
// Team option (off by default): after a wrong answer, give the question's clue and one more try straight away,
// instead of waiting for the retry round at the end.
const clueOnWrong = (state) => state.activity.content?.clue_on_wrong === true;

function listenTurn(state, lines) {
  const ph = state.item.listen.phase;
  return makeTurn(state, lines, ph === 'story' ? 'ready' : ph === 'offer' ? 'choice' : null);
}

function storyLines(state) {
  const item = curItem(state);
  const L = state.item.listen;
  L.phase = 'story';
  const lines = [];
  if (L.round === 1) {
    const lead = itemLead(state);
    if (lead) lines.push(line(lead, 'intro'));
    if (item.intro) lines.push(line(item.intro, 'intro'));
    lines.push(line(item.title ? `This story is called: ${item.title}.` : 'Here is a story. Listen carefully.', 'intro'));
    if (questionsOf(state).some((q) => q?.kind === 'title')) lines.push(line("At the end, I'll ask you to give the story a new name.", 'intro'));
  } else lines.push(line('Here is the story again. Listen carefully.', 'intro'));
  lines.push(line(item.story || '', 'story'));
  lines.push(line(L.round === 1 ? MODES.listen.prompt(item) : `When you're ready to answer the ${missedCount(state) === 1 ? 'question' : 'questions'} again, press I'm ready.`, 'prompt'));
  state.lastLines = lines;
  return lines;
}

// How Buddy leads into each story question: like a person talking, not "Question 2 of 5".
const NEXT_LEADS = ['For the next question: ', 'Here\u2019s the next one. ', 'Next question: '];
function questionLead(pos, total) {
  if (total === 1) return '';
  if (pos === 0) return 'The first question is: ';
  if (pos === total - 1) return 'And the last question: ';
  return NEXT_LEADS[(pos - 1) % NEXT_LEADS.length];
}

function askLines(state) {
  const L = state.item.listen;
  const qi = L.queue[L.pos];
  const q = questionsOf(state)[qi];
  const lines = [line(`${questionLead(L.pos, L.queue.length)}${q.question}`, 'prompt')];
  state.lastLines = lines;
  L.helped = false;
  return lines;
}

function startQuestions(state) {
  const L = state.item.listen;
  const all = questionsOf(state).map((_, i) => i);
  L.queue = L.round === 1 ? all : all.filter((i) => !L.results[i]?.correct);
  L.pos = 0;
  L.phase = 'question';
  const intro = L.round > 1 ? (L.queue.length === 1 ? "Let's try the one you missed." : "Let's try the ones you missed.")
    : L.queue.length === 1 ? 'Here is the question. Take your time.' : 'Now some questions about the story. Take your time with each one.';
  return [line(intro, 'intro'), ...askLines(state)];
}

async function listenAnswer(state, { text, displayText, confirmed }, judge) {
  const it = state.item;
  const L = it.listen;
  if (L.phase !== 'question') return { state, turn: listenTurn(state, state.lastLines) };
  const item = curItem(state);
  const qi = L.queue[L.pos];
  const q = questionsOf(state)[qi];
  const j = await judge({ mode: 'listen', item: { ...q, story: item.story, clarify_phrases: [] }, elements: ['answer'], text, activity: state.activity, history: [], learner: learnerOf(state) });
  if (j.garbled && !confirmed) return askToConfirm(state, { text, displayText });
  if (j.help && j.help !== 'none') return { state, turn: listenTurn(state, listenHelp(state, j.help, text, 'spoken')) };

  it.responses.push({ text: `Q${qi + 1}: ${displayText}`, afterSupport: L.round > 1 || L.helped });
  it.attempts += 1;
  const correct = !!j.met.answer;
  const prev = L.results[qi];
  L.results[qi] = {
    correct,
    answer: displayText,
    round: L.round,
    helped: L.helped,
    firstTry: prev ? prev.firstTry : (correct && !L.helped),
  };
  // Wrong, and the team wants a clue straight away: one clue and one more try at this question, then move on.
  if (!correct && clueOnWrong(state) && !L.helped) {
    L.helped = true;
    it.anySupport = true;
    it.supportGiven.push({ el: `q_${qi}`, level: 1, text: q.clue || 'Think back to the story.', by: 'buddy' });
    const retry = [
      line(q.clue ? `Good try. Here's a clue. ${q.clue}` : 'Good try. Think back to the story.', 'cue', { level: 'specific cue' }),
      line(q.question, 'prompt'),
    ];
    state.lastLines = [retry[1]];
    return { state, turn: listenTurn(state, retry) };
  }
  const lines = [line(ackFor(state, L.pos + L.round), 'ack')];
  L.pos += 1;
  if (L.pos < L.queue.length) return { state, turn: listenTurn(state, lines.concat(askLines(state))) };
  return endRound(state, lines);
}

function endRound(state, lines) {
  const L = state.item.listen;
  const total = questionsOf(state).length;
  const right = Object.values(L.results).filter((r) => r.correct).length;
  const missed = total - right;
  if (!missed) {
    lines.push(line(L.round === 1 ? `You got all ${total} right. Well done!` : `That's all ${total} right now. Well done!`, 'feedback'));
    return { state, turn: listenTurn(state, finishListen(state, lines)) };
  }
  lines.push(line(right ? `You got ${right} out of ${total} right. Good listening.` : 'Those questions were tricky.', 'feedback'));
  if (L.round >= listenRounds(state)) {
    lines.push(line('Thanks for listening so carefully.', 'feedback'));
    return { state, turn: listenTurn(state, finishListen(state, lines)) };
  }
  L.phase = 'offer';
  const them = missed === 1 ? 'the one' : `the ${missed}`;
  const offer = line(`Would you like to hear the story again and try ${them} you missed? Or you can try ${missed === 1 ? 'it' : 'them'} again straight away, or finish.`, 'prompt');
  lines.push(offer);
  state.lastLines = [offer];
  return { state, turn: listenTurn(state, lines) };
}

const missedCount = (state) => questionsOf(state).filter((_, i) => !state.item.listen.results[i]?.correct).length;

// Another round at the missed questions: with the story read again (counts as support), or straight to the questions.
function retryRound(state, { story = true } = {}) {
  const it = state.item;
  const L = it.listen;
  L.round += 1;
  if (!story) return startQuestions(state);
  it.supportGiven.push({ el: 'story', level: 1, text: 'Heard the story again', by: 'sam' });
  it.anySupport = true;
  return storyLines(state);
}

function listenOfferSpoken(state, text) {
  // "without the story", "just the questions", "straight away" → questions only; checked before a plain "yes".
  if (/\b(without|just the|only the|straight|skip|no story)\b/i.test(text)) return { state, turn: listenTurn(state, retryRound(state, { story: false })) };
  if (/\b(yes|yeah|yep|ok|okay|sure|please|again|try|story|hear)\b/i.test(text)) return { state, turn: listenTurn(state, retryRound(state)) };
  if (/\b(no|nope|finish|finished|stop|done)\b/i.test(text)) return { state, turn: listenTurn(state, finishListen(state, [line(LISTEN_THANKS, 'feedback')])) };
  return { state, turn: listenTurn(state, [line('Press Hear the story, Just the questions, or Finish.', 'clarify')]) };
}

function listenHelp(state, kind, text, source) {
  const it = state.item;
  const L = it.listen;
  it.help.push({ kind, text, source });
  if (L.phase !== 'question') return state.lastLines.length ? state.lastLines : [line('Take your time.', 'ack')];
  const q = questionsOf(state)[L.queue[L.pos]];
  if (kind === 'repeat') return [line('Sure.', 'ack'), ...state.lastLines];
  L.helped = true;
  it.anySupport = true;
  it.supportGiven.push({ el: `q_${L.queue[L.pos]}`, level: 1, text: q.clue || 'Think back to the story.', by: source === 'button' ? 'sam' : 'buddy' });
  if (kind === 'dont_understand') return [line('Thanks for telling me. Think back to the story.', 'ack'), line(q.question, 'prompt')];
  return [line(q.clue ? `Here's a clue. ${q.clue}` : 'Think back to the story.', 'cue', { level: 'specific cue' }), line(q.question, 'prompt')];
}

function finishListen(state, lines) {
  state.item.listen.phase = 'done';
  return advance(state, lines);
}

// ---------------------------------------------------------------- finishing items and sessions

function completeItem(state, newly) {
  const it = state.item;
  const item = curItem(state);
  const met = required(state).filter((e) => it.met[e]);
  const lines = [];
  // Brief, specific feedback about what he did. Concise + complete → move on, no extra questions.
  const els = it.anySupport ? newly : met;
  if (els.length) lines.push(line(`You ${describe(state.mode, els, item)}.`, 'feedback'));
  else lines.push(line('Thanks for working on that one.', 'feedback'));

  // Fading: remember how much support each element needed.
  for (const el of it.elements) {
    if (it.skipped[el]) state.fade[el] = 3;
    else if (it.met[el]) state.fade[el] = it.met[el].independent ? -1 : (it.met[el].level ?? 0);
  }
  return advance(state, lines);
}

function advance(state, lines) {
  state.completed.push(buildRecord(state, state.item));
  const items = state.activity.content.items;
  const timeUp = Date.now() - state.startedAt > state.settings.session_minutes * 60_000;
  if (state.itemIndex + 1 < items.length && !timeUp) {
    state.itemIndex += 1;
    return lines.concat(openItem(state)); // openItem leads in: "On to the next situation." etc.
  }
  state.done = true;
  lines.push(line(`That's the end of this practice. Thanks for practising with me${state.learnerName ? `, ${state.learnerName}` : ''}. See you next time!`, 'closing'));
  return lines;
}

/** Sam pressed Finish (or the app closed the session). Returns any records not yet produced. */
export function finish(state, reason = 'finished') {
  if (!state.done && state.item && (state.item.responses.length || state.item.help.length || state.item.supportGiven.length || state.item.steps?.pos > 0)) {
    state.completed.push(buildRecord(state, state.item, reason === 'finished' ? `${state.learnerName || 'The learner'} finished before this item was complete.` : `Practice stopped (${reason}).`));
  }
  state.done = true;
  return { state, records: state.completed };
}

// ---------------------------------------------------------------- practice record (no scores, no diagnoses)

function buildListenRecord(state, it, stopNote) {
  const item = curItem(state);
  const qs = questionsOf(state);
  const L = it.listen;
  const label = (i) => `Q${i + 1} "${qs[i]?.question || ''}"`;
  const res = qs.map((_, i) => L.results[i]);
  const first = res.filter((r) => r?.firstTry).length;
  const right = res.filter((r) => r?.correct).length;
  const independent = res.flatMap((r, i) => (r?.firstTry ? [`${label(i)}: "${r.answer}"`] : []));
  const after = res.flatMap((r, i) => (r?.correct && !r.firstTry ? [`${label(i)}: "${r.answer}"`] : []));
  const wrong = res.flatMap((r, i) => (r && !r.correct ? [`${label(i)}: "${r.answer}" (answer: ${qs[i].kind === 'title' ? 'any sensible name' : (qs[i].answers || [])[0] || '?'})`] : []));
  const notes = [];
  if (stopNote) notes.push(stopNote);
  notes.push(`${first} of ${qs.length} right first time${right !== first ? `; ${right} of ${qs.length} by the end` : ''}.`);
  if (L.round > 1) notes.push(`Heard the story ${L.round} times.`);
  if (wrong.length) notes.push(`Still to get: ${wrong.join('; ')}.`);
  const planGoal = PLAN_GOALS[state.activity.plan_goal] ? state.activity.plan_goal : 'other';
  const code = supportCode(it.supportGiven);
  const visualAids = [];
  if (item.image_id) visualAids.push('Pictures');
  if (state.settings.captions) visualAids.push('Captions');
  return {
    plan_goal: planGoal,
    support_code: code,
    success: successFor(planGoal, { complete: right === qs.length, code, stopped: !!stopNote }),
    visual_aids: visualAids,
    sam_turns: null,
    score_correct: right,
    score_first: first,
    score_total: qs.length,
    item_label: item.title || 'story',
    goal: state.activity.goal || MODES.listen.defaultGoal,
    sam_response: it.responses.map((r) => (r.afterSupport ? `[after support] ${r.text}` : r.text)).join(' / '),
    independent,
    support_provided: it.supportGiven.map((s) => `${s.el === 'story' ? 'Story read again' : `Clue for ${label(Number(s.el.slice(2)))}`}: "${s.text}"`),
    after_support: after,
    help_requests: it.help.filter((h) => h.kind !== 'repeat').map((h) => `${h.source === 'button' ? 'Pressed' : 'Said'} "${h.text}"`),
    review_note: notes.join(' '),
  };
}

export function buildRecord(state, it, stopNote = null) {
  if (state.mode === 'listen') return buildListenRecord(state, it, stopNote);
  if (state.mode === 'steps') return buildStepsRecord(state, it, stopNote);
  const m = MODES[state.mode];
  const item = curItem(state);
  const label = (el) => (el.startsWith('turn_') ? 'Comment' : labelFor(state.mode, el));
  const evLabel = (el) => (el.startsWith('turn_') ? 'Turn' : (m.evidenceLabel?.[el] || label(el)));
  const metEls = Object.keys(it.met);

  const independent = metEls.filter((e) => it.met[e].independent).map((e) => `${evLabel(e)}: "${it.met[e].evidence}"`);
  const after = metEls.filter((e) => !it.met[e].independent).map((e) => `${evLabel(e)}: "${it.met[e].evidence}"`);
  const support = it.supportGiven.map((s) => `${cap(LEVELS[s.level])} for ${label(s.el).toLowerCase()}: "${s.text}"${s.by === 'sam' ? ' (asked for it)' : ''}`);
  const help = it.help.map((h) => `${h.source === 'button' ? 'Pressed' : 'Said'} "${h.text}" — counted as a successful response`);

  const notes = [];
  if (stopNote) notes.push(stopNote);
  if (state.mode === 'conversation') {
    const c = it.conv;
    notes.push(`${c.validTurns} conversational turn${c.validTurns === 1 ? '' : 's'}${c.turns.some((t) => t.connection) ? ', including a personal connection' : ''}.`);
    if (state.activity.content.practise_questions) notes.push(c.questionAsked ? 'Asked a follow-up question.' : 'Follow-up question not asked yet.');
  } else {
    const supported = new Map();
    for (const s of it.supportGiven) supported.set(s.el, Math.max(supported.get(s.el) ?? -1, s.level));
    for (const [el, lv] of supported) if (it.met[el]) notes.push(`${label(el)} needed a ${LEVELS[lv]} on this attempt.`);
    for (const el of Object.keys(it.skipped)) notes.push(`${label(el)} not given yet, even after a model.`);
    if (state.mode === 'follow') {
      notes.length = stopNote ? 1 : 0; // the step-by-step notes below replace the generic ones
      followSteps(item).forEach((st, i) => {
        const el = `step_${i}`;
        const what = followStepText(st);
        const d = it.diag?.[el];
        if (it.skipped[el]) notes.push(`Step ${i + 1} (${what}): Buddy showed it.`);
        else if (!it.met[el]) notes.push(`Step ${i + 1} (${what}): not done.`);
        else if (!d) notes.push(`Step ${i + 1} (${what}): done on their own.`);
        else notes.push(`Step ${i + 1} (${what}): ${FOLLOW_DIAG[d]}.`);
      });
      if (it.repeats) notes.push(`Asked to hear the instruction again ${it.repeats === 1 ? 'once' : `${it.repeats} times`}.`);
    }
    if (state.mode === 'recall') {
      const total = it.elements.length;
      const got = it.elements.filter((e) => it.met[e]);
      const own = got.filter((e) => it.met[e].independent).length;
      notes.unshift(`Remembered ${got.length} of ${total}: ${own} on their own${got.length > own ? `, ${got.length - own} after a clue` : ''}.`);
      const photo = it.supportGiven.some((s) => s.level === 3 && /photo/i.test(s.text));
      if (photo) notes.push('Needed a photo for at least one.');
      if (!(it.mems || []).length && it.supportGiven.length) notes.push(`Buddy used general clues: no list of what ${state.learnerName || 'the learner'} did from the last ${RECALL_DAYS} days.`);
      if (it.usedInterests) notes.push('One clue named their interests.');
    }
    if (it.unsafe?.length) notes.push(`Suggested something that may not be safe: ${it.unsafe.map((u) => `"${u}"`).join('; ')}.`);
    if (state.mode !== 'follow' && !stopNote && !supported.size && !Object.keys(it.skipped).length && metEls.length) notes.push('All parts given independently.');
  }
  if (help.length) notes.push('Asked for help, which counts as a successful response.');

  // Plan tracking: support code, whether this opportunity met the goal's criterion, visual aids.
  const planGoal = PLAN_GOALS[state.activity.plan_goal] ? state.activity.plan_goal : 'other';
  let code = supportCode(it.supportGiven);
  let complete;
  let samTurns = null;
  if (planGoal === 'unexpected' && it.elements.includes('clarify')) {
    // Goal 1 is about noticing and asking; retelling the clear steps afterwards isn't part of it.
    code = supportCode(it.supportGiven.filter((s) => s.el === 'clarify'));
    complete = !!it.met.clarify;
  } else if (state.mode === 'think' && planGoal === 'unexpected') {
    // Goal 1 asks for noticing the change and a safe response (asking if unsure). "Why" and "what if" are
    // practised too, but don't decide whether this opportunity met the goal.
    code = supportCode(it.supportGiven.filter((s) => s.el === 'problem' || s.el === 'action'));
    complete = !!(it.met.problem && it.met.action) && !it.unsafe.length;
  } else if (state.mode === 'conversation') {
    // The plan counts each speaker's contribution as one turn, so 2 relevant turns from Sam
    // (alternating with Buddy's) make 4 conversational turns.
    samTurns = it.conv.validTurns;
    complete = samTurns >= 2 && it.conv.questionAsked;
  } else {
    complete = it.elements.length > 0 && it.elements.every((e) => it.met[e]);
  }
  const visualAids = [];
  if (state.settings.cue_cards && it.cardShown) visualAids.push(m.organiser ? 'Organiser' : 'Cue card');
  if ((item.image_ids || []).length || item.image_id) visualAids.push('Pictures');
  if (state.settings.captions) visualAids.push('Captions');

  return {
    plan_goal: planGoal,
    support_code: code,
    success: successFor(planGoal, { complete, code, stopped: !!stopNote }),
    visual_aids: visualAids,
    sam_turns: samTurns,
    item_label: m.itemLabel(item),
    goal: state.activity.goal || m.defaultGoal,
    sam_response: it.responses.map((r) => (r.afterSupport ? `[after support] ${r.text}` : r.text)).join(' / '),
    independent,
    support_provided: support,
    after_support: after,
    help_requests: help,
    review_note: notes.join(' '),
  };
}

// ---------------------------------------------------------------- what the client renders

// Story Buddy's organiser can be faded by the team: 'show' (from the start), 'when_stuck' (appears once Buddy
// has had to give a cue) or 'off'. Other modes always show their cue card when cue cards are on.
function organiserVisible(state) {
  if (!MODES[state.mode].organiser) return true;
  const how = state.activity.content?.organiser || 'show';
  if (how === 'off') return false;
  if (how === 'when_stuck') return !!state.item?.anySupport;
  return true;
}

function makeTurn(state, lines, expect = null) {
  const m = MODES[state.mode];
  const item = curItem(state);
  const it = state.item;
  let cueCard = null;
  const labels = state.settings.cue_cards && organiserVisible(state) ? m.cueCard(item, state.activity) : null;
  if (labels) {
    if (it) it.cardShown = true;
    const lit = labels.map(() => false);
    for (const el of Object.keys(it?.met || {})) {
      const i = m.cueCardIndex(el, item);
      if (i != null && i < lit.length) lit[i] = true;
    }
    cueCard = { labels, lit };
  }
  const stepUi = state.mode === 'steps' ? stepsUi(state) : null;
  const images = state.mode === 'steps' ? (stepUi?.image ? [stepUi.image] : [])
    : state.mode === 'story' ? (item.image_ids || []) : state.mode === 'recall' ? (it?.showImage ? [it.showImage] : []) : (item.image_id ? [item.image_id] : []);
  return {
    lines,
    expect: expect || (state.done ? 'none' : 'response'),
    done: state.done,
    ui: {
      images,
      imageLayout: state.mode === 'story' && images.length > 1 ? 'sequence' : 'single',
      cueCard,
      paused: state.paused,
      itemNumber: state.itemIndex + 1,
      itemCount: state.activity.content.items.length,
      clarifyPhrases: state.mode === 'task' ? (item.clarify_phrases || DEFAULT_CLARIFY_PHRASES) : null,
      step: stepUi?.step || null,
      stepList: stepUi?.list || null,
      board: state.mode === 'follow' && it?.board ? {
        boxes: FOLLOW_BOXES,
        tokens: (item.tokens || []).map((id) => ({ id, name: tokenName(id), img: tokenImage(id) })),
        pos: it.board.pos,
        selected: it.board.selected,
        highlight: it.board.highlight,
        showStep: it.showStep,
      } : null,
    },
  };
}

// ---------------------------------------------------------------- Listen Buddy on screen (follow)

const FOLLOW_DIAG = {
  doing: 'understood and remembered it (said it back correctly) but did something different at first',
  remembering: 'needed to hear it again (remembering)',
  understanding: 'needed to see it on the screen (understanding)',
};

const followCur = (state) => {
  const it = state.item;
  const i = it.elements.findIndex((e) => !it.met[e] && !it.skipped[e]);
  return i < 0 ? null : { i, el: it.elements[i], step: followSteps(curItem(state))[i] };
};
const isSay = (step) => String(step?.type).startsWith('say_');

function followTurn(state, lines) {
  const cur = followCur(state);
  const speak = state.item.phase === 'retell' || (cur && isSay(cur.step));
  return makeTurn(state, lines, state.done ? null : speak ? 'response' : 'board');
}

// Where a token would sit after a 'place' step, and whether that satisfies the step.
function placeOk(board, step, slot) {
  const at = (tok) => board.pos[tok];
  if (step.type === 'box') return slot === Number(step.box) - 1;
  const t = at(step.target);
  if (t == null) return false;
  if (step.type === 'next_to') return Math.abs(slot - t) === 1;
  if (step.type === 'left_of') return slot < t;
  if (step.type === 'right_of') return slot > t;
  return false;
}
function sayAnswer(state, step) {
  const placed = Object.entries(state.item.board.pos).filter(([, p]) => p != null).sort((a, b) => a[1] - b[1]);
  if (!placed.length) return null;
  if (step.type === 'say_left') return placed[0][0];
  if (step.type === 'say_right') return placed.at(-1)[0];
  return (placed.find(([, p]) => p === Number(step.box) - 1) || [])[0] || null;
}

function followMet(state, cur, evidence) {
  const it = state.item;
  it.met[cur.el] = { evidence, independent: !it.anySupport, level: maxLevelFor(it, cur.el), attempt: it.attempts };
  it.showStep = null;
  it.board.highlight = null;
  it.phase = 'act';
  if (!followCur(state)) return completeItem(state, [cur.el]);
  return [];
}

/** Sam tapped a shape ({ type: 'token', token }) or a box ({ type: 'box', box: 0-based }). */
export function act(state, action = {}) {
  if (state.done || state.mode !== 'follow') return { state, turn: makeTurn(state, []) };
  const it = state.item;
  const item = curItem(state);
  const cur = followCur(state);
  if (!cur) return { state, turn: followTurn(state, []) };
  if (it.phase === 'retell') return { state, turn: followTurn(state, [line('First tell me what I asked you to do. Press Talk.', 'clarify')]) };
  if (action.type === 'token') {
    const tok = String(action.token || '');
    if (!(item.tokens || []).includes(tok)) return { state, turn: followTurn(state, []) };
    it.board.selected = tok;
    if (cur.step.type !== 'touch') return { state, turn: followTurn(state, []) };
    it.attempts += 1;
    it.responses.push({ text: `[touched] ${tokenName(tok)}`, afterSupport: it.anySupport });
    if (tok === cur.step.token) return { state, turn: followTurn(state, followMet(state, cur, `touched the ${tokenName(tok)}`)) };
    return { state, turn: followTurn(state, followWrong(state, cur)) };
  }
  if (action.type === 'box') {
    const slot = Number(action.box);
    if (!Number.isInteger(slot) || slot < 0 || slot >= FOLLOW_BOXES) return { state, turn: followTurn(state, []) };
    const tok = it.board.selected;
    if (!tok) return { state, turn: followTurn(state, [line(`Touch a ${followThing(curItem(state))} first, then touch a box.`, 'clarify')]) };
    if (isSay(cur.step)) return { state, turn: followTurn(state, [line('Now tell me. Press Talk.', 'clarify')]) };
    it.attempts += 1;
    it.responses.push({ text: `[put] ${tokenName(tok)} in box ${slot + 1}`, afterSupport: it.anySupport });
    const occupied = Object.entries(it.board.pos).some(([t, p]) => p === slot && t !== tok);
    if (cur.step.type !== 'touch' && tok === cur.step.token && !occupied && placeOk(it.board, cur.step, slot)) {
      it.board.pos[tok] = slot;
      it.board.selected = null;
      return { state, turn: followTurn(state, followMet(state, cur, `put the ${tokenName(tok)} in box ${slot + 1}`)) };
    }
    it.board.selected = null; // wrong: the shape stays where it was
    return { state, turn: followTurn(state, followWrong(state, cur)) };
  }
  return { state, turn: followTurn(state, []) };
}

// A step went wrong. First find out whether Sam remembers it; then give the next support.
function followWrong(state, cur) {
  const it = state.item;
  const given = it.supportGiven.filter((s) => s.el === cur.el).length;
  if (!given) {
    it.phase = 'retell';
    it.anySupport = true;
    it.supportGiven.push({ el: cur.el, level: 0, text: 'What did I ask you to do?', by: 'buddy' });
    return [line('Not quite.', 'feedback'), line(isSay(cur.step) ? 'What did I ask you to tell me?' : 'What did I ask you to do?', 'cue', { element: cur.el, level: LEVELS[0] })];
  }
  return [line('Not quite.', 'feedback'), ...followNextSupport(state, 'buddy')];
}

// Next support for the current step: hear it again → see it on screen → Buddy shows it.
function followNextSupport(state, by) {
  const it = state.item;
  const cur = followCur(state);
  if (!cur) return [];
  const steps = followSteps(curItem(state));
  const text = followStepText(cur.step, cur.i ? steps[cur.i - 1].token : null);
  const top = Math.max(0, ...it.supportGiven.filter((s) => s.el === cur.el).map((s) => s.level));
  const level = Math.min(3, it.supportGiven.some((s) => s.el === cur.el) ? top + 1 : 1);
  it.anySupport = true;
  it.phase = 'act';
  if (level === 1) {
    if (!it.diag[cur.el]) it.diag[cur.el] = 'remembering';
    it.supportGiven.push({ el: cur.el, level, text: `Listen again: ${text}.`, by });
    return [line(`Listen again: ${text}.`, 'cue', { element: cur.el, level: LEVELS[1] })];
  }
  if (level === 2) {
    if (it.diag[cur.el] !== 'doing') it.diag[cur.el] = 'understanding';
    it.showStep = `${text[0].toUpperCase()}${text.slice(1)}.`;
    it.supportGiven.push({ el: cur.el, level, text: `Shown on screen: ${text}.`, by });
    return [line(`Here it is on the screen: ${text}.`, 'cue', { element: cur.el, level: LEVELS[2] })];
  }
  // Model: Buddy does it.
  it.supportGiven.push({ el: cur.el, level: 3, text: `Buddy showed it: ${text}.`, by });
  it.modelGiven[cur.el] = true;
  it.skipped[cur.el] = true;
  it.showStep = null;
  let shown;
  if (isSay(cur.step)) {
    const ans = sayAnswer(state, cur.step);
    shown = line(ans ? `The ${tokenName(ans)} is ${cur.step.type === 'say_box' ? `in box ${cur.step.box}` : `on the ${cur.step.type === 'say_left' ? 'left' : 'right'}`}.` : "Let's move on.", 'model', { element: cur.el, level: LEVELS[3] });
  } else if (cur.step.type === 'touch') {
    it.board.selected = cur.step.token;
    shown = line(`Watch. This is the ${tokenName(cur.step.token)}.`, 'model', { element: cur.el, level: LEVELS[3] });
  } else {
    const slot = [0, 1, 2, 3].find((b) => !Object.values(it.board.pos).includes(b) && placeOk(it.board, cur.step, b));
    if (slot != null) { it.board.pos[cur.step.token] = slot; it.board.highlight = slot; }
    it.board.selected = null;
    shown = line(`Watch. The ${tokenName(cur.step.token)} goes here.`, 'model', { element: cur.el, level: LEVELS[3] });
  }
  if (!followCur(state)) return [shown, ...completeItem(state, [])];
  return [shown, line("Now the next part.", 'prompt')];
}

// Sam spoke: either saying back the step ("What did I ask you to do?") or answering a "tell me" step.
function followSpeech(state, text) {
  const it = state.item;
  const cur = followCur(state);
  if (!cur) return followTurn(state, []);
  const help = detectHelp(text);
  if (help === 'repeat' || help === 'dont_understand') {
    it.repeats += 1;
    return followTurn(state, [line('Here it is again.', 'ack'), it.instructionLine]);
  }
  it.responses.push({ text, afterSupport: it.anySupport });
  const steps = followSteps(curItem(state));
  if (it.phase === 'retell') {
    if (retellMatches(text, cur.step)) {
      it.diag[cur.el] = 'doing';
      it.phase = 'act';
      return followTurn(state, [line("Yes, that's right. Have another go.", 'ack')]);
    }
    return followTurn(state, followNextSupport(state, 'buddy'));
  }
  if (isSay(cur.step)) {
    it.attempts += 1;
    const ans = sayAnswer(state, cur.step);
    const others = (curItem(state).tokens || []).filter((t) => t !== ans);
    const partsOf = (tok) => tokenWords(tok);
    const mentions = (w) => new RegExp(`\\b${w}\\b`, 'i').test(text);
    // Right if it names the answer (colour, shape or object word) and names nothing that only belongs to another one.
    const right = ans && partsOf(ans).some(mentions);
    const wrong = ans && others.flatMap(partsOf).filter((w) => !partsOf(ans).includes(w)).some(mentions);
    if (right && !wrong) return followTurn(state, followMet(state, cur, text));
    return followTurn(state, followWrong(state, cur));
  }
  // A tap step, but Sam spoke: point him back to the screen without counting it.
  it.responses.pop();
  return followTurn(state, [line(cur.step.type === 'touch' ? `Touch the ${followThing(curItem(state))} on the screen.` : `Touch a ${followThing(curItem(state))}, then touch a box.`, 'clarify')]);
}

// Did Sam say the step back? He needs the shape or object (a word that names it) and the key word of the action.
function retellMatches(text, step) {
  const t = String(text).toLowerCase();
  const names = (tok) => tokenWords(tok).some((w) => t.includes(w));
  const num = (n) => new RegExp(`\\b(${n}|${['zero', 'one', 'two', 'three', 'four', 'five'][n]})\\b`).test(t);
  switch (step.type) {
    case 'touch': return names(step.token) && /\b(touch|tap|press|choose|pick|find|point)/.test(t);
    case 'box': return names(step.token) && num(Number(step.box));
    case 'next_to': return names(step.token) && names(step.target) && /\b(next|beside|by)\b/.test(t);
    case 'left_of': return names(step.token) && names(step.target) && /\bleft\b/.test(t);
    case 'right_of': return names(step.token) && names(step.target) && /\bright\b/.test(t);
    case 'say_left': return /\bleft\b/.test(t);
    case 'say_right': return /\bright\b/.test(t);
    case 'say_box': return num(Number(step.box));
    default: return false;
  }
}

export { DEFAULTS as ENGINE_DEFAULTS };


// ---------------------------------------------------------------- Task Buddy: Step by Step (steps)
// The learner does a real task, one step at a time. Practice mode: Buddy says each step (with its picture), asks
// one question for the team's chosen skill (before or after the step), and the learner presses Done after doing it.
// At the end Buddy asks for all the steps from beginning to end. Independence mode: the learner does the whole
// task alone and then explains it; Help me shows the steps on screen.
// Support ladder for this module only: 1 independent → 2 broad clue → 3 specific clue → 4 visual support → 5 model.

const stepsOf = (state) => (curItem(state).steps || []).filter((x) => String(x?.text || '').trim());
// Learn the steps (the default): Buddy shows every step with its picture first ("Make a movie in your mind"),
// then asks about each one by number with the screen cleared. No Done button.
const stepsLearn = (state) => stepRunOf(state.activity) === 'learn';
const stepsPractice = (state) => stepRunOf(state.activity) !== 'independence';
const stepsAsk = (state) => state.activity.content?.ask_steps !== false;
// The end "tell me all the steps" is off by default when learning the steps (the questions already go through them).
const stepsRetell = (state) => (stepsLearn(state) ? state.activity.content?.ask_end === true : state.activity.content?.ask_end !== false);
const STEP_RIGHT = ["That's right.", 'Yes, good.', "That's it."];
const firstWordsOf = (t, n) => String(t || '').split(/\s+/).slice(0, n).join(' ').replace(/[.,;:!?]+$/, '');

function stepsTurn(state, lines) {
  const S = state.item.steps;
  return makeTurn(state, lines, state.done ? null : ['doing', 'indep'].includes(S.phase) ? 'done' : S.phase === 'walk' ? 'ready' : 'response');
}

function stepsOpen(state, lines) {
  const item = curItem(state);
  const S = state.item.steps;
  const task = item.title || state.activity.title || 'this task';
  if (item.intro) lines.push(line(item.intro, 'intro'));
  if (!stepsPractice(state)) {
    S.phase = 'indep';
    const say = [
      line(`Today's task is: ${task}.`, 'intro'),
      line("This time, do all the steps on your own. If you get stuck, press Help me. When you've finished everything, press Done.", 'prompt'),
    ];
    lines.push(...say);
    state.lastLines = say;
    return lines;
  }
  if (stepsLearn(state)) {
    // Walk through every step with its picture, then wait for "I'm ready" before the questions.
    const list = stepsOf(state);
    S.phase = 'walk';
    lines.push(line(`Today's task is: ${task}.`, 'intro'));
    const walk = [
      line(TEAM_PHRASE, 'movie'),
      line(`Listen to all ${list.length} steps first.`, 'intro'),
      ...list.map((x, i) => line(`Step ${i + 1}. ${x.text}`, 'instruction', { step: i })),
      line(stepsAsk(state) ? "When you're ready for the questions, press I'm ready." : "When you're ready, press I'm ready.", 'prompt'),
    ];
    state.lastLines = walk;
    return lines.concat(walk);
  }
  lines.push(line(`Today's task is: ${task}. We'll do it one step at a time. After each step, press Done.`, 'intro'));
  return lines.concat(stepStart(state));
}

// Steps are always named by number: "Step 1.", "Step 7, the last step."
function stepLead(pos, total) {
  if (total <= 1) return null;
  return pos === total - 1 ? `Step ${pos + 1}, the last step.` : `Step ${pos + 1}.`;
}

// Learn the steps: the learner pressed I'm ready after the walk-through.
function stepsBeginQuestions(state) {
  const S = state.item.steps;
  S.pos = 0;
  if (!stepsAsk(state)) {
    if (stepsRetell(state)) return stepsAskRetell(state, 'Good listening.');
    return stepsComplete(state, [line('Good listening. Well done.', 'feedback')]);
  }
  return [line("Let's see what you remember.", 'intro'), ...stepAsk(state)];
}

// Learn the steps: ask about the step at S.pos, by number, with the screen cleared.
function stepAsk(state) {
  const S = state.item.steps;
  const list = stepsOf(state);
  const c = stepCoach(state.activity, { steps: list }, S.pos);
  Object.assign(S, { level: -1, tries: 0, visual: false, said: false, phase: 'q' });
  const lead = /\bstep\s*\d/i.test(c.question) ? null : stepLead(S.pos, list.length);
  const lines = [lead ? line(lead, 'intro') : null, line(c.question, 'prompt')].filter(Boolean);
  state.lastLines = lines;
  return lines;
}

// Learn the steps: after the last question, say honestly how it went.
function stepsLearnEnd(state, lines) {
  const S = state.item.steps;
  const n = stepsOf(state).length;
  const res = Object.values(S.results);
  const own = res.filter((r) => r.firstTry).length;
  const helped = res.filter((r) => r.correct && !r.firstTry).length;
  const fb = own === n ? `You answered all ${n} on your own. Well done.`
    : `That's all ${n} steps. You answered ${own} on your own${helped ? ` and ${helped} with some help` : ''}.`;
  if (stepsRetell(state)) return stepsAskRetell(state, fb, lines);
  return stepsComplete(state, [...lines, line(fb, 'feedback')]);
}

function stepStart(state) {
  const S = state.item.steps;
  const list = stepsOf(state);
  const step = list[S.pos];
  const c = stepCoach(state.activity, { steps: list }, S.pos);
  Object.assign(S, { level: -1, tries: 0, visual: false, said: false });
  const lines = [];
  const lead = stepLead(S.pos, list.length);
  if (lead) lines.push(line(lead, 'intro'));
  const ask = stepsAsk(state) && c.when === 'before';
  if (ask && c.skill === 'memory') {
    // Memory: Buddy asks for the step before saying it.
    S.phase = 'q';
    lines.push(line(c.question, 'prompt'));
  } else {
    S.said = true;
    // The question follows straight away, so the step's words stay out of the captions (no reading the answer).
    lines.push(line(step.text, 'instruction', ask ? { noCaption: true } : {}));
    if (ask) { S.phase = 'q'; lines.push(line(c.question, 'prompt')); }
    else { S.phase = 'doing'; lines.push(line(S.pos === 0 ? "Do it now, and press Done when you've finished." : "Press Done when you've finished.", 'prompt')); }
  }
  state.lastLines = lines.filter((l) => l.kind !== 'intro');
  return lines;
}

// After the step's question is settled (right, or carried on after the model).
function stepAfterQuestion(state, lines) {
  const S = state.item.steps;
  if (stepsLearn(state)) {
    S.pos += 1;
    return S.pos < stepsOf(state).length ? lines.concat(stepAsk(state)) : stepsLearnEnd(state, lines);
  }
  const c = stepCoach(state.activity, { steps: stepsOf(state) }, S.pos);
  if (c.when === 'after') return lines.concat(stepNext(state));
  const step = stepsOf(state)[S.pos];
  S.phase = 'doing';
  const doIt = [];
  if (!S.said) { S.said = true; doIt.push(line(step.text, 'instruction')); }
  doIt.push(line("Now do it, and press Done when you've finished.", 'prompt'));
  state.lastLines = doIt;
  return lines.concat(doIt);
}

// The learner pressed Done (or said "done") for the current step.
function stepDone(state) {
  const S = state.item.steps;
  const c = stepCoach(state.activity, { steps: stepsOf(state) }, S.pos);
  state.item.responses.push({ text: `[Done] step ${S.pos + 1}`, afterSupport: false, done: true });
  if (stepsAsk(state) && c.when === 'after') {
    S.phase = 'q';
    const q = [line(c.question, 'prompt')];
    state.lastLines = q;
    return q;
  }
  return stepNext(state);
}

function stepNext(state) {
  const S = state.item.steps;
  S.pos += 1;
  if (S.pos < stepsOf(state).length) return stepStart(state);
  if (stepsRetell(state)) return stepsAskRetell(state, "You've done all the steps.");
  return stepsComplete(state, [line("You've done all the steps. Well done.", 'feedback')]);
}

function stepsAskRetell(state, before, lead = []) {
  const S = state.item.steps;
  S.phase = 'retell';
  const q = line(stepsLearn(state) ? 'Now tell me all the steps, from beginning to end.' : 'Now tell me all the steps you followed, from beginning to end.', 'prompt');
  state.lastLines = [q];
  return [...lead, line(before, 'feedback'), q];
}

function giveStepCue(state, level, by) {
  const it = state.item;
  const S = it.steps;
  const c = stepCoach(state.activity, { steps: stepsOf(state) }, S.pos);
  const lv = Math.min(3, Math.max(0, level));
  S.level = lv;
  if (lv >= 2) S.visual = true;
  it.anySupport = true;
  it.supportGiven.push({ el: `s_${S.pos}`, level: lv, text: c.ladder[lv], by });
  const q = line(lv === 3 ? `Now you try. ${c.question}` : c.question, 'prompt');
  state.lastLines = [q];
  return [line(c.ladder[lv], lv === 3 ? 'model' : 'cue', { level: STEP_LEVELS[lv] }), q];
}

async function stepsAnswer(state, { text, displayText }, judge) {
  const it = state.item;
  const S = it.steps;
  if (S.phase === 'retell') return stepsRetellAnswer(state, { text, displayText }, judge);
  if (S.phase !== 'q') return { state, turn: stepsTurn(state, state.lastLines) };
  const list = stepsOf(state);
  const c = stepCoach(state.activity, { steps: list }, S.pos);
  const j = await judge({
    mode: 'steps', elements: ['answer'], text, activity: state.activity, history: [], learner: learnerOf(state),
    item: { task: curItem(state).title || '', step: list[S.pos].text, step_number: S.pos + 1, previous_step: list[S.pos - 1]?.text || null, next_step: list[S.pos + 1]?.text || null, question: c.question, example_answer: c.answer, skill: c.skill, said_step_already: S.said, heard_all_steps_first: stepsLearn(state), clarify_phrases: [] },
  });
  if (j.help && j.help !== 'none') return { state, turn: stepsTurn(state, stepsHelp(state, j.help, displayText, 'spoken')) };
  const correct = !!j.met.answer;
  it.attempts += 1;
  it.responses.push({ text: displayText, afterSupport: S.level >= 0 });
  // Right, or already shown the model and had one more try: settle this step's question and move on.
  if (correct || S.level >= 3) {
    S.results[S.pos] = { answer: displayText, correct, firstTry: correct && S.level < 0, level: S.level };
    const ack = correct ? STEP_RIGHT[S.pos % STEP_RIGHT.length] : "Thanks. Let's carry on.";
    return { state, turn: stepsTurn(state, stepAfterQuestion(state, [line(ack, correct ? 'feedback' : 'ack')])) };
  }
  S.tries += 1;
  return { state, turn: stepsTurn(state, giveStepCue(state, S.level + 1, 'buddy')) };
}

async function stepsRetellAnswer(state, { text, displayText }, judge) {
  const it = state.item;
  const S = it.steps;
  const list = stepsOf(state);
  const short = list.map((x) => x.text.split(/(?<=[.!?])\s/)[0]);
  const elements = short.map((_, i) => `step_${i}`).concat(short.length >= 2 ? ['order'] : []);
  const j = await judge({ mode: 'task', elements, text, activity: state.activity, history: [], learner: learnerOf(state), item: { steps: short, instruction: short.join(' '), clarify_phrases: [] } });
  if (j.help && j.help !== 'none' && !Object.values(j.met).some(Boolean)) return { state, turn: stepsTurn(state, stepsHelp(state, j.help, displayText, 'spoken')) };
  it.responses.push({ text: displayText, afterSupport: S.retellTries > 0, retell: true });
  const R = S.retell || (S.retell = { met: {}, inOrder: null, cued: false });
  short.forEach((_, i) => { if (j.met[`step_${i}`] && !R.met[i]) R.met[i] = { text: j.met[`step_${i}`], afterCue: R.cued }; });
  if (j.inOrder != null) R.inOrder = R.inOrder === false ? false : j.inOrder;
  const got = Object.keys(R.met).length;
  // Steps still missing: up to two clues (broad, then the missing step's opening words), then finish.
  if (got < short.length && S.retellTries < 2 && (R.level ?? -1) < 1) {
    S.retellTries += 1;
    return { state, turn: stepsTurn(state, retellCue(state, 'buddy')) };
  }
  // Praise only what really happened: every step without a clue, every step with one, or how many.
  const fb = got === short.length
    ? (R.cued ? 'You told me every step, with a clue.' : `You told me every step${R.inOrder === true ? ', in order' : ''}. Well done.`)
    : `Thanks. You told me ${got} of the ${short.length} steps.`;
  return { state, turn: stepsTurn(state, stepsComplete(state, [line(fb, 'feedback')])) };
}

// Telling all the steps: each clue is stronger than the last: broad → the first missing step's opening words →
// the model (all the steps, said by Buddy).
function retellCue(state, by, model = false) {
  const it = state.item;
  const S = it.steps;
  const R = S.retell || (S.retell = { met: {}, inOrder: null, cued: false });
  const list = stepsOf(state);
  const miss = list.findIndex((_, i) => !R.met[i]);
  it.anySupport = true;
  R.cued = true;
  R.level = model || miss < 0 ? 3 : Math.min(3, (R.level ?? -1) + 1);
  if (R.level >= 2) {
    R.level = 3;
    const text = list.map((x, i, a) => `${i === 0 ? 'First' : i === a.length - 1 ? 'Last' : 'Then'}, ${x.text.split(/(?<=[.!?])\s/)[0].replace(/[.!?]+$/, '').replace(/^[A-Z](?=[a-z])/, (m) => m.toLowerCase())}.`).join(' ');
    it.supportGiven.push({ el: 'retell', level: 3, text, by });
    state.lastLines = [line('Now you try. Tell me the steps from beginning to end.', 'prompt')];
    return [line(text, 'model', { level: STEP_LEVELS[3] }), ...state.lastLines];
  }
  const cue = R.level === 0
    ? (miss === 0 ? 'Think about the very first thing.' : `Think about step ${miss + 1}.`)
    : `Step ${miss + 1} starts like this: ${firstWordsOf(list[miss].text, 3)}\u2026`;
  it.supportGiven.push({ el: 'retell', level: R.level, text: cue, by });
  state.lastLines = [line(cue, 'cue', { level: STEP_LEVELS[R.level] })];
  return state.lastLines;
}

function stepsComplete(state, lines) {
  state.item.steps.phase = 'done';
  return advance(state, lines);
}

// While the learner is doing a step (or the whole task), speech is about being finished or needing help.
function stepsSpokenWhileDoing(state, text) {
  const S = state.item.steps;
  if (/\b(done|finished|did it|i'?ve done|ready|next)\b/i.test(text) && !/\bnot (done|finished|ready)\b/i.test(text)) {
    return S.phase === 'indep' ? stepsIndepDone(state) : stepDone(state);
  }
  const kind = detectHelp(text, []);
  if (kind && kind !== 'none') return stepsHelp(state, kind, text, 'spoken');
  return [line(S.phase === 'indep' ? "Take your time. Press Done when you've finished everything, or Help me if you're stuck." : "Take your time. Press Done when you've finished this step.", 'clarify')];
}

function stepsIndepDone(state) {
  state.item.responses.push({ text: '[Done] whole task', afterSupport: false, done: true });
  return stepsAskRetell(state, state.item.steps.list ? "You've finished." : "You've finished, all on your own.");
}

function stepsHelp(state, kind, text, source) {
  const it = state.item;
  const S = it.steps;
  const by = source === 'button' ? 'sam' : 'buddy';
  it.help.push({ kind, text, source });
  if (kind === 'repeat') return [line('Sure.', 'ack'), ...state.lastLines];
  if (S.phase === 'indep') {
    // Independence mode: help shows the whole list of steps on screen (visual support).
    S.list = true;
    it.anySupport = true;
    it.supportGiven.push({ el: 'task', level: 2, text: 'Looked at the steps on screen', by });
    const l = [line('Here are the steps. Look at the screen.', 'cue', { level: STEP_LEVELS[2] }), line("Press Done when you've finished everything.", 'prompt')];
    state.lastLines = l;
    return l;
  }
  if (S.phase === 'doing') {
    // Stuck while doing a step: show it on screen and say it again (visual support for that step).
    S.visual = true;
    S.sawStep[S.pos] = true;
    it.anySupport = true;
    const step = stepsOf(state)[S.pos];
    it.supportGiven.push({ el: `s_${S.pos}`, level: 2, text: 'Saw the step on screen while doing it', by });
    const l = [line("Here's the step on the screen.", 'cue', { level: STEP_LEVELS[2] }), line(step.text, 'instruction'), line("Press Done when you've finished.", 'prompt')];
    state.lastLines = l.slice(1);
    return l;
  }
  if (S.phase === 'retell') return retellCue(state, by, kind === 'show_me');
  if (S.phase === 'walk') return [line('Sure. Here are the steps again.', 'ack'), ...state.lastLines.slice(1)];
  // A step question: hint → next clue; "I don't understand" → at least the specific clue; example → the model.
  const next = kind === 'show_me' ? 3 : kind === 'dont_understand' || kind === 'other_clarification' ? Math.max(1, S.level + 1) : S.level + 1;
  if (S.level >= 3) return [line('Have a go. Any answer is fine.', 'ack'), ...state.lastLines];
  return giveStepCue(state, next, by);
}

function stepsControl(state, action) {
  const S = state.item.steps;
  const t = (lines) => ({ state, turn: stepsTurn(state, lines) });
  switch (action) {
    case 'start_questions':
      if (S.phase === 'walk') return t(stepsBeginQuestions(state));
      return t([]);
    case 'step_done':
      if (S.phase === 'doing') return t(stepDone(state));
      if (S.phase === 'indep') return t(stepsIndepDone(state));
      return t([]);
    case 'repeat': return t(stepsHelp(state, 'repeat', 'Repeat', 'button'));
    case 'hint': return t(stepsHelp(state, 'need_help', 'Give me a hint', 'button'));
    case 'dont_understand': return t(stepsHelp(state, 'dont_understand', "I don't understand", 'button'));
    case 'example': return t(stepsHelp(state, 'show_me', 'Show me an example', 'button'));
    case 'think': state.paused = true; return { state, turn: makeTurn(state, [], 'none') };
    case 'ready': state.paused = false; return t([]);
    case 'try_again': state.paused = false; return t([line('Of course. Have another go whenever you are ready.', 'ack'), ...state.lastLines]);
    default: throw new Error(`Unknown control: ${action}`);
  }
}

// What the screen shows: the current step's picture and words (hidden while Memory asks for it, until the visual
// clue), progress, and in Independence mode the whole list once help was asked for.
function stepsUi(state) {
  const S = state.item?.steps;
  if (!S) return null;
  const list = stepsOf(state);
  if (S.phase === 'walk') return { image: null, step: null, list: list.map((x, i) => ({ n: i + 1, text: x.text, image: x.image_id || null })) };
  if (S.phase === 'indep' || (S.phase === 'retell' && !stepsPractice(state))) {
    return { image: curItem(state).image_id || null, step: null, list: S.list && S.phase === 'indep' ? list.map((x, i) => ({ n: i + 1, text: x.text, image: x.image_id || null })) : null };
  }
  if (S.phase === 'retell' || S.phase === 'done' || !list[S.pos]) return { image: null, step: null, list: null };
  // While Buddy is asking about a step, its words and picture stay hidden: seeing them is level 3 support
  // (visual), so it would make the question trivial. They show while the learner is doing the step.
  const show = S.phase === 'q' ? S.visual : (S.said || S.visual);
  const cur = list[S.pos];
  // Learn the steps: visual support is the step's picture only (its words would be the answer), or the words
  // when the step has no picture.
  const text = stepsLearn(state) ? (S.visual && !cur.image_id ? cur.text : null) : (show ? cur.text : null);
  return { image: show ? (cur.image_id || null) : null, step: { n: S.pos + 1, total: list.length, text, visual: !!S.visual }, list: null };
}

function buildStepsRecord(state, it, stopNote) {
  const item = curItem(state);
  const S = it.steps;
  const list = stepsOf(state);
  const skill = stepSkillOf(state.activity);
  const practice = stepsPractice(state);
  const asked = practice && stepsAsk(state);
  const label = (i) => `Step ${i + 1}`;
  const res = list.map((_, i) => S.results[i]);
  const answered = res.filter(Boolean);
  const first = answered.filter((r) => r.firstTry).length;
  const right = answered.filter((r) => r.correct).length;
  const notes = [];
  if (stopNote) notes.push(stopNote);
  const learn = stepsLearn(state);
  notes.push(learn ? `Learn the steps, practising ${STEP_SKILLS[skill].label.toLowerCase()}.` : practice ? `Do it for real, practising ${STEP_SKILLS[skill].label.toLowerCase()}.` : 'Independence mode.');
  const doneSteps = practice && !learn ? Math.min(S.pos, list.length) : null;
  if (practice && !learn && doneSteps < list.length) notes.push(`Did ${doneSteps} of ${list.length} steps.`);
  if (asked && answered.length) notes.push(`${first} of ${answered.length} step questions answered on their own${right !== first ? `; ${right} by the end` : ''}.`);
  const levelOf = (i) => Math.max(-1, ...it.supportGiven.filter((g) => g.el === `s_${i}`).map((g) => g.level));
  const needed = list.map((_, i) => levelOf(i)).map((lv, i) => (lv >= 0 ? `${label(i)}: ${STEP_LEVELS[lv]}` : null)).filter(Boolean);
  if (needed.length) notes.push(`Most support needed: ${needed.join('; ')}.`);
  const saw = Object.keys(S.sawStep).map((i) => label(Number(i)));
  if (saw.length) notes.push(`Looked at the step on screen while doing it: ${saw.join(', ')}.`);
  if (!practice && S.phase !== 'indep') notes.push(S.list ? 'Looked at the steps on screen during the task.' : 'Did the whole task without help.');
  if (S.retell) {
    const got = Object.keys(S.retell.met).length;
    notes.push(`Told ${got} of ${list.length} steps from beginning to end${S.retell.inOrder === false ? ' (not in order)' : S.retell.inOrder === true && got >= 2 ? ', in order' : ''}${S.retell.cued ? ', with a clue' : ''}.`);
  }
  const planGoal = PLAN_GOALS[state.activity.plan_goal] ? state.activity.plan_goal : 'other';
  const code = supportCode(it.supportGiven);
  const complete = !stopNote && S.phase === 'done';
  const visualAids = [];
  if (list.some((x) => x.image_id)) visualAids.push('Pictures');
  if (state.settings.captions) visualAids.push('Captions');
  return {
    plan_goal: planGoal,
    support_code: code,
    success: successFor(planGoal, { complete, code, stopped: !!stopNote }),
    visual_aids: visualAids,
    sam_turns: null,
    score_correct: asked && answered.length ? right : null,
    score_first: asked && answered.length ? first : null,
    score_total: asked && answered.length ? answered.length : null,
    item_label: item.title || 'task',
    goal: state.activity.goal || STEP_SKILLS[skill].goal,
    sam_response: it.responses.filter((r) => !r.done).map((r) => (r.retell ? `[steps] ${r.text}` : r.afterSupport ? `[after support] ${r.text}` : r.text)).join(' / '),
    independent: res.flatMap((r, i) => (r?.firstTry ? [`${label(i)}: "${r.answer}"`] : [])),
    support_provided: it.supportGiven.map((g) => `${g.el === 'retell' ? 'Telling the steps' : g.el === 'task' ? 'During the task' : label(Number(g.el.slice(2)))}, ${STEP_LEVELS[g.level]}: "${g.text}"${g.by === 'sam' ? ' (asked for it)' : ''}`),
    after_support: res.flatMap((r, i) => (r?.correct && !r.firstTry ? [`${label(i)}: "${r.answer}"`] : [])),
    help_requests: it.help.filter((h) => h.kind !== 'repeat').map((h) => `${h.source === 'button' ? 'Pressed' : 'Said'} "${h.text}"`),
    review_note: notes.join(' '),
  };
}

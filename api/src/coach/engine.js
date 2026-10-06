// Coaching engine.
//   Prompt → wait → listen → recognise what Sam supplied → offer ONE relevant cue if needed → allow another attempt.
// Pure state machine: no I/O except the injected `judge`. State is JSON so it can live in Postgres.

import { MODES, LEVELS, TEAM_PHRASE, DEFAULT_CLARIFY_PHRASES, cueLadder, describe, labelFor } from './modes.js';

const DEFAULTS = {
  think_seconds: 8,        // quiet time after "Make a movie in your mind" before the prompt
  fade_support: true,      // start later items at a lighter cue level
  max_attempts: 6,         // per item, then Buddy closes the item kindly
  session_minutes: 15,     // checked only between items — never shown as a timer
  turns_per_topic: 3,      // conversation
  cue_cards: true,
};

const line = (text, kind = 'say', extra = {}) => ({ text, kind, ...extra });
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// ---------------------------------------------------------------- session lifecycle

export function createSession({ activity, settings = {}, learnerName = 'Sam', now = Date.now() }) {
  const items = activity.content?.items || [];
  if (!items.length) throw new Error('This activity has no items yet.');
  const state = {
    v: 1,
    mode: activity.mode,
    activity: { id: activity.id, title: activity.title, goal: activity.goal, content: activity.content },
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
  };
  const lines = openItem(state);
  return { state, turn: makeTurn(state, lines) };
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
  };
  if (state.mode === 'task' && item.unclear_instruction) { st.phase = 'clarify'; st.elements.unshift('clarify'); }
  if (state.mode === 'conversation') st.conv = { validTurns: 0, questionAsked: false, turns: [], noted: {} };
  return st;
}

const curItem = (s) => s.activity.content.items[s.itemIndex];

function openItem(state) {
  state.item = newItemState(state);
  const item = curItem(state);
  const m = MODES[state.mode];
  const think = state.settings.think_seconds;
  const lines = [];
  if (state.mode === 'object') {
    lines.push(line(m.prompt(item), 'prompt'));
  } else if (state.mode === 'story') {
    lines.push(line(TEAM_PHRASE, 'movie', { pauseAfter: think }));
    lines.push(line(m.prompt(item), 'prompt'));
  } else if (state.mode === 'task') {
    lines.push(line("Here's your job.", 'intro'));
    if (state.item.phase === 'clarify') {
      lines.push(line(item.unclear_instruction, 'instruction'));
      lines.push(line(TEAM_PHRASE, 'movie', { pauseAfter: think }));
      lines.push(line('Then tell me the instructions back.', 'prompt'));
    } else {
      lines.push(line(m.instruction(item), 'instruction'));
      lines.push(line(TEAM_PHRASE, 'movie', { pauseAfter: think }));
      lines.push(line(m.prompt(item), 'prompt'));
    }
  } else if (state.mode === 'conversation') {
    lines.push(line(item.opener || `Let's talk about ${item.topic}.`, 'prompt'));
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
  if (!text) {
    return { state, turn: makeTurn(state, [line("I didn't hear anything. Take your time, and press Talk when you're ready.", 'clarify')]) };
  }
  if (input.uncertain && !input.confirmed) return askToConfirm(state, input);
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
  return process_(state, { ...p, confirmed: true }, judge);
}

async function process_(state, { text, displayText, confirmed }, judge) {
  const m = MODES[state.mode];
  const it = state.item;
  const item = curItem(state);

  const conv = it.conv;
  const practiseQ = !!state.activity.content.practise_questions;
  const inviteQuestion = state.mode === 'conversation'
    ? !(practiseQ && !conv.questionAsked && conv.validTurns >= 1) && conv.validTurns + 1 < state.settings.turns_per_topic
    : false;

  const history = state.mode === 'conversation'
    ? [{ who: 'Buddy', text: item.opener }, ...conv.turns.flatMap((t) => [{ who: 'Sam', text: t.text }, ...(t.reply ? [{ who: 'Buddy', text: t.reply }] : [])])]
    : [];

  const judgeElements = state.mode === 'conversation' ? ['turn'] : it.elements.filter((e) => e !== 'order' && e !== 'clarify');
  const j = await judge({ mode: state.mode, item, elements: judgeElements, text, activity: state.activity, history, inviteQuestion });

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
  const newly = absorb(state, j);
  const lines = [];
  if (allMet(state)) return { state, turn: makeTurn(state, completeItem(state, newly)) };

  if (newly.length) lines.push(line(`You ${describe(state.mode, newly, item)}.`, 'feedback'));

  // After a model, one more attempt; if the element is still missing, note it and move to the next one.
  if (it.focus && it.modelGiven[it.focus] && !it.met[it.focus]) it.skipped[it.focus] = true;
  if (allMet(state) || it.attempts >= state.settings.max_attempts) return { state, turn: makeTurn(state, completeItem(state, newly)) };

  const focus = nextMissing(state);
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
  const text = cueLadder(state.mode, state.activity, item, el)[level];
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
  const el = state.mode === 'conversation' ? convFocus(state) : (state.item.phase === 'clarify' ? 'clarify' : nextMissing(state));
  if (!el) return line('You have already done everything for this one.', 'feedback');
  return giveCue(state, el, by);
}

function exampleLine(state, by) {
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
  switch (action) {
    case 'repeat':
      it.help.push({ kind: 'repeat', text: 'Repeat', source: 'button' });
      return { state, turn: makeTurn(state, state.lastLines.map((l) => ({ ...l, pauseAfter: l.pauseAfter }))) };
    case 'hint':
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
      return { state, turn: makeTurn(state, [line('Okay. Have another go whenever you are ready.', 'ack')]) };
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

  if (j.connection && !c.noted.connection) { lines.push(line('You connected it to your own experience.', 'feedback')); c.noted.connection = true; }
  if (j.question && !c.questionAsked) { c.questionAsked = true; if (practiseQ) lines.push(line('You asked me a question.', 'feedback')); }

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
    lines.push(line("Here's the next one.", 'intro'));
    return lines.concat(openItem(state));
  }
  state.done = true;
  lines.push(line(`That's the end of this practice. Thanks for practising with me, ${state.learnerName || 'Sam'}.`, 'closing'));
  return lines;
}

/** Sam pressed Finish (or the app closed the session). Returns any records not yet produced. */
export function finish(state, reason = 'finished') {
  if (!state.done && state.item && (state.item.responses.length || state.item.help.length || state.item.supportGiven.length)) {
    state.completed.push(buildRecord(state, state.item, reason === 'finished' ? 'Sam finished before this item was complete.' : `Practice stopped (${reason}).`));
  }
  state.done = true;
  return { state, records: state.completed };
}

// ---------------------------------------------------------------- practice record (no scores, no diagnoses)

export function buildRecord(state, it, stopNote = null) {
  const m = MODES[state.mode];
  const item = curItem(state);
  const label = (el) => (el.startsWith('turn_') ? 'Comment' : labelFor(state.mode, el));
  const evLabel = (el) => (el.startsWith('turn_') ? 'Turn' : (m.evidenceLabel?.[el] || label(el)));
  const metEls = Object.keys(it.met);

  const independent = metEls.filter((e) => it.met[e].independent).map((e) => `${evLabel(e)}: "${it.met[e].evidence}"`);
  const after = metEls.filter((e) => !it.met[e].independent).map((e) => `${evLabel(e)}: "${it.met[e].evidence}"`);
  const support = it.supportGiven.map((s) => `${cap(LEVELS[s.level])} for ${label(s.el).toLowerCase()}: "${s.text}"${s.by === 'sam' ? ' (Sam asked)' : ''}`);
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
    if (!stopNote && !supported.size && !Object.keys(it.skipped).length && metEls.length) notes.push('All parts given independently.');
  }
  if (help.length) notes.push('Asked for help, which counts as a successful response.');

  return {
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

function makeTurn(state, lines, expect = null) {
  const m = MODES[state.mode];
  const item = curItem(state);
  const it = state.item;
  let cueCard = null;
  if (state.settings.cue_cards) {
    const labels = m.cueCard(item, state.activity);
    const lit = labels.map(() => false);
    for (const el of Object.keys(it?.met || {})) {
      const i = m.cueCardIndex(el);
      if (i != null && i < lit.length) lit[i] = true;
    }
    cueCard = { labels, lit };
  }
  const images = state.mode === 'story' ? (item.image_ids || []) : (item.image_id ? [item.image_id] : []);
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
    },
  };
}

export { DEFAULTS as ENGINE_DEFAULTS };

// Coaching engine.
//   Prompt → wait → listen → recognise what Sam supplied → offer ONE relevant cue if needed → allow another attempt.
// Pure state machine: no I/O except the injected `judge`. State is JSON so it can live in Postgres.

import { MODES, LEVELS, TEAM_PHRASE, DEFAULT_CLARIFY_PHRASES, cueLadder, describe, labelFor } from './modes.js';
import { PLAN_GOALS, supportCode, successFor } from './goals.js';

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

const learnerOf = (state) => ({ name: state.learnerName, age: state.learnerAge, interests: state.learnerInterests || [] });

export function createSession({ activity, settings = {}, learnerName = 'Sam', learnerAge = null, learnerInterests = [], now = Date.now() }) {
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
  const lines = openItem(state);
  return { state, turn: state.mode === 'listen' ? listenTurn(state, lines) : makeTurn(state, lines) };
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
  };
  if (state.mode === 'task' && item.unclear_instruction) { st.phase = 'clarify'; st.elements.unshift('clarify'); }
  if (state.mode === 'conversation') st.conv = { validTurns: 0, questionAsked: false, turns: [], noted: {} };
  if (state.mode === 'listen') st.listen = { phase: 'story', round: 1, queue: [], pos: 0, results: {}, helped: false };
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
    // Optional opening line from the team, e.g. "Let's tell the story of your trip to Ireland."
    if (item.intro) lines.push(line(item.intro, 'intro'));
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
  } else if (state.mode === 'think') {
    if (item.intro) lines.push(line(item.intro, 'intro'));
    lines.push(line("Here's a situation.", 'intro'));
    lines.push(line(item.scenario || '', 'instruction'));
    lines.push(line(TEAM_PHRASE, 'movie', { pauseAfter: think }));
    lines.push(line(m.prompt(item), 'prompt'));
  } else if (state.mode === 'conversation') {
    lines.push(line(item.opener || `Let's talk about ${item.topic}.`, 'prompt'));
  } else if (state.mode === 'listen') {
    return storyLines(state);
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

  if (state.mode === 'listen') return listenAnswer(state, { text, displayText, confirmed }, judge);

  const conv = it.conv;
  const practiseQ = !!state.activity.content.practise_questions;
  const inviteQuestion = state.mode === 'conversation'
    ? !(practiseQ && !conv.questionAsked && conv.validTurns >= 1) && conv.validTurns + 1 < state.settings.turns_per_topic
    : false;

  const history = state.mode === 'conversation'
    ? [{ who: 'Buddy', text: item.opener }, ...conv.turns.flatMap((t) => [{ who: 'Sam', text: t.text }, ...(t.reply ? [{ who: 'Buddy', text: t.reply }] : [])])]
    : [];

  const judgeElements = state.mode === 'conversation' ? ['turn'] : it.elements.filter((e) => e !== 'order' && e !== 'clarify');
  const j = await judge({ mode: state.mode, item, elements: judgeElements, text, activity: state.activity, history, inviteQuestion, learner: learnerOf(state) });

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
  const newly = absorb(state, j);
  const lines = [];
  if (allMet(state)) return { state, turn: makeTurn(state, completeItem(state, newly)) };

  if (newly.length) lines.push(line(`You ${describe(state.mode, newly, item)}.`, 'feedback'));

  // After a model, one more attempt; if the element is still missing, note it and move to the next one.
  if (it.focus && it.modelGiven[it.focus] && !it.met[it.focus]) it.skipped[it.focus] = true;
  if (allMet(state) || it.attempts >= state.settings.max_attempts) return { state, turn: makeTurn(state, completeItem(state, newly)) };

  const focus = nextMissing(state);
  // Think Buddy: "Why…?" and "What if that doesn't work?" are part of the activity, asked once as plain
  // follow-up questions before any cue. They are not counted as support.
  const follow = m.followUps?.[focus];
  if (follow && !it.asked[focus] && it.met.action) {
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
  if (state.mode === 'listen') return listenHelp(state, kind, text, source);
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
  if (state.mode === 'listen') return listenHelp(state, 'need_help', 'Give me a hint', by === 'sam' ? 'button' : 'spoken')[0];
  const el = state.mode === 'conversation' ? convFocus(state) : (state.item.phase === 'clarify' ? 'clarify' : nextMissing(state));
  if (!el) return line('You have already done everything for this one.', 'feedback');
  return giveCue(state, el, by);
}

function exampleLine(state, by) {
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
      if (state.mode === 'listen') return { state, turn: listenTurn(state, [line('Okay. Here is the question again.', 'ack'), ...state.lastLines]) };
      return { state, turn: makeTurn(state, [line('Okay. Have another go whenever you are ready.', 'ack')]) };
    case 'start_questions':
      if (state.mode !== 'listen' || it.listen.phase !== 'story') return { state, turn: makeTurn(state, []) };
      return { state, turn: listenTurn(state, startQuestions(state)) };
    case 'listen_retry':
      if (state.mode !== 'listen' || it.listen.phase !== 'offer') return { state, turn: makeTurn(state, []) };
      return { state, turn: listenTurn(state, retryRound(state)) };
    case 'listen_finish':
      if (state.mode !== 'listen' || it.listen.phase !== 'offer') return { state, turn: makeTurn(state, []) };
      return { state, turn: listenTurn(state, finishListen(state, [line("Okay. Thanks for listening so carefully.", 'feedback')])) };
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
// If any were missed, Buddy offers to read the story again and ask only those (up to MAX_LISTEN_ROUNDS rounds).

const MAX_LISTEN_ROUNDS = 3;
const ACKS = ['Thank you.', 'Okay.', 'Thanks.', 'Got it.'];
const questionsOf = (state) => curItem(state).questions || [];

function listenTurn(state, lines) {
  const ph = state.item.listen.phase;
  return makeTurn(state, lines, ph === 'story' ? 'ready' : ph === 'offer' ? 'choice' : null);
}

function storyLines(state) {
  const item = curItem(state);
  const L = state.item.listen;
  L.phase = 'story';
  const lines = [];
  if (L.round === 1 && item.intro) lines.push(line(item.intro, 'intro'));
  if (L.round === 1) lines.push(line(item.title ? `This story is called: ${item.title}.` : 'Here is a story. Listen carefully.', 'intro'));
  else lines.push(line('Here is the story again. Listen carefully.', 'intro'));
  lines.push(line(item.story || '', 'story'));
  lines.push(line(MODES.listen.prompt(item), 'prompt'));
  state.lastLines = lines;
  return lines;
}

function askLines(state) {
  const L = state.item.listen;
  const qi = L.queue[L.pos];
  const q = questionsOf(state)[qi];
  const lines = [line(`Question ${L.pos + 1} of ${L.queue.length}. ${q.question}`, 'prompt')];
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
  return [line(L.round === 1 ? "Here are the questions. Take your time with each one." : "Let's try the ones you missed.", 'intro'), ...askLines(state)];
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
  const lines = [line(ACKS[(L.pos + L.round) % ACKS.length], 'ack')];
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
  lines.push(line(`You got ${right} out of ${total} right.`, 'feedback'));
  if (L.round >= MAX_LISTEN_ROUNDS) {
    lines.push(line('Thanks for listening so carefully.', 'feedback'));
    return { state, turn: listenTurn(state, finishListen(state, lines)) };
  }
  L.phase = 'offer';
  const offer = line(`Would you like to hear the story again and try the ${missed === 1 ? 'one' : missed} you missed?`, 'prompt');
  lines.push(offer);
  state.lastLines = [offer];
  return { state, turn: listenTurn(state, lines) };
}

function retryRound(state) {
  const it = state.item;
  const L = it.listen;
  L.round += 1;
  it.supportGiven.push({ el: 'story', level: 1, text: 'Heard the story again', by: 'sam' });
  it.anySupport = true;
  return storyLines(state);
}

function listenOfferSpoken(state, text) {
  if (/\b(yes|yeah|yep|ok|okay|sure|please|again|try)\b/i.test(text)) return { state, turn: listenTurn(state, retryRound(state)) };
  if (/\b(no|nope|finish|finished|stop|done)\b/i.test(text)) return { state, turn: listenTurn(state, finishListen(state, [line('Okay. Thanks for listening so carefully.', 'feedback')])) };
  return { state, turn: listenTurn(state, [line('Press Yes to hear the story again, or No to finish.', 'clarify')]) };
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
    state.completed.push(buildRecord(state, state.item, reason === 'finished' ? `${state.learnerName || 'The learner'} finished before this item was complete.` : `Practice stopped (${reason}).`));
  }
  state.done = true;
  return { state, records: state.completed };
}

// ---------------------------------------------------------------- practice record (no scores, no diagnoses)

function buildListenRecord(state, it, stopNote) {
  const item = curItem(state);
  const qs = item.questions || [];
  const L = it.listen;
  const label = (i) => `Q${i + 1} "${qs[i]?.question || ''}"`;
  const res = qs.map((_, i) => L.results[i]);
  const first = res.filter((r) => r?.firstTry).length;
  const right = res.filter((r) => r?.correct).length;
  const independent = res.flatMap((r, i) => (r?.firstTry ? [`${label(i)}: "${r.answer}"`] : []));
  const after = res.flatMap((r, i) => (r?.correct && !r.firstTry ? [`${label(i)}: "${r.answer}"`] : []));
  const wrong = res.flatMap((r, i) => (r && !r.correct ? [`${label(i)}: "${r.answer}" (answer: ${(qs[i].answers || [])[0] || '?'})`] : []));
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
    if (it.unsafe?.length) notes.push(`Suggested something that may not be safe: ${it.unsafe.map((u) => `"${u}"`).join('; ')}.`);
    if (!stopNote && !supported.size && !Object.keys(it.skipped).length && metEls.length) notes.push('All parts given independently.');
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
  if (state.settings.cue_cards) visualAids.push('Cue card');
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

function makeTurn(state, lines, expect = null) {
  const m = MODES[state.mode];
  const item = curItem(state);
  const it = state.item;
  let cueCard = null;
  const labels = state.settings.cue_cards ? m.cueCard(item, state.activity) : null;
  if (labels) {
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
